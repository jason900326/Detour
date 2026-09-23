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

## Pure engine responsibilities

`src/lib/pocket-engine.ts` owns product rules that should stay testable without React Native or network access:

- discovery catalogue
- difficulty selection
- phase timing
- GPS trace acceptance
- short-empty-journey discard rule

Future discovery/content rules should stay here, or move to a sibling `pocket-discoveries.ts` if the catalogue becomes large enough to make the engine difficult to scan. UI components should never choose discovery difficulty themselves.

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

For each shown discovery, Pocket records only:

- discovery ID
- difficulty and kind
- coarse environment
- shown time
- found / skipped / unresolved result
- seconds visible
- elapsed journey position
- discovery index

Aggregates expose shown/found/skip rates, average/median resolution time, environment performance and journey-position performance.

At finish, only route-quality ratios/counts are added. Raw coordinates are never included in telemetry payloads.

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
