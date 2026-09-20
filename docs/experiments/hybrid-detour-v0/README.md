# DETOUR — Hybrid Experiment v0

> 打開 App → 做一個動作 → 接下來交給 Detour。

這是新版 Detour 的隔離實驗版。目的不是把舊流程修回來，而是驗證一個更直接的產品核心：使用者不需要先規劃，走出去之後，下一步由 Detour 在路上逐段產生。

## Status

- Branch: experiment/hybrid-detour-v0
- Pull request: #70
- Current state: experimental vertical slice
- Preview: 由 GitHub Actions 自動跑 quality 並發布到 EAS Preview
- This branch is not merged into main.

## Product promise

Detour 會帶你走一條你原本不會走的路。

它不是傳統導航 App，也不要求使用者先決定時間、目的地或玩法。使用者只需要做一個開始動作，之後只處理眼前的一小步。

## Product decisions

### Removed from the new entry flow

- Time selection
- Mood selection
- Pre-trip ticket / boarding pass
- Fixed Scene destination
- Precomputed full route
- Arrival as a required ending
- Countdown, remaining time, and remaining distance

### Preserved as later product capabilities

- Hybrid progressive navigation
- Side Events
- Native iOS camera
- Journey trace
- Photo recap
- Souvenir ticket after the journey

這些功能不是刪除，而是不再阻塞使用者開始走。車票從出發前的邀請函，改成旅程完成後代表這次經歷的票根。

## Target user flow

1. Open the app.
2. Swipe the start control.
3. Immediately enter walking state.
4. Show only the current action, for example 「先往前走。」 or 「下一個路口右轉。」
5. Prepare the next decision in the background.
6. At a decision point, Detour or the user chooses the next direction.
7. Occasionally present a small along-the-way discovery.
8. After an internal chapter, ask whether to continue, end, or return.
9. If the user continues, stay inside Journey and start the next chapter directly.
10. When the user ends, show the trace, photos, recap, and souvenir ticket.

### Journey rules

- The Journey screen does not show a timer.
- The Journey screen does not show remaining distance.
- The Journey screen does not show a destination.
- A chapter is an internal pacing mechanism, not a user KPI.
- The user can always end the walk.
- The app must never ask the user to cross a road, enter a restricted area, or follow an unsafe instruction.

## What this branch currently proves

- A Skia-driven swipe start control.
- Swipe completion that immediately enters the walking screen.
- Foreground location permission and live location watcher.
- Real walking route requests instead of a fake prototype polyline.
- A basic Hybrid direction decision between left, straight, and right.
- A visible Hybrid decision label in the walking state.
- A short chapter with continue or end.
- Session-local trace collection.
- The old God controller, camera, Side Events, ticket, and completion files remain untouched.

## Known limitations of v0

The current direction engine is intentionally small. It selects a direction and routes toward an offset point. It does not yet compare several valid road candidates, guarantee a novel street, or fully integrate off-route rerouting.

The current trace is kept in memory only. The current experimental entry also does not yet include the discovery content, native camera, photo recap, or souvenir ticket. Those are continuation work, not reasons to restore the old pre-trip flow.

## P0 definition for the complete new Detour

Before calling the new product ready for regular outdoor testing, the following must be complete:

1. Entry and permissions: swipe starts the Journey without a waiting screen, and permission failures have a clear exit.
2. Lifecycle reliability: foreground/background transitions, watcher cleanup, interrupted sessions, and recovery do not leave the app stuck or crash.
3. Safe routing: only valid walking routes are accepted; military, defense, restricted, and unsafe destinations are rejected; routing failures never fall back to fake directions.
4. Hybrid decisions: choose between valid candidates at decision points, reduce repeated streets, and preserve the user/system choice rhythm.
5. Rerouting: detect meaningful off-route movement and generate a new next step without showing stale instructions.
6. Along-the-way discovery: add occasional small observations without turning the walk into a checklist, score, or progress dashboard.
7. Native camera: use the iOS-native-quality camera path with consistent preview/output, 1x main lens behavior, focus/exposure interaction, and repeated-capture stability.
8. Trace and ending: allow manual ending at any time, persist the session, and generate the first useful recap.
9. Outdoor validation: test permission denial, weak GPS, network loss, backgrounding, repeated capture, route failure, and continuing across chapters.
10. Preview delivery: quality and Preview publication remain automatic through the existing GitHub Actions workflow.

## Explicitly not P0

These do not block the first new Detour field experiment:

- Final color tuning
- Full map-lighting system
- Account system
- Payments
- Coins, points, rankings, or questionnaires
- Reintroducing Mood as a homepage selector
- Reintroducing a pre-trip ticket
- Full-trip route generation before departure
- A fixed destination or forced Arrival screen

## Technical boundary

The experiment is a separate vertical slice in the same repository.

New entry and experiment files:

- src/app/index.tsx
- src/components/hybrid-detour-experiment.tsx
- src/components/hybrid-swipe-start.tsx
- src/hooks/use-hybrid-detour-controller.ts
- src/lib/hybrid-detour/decision-engine.ts

Reused lower-level infrastructure:

- Location watcher lifecycle
- GPS trace filtering
- Walking route service
- Navigation beat generation
- Geo utilities

The old controller and old physical product flow are retained as rollback/reference material until the new slice proves itself outdoors.

## Testing command and delivery

Quality gate:

    npm run quality

Preview is published from the PR branch by GitHub Actions. The tester should use the installed Detour Preview app and does not need to pull the branch or run Metro manually.

## Definition of success

The experiment succeeds if a first-time user can open Detour, swipe once, begin walking immediately, understand only the current action, notice that Detour is making progressive choices, and end the walk without ever needing to plan a destination first.