# Pocket playtest schema extension

Pocket discovery and route-quality telemetry uses four **additive** nullable fields on `public.playtest_runs`:

- `pocket_discoveries jsonb`
- `discovery_summary jsonb`
- `route_quality jsonb`
- `pocket_swap_count integer`

The repository does not currently contain the Supabase CLI migration history, while the linked project already has remote migrations. Do **not** paste an ad-hoc timestamped SQL file beside the Edge Function and treat it as migration history.

When this change is ready to deploy, create a normal Supabase migration from a checkout that owns the project's migration history:

```sh
supabase migration new add_pocket_playtest_metrics
```

Put this additive SQL in the generated `supabase/migrations/<timestamp>_add_pocket_playtest_metrics.sql` file, reset/test locally, then deploy through the project's normal migration workflow:

```sql
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
```

The Edge Function keeps the existing `sync-run` mode unchanged. `sync-pocket-run` should be deployed only with (or after) this additive schema change if full Pocket metrics need to persist.

Pocket payloads intentionally exclude GPS coordinates, route traces, photos and destination names.
