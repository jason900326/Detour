# Generated mission candidates

Run:

```sh
npm run missions:generate
```

This writes `mission-candidates.json` into this directory.

The JSON is a **review queue**, not production content. The app never imports it.

The generator combines curated mission grammar templates, deduplicates exact wording, runs the development-time mission validator, and records validation warnings/errors next to each candidate. A candidate only enters `src/lib/pocket-content.ts` after human review.
