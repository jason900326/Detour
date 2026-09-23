# Mission system

Detour missions are curated, short observation prompts. The system is designed so variety comes from a compact grammar and sequencing policy, not from long prompts or runtime AI generation.

## Production rule

A mission should normally be understood in about 1–2 seconds.

Prefer:

> 找一個紅色的東西。

Avoid prompts that require interpretation before the user can act.

Production missions live in `src/lib/pocket-content.ts`. Generated candidates never enter the app automatically.

## Mission grammar

Every current production mission is described across independent dimensions:

### Observation direction

- `up`
- `eye_level`
- `down`
- `around`
- `distance`
- `stop_and_watch`

### Action type

- `find_one`
- `find_pattern`
- `compare`
- `count`
- `choose_viewpoint`
- `stop_and_observe`
- `rest`

### Observation concept

Reusable concepts include color, shape, material, age, repair, addition, repetition, reflection, light, shadow, text, number, movement, flow, height, layer, wear, boundary, opening, seat, and greenery.

### Journey role

- `quick` — high-confidence task that gets the player looking immediately.
- `observation` — core Detour attention task.
- `rhythm_change` — occasional viewpoint, stop, flow, count, or rest task.

### Environment suitability

Missions can declare preferred or inappropriate environments such as street, commercial, residential, green, plaza, pedestrian, transit, or mixed.

Routing currently supplies only a coarse environment signal. Suitability changes probability; it never claims an object definitely exists.

## Sequencing

The explainable selector in `pocket-discovery-selection.ts` adds mission-mix factors to each score:

- repeated observation direction penalty
- repeated action-type penalty
- rhythm-change rarity
- stronger penalty when rest appeared recently
- no consecutive `stop_and_observe` when another eligible mission exists
- first mission prefers `quick`
- Closing can favor lightweight `rest` / `choose_viewpoint`

These remain soft product hypotheses except for the small safety/rhythm eligibility rule preventing consecutive stop missions.

Every factor is part of the normal score breakdown and therefore appears in playtest decision logs.

## Mission lint

`src/lib/pocket-mission-validation.ts` is a development-time review tool.

It flags:

- missing grammar metadata
- long titles / hints
- subjective wording such as 「最療癒」 or 「最有故事」
- unsafe instructions
- private-access / stranger-interaction language
- exact duplicate wording
- unusually location-specific targets
- missing environment suitability

The validator is intentionally conservative and incomplete. Passing lint does not make a mission good; it only removes obvious review work.

Current production content is covered by tests so validation errors fail the normal test suite.

## Candidate generation

Run:

```sh
npm run missions:generate
```

The script combines curated grammar templates from `pocket-mission-grammar.ts`, deduplicates exact wording, runs validation, and writes:

```text
scripts/generated/mission-candidates.json
```

The generated file is a review queue, not production content. It is not imported by the app.

A founder workflow should be:

1. define or refine observation concepts/templates;
2. generate candidates;
3. reject awkward, unsafe, rare, repetitive, or unclear candidates;
4. promote only strong candidates into `DISCOVERIES`;
5. tune sequencing weights using playtest telemetry.

The goal is to make reviewing easier than inventing every mission manually.

## Safety

Missions must remain observable from public, normally walkable space.

Rest / flow missions should use short observation periods (roughly 20–45 seconds during playtests), never require standing in traffic or blocking pedestrian flow, and never require photographing, following, identifying, or judging strangers.

## Non-goals

The mission system does not:

- call an LLM;
- generate arbitrary natural-language prompts at runtime;
- use AI vision for completion;
- require proof photos;
- auto-publish generated candidates;
- optimize solely for completion rate.

The curated pool remains the product. Grammar tooling reduces manual brainstorming work around it.
