-- Additive, backwards-compatible fields for Pocket V2 playtest telemetry.
-- Raw GPS coordinates, route traces, photos and destination names are never
-- stored in these columns.

alter table public.playtest_runs
  add column if not exists pocket_discoveries jsonb,
  add column if not exists discovery_summary jsonb,
  add column if not exists route_quality jsonb,
  add column if not exists pocket_swap_count integer;

comment on column public.playtest_runs.pocket_discoveries is
  'Privacy-safe Pocket prompt observations: IDs, difficulty, coarse environment, outcome and timing only.';
comment on column public.playtest_runs.discovery_summary is
  'Aggregated prompt performance; contains no raw location data.';
comment on column public.playtest_runs.route_quality is
  'Approximate route-quality ratios and reroute count; contains no coordinates or route trace.';
