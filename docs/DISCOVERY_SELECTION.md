# Discovery selection

Detour does not generate arbitrary missions at runtime. Discovery content is curated in `src/lib/pocket-content.ts`; selection is a deterministic, inspectable product policy in `src/lib/pocket-discovery-selection.ts`.

The playtest goal is to explain every shown discovery as a lifecycle:

```text
curated catalogue
→ candidate generation
→ transparent ranking
→ weighted deterministic selection
→ shown
→ found / skipped
→ aggregate playtest signals
```

## 1. Candidate generation

`generateDiscoveryCandidates()` receives a `DiscoveryContext` containing only product state needed for selection:

- coarse environment: `street | green | commercial`
- Experience ID
- elapsed Journey seconds
- discovery index
- Journey phase
- day / night and optional future weather context
- previous discovery kind / difficulty / result / seconds visible
- recently seen discovery IDs
- recently found discovery IDs
- quick-find streak
- optional aggregate historical performance

It does **not** receive GPS coordinates, route traces, photos, destination names, user profiles, or sensitive personal data.

Candidate generation applies explicit eligibility rules:

1. Experience / availability compatibility.
2. Day/night and future weather constraints.
3. Adaptive target difficulty.
4. Hard-after-hard prevention.
5. Themed Experience preference when an appropriate themed pool exists.
6. Safe non-hard fallback if the ideal pool is empty.
7. Core fallback if a future small Experience has no eligible content.

Recently shown discoveries are not permanently banned. They stay eligible and receive recency penalties during ranking.

## 2. Ranking factors

Every candidate receives `DiscoveryScoreBreakdown`:

```ts
{
  base,
  environment,
  difficulty,
  variety,
  recency,
  performance,
  experience,
  phase,
  total
}
```

Current factors are product hypotheses, intentionally kept in one pure function.

- **base** — stable starting value.
- **environment** — weakly favors content whose metadata matches the current coarse environment; never treats OSM context as proof an object exists.
- **difficulty** — favors the difficulty selected by the adaptive policy.
- **variety** — slightly discourages repeating the previous low-level discovery kind.
- **recency** — strongly discourages immediate repeats and gradually decays for older exposure; it never permanently removes content.
- **performance** — weak historical signal with a minimum sample threshold.
- **experience** — favors content matching the current themed Experience.
- **directionVariety** — discourages repeatedly looking at the same physical visual zone.
- **actionVariety** — discourages repeating the same mission action.
- **rhythm** — keeps rest / stop / viewpoint missions occasional and rewards appropriate Closing rhythm.
- **phase** — keeps Closing optional targets lightweight.

The score is converted to a positive selection weight. Ranking itself contains no random calls.

## 3. Adaptive difficulty

`discoveryDifficultyPolicy()` is pure.

Current rules:

- First discovery targets **Easy**.
- Closing / optional Closing content targets **Easy**.
- A user skip triggers **skip recovery** and targets Easy.
- A previous search over 100 seconds triggers **difficulty recovery** and targets Easy.
- Hard cannot follow Hard.
- After at least two quick finds, Hard becomes possible with a tunable random probability.
- Otherwise the normal target is Medium.

Skip recovery and Closing are explicit reasons in the selection log, rather than hidden boolean flags.

## 4. Historical performance

The selector can receive aggregate local playtest metrics:

```ts
{
  shown,
  found,
  skipped,
  averageSeconds,
  medianSeconds
}
```

Current safeguards:

- fewer than 8 samples → no ranking influence;
- low found rate alone → no penalty;
- repeated high skip rate combined with very long search time → small negative signal;
- a stable, reasonably timed discovery can receive only a very small positive signal;
- skip recovery may slightly prefer a historically higher-confidence target.

This influence is intentionally much smaller than Experience, difficulty, environment, and recency. Detour is not optimizing for maximum completion rate.

## 5. Decision log

`chooseDiscoveryDecision()` returns both the selected `Discovery` and a privacy-safe `DiscoverySelectionLog`.

The local log records:

- selected discovery ID
- timestamp
- coarse environment / Experience
- elapsed seconds / discovery index / phase
- previous result / timing / difficulty
- recent discovery IDs
- quick-find streak
- all ranked eligible candidates
- each candidate score + score breakdown
- selection reason
- whether fallback was used
- difficulty random value
- final selection random value

It never includes:

- GPS coordinates
- route traces
- photos
- destination names

Local telemetry keeps the full candidate list. Best-effort backend sync compacts it to the top 8 candidates while ensuring the selected candidate is retained.

## 6. Outcome telemetry

The selection log is attached to the same `PocketDiscoveryObservation` that later receives:

- shown timestamp
- found or skipped result
- seconds visible
- discovery index
- difficulty
- kind
- environment
- Experience

This makes the lifecycle analyzable as:

```text
candidates → ranking → selection → shown → outcome
```

Older or interrupted telemetry can still contain an unresolved observation; analytics must not invent a user response when none was recorded.

## 7. Reproducing a selection

Production may use normal `Math.random`, but randomness enters only at the orchestration boundary.

Tests/debugging can supply exact values:

```ts
chooseDiscoveryDecision(context, {
  randomValues: {
    difficulty: 0.2,
    selection: 0.73,
  },
  timestamp: 123,
});
```

Identical catalogue + context + random values produce the same ranked set, selected discovery, and log.

For a stored playtest log, `replayDiscoverySelection(log)` replays the final weighted pick from the recorded candidates and random value without needing any location data.

## 8. Analytics helpers

`pocket-telemetry-core.ts` provides pure reports for questions such as:

- highest skip-rate discoveries
- longest median observation time
- environment-specific differences
- repeated exposure within the last few tasks
- fallback frequency
- skip-recovery → another skip
- Hard after a quick-find streak

These are inspection tools, not automatic content-removal rules.

## 9. Parameters intended for playtest tuning

The following values are deliberately centralized hypotheses:

- quick-find threshold (currently under 60 seconds)
- slow-search recovery threshold (currently over 100 seconds)
- Hard escalation probability
- recent-exposure penalty curve
- environment match weight
- kind-variety weight
- Experience relevance weight
- historical performance minimum sample size
- historical performance maximum influence
- uploaded candidate-list limit

Tune them only after looking at real playtest behavior. Do not optimize one metric—especially completion rate—in isolation.


## Mission grammar layer

Mission wording and sequencing metadata are documented in [MISSION_SYSTEM.md](./MISSION_SYSTEM.md). The selection pipeline treats mission direction, action type, role, and environment suitability as explicit factors rather than inferring them from text.
