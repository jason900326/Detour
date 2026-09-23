# Pocket architecture

Pocket V2 is the active Detour product surface. The goal of this architecture is to keep the ten-minute real-world observation loop small, local-first and measurable without turning it into a navigation or progression system.

## Entry and screen composition

`src/app/index.tsx` points directly to `src/components/pocket/pocket-app.tsx`.

`PocketApp` owns only top-level composition:

- screen/back-stack state
- camera, album, map and confirmation overlays
- share capture coordination
- the active `usePocketJourney()` controller
- visibility-gated haptic/audio feedback

Large presentation sections live under `src/components/pocket/screens/`:

- `pocket-home-screen.tsx` — start/recovery/history entry
- `pocket-journey-screen.tsx` — current objective, direction, camera/album affordances
- `pocket-completion-screen.tsx` — immediate completion memory
- `pocket-history-screen.tsx` — ticket archive
- `pocket-detail-screen.tsx` — one saved ticket
- `pocket-share-screen.tsx` — cover choice, preview and export controls
- `pocket-help-screen.tsx` — compact rules and indoor dev entry
- `pocket-screen-header.tsx` — shared header only

No additional global state library is used.

## Journey state ownership

`src/hooks/use-pocket-journey.ts` is the stateful journey controller.

It owns:

- foreground location and heading watchers
- active/history persistence
- cold-launch recovery
- current leg and reroute lifecycle
- discovery found/skip actions
- phase transitions and finishing
- local photo attachment
- best-effort telemetry calls

Analytics failure is intentionally isolated from journey persistence. A telemetry write or sync failure must not change whether a journey can start, continue or finish.

## Content and pure engine responsibilities

`src/lib/pocket-content.ts` owns discovery content and content selection. It contains:

- the discovery catalogue
- content metadata such as tags, weak environment hints, daylight/weather availability and Experience suitability
- the lightweight Experience catalogue
- Experience / availability metadata
- curated discovery catalogue

`src/lib/pocket-discovery-selection.ts` owns the explainable selection pipeline:

- adaptive difficulty policy
- candidate generation
- Experience-aware filtering
- inspectable score breakdowns
- weak environment / recency / historical-performance weighting
- deterministic weighted selection with injectable randomness
- privacy-safe selection logs and replay

`src/lib/pocket-engine.ts` owns Journey rules that should stay testable without React Native or network access:

- Journey state types
- phase timing
- GPS trace acceptance
- short-empty-journey discard rule

UI components never choose discovery difficulty or directly special-case themed content.

### Experience model

Experiences are content lenses over the same Journey engine, not parallel game modes.

The active content catalogue currently contains:

- `core` — implicit default; no user choice is required
- `night` — development-only proof that a themed pool can change observation style without changing routing, ticket, camera, history or sharing

Normal `start()` means `core`. Old saved journeys with no `experienceId` are also interpreted as `core`.

The Night Experience is reachable only from the `__DEV__` help/test section. The production home screen remains an immediate-start surface and does not ask for a mode, duration, mood, party size or theme.

### Adding a future pack

A future curated pack should normally require only:

1. Add an `ExperienceId` and one `DetourExperience` configuration.
2. Add or annotate discoveries with tags / `suitableFor` / optional availability metadata.
3. Add focused selection tests.
4. Expose the Experience through an optional secondary entry only when the product is ready.

Do not fork `usePocketJourney()`, routing, completion, ticket, camera or share flows for a themed pack.

### Existing discovery migration

No storage migration is required for the current content refactor.

- Existing discovery IDs are unchanged.
- New metadata fields are optional.
- The old single `environment` field remains supported as a compatibility shape while new content uses `environments`.
- Existing saved journeys do not have `experienceId`; undefined resolves to `core`.
- Saved `found` / `target` records continue to render because the user-visible discovery fields are unchanged.

If the legacy single-environment compatibility field is removed later, that should be a separate storage/schema migration after active old journeys have aged out or are explicitly normalized.

## Routing

`src/lib/pocket-routing.ts` owns the next short-leg policy around nearby public candidates and delegates actual walking geometry to `routing-engine.ts`.

Policy includes:

- weak environment weighting
- short exploratory leg preference
- immediate U-turn avoidance
- current/recent trace overlap rejection
- rubber-band distance pressure
- closing-stop filtering
- no invented straight-line route fallback

`src/lib/pocket-route-quality.ts` computes approximate post-run metrics from polyline proximity:

- `novelStreetRatio`
- `currentJourneyOverlapRatio`
- `recentJourneyOverlapRatio`
- `backtrackRatio`
- `rerouteCount`

These are deliberately approximate. GPS traces are not treated as authoritative street-segment maps.

## Storage

`src/lib/storage.ts` is the AsyncStorage adapter.

Writes use a pending key before replacing the primary key. `storage-envelope.ts` contains the pure selection/recovery logic so legacy JSON, envelopes and interrupted writes are regression-tested without loading React Native.

Pocket keys remain separate from legacy Passport storage. Legacy Passport entries are still imported intentionally into Pocket history.

## Analytics

Pocket telemetry is split into:

- `pocket-telemetry-core.ts` — pure aggregation
- `pocket-telemetry.ts` — local-first persistence and best-effort sync

For each shown discovery, Pocket records the selection decision together with the outcome lifecycle:

- selected discovery ID
- ranked eligible candidate IDs and score breakdowns
- selection reason / fallback flag / random values
- recent discovery IDs and coarse selection context
- discovery ID
- difficulty and kind
- coarse environment
- Experience ID
- shown time
- found / skipped / unresolved result
- seconds visible
- elapsed journey position
- discovery index
- whether the same discovery has already appeared in that Journey

Aggregates expose shown/found/skip rates, average/median resolution time, environment performance and journey-position performance.

`aggregateDiscoveryQuality()` additionally exposes per-discovery descriptive signals: shown count, found/skip rate, median observation time, environment breakdown and repeat exposure. It intentionally does not rank or auto-remove discoveries. Completion percentage is not treated as the objective; a discovery can be valuable because it creates attention and curiosity rather than because it is instantly easy.

At finish, only route-quality ratios/counts are added. Raw coordinates are never included in telemetry payloads.

Full local selection logs keep the eligible ranked candidate list. Backend sync compacts candidate arrays to the top 8 while retaining the selected discovery. Historical discovery performance can weakly influence future local selection only after a minimum sample size; low completion alone is never treated as proof that content is bad.

The selection pipeline, ranking factors, reproducibility contract and tunable playtest parameters are documented in [DISCOVERY_SELECTION.md](./DISCOVERY_SELECTION.md).

## Network dependencies

Core Pocket currently depends on network access for:

1. `detour-scene` / nearby public map context used by Pocket routing.
2. The walking route service behind `routing-engine.ts`.
3. `detour-playtest` for optional telemetry sync.

The first two can affect routing availability. The third is non-blocking and may fail silently.

Camera, ticket history, photos and the active journey remain local-first.

## Privacy boundaries

Pocket telemetry must not upload:

- GPS coordinates
- route traces
- photos
- destination names

Ticket/photo storage remains on-device. The playtest backend accepts additive Pocket metrics while preserving the legacy `sync-run` payload.

## Legacy dependency audit

### CURRENTLY USED BY POCKET

- `src/app/index.tsx`
- `src/components/pocket/**`
- `src/hooks/use-pocket-journey.ts`
- `src/lib/pocket-engine.ts`
- `src/lib/pocket-content.ts`
- `src/lib/pocket-discovery-selection.ts`
- `src/lib/pocket-routing.ts`
- `src/lib/navigation-engine.ts`
- `src/lib/routing-engine.ts`
- `src/lib/storage.ts` + `storage-envelope.ts`
- `src/lib/pocket-feedback.ts`
- `src/lib/pocket-share.ts`
- `src/lib/pocket-telemetry*.ts`
- `src/lib/pocket-route-quality.ts`
- `src/lib/app-config.ts` / `api-client.ts`

### LEGACY BUT STILL REFERENCED

- `src/lib/app-model.ts` and legacy Passport storage shape: Pocket intentionally imports old saved history.
- `src/lib/playtest-analytics.ts`: Pocket reuses the anonymous tester ID while the older playtest reporting path remains supported.
- Shared routing/scene infrastructure outside the Pocket namespace is still used by Pocket network calls or current tooling/tests.

### SAFE TO REMOVE

None were deleted in this pass. The obvious Expo-starter/dead-asset cleanup had already happened before this branch, and the remaining old V1/V2 controller graph was not proven independent from all current tooling strongly enough to justify destructive deletion here.

### UNCERTAIN / RETIRE AFTER A DEDICATED GRAPH CHECK

These are not imported by the active app entry, but still form the historical V1/V2 implementation and may be useful to tests, tooling or migration work until a repository-wide import graph is reviewed:

- `src/hooks/use-detour-home-controller.ts`
- `src/hooks/use-v2-detour-controller.ts`
- `src/hooks/use-side-event-controller.ts`
- `src/hooks/use-playtest-store.ts`
- `src/hooks/use-passport-store.ts`
- `src/components/detour-home-view.tsx`
- `src/components/v2-detour-screen.tsx`
- `src/components/side-event-paper.tsx`
- `src/components/mood-visuals.tsx`
- `src/components/arrival-completion-stage.tsx`
- legacy home styles

Do not delete this uncertain group opportunistically while changing Pocket behavior. Retire it as a separate cleanup once references from scripts, tests, migration paths and documentation are exhaustively confirmed.


## Validation contract

Before merging Pocket architecture changes, run `npm run lint`, `npm run typecheck` and `npm test`. The repository quality workflow also bundles the iOS app so screen extraction cannot silently introduce a module-resolution failure.


## Monetization boundary

Experience architecture does not imply monetization. Core remains immediate and free in the current product thesis. Product hypotheses, candidate future packs and explicit anti-patterns live in [MONETIZATION_HYPOTHESES.md](./MONETIZATION_HYPOTHESES.md). There is no purchase, subscription, entitlement, currency, energy or premium-badge implementation in Pocket.
