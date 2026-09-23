import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMissionGrammarCandidates } from "../src/lib/pocket-mission-grammar.ts";
import { validateMissionSet } from "../src/lib/pocket-mission-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, "generated/mission-candidates.json");

const raw = generateMissionGrammarCandidates();
const deduped = [...new Map(raw.map((candidate) => [candidate.title, candidate])).values()];
const report = validateMissionSet(deduped);

const candidates = deduped.map((candidate, index) => ({
  ...candidate,
  validation: report.get(index) ?? [],
}));

const errors = candidates.flatMap((candidate) =>
  candidate.validation.filter((issue) => issue.severity === "error"),
);
const warnings = candidates.flatMap((candidate) =>
  candidate.validation.filter((issue) => issue.severity === "warning"),
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note:
        "Review queue only. These candidates are not imported by the production app.",
      candidateCount: candidates.length,
      errors: errors.length,
      warnings: warnings.length,
      candidates,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(
  `Generated ${candidates.length} deduplicated mission candidates (${errors.length} errors, ${warnings.length} warnings).`,
);
console.log(outputPath);

if (errors.length) process.exitCode = 1;
