create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.scenes (
  id text primary key,
  source text not null,
  source_id text not null,
  osm_type text,
  osm_id bigint,
  kind text not null,
  name text,
  label text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location extensions.geography(POINT, 4326) not null,
  tags jsonb not null default '{}'::jsonb,
  quality_score integer not null default 0,
  active boolean not null default true,
  import_batch text,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists scenes_location_gix
  on public.scenes using gist (location);

create index if not exists scenes_active_kind_idx
  on public.scenes (active, kind);

create index if not exists scenes_source_batch_idx
  on public.scenes (source, import_batch);

alter table public.scenes enable row level security;

create or replace function public.set_scene_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.location := extensions.st_point(new.longitude, new.latitude)::extensions.geography;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_scene_location_before_write on public.scenes;
create trigger set_scene_location_before_write
before insert or update of latitude, longitude on public.scenes
for each row execute function public.set_scene_location();

create or replace function public.nearby_detour_scenes(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer,
  p_family text default 'general',
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
  quality_score integer,
  distance_m double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_point(p_lon, p_lat)::extensions.geography as point
  )
  select
    s.id,
    s.osm_type,
    s.osm_id,
    s.latitude,
    s.longitude,
    s.tags,
    s.kind,
    s.quality_score,
    extensions.st_distance(s.location, o.point) as distance_m
  from public.scenes s
  cross join origin o
  where
    s.active = true
    and extensions.st_dwithin(
      s.location,
      o.point,
      greatest(100, least(coalesce(p_radius_m, 1000), 2500))
    )
    and (
      (
        coalesce(p_family, 'general') = 'food'
        and s.kind in ('food', 'market')
        and coalesce(s.name, '') <> ''
      )
      or (
        coalesce(p_family, 'general') <> 'food'
        and s.kind <> 'food'
      )
    )
  order by
    s.quality_score desc,
    extensions.st_distance(s.location, o.point) asc
  limit greatest(1, least(coalesce(p_limit, 180), 240));
$$;

create or replace function public.finalize_osm_scene_import(p_batch text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if p_batch is null or length(trim(p_batch)) = 0 then
    raise exception 'p_batch is required';
  end if;

  update public.scenes
  set active = false,
      updated_at = now()
  where source = 'osm'
    and active = true
    and import_batch is distinct from p_batch;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on table public.scenes from anon, authenticated;
revoke all on function public.nearby_detour_scenes(double precision, double precision, integer, text, integer) from public, anon, authenticated;
revoke all on function public.finalize_osm_scene_import(text) from public, anon, authenticated;

grant select, insert, update, delete on table public.scenes to service_role;
grant execute on function public.nearby_detour_scenes(double precision, double precision, integer, text, integer) to service_role;
grant execute on function public.finalize_osm_scene_import(text) to service_role;
