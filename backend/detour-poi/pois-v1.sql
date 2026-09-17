create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.pois (
  id text primary key,
  source text not null,
  source_id text not null,
  name text not null,
  brand_name text,
  category text,
  address text,
  locality text,
  region text,
  country_code text not null default 'TW',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location extensions.geography(POINT, 4326) not null,
  confidence real check (confidence is null or confidence between 0 and 1),
  operating_status text,
  aliases text[] not null default '{}',
  search_text text not null,
  active boolean not null default true,
  import_batch text,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pois_source_id_present check (length(source_id) > 0)
);

create index if not exists pois_location_gix
  on public.pois using gist (location);

create index if not exists pois_active_source_batch_idx
  on public.pois (active, source, import_batch);

alter table public.pois enable row level security;

create or replace function public.set_poi_location()
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

drop trigger if exists set_poi_location_before_write on public.pois;
create trigger set_poi_location_before_write
before insert or update of latitude, longitude on public.pois
for each row execute function public.set_poi_location();

create or replace function public.search_detour_pois(
  p_query text,
  p_lat double precision,
  p_lon double precision,
  p_limit integer default 30
)
returns table (
  id text,
  name text,
  brand_name text,
  category text,
  address text,
  locality text,
  region text,
  latitude double precision,
  longitude double precision,
  confidence real,
  distance_m double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      lower(trim(coalesce(p_query, ''))) as query,
      extensions.st_point(p_lon, p_lat)::extensions.geography as origin
  )
  select
    poi.id,
    poi.name,
    poi.brand_name,
    poi.category,
    poi.address,
    poi.locality,
    poi.region,
    poi.latitude,
    poi.longitude,
    poi.confidence,
    extensions.st_distance(poi.location, params.origin) as distance_m
  from public.pois poi
  cross join params
  where
    poi.active = true
    and poi.country_code = 'TW'
    and coalesce(poi.operating_status, 'open') <> 'permanently_closed'
    and length(params.query) between 1 and 100
    and (
      poi.search_text ilike '%' || params.query || '%'
      or poi.search_text ilike '%' || replace(params.query, '台', '臺') || '%'
      or poi.search_text ilike '%' || replace(params.query, '臺', '台') || '%'
    )
  order by
    poi.location operator(extensions.<->) params.origin,
    poi.confidence desc nulls last,
    poi.name
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

create or replace function public.finalize_overture_poi_import(p_batch text)
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

  update public.pois
  set active = false,
      updated_at = now()
  where source = 'overture'
    and active = true
    and import_batch is distinct from p_batch;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on table public.pois from anon, authenticated;
revoke all on function public.set_poi_location() from public, anon, authenticated;
revoke all on function public.search_detour_pois(text, double precision, double precision, integer) from public, anon, authenticated;
revoke all on function public.finalize_overture_poi_import(text) from public, anon, authenticated;

grant select, insert, update, delete on table public.pois to service_role;
grant execute on function public.set_poi_location() to service_role;
grant execute on function public.search_detour_pois(text, double precision, double precision, integer) to service_role;
grant execute on function public.finalize_overture_poi_import(text) to service_role;
