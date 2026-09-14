create table if not exists public.scene_discovery_cache (
  cache_key text primary key,
  query_version integer not null default 1,
  family text not null check (family in ('general', 'food')),
  grid_lat_e3 integer not null,
  grid_lon_e3 integer not null,
  radius_m integer not null check (radius_m between 100 and 5000),
  elements jsonb not null check (jsonb_typeof(elements) = 'array'),
  upstream text not null default 'unknown',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists scene_discovery_cache_neighbor_idx
  on public.scene_discovery_cache (
    family,
    radius_m,
    grid_lat_e3,
    grid_lon_e3,
    stale_until desc
  );

alter table public.scene_discovery_cache enable row level security;
revoke all on table public.scene_discovery_cache from anon, authenticated;
