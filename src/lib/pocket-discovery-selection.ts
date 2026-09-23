import {
  DISCOVERIES,
  discoveryMatchesExperience,
  effectiveEnvironments,
  filterDiscoveries,
  type Daylight,
  type Difficulty,
  type Discovery,
  type DiscoveryKind,
  type Environment,
  type ExperienceId,
  type Weather,
} from "./pocket-content.ts";
import type {
  MissionActionType,
  MissionDirection,
  MissionRole,
} from "./pocket-mission-grammar.ts";

export type DiscoveryResult = "found" | "skipped";
export type DiscoveryPhase = "exploration" | "closing";

export type DiscoveryPerformance = {
  shown: number;
  found: number;
  skipped: number;
  averageSeconds?: number;
  medianSeconds?: number;
};

export type PreviousDiscoveryContext = {
  id: string;
  kind: DiscoveryKind;
  difficulty: Difficulty;
  result: DiscoveryResult;
  secondsVisible: number;
  direction?: MissionDirection;
  actionType?: MissionActionType;
  role?: MissionRole;
};

export type DiscoveryContext = {
  environment: Environment;
  experienceId: ExperienceId;
  elapsedSeconds: number;
  discoveryIndex: number;
  phase: DiscoveryPhase;
  daylight?: Daylight;
  weather?: Weather;
  previousDiscovery?: PreviousDiscoveryContext;
  recentlySeenIds: string[];
  recentlyFoundIds: string[];
  recentDirections: MissionDirection[];
  recentActionTypes: MissionActionType[];
  recentRoles: MissionRole[];
  quickFindStreak: number;
  /** Optional local playtest aggregate. Small samples intentionally have no effect. */
  performanceById?: Record<string, DiscoveryPerformance>;
  /** Closing optional targets use the same lightweight recovery policy. */
  forceLight?: boolean;
};

export type DiscoverySelectionReason =
  | "normal-selection"
  | "difficulty-recovery"
  | "skip-recovery"
  | "closing-light"
  | "fallback";

export type DiscoveryDifficultyPolicy = {
  target: Difficulty;
  reason: Exclude<DiscoverySelectionReason, "fallback">;
  hardAllowed: boolean;
  difficultyRandomValue: number;
};

export type DiscoveryScoreBreakdown = {
  base: number;
  environment: number;
  difficulty: number;
  variety: number;
  recency: number;
  performance: number;
  experience: number;
  directionVariety: number;
  actionVariety: number;
  rhythm: number;
  phase: number;
  total: number;
};

export type RankedDiscoveryCandidate = {
  discovery: Discovery;
  score: number;
  weight: number;
  scoreBreakdown: DiscoveryScoreBreakdown;
};

export type DiscoveryCandidateSet = {
  candidates: Discovery[];
  difficultyPolicy: DiscoveryDifficultyPolicy;
  fallbackUsed: boolean;
  usedCoreFallback: boolean;
};

export type DiscoverySelectionLogCandidate = {
  id: string;
  score: number;
  weight: number;
  scoreBreakdown: DiscoveryScoreBreakdown;
};

export type DiscoverySelectionLog = {
  selectedDiscoveryId: string;
  timestamp: number;
  context: {
    environment: Environment;
    experienceId: ExperienceId;
    elapsedSeconds: number;
    discoveryIndex: number;
    phase: DiscoveryPhase;
    daylight?: Daylight;
    weather?: Weather;
    previousResult?: DiscoveryResult;
    previousSecondsVisible?: number;
    previousDifficulty?: Difficulty;
    recentlySeenIds: string[];
    recentlyFoundIds: string[];
    recentDirections: MissionDirection[];
    recentActionTypes: MissionActionType[];
    recentRoles: MissionRole[];
    quickFindStreak: number;
  };
  candidates: DiscoverySelectionLogCandidate[];
  reason: DiscoverySelectionReason;
  fallbackUsed: boolean;
  randomValue: number;
  difficultyRandomValue: number;
};

export type DiscoveryDecision = {
  discovery: Discovery;
  rankedCandidates: RankedDiscoveryCandidate[];
  log: DiscoverySelectionLog;
};

const clampRandom = (value: number) =>
  Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0));

const roundScore = (value: number) => Math.round(value * 1000) / 1000;

export function discoveryDifficultyPolicy(
  context: DiscoveryContext,
  difficultyRandomValue = 0.5,
): DiscoveryDifficultyPolicy {
  const randomValue = clampRandom(difficultyRandomValue);
  const previous = context.previousDiscovery;

  if (context.phase === "closing" || context.forceLight) {
    return {
      target: "easy",
      reason: "closing-light",
      hardAllowed: false,
      difficultyRandomValue: randomValue,
    };
  }

  if (!previous || context.discoveryIndex <= 1) {
    return {
      target: "easy",
      reason: "normal-selection",
      hardAllowed: false,
      difficultyRandomValue: randomValue,
    };
  }

  if (previous.result === "skipped") {
    return {
      target: "easy",
      reason: "skip-recovery",
      hardAllowed: false,
      difficultyRandomValue: randomValue,
    };
  }

  if (previous.secondsVisible > 100) {
    return {
      target: "easy",
      reason: "difficulty-recovery",
      hardAllowed: false,
      difficultyRandomValue: randomValue,
    };
  }

  const hardAllowed = previous.difficulty !== "hard";
  if (
    hardAllowed &&
    context.quickFindStreak >= 2 &&
    previous.secondsVisible < 60 &&
    randomValue < 0.4
  ) {
    return {
      target: "hard",
      reason: "normal-selection",
      hardAllowed: true,
      difficultyRandomValue: randomValue,
    };
  }

  return {
    target: "medium",
    reason: "normal-selection",
    hardAllowed,
    difficultyRandomValue: randomValue,
  };
}

function experiencePreferredPool(
  candidates: Discovery[],
  experienceId: ExperienceId,
) {
  if (experienceId === "core") return candidates;
  const themed = candidates.filter((discovery) =>
    discoveryMatchesExperience(discovery, experienceId),
  );
  return themed.length ? themed : candidates;
}

const RECENT_DISCOVERY_COOLDOWN = 12;

function applyMissionMixEligibility(
  candidates: Discovery[],
  context: DiscoveryContext,
) {
  let next = candidates;

  if (context.discoveryIndex <= 1) {
    const quick = next.filter((discovery) => discovery.role === "quick");
    if (quick.length) next = quick;
  }

  const cooldownIds = new Set(
    context.recentlySeenIds.slice(-RECENT_DISCOVERY_COOLDOWN),
  );
  const fresh = next.filter((discovery) => !cooldownIds.has(discovery.id));
  if (fresh.length) next = fresh;

  if (context.recentActionTypes.at(-1) === "stop_and_observe") {
    const nonStop = next.filter(
      (discovery) => discovery.actionType !== "stop_and_observe",
    );
    if (nonStop.length) next = nonStop;
  }

  return next;
}

/**
 * Stage 1: decide which curated discoveries are eligible for this moment.
 *
 * Recency never permanently removes content. Hard-after-hard is the one
 * intentional repetition rule enforced as an eligibility constraint.
 */
export function generateDiscoveryCandidates(
  discoveries: Discovery[],
  context: DiscoveryContext,
  difficultyRandomValue = 0.5,
): DiscoveryCandidateSet {
  const policy = discoveryDifficultyPolicy(context, difficultyRandomValue);
  const availabilityContext = {
    environment: context.environment,
    experienceId: context.experienceId,
    daylight: context.daylight,
    weather: context.weather,
  };

  let available = filterDiscoveries(discoveries, availabilityContext);

  if (!policy.hardAllowed) {
    available = available.filter((discovery) => discovery.difficulty !== "hard");
  }

  let ideal = available.filter(
    (discovery) => discovery.difficulty === policy.target,
  );
  ideal = experiencePreferredPool(ideal, context.experienceId);
  ideal = applyMissionMixEligibility(ideal, context);

  if (ideal.length) {
    return {
      candidates: ideal,
      difficultyPolicy: policy,
      fallbackUsed: false,
      usedCoreFallback: false,
    };
  }

  let fallback = available.filter((discovery) => discovery.difficulty !== "hard");
  fallback = experiencePreferredPool(fallback, context.experienceId);
  fallback = applyMissionMixEligibility(fallback, context);

  if (fallback.length) {
    return {
      candidates: fallback,
      difficultyPolicy: policy,
      fallbackUsed: true,
      usedCoreFallback: false,
    };
  }

  // Small future packs must fail open to safe universal core content rather
  // than returning no task. Availability constraints still apply.
  const coreFallback = filterDiscoveries(discoveries, {
    ...availabilityContext,
    experienceId: "core" as ExperienceId,
  }).filter((discovery) => discovery.difficulty !== "hard");

  if (!coreFallback.length) {
    throw new Error("Discovery catalogue has no eligible fallback content.");
  }

  return {
    candidates: coreFallback,
    difficultyPolicy: policy,
    fallbackUsed: true,
    usedCoreFallback: true,
  };
}

function recencyScore(discovery: Discovery, context: DiscoveryContext) {
  const reversedIndex = [...context.recentlySeenIds]
    .reverse()
    .findIndex((id) => id === discovery.id);

  if (reversedIndex < 0) return 0;
  if (reversedIndex === 0) return -1.2;
  if (reversedIndex <= 2) return -0.75;
  if (reversedIndex <= 4) return -0.4;

  const foundRecently = context.recentlyFoundIds
    .slice(-6)
    .includes(discovery.id);
  return foundRecently ? -0.22 : -0.12;
}

function directionVarietyScore(
  discovery: Discovery,
  context: DiscoveryContext,
) {
  if (!discovery.direction) return 0;
  const recent = context.recentDirections;
  if (recent.at(-1) === discovery.direction) return -0.38;
  if (recent.slice(-3).includes(discovery.direction)) return -0.16;
  return recent.length ? 0.08 : 0;
}

function actionVarietyScore(
  discovery: Discovery,
  context: DiscoveryContext,
) {
  if (!discovery.actionType) return 0;
  const recent = context.recentActionTypes;
  if (recent.at(-1) === discovery.actionType) return -0.32;
  if (recent.slice(-3).includes(discovery.actionType)) return -0.14;
  return recent.length ? 0.06 : 0;
}

function rhythmScore(
  discovery: Discovery,
  context: DiscoveryContext,
) {
  if (discovery.role !== "rhythm_change") return 0.04;

  const recentActions = context.recentActionTypes;
  const recentRoles = context.recentRoles;
  if (
    discovery.actionType === "stop_and_observe" &&
    recentActions.at(-1) === "stop_and_observe"
  )
    return -1.4;
  if (
    discovery.actionType === "rest" &&
    recentActions.slice(-4).includes("rest")
  )
    return -1.05;
  if (recentRoles.slice(-3).includes("rhythm_change")) return -0.72;
  if (context.discoveryIndex <= 2) return -0.7;

  if (
    context.phase === "closing" &&
    (discovery.actionType === "rest" ||
      discovery.actionType === "choose_viewpoint")
  )
    return 0.48;
  if (
    context.phase === "closing" &&
    discovery.actionType === "stop_and_observe"
  )
    return 0.12;

  return -0.18;
}

function historicalPerformanceScore(
  performance: DiscoveryPerformance | undefined,
  context: DiscoveryContext,
) {
  if (!performance || performance.shown < 8) return 0;

  const skipRate = performance.skipped / Math.max(1, performance.shown);
  const foundRate = performance.found / Math.max(1, performance.shown);
  const median = performance.medianSeconds ?? performance.averageSeconds;

  let score = 0;

  // Weak negative signal only when repeated evidence says the task is both
  // often skipped and slow. Low found rate alone is not considered "bad".
  if (skipRate >= 0.65 && (median ?? 0) >= 100) score -= 0.16;
  else if (skipRate >= 0.5 && (median ?? 0) >= 120) score -= 0.09;

  // Skip recovery may slightly favor proven, reasonably quick prompts.
  if (
    context.previousDiscovery?.result === "skipped" &&
    foundRate >= 0.6 &&
    (median ?? 999) >= 15 &&
    (median ?? 999) <= 90
  ) {
    score += 0.08;
  } else if (
    foundRate >= 0.45 &&
    (median ?? 999) >= 20 &&
    (median ?? 999) <= 90
  ) {
    score += 0.03;
  }

  return Math.max(-0.18, Math.min(0.08, score));
}

/**
 * Stage 2: score eligible candidates with inspectable product hypotheses.
 */
export function scoreDiscoveryCandidate(
  discovery: Discovery,
  context: DiscoveryContext,
  targetDifficulty: Difficulty,
): DiscoveryScoreBreakdown {
  const environments = effectiveEnvironments(discovery);
  const previous = context.previousDiscovery;
  const performance = context.performanceById?.[discovery.id];

  const base = 1;
  const suitability = discovery.environmentSuitability;
  const environment =
    suitability?.inappropriate?.includes(context.environment)
      ? -0.62
      : suitability?.preferred?.includes(context.environment)
        ? 0.4
        : environments.length === 0
          ? 0
          : environments.includes(context.environment)
            ? 0.35
            : -0.08;
  const difficulty =
    discovery.difficulty === targetDifficulty
      ? 0.55
      : discovery.difficulty === "hard"
        ? -0.35
        : 0.08;
  const variety = previous
    ? previous.kind === discovery.kind
      ? -0.16
      : 0.16
    : 0;
  const recency = recencyScore(discovery, context);
  const performanceScore = historicalPerformanceScore(performance, context);
  const directionVariety = directionVarietyScore(discovery, context);
  const actionVariety = actionVarietyScore(discovery, context);
  const rhythm = rhythmScore(discovery, context);
  const experience =
    context.experienceId !== "core" &&
    discoveryMatchesExperience(discovery, context.experienceId)
      ? 0.45
      : 0;
  const phase =
    context.phase === "closing" && discovery.difficulty === "easy" ? 0.18 : 0;

  const total = roundScore(
    base +
      environment +
      difficulty +
      variety +
      recency +
      performanceScore +
      experience +
      directionVariety +
      actionVariety +
      rhythm +
      phase,
  );

  return {
    base,
    environment,
    difficulty,
    variety,
    recency,
    performance: performanceScore,
    experience,
    directionVariety,
    actionVariety,
    rhythm,
    phase,
    total,
  };
}

export function rankDiscoveryCandidates(
  candidates: Discovery[],
  context: DiscoveryContext,
  targetDifficulty: Difficulty,
): RankedDiscoveryCandidate[] {
  return candidates
    .map((discovery) => {
      const scoreBreakdown = scoreDiscoveryCandidate(
        discovery,
        context,
        targetDifficulty,
      );
      return {
        discovery,
        score: scoreBreakdown.total,
        weight: Math.max(0.05, scoreBreakdown.total),
        scoreBreakdown,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.discovery.id.localeCompare(b.discovery.id),
    );
}

/**
 * Stage 3: weighted selection over an already-ranked, inspectable set.
 * No random calls occur inside candidate generation or ranking.
 */
export function selectDiscoveryFromRanked(
  ranked: RankedDiscoveryCandidate[],
  randomValue: number,
): RankedDiscoveryCandidate {
  if (!ranked.length) throw new Error("Cannot select from an empty candidate set.");

  const rollValue = clampRandom(randomValue);
  const totalWeight = ranked.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = rollValue * totalWeight;

  for (const candidate of ranked) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }

  return ranked[ranked.length - 1];
}

function publicLogContext(context: DiscoveryContext) {
  return {
    environment: context.environment,
    experienceId: context.experienceId,
    elapsedSeconds: Math.max(0, Math.round(context.elapsedSeconds)),
    discoveryIndex: context.discoveryIndex,
    phase: context.phase,
    daylight: context.daylight,
    weather: context.weather,
    previousResult: context.previousDiscovery?.result,
    previousSecondsVisible: context.previousDiscovery?.secondsVisible,
    previousDifficulty: context.previousDiscovery?.difficulty,
    recentlySeenIds: [...context.recentlySeenIds],
    recentlyFoundIds: [...context.recentlyFoundIds],
    recentDirections: [...context.recentDirections],
    recentActionTypes: [...context.recentActionTypes],
    recentRoles: [...context.recentRoles],
    quickFindStreak: context.quickFindStreak,
  };
}

export function chooseDiscoveryDecision(
  context: DiscoveryContext,
  options?: {
    discoveries?: Discovery[];
    random?: () => number;
    randomValues?: {
      difficulty: number;
      selection: number;
    };
    timestamp?: number;
  },
): DiscoveryDecision {
  const random = options?.random ?? Math.random;
  const difficultyRandomValue = clampRandom(
    options?.randomValues?.difficulty ?? random(),
  );
  const selectionRandomValue = clampRandom(
    options?.randomValues?.selection ?? random(),
  );
  const discoveries = options?.discoveries ?? DISCOVERIES;

  const generated = generateDiscoveryCandidates(
    discoveries,
    context,
    difficultyRandomValue,
  );
  const ranked = rankDiscoveryCandidates(
    generated.candidates,
    context,
    generated.difficultyPolicy.target,
  );
  const selected = selectDiscoveryFromRanked(ranked, selectionRandomValue);

  const reason: DiscoverySelectionReason =
    generated.fallbackUsed &&
    generated.difficultyPolicy.reason === "normal-selection"
      ? "fallback"
      : generated.difficultyPolicy.reason;

  const log: DiscoverySelectionLog = {
    selectedDiscoveryId: selected.discovery.id,
    timestamp: options?.timestamp ?? Date.now(),
    context: publicLogContext(context),
    candidates: ranked.map((candidate) => ({
      id: candidate.discovery.id,
      score: candidate.score,
      weight: candidate.weight,
      scoreBreakdown: candidate.scoreBreakdown,
    })),
    reason,
    fallbackUsed: generated.fallbackUsed,
    randomValue: selectionRandomValue,
    difficultyRandomValue,
  };

  return {
    discovery: selected.discovery,
    rankedCandidates: ranked,
    log,
  };
}

/**
 * Backwards-compatible convenience wrapper for call sites that only need the
 * selected Discovery. New Journey code should use chooseDiscoveryDecision().
 */
export function chooseDiscovery(
  context: DiscoveryContext,
  options?: Parameters<typeof chooseDiscoveryDecision>[1],
) {
  return chooseDiscoveryDecision(context, options).discovery;
}

/**
 * Replays the final weighted choice from a stored privacy-safe log.
 * This is enough to debug "why did candidate X win?" without GPS data.
 */
export function replayDiscoverySelection(log: DiscoverySelectionLog) {
  if (!log.candidates.length) return null;
  const ranked = log.candidates.map((candidate) => ({
    discovery: { id: candidate.id } as Discovery,
    score: candidate.score,
    weight: candidate.weight,
    scoreBreakdown: candidate.scoreBreakdown,
  }));
  return selectDiscoveryFromRanked(ranked, log.randomValue).discovery.id;
}

export function compactDiscoverySelectionLog(
  log: DiscoverySelectionLog,
  limit = 8,
): DiscoverySelectionLog {
  if (log.candidates.length <= limit) return log;

  const selected = log.candidates.find(
    (candidate) => candidate.id === log.selectedDiscoveryId,
  );
  const top = log.candidates.slice(0, limit);
  const candidates =
    selected && !top.some((candidate) => candidate.id === selected.id)
      ? [...top.slice(0, Math.max(0, limit - 1)), selected]
      : top;

  return { ...log, candidates };
}
