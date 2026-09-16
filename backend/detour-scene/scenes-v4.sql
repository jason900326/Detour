-- Scene V2 data layer.
--
-- Apply this before running the V2 Taiwan import. The migration is additive:
-- existing Scene rows stay queryable, while the next import backfills every
-- precomputed score and trait with scoring_version = 2.

alter table public.scenes
  add column if not exists scene_family text not null default 'detour',
  add column if not exists oddity_score smallint not null default 0,
  add column if not exists visual_score smallint not null default 0,
  add column if not exists food_commitment_score smallint,
  add column if not exists traits text[] not null default '{}'::text[],
  add column if not exists scoring_version smallint not null default 1;

update public.scenes
set scene_family = case
  when kind in ('food', 'market') then 'food'
  else 'detour'
end
where scene_family is distinct from case
  when kind in ('food', 'market') then 'food'
  else 'detour'
end;

-- OSM community_centre includes neighbourhood offices, resident associations
-- and temporary campaign headquarters.  These are civic facilities rather
-- than intentional Detour destinations; the V2 importer rejects them too.
update public.scenes
set active = false
where active = true
  and source = 'osm'
  and scene_family = 'detour'
  and kind = 'culture'
  and tags->>'amenity' = 'community_centre';

do $$
begin
  alter table public.scenes
    add constraint scenes_scene_family_check
    check (scene_family in ('detour', 'food'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.scenes
    add constraint scenes_oddity_score_check
    check (oddity_score between 0 and 100);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.scenes
    add constraint scenes_visual_score_check
    check (visual_score between 0 and 100);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.scenes
    add constraint scenes_food_commitment_score_check
    check (
      food_commitment_score is null
      or food_commitment_score between 0 and 100
    );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.scenes
    add constraint scenes_scoring_version_check
    check (scoring_version > 0);
exception
  when duplicate_object then null;
end
$$;

create index if not exists scenes_active_family_rank_idx
  on public.scenes (
    scene_family,
    quality_score desc,
    oddity_score desc,
    visual_score desc
  )
  where active = true;

drop function if exists public.nearby_detour_scenes(
  double precision,
  double precision,
  integer,
  text,
  integer
);

create function public.nearby_detour_scenes(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer,
  p_family text default 'detour',
  p_limit integer default 180
)
returns table (
  id text,
  osm_type text,
  osm_id bigint,
  latitude double precision,
  longitude double precision,
  tags jsonb,
  kind text,
  scene_family text,
  quality_score integer,
  oddity_score integer,
  visual_score integer,
  food_commitment_score integer,
  traits text[],
  scoring_version integer,
  distance_m double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_point(p_lon, p_lat)::extensions.geography as point
  ),
  eligible as (
    select
      s.*,
      extensions.st_distance(s.location, o.point) as distance_m,
      (
        coalesce(s.name, '') <> ''
        or coalesce(s.tags->>'image', '') <> ''
        or coalesce(s.tags->>'wikimedia_commons', '') <> ''
        or coalesce(s.tags->>'wikipedia', '') <> ''
        or coalesce(s.tags->>'wikidata', '') <> ''
        or coalesce(s.tags->>'artist_name', '') <> ''
        or coalesce(s.tags->>'description', '') <> ''
        or coalesce(s.tags->>'inscription', '') <> ''
        or coalesce(s.tags->>'heritage', '') <> ''
      ) as strong_identity
    from public.scenes s
    cross join origin o
    where
      s.active = true
      and s.scene_family = case
        when coalesce(p_family, 'detour') = 'food' then 'food'
        else 'detour'
      end
      and (
        s.scene_family <> 'food'
        or coalesce(s.name, '') <> ''
      )
      and extensions.st_dwithin(
        s.location,
        o.point,
        greatest(100, least(coalesce(p_radius_m, 1000), 2500))
      )
  ),
  scored as (
    select
      e.*,
      case
        when e.scene_family = 'food' then 0
        when e.kind in ('steps', 'footbridge', 'pedestrian')
          and not e.strong_identity then 1
        when e.kind = 'historic'
          and not e.strong_identity then 1
        when e.kind in ('mural', 'street-art', 'artwork', 'statue')
          then case when e.quality_score >= 30 then 0 else 1 end
        when e.kind in ('culture', 'public-bookcase', 'heritage-tree')
          then case when e.quality_score >= 26 then 0 else 1 end
        when e.kind = 'green-space' then 1
        when e.quality_score >= 24 then 0
        else 1
      end as tier_rank,
      case
        when e.scene_family = 'food'
          then (
            e.quality_score * 0.65
            + coalesce(e.food_commitment_score, 0) * 0.35
          )
        else (
          e.quality_score * 0.35
          + e.oddity_score * 0.45
          + e.visual_score * 0.20
        )
      end as rank_score
    from eligible e
  ),
  balanced as (
    select
      s.*,
      row_number() over (
        partition by s.kind
        order by
          s.tier_rank asc,
          s.rank_score desc,
          s.distance_m asc
      ) as kind_rank
    from scored s
  )
  select
    b.id,
    b.osm_type,
    b.osm_id,
    b.latitude,
    b.longitude,
    b.tags,
    b.kind,
    b.scene_family,
    b.quality_score,
    b.oddity_score::integer,
    b.visual_score::integer,
    b.food_commitment_score::integer,
    b.traits,
    b.scoring_version::integer,
    b.distance_m
  from balanced b
  where
    b.scene_family = 'food'
    or b.kind_rank <= 40
  order by
    b.tier_rank asc,
    b.rank_score desc,
    b.distance_m asc
  limit greatest(1, least(coalesce(p_limit, 180), 240));
$$;

revoke all on function public.nearby_detour_scenes(
  double precision,
  double precision,
  integer,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.nearby_detour_scenes(
  double precision,
  double precision,
  integer,
  text,
  integer
) to service_role;
