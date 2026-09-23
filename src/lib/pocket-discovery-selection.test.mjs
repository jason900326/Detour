import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseDiscoveryDecision,
  compactDiscoverySelectionLog,
  discoveryDifficultyPolicy,
  generateDiscoveryCandidates,
  rankDiscoveryCandidates,
  replayDiscoverySelection,
  scoreDiscoveryCandidate,
} from "./pocket-discovery-selection.ts";

const discovery = (overrides = {}) => ({
  id: "base",
  emoji: "•",
  title: "看一眼。",
  hint: "留在公共空間。",
  difficulty: "easy",
  kind: "feature",
  ...overrides,
});

const context = (overrides = {}) => ({
  environment: "street",
  experienceId: "core",
  elapsedSeconds: 0,
  discoveryIndex: 1,
  phase: "exploration",
  daylight: "day",
  recentlySeenIds: [],
  recentlyFoundIds: [],
  recentDirections: [],
  recentActionTypes: [],
  recentRoles: [],
  quickFindStreak: 0,
  ...overrides,
});

test("first task is easy", () => {
  const policy = discoveryDifficultyPolicy(context(), 0);
  assert.equal(policy.target, "easy");

  const decision = chooseDiscoveryDecision(context(), {
    discoveries: [
      discovery({ id: "easy", difficulty: "easy" }),
      discovery({ id: "hard", difficulty: "hard" }),
    ],
    randomValues: { difficulty: 0, selection: 0 },
    timestamp: 123,
  });
  assert.equal(decision.discovery.difficulty, "easy");
});

test("hard tasks do not repeat consecutively", () => {
  const ctx = context({
    discoveryIndex: 4,
    previousDiscovery: {
      id: "hard-before",
      kind: "detail",
      difficulty: "hard",
      result: "found",
      secondsVisible: 20,
    },
    recentlySeenIds: ["hard-before"],
    recentlyFoundIds: ["hard-before"],
    quickFindStreak: 3,
  });

  const generated = generateDiscoveryCandidates(
    [
      discovery({ id: "easy", difficulty: "easy" }),
      discovery({ id: "medium", difficulty: "medium" }),
      discovery({ id: "hard", difficulty: "hard" }),
    ],
    ctx,
    0,
  );

  assert.equal(generated.difficultyPolicy.hardAllowed, false);
  assert.equal(
    generated.candidates.some((item) => item.difficulty === "hard"),
    false,
  );
});

test("slow previous discovery lowers difficulty", () => {
  const policy = discoveryDifficultyPolicy(
    context({
      discoveryIndex: 3,
      previousDiscovery: {
        id: "slow",
        kind: "feature",
        difficulty: "medium",
        result: "found",
        secondsVisible: 130,
      },
      quickFindStreak: 0,
    }),
    0,
  );

  assert.equal(policy.target, "easy");
  assert.equal(policy.reason, "difficulty-recovery");
});

test("skip triggers recovery behavior", () => {
  const policy = discoveryDifficultyPolicy(
    context({
      discoveryIndex: 3,
      previousDiscovery: {
        id: "skipped",
        kind: "feature",
        difficulty: "medium",
        result: "skipped",
        secondsVisible: 45,
      },
    }),
    0,
  );

  assert.equal(policy.target, "easy");
  assert.equal(policy.reason, "skip-recovery");
  assert.equal(policy.hardAllowed, false);
});

test("two quick finds can open hard difficulty without making it mandatory", () => {
  const ctx = context({
    discoveryIndex: 3,
    previousDiscovery: {
      id: "quick",
      kind: "object",
      difficulty: "medium",
      result: "found",
      secondsVisible: 25,
    },
    quickFindStreak: 2,
  });

  assert.equal(discoveryDifficultyPolicy(ctx, 0.1).target, "hard");
  assert.equal(discoveryDifficultyPolicy(ctx, 0.8).target, "medium");
});

test("recently seen tasks stay on cooldown when fresh alternatives exist", () => {
  const repeated = discovery({ id: "repeat", difficulty: "medium" });
  const fresh = discovery({ id: "fresh", difficulty: "medium" });
  const ctx = context({
    discoveryIndex: 6,
    previousDiscovery: {
      id: "previous",
      kind: "object",
      difficulty: "easy",
      result: "found",
      secondsVisible: 40,
    },
    recentlySeenIds: ["a", "b", "c", "repeat"],
    recentlyFoundIds: [],
  });

  const repeatedScore = scoreDiscoveryCandidate(repeated, ctx, "medium");
  const freshScore = scoreDiscoveryCandidate(fresh, ctx, "medium");

  assert.ok(repeatedScore.recency < 0);
  assert.ok(freshScore.total > repeatedScore.total);

  const generated = generateDiscoveryCandidates([repeated, fresh], ctx, 0.8);
  assert.deepEqual(
    generated.candidates.map((item) => item.id),
    ["fresh"],
  );
});

test("cooldown fails open when every eligible task was recently shown", () => {
  const first = discovery({ id: "first", difficulty: "medium" });
  const second = discovery({ id: "second", difficulty: "medium" });
  const generated = generateDiscoveryCandidates(
    [first, second],
    context({
      discoveryIndex: 8,
      recentlySeenIds: ["first", "second"],
      previousDiscovery: {
        id: "second",
        kind: "feature",
        difficulty: "easy",
        result: "found",
        secondsVisible: 40,
      },
    }),
    0.8,
  );

  assert.equal(generated.candidates.length, 2);
});

test("environment-matching discoveries are preferred in ranking, not hard-filtered", () => {
  const street = discovery({
    id: "street",
    difficulty: "medium",
    environments: ["street"],
  });
  const green = discovery({
    id: "green",
    difficulty: "medium",
    environments: ["green"],
  });
  const ctx = context({
    discoveryIndex: 2,
    previousDiscovery: {
      id: "previous",
      kind: "object",
      difficulty: "easy",
      result: "found",
      secondsVisible: 70,
    },
  });

  const generated = generateDiscoveryCandidates([green, street], ctx, 0.8);
  assert.deepEqual(
    new Set(generated.candidates.map((item) => item.id)),
    new Set(["green", "street"]),
  );

  const ranked = rankDiscoveryCandidates(
    generated.candidates,
    ctx,
    generated.difficultyPolicy.target,
  );
  assert.equal(ranked[0].discovery.id, "street");
  assert.ok(ranked[0].scoreBreakdown.environment > 0);
});

test("themed Experiences filter incompatible content and prefer themed candidates", () => {
  const night = discovery({
    id: "night",
    suitableFor: ["night"],
    availability: { daylight: "night" },
    tags: ["night", "light"],
  });
  const coreOnly = discovery({
    id: "core-only",
    unsuitableFor: ["night"],
  });
  const universal = discovery({ id: "universal" });

  const generated = generateDiscoveryCandidates(
    [night, coreOnly, universal],
    context({
      experienceId: "night",
      daylight: "night",
    }),
    0.8,
  );

  assert.deepEqual(
    generated.candidates.map((item) => item.id),
    ["night"],
  );
});

test("fallback works when the ideal difficulty pool is empty", () => {
  const generated = generateDiscoveryCandidates(
    [
      discovery({ id: "easy-a", difficulty: "easy" }),
      discovery({ id: "easy-b", difficulty: "easy" }),
    ],
    context({
      discoveryIndex: 2,
      previousDiscovery: {
        id: "previous",
        kind: "object",
        difficulty: "easy",
        result: "found",
        secondsVisible: 70,
      },
    }),
    0.8,
  );

  assert.equal(generated.difficultyPolicy.target, "medium");
  assert.equal(generated.fallbackUsed, true);
  assert.equal(generated.candidates.length, 2);
});

test("identical context and random inputs produce identical selection and replay", () => {
  const catalogue = [
    discovery({ id: "a" }),
    discovery({ id: "b" }),
    discovery({ id: "c" }),
  ];
  const ctx = context();

  const first = chooseDiscoveryDecision(ctx, {
    discoveries: catalogue,
    randomValues: { difficulty: 0.2, selection: 0.73 },
    timestamp: 1,
  });
  const second = chooseDiscoveryDecision(ctx, {
    discoveries: catalogue,
    randomValues: { difficulty: 0.2, selection: 0.73 },
    timestamp: 1,
  });

  assert.equal(first.discovery.id, second.discovery.id);
  assert.deepEqual(first.log, second.log);
  assert.equal(replayDiscoverySelection(first.log), first.discovery.id);
});

test("score breakdown total equals the sum of inspectable factors", () => {
  const score = scoreDiscoveryCandidate(
    discovery({
      id: "candidate",
      difficulty: "medium",
      environments: ["street"],
      tags: ["night"],
    }),
    context({
      experienceId: "night",
      daylight: "night",
      discoveryIndex: 2,
      previousDiscovery: {
        id: "previous",
        kind: "object",
        difficulty: "easy",
        result: "found",
        secondsVisible: 50,
      },
      quickFindStreak: 1,
    }),
    "medium",
  );

  const calculated =
    score.base +
    score.environment +
    score.difficulty +
    score.variety +
    score.recency +
    score.performance +
    score.experience +
    score.directionVariety +
    score.actionVariety +
    score.rhythm +
    score.phase;

  assert.equal(score.total, Math.round(calculated * 1000) / 1000);
});

test("small historical samples do not influence ranking", () => {
  const item = discovery({ id: "sampled", difficulty: "medium" });
  const baseContext = context({
    discoveryIndex: 2,
    previousDiscovery: {
      id: "previous",
      kind: "object",
      difficulty: "easy",
      result: "found",
      secondsVisible: 70,
    },
  });
  const withTinySample = {
    ...baseContext,
    performanceById: {
      sampled: {
        shown: 3,
        found: 0,
        skipped: 3,
        medianSeconds: 180,
      },
    },
  };

  assert.equal(
    scoreDiscoveryCandidate(item, baseContext, "medium").performance,
    0,
  );
  assert.equal(
    scoreDiscoveryCandidate(item, withTinySample, "medium").performance,
    0,
  );
});

test("decision logs are privacy-safe and contain no location fields", () => {
  const decision = chooseDiscoveryDecision(context(), {
    discoveries: [discovery({ id: "safe" })],
    randomValues: { difficulty: 0.1, selection: 0.1 },
    timestamp: 99,
  });
  const serialized = JSON.stringify(decision.log).toLowerCase();

  for (const forbidden of [
    "latitude",
    "longitude",
    "coordinate",
    "route",
    "photo",
    "destination",
    "gps",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});


test("compacted upload logs retain the selected candidate even outside the top N", () => {
  const catalogue = Array.from({ length: 10 }, (_, index) =>
    discovery({ id: `item-${index}` }),
  );
  const decision = chooseDiscoveryDecision(context(), {
    discoveries: catalogue,
    randomValues: { difficulty: 0.2, selection: 0.999 },
    timestamp: 7,
  });

  const compact = compactDiscoverySelectionLog(decision.log, 4);

  assert.equal(compact.candidates.length, 4);
  assert.equal(
    compact.candidates.some(
      (candidate) => candidate.id === decision.discovery.id,
    ),
    true,
  );
});


test("repeated observation direction receives a ranking penalty", () => {
  const up = discovery({
    id: "up",
    difficulty: "medium",
    direction: "up",
    actionType: "find_one",
    role: "observation",
  });
  const down = discovery({
    id: "down",
    difficulty: "medium",
    direction: "down",
    actionType: "find_one",
    role: "observation",
  });
  const ctx = context({
    discoveryIndex: 3,
    recentDirections: ["eye_level", "up"],
    recentActionTypes: ["find_one", "find_pattern"],
    recentRoles: ["quick", "observation"],
    previousDiscovery: {
      id: "previous",
      kind: "feature",
      difficulty: "easy",
      result: "found",
      secondsVisible: 50,
    },
  });

  const upScore = scoreDiscoveryCandidate(up, ctx, "medium");
  const downScore = scoreDiscoveryCandidate(down, ctx, "medium");
  assert.ok(upScore.directionVariety < 0);
  assert.ok(downScore.total > upScore.total);
});

test("repeated action type receives a ranking penalty", () => {
  const repeated = discovery({
    id: "repeated-action",
    difficulty: "medium",
    direction: "down",
    actionType: "find_one",
    role: "observation",
  });
  const varied = discovery({
    id: "varied-action",
    difficulty: "medium",
    direction: "down",
    actionType: "compare",
    role: "observation",
  });
  const ctx = context({
    discoveryIndex: 3,
    recentDirections: ["eye_level"],
    recentActionTypes: ["find_one"],
    recentRoles: ["observation"],
    previousDiscovery: {
      id: "previous",
      kind: "feature",
      difficulty: "easy",
      result: "found",
      secondsVisible: 50,
    },
  });

  assert.ok(
    scoreDiscoveryCandidate(repeated, ctx, "medium").actionVariety <
      scoreDiscoveryCandidate(varied, ctx, "medium").actionVariety,
  );
});

test("environment suitability prefers matching missions and penalizes inappropriate ones", () => {
  const preferred = discovery({
    id: "preferred",
    difficulty: "medium",
    environmentSuitability: { preferred: ["street"] },
  });
  const inappropriate = discovery({
    id: "avoid",
    difficulty: "medium",
    environmentSuitability: { inappropriate: ["street"] },
  });
  const ctx = context({
    discoveryIndex: 2,
    previousDiscovery: {
      id: "previous",
      kind: "object",
      difficulty: "easy",
      result: "found",
      secondsVisible: 70,
    },
  });

  const preferredScore = scoreDiscoveryCandidate(preferred, ctx, "medium");
  const inappropriateScore = scoreDiscoveryCandidate(
    inappropriate,
    ctx,
    "medium",
  );
  assert.ok(preferredScore.environment > 0);
  assert.ok(inappropriateScore.environment < 0);
  assert.ok(preferredScore.total > inappropriateScore.total);
});

test("recent rest missions receive a strong frequency penalty", () => {
  const rest = discovery({
    id: "rest",
    difficulty: "medium",
    direction: "stop_and_watch",
    actionType: "rest",
    role: "rhythm_change",
  });
  const normal = discovery({
    id: "normal",
    difficulty: "medium",
    direction: "down",
    actionType: "find_one",
    role: "observation",
  });
  const ctx = context({
    discoveryIndex: 5,
    recentDirections: ["down", "stop_and_watch"],
    recentActionTypes: ["find_one", "rest"],
    recentRoles: ["observation", "rhythm_change"],
    previousDiscovery: {
      id: "previous",
      kind: "feature",
      difficulty: "easy",
      result: "found",
      secondsVisible: 50,
    },
  });

  assert.ok(
    scoreDiscoveryCandidate(rest, ctx, "medium").rhythm <
      scoreDiscoveryCandidate(normal, ctx, "medium").rhythm,
  );
});

test("stop-and-watch missions are not selected consecutively when alternatives exist", () => {
  const stop = discovery({
    id: "stop",
    difficulty: "medium",
    direction: "stop_and_watch",
    actionType: "stop_and_observe",
    role: "rhythm_change",
  });
  const normal = discovery({
    id: "normal",
    difficulty: "medium",
    direction: "down",
    actionType: "find_one",
    role: "observation",
  });
  const generated = generateDiscoveryCandidates(
    [stop, normal],
    context({
      discoveryIndex: 4,
      recentActionTypes: ["find_one", "stop_and_observe"],
      recentDirections: ["down", "stop_and_watch"],
      recentRoles: ["observation", "rhythm_change"],
      previousDiscovery: {
        id: "previous",
        kind: "feature",
        difficulty: "easy",
        result: "found",
        secondsVisible: 50,
      },
    }),
    0.8,
  );

  assert.equal(
    generated.candidates.some(
      (candidate) => candidate.actionType === "stop_and_observe",
    ),
    false,
  );
});

test("closing prefers lightweight rest or viewpoint missions", () => {
  const rest = discovery({
    id: "rest",
    difficulty: "easy",
    direction: "stop_and_watch",
    actionType: "rest",
    role: "rhythm_change",
  });
  const viewpoint = discovery({
    id: "viewpoint",
    difficulty: "easy",
    direction: "distance",
    actionType: "choose_viewpoint",
    role: "rhythm_change",
  });
  const normal = discovery({
    id: "normal",
    difficulty: "easy",
    direction: "eye_level",
    actionType: "find_one",
    role: "quick",
  });
  const ctx = context({
    discoveryIndex: 6,
    phase: "closing",
    recentDirections: ["down", "around"],
    recentActionTypes: ["find_one", "compare"],
    recentRoles: ["observation", "observation"],
  });

  const ranked = rankDiscoveryCandidates(
    [normal, rest, viewpoint],
    ctx,
    "easy",
  );
  assert.ok(
    ["rest", "viewpoint"].includes(ranked[0].discovery.id),
  );
});

test("first mission favors quick, easy, immediately readable content", () => {
  const quick = discovery({
    id: "quick",
    title: "找一個數字。",
    difficulty: "easy",
    direction: "eye_level",
    actionType: "find_one",
    role: "quick",
  });
  const rhythm = discovery({
    id: "rhythm",
    title: "停 30 秒，看人往哪邊走。",
    difficulty: "easy",
    direction: "stop_and_watch",
    actionType: "stop_and_observe",
    role: "rhythm_change",
  });

  const generated = generateDiscoveryCandidates(
    [rhythm, quick],
    context(),
    0.5,
  );
  assert.deepEqual(
    generated.candidates.map((candidate) => candidate.id),
    ["quick"],
  );
});
