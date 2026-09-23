import test from "node:test";
import assert from "node:assert/strict";
import { DISCOVERIES } from "./pocket-content.ts";
import { generateMissionGrammarCandidates } from "./pocket-mission-grammar.ts";
import {
  validateMission,
  validateMissionSet,
} from "./pocket-mission-validation.ts";

const mission = (overrides = {}) => ({
  title: "找一個圓形。",
  hint: "大小都算。",
  difficulty: "easy",
  direction: "around",
  actionType: "find_one",
  concept: "shape",
  role: "quick",
  environmentSuitability: {},
  ...overrides,
});

test("subjective missions are flagged for review", () => {
  const issues = validateMission(
    mission({ title: "找一個最療癒的地方。" }),
  );
  assert.ok(
    issues.some((issue) => issue.code === "subjective-language"),
  );
});

test("overly long prompts are flagged", () => {
  const issues = validateMission(
    mission({
      title:
        "在你附近找一個能代表今天城市氣氛而且帶有鮮明紅色色彩的物件。",
    }),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "title-too-long" || issue.code === "title-long",
    ),
  );
});

test("unsafe missions are rejected", () => {
  const issues = validateMission(
    mission({ title: "跟著陌生人走一段路。" }),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "unsafe-language" &&
        issue.severity === "error",
    ),
  );
});

test("production mission pool contains required grammar metadata and no validation errors", () => {
  const report = validateMissionSet(DISCOVERIES);
  const errors = [...report.values()].flat().filter(
    (issue) => issue.severity === "error",
  );
  assert.deepEqual(errors, []);
});

test("grammar tooling generates a large deduplicated review pool", () => {
  const generated = generateMissionGrammarCandidates();
  assert.ok(generated.length >= 80);
  assert.equal(
    new Set(generated.map((candidate) => candidate.title)).size,
    generated.length,
  );

  const report = validateMissionSet(generated);
  const errors = [...report.values()].flat().filter(
    (issue) => issue.severity === "error",
  );
  assert.deepEqual(errors, []);
});
