import {
  MISSION_ACTION_TYPES,
  MISSION_DIRECTIONS,
  MISSION_ENVIRONMENTS,
  MISSION_ROLES,
  OBSERVATION_CONCEPTS,
  type GeneratedMissionCandidate,
  type MissionGrammarMetadata,
} from "./pocket-mission-grammar.ts";

export type MissionValidationSeverity = "warning" | "error";

export type MissionValidationIssue = {
  severity: MissionValidationSeverity;
  code: string;
  message: string;
};

export type MissionValidationInput = Partial<MissionGrammarMetadata> & {
  title?: string;
  hint?: string;
  difficulty?: "easy" | "medium" | "hard";
  sourceTemplate?: string;
};

const SUBJECTIVE_PHRASES = [
  "最美",
  "最療癒",
  "最有故事",
  "最有感覺",
  "最像今天",
  "最特別",
  "最好看",
  "最有靈魂",
  "最有氣氛",
];

const UNSAFE_PHRASES = [
  "穿越馬路",
  "走進車道",
  "站在馬路",
  "闖入",
  "翻牆",
  "攀爬",
  "進入私人",
  "進入私有",
  "跟著陌生人",
  "追陌生人",
  "追人",
  "追車",
  "追動物",
  "拍陌生人",
  "碰電箱",
  "碰號誌",
];

const RARE_TARGET_PHRASES = [
  "消防栓",
  "教堂",
  "噴水池",
  "雕像",
  "電話亭",
];

function chineseLength(value: string) {
  return [...value.trim()].length;
}

export function validateMission(
  mission: MissionValidationInput,
): MissionValidationIssue[] {
  const issues: MissionValidationIssue[] = [];
  const title = mission.title?.trim() ?? "";
  const hint = mission.hint?.trim() ?? "";

  if (!title) {
    issues.push({
      severity: "error",
      code: "missing-title",
      message: "Mission needs a short title.",
    });
  } else {
    const titleLength = chineseLength(title);
    if (titleLength > 24) {
      issues.push({
        severity: "error",
        code: "title-too-long",
        message: `Title is ${titleLength} characters; simplify it.`,
      });
    } else if (titleLength > 14) {
      issues.push({
        severity: "warning",
        code: "title-long",
        message: `Title is ${titleLength} characters; aim for about 12 when possible.`,
      });
    }
  }

  if (hint) {
    const hintLength = chineseLength(hint);
    if (hintLength > 42) {
      issues.push({
        severity: "error",
        code: "hint-too-long",
        message: `Hint is ${hintLength} characters; keep it to one short sentence.`,
      });
    } else if (hintLength > 28) {
      issues.push({
        severity: "warning",
        code: "hint-long",
        message: `Hint is ${hintLength} characters; shorten if possible.`,
      });
    }
  }

  const combined = `${title} ${hint}`;
  for (const phrase of SUBJECTIVE_PHRASES) {
    if (combined.includes(phrase)) {
      issues.push({
        severity: "warning",
        code: "subjective-language",
        message: `Review subjective phrase: ${phrase}`,
      });
    }
  }
  for (const phrase of UNSAFE_PHRASES) {
    if (combined.includes(phrase)) {
      issues.push({
        severity: "error",
        code: "unsafe-language",
        message: `Unsafe mission phrase: ${phrase}`,
      });
    }
  }
  for (const phrase of RARE_TARGET_PHRASES) {
    if (title.includes(phrase)) {
      issues.push({
        severity: "warning",
        code: "rare-target",
        message: `Target may be too location-specific: ${phrase}`,
      });
    }
  }

  if (!mission.direction || !MISSION_DIRECTIONS.includes(mission.direction)) {
    issues.push({
      severity: "error",
      code: "missing-direction",
      message: "Mission needs a valid observation direction.",
    });
  }
  if (
    !mission.actionType ||
    !MISSION_ACTION_TYPES.includes(mission.actionType)
  ) {
    issues.push({
      severity: "error",
      code: "missing-action-type",
      message: "Mission needs a valid action type.",
    });
  }
  if (!mission.concept || !OBSERVATION_CONCEPTS.includes(mission.concept)) {
    issues.push({
      severity: "error",
      code: "missing-concept",
      message: "Mission needs a valid observation concept.",
    });
  }
  if (!mission.role || !MISSION_ROLES.includes(mission.role)) {
    issues.push({
      severity: "error",
      code: "missing-role",
      message: "Mission needs a journey role.",
    });
  }
  if (!mission.difficulty) {
    issues.push({
      severity: "error",
      code: "missing-difficulty",
      message: "Mission needs a difficulty.",
    });
  }
  if (!mission.environmentSuitability) {
    issues.push({
      severity: "warning",
      code: "missing-environment-suitability",
      message: "Mission should declare environment suitability, even if universal.",
    });
  } else {
    for (const environment of [
      ...(mission.environmentSuitability.preferred ?? []),
      ...(mission.environmentSuitability.inappropriate ?? []),
    ]) {
      if (!MISSION_ENVIRONMENTS.includes(environment)) {
        issues.push({
          severity: "error",
          code: "invalid-environment",
          message: `Unknown mission environment: ${environment}`,
        });
      }
    }
  }

  return issues;
}

export function validateMissionSet(
  missions: MissionValidationInput[],
): Map<number, MissionValidationIssue[]> {
  const duplicateTitles = new Map<string, number[]>();
  missions.forEach((mission, index) => {
    const title = mission.title?.trim();
    if (!title) return;
    const indexes = duplicateTitles.get(title) ?? [];
    indexes.push(index);
    duplicateTitles.set(title, indexes);
  });

  const results = new Map<number, MissionValidationIssue[]>();
  missions.forEach((mission, index) => {
    const issues = validateMission(mission);
    const title = mission.title?.trim();
    if (title && (duplicateTitles.get(title)?.length ?? 0) > 1) {
      issues.push({
        severity: "warning",
        code: "duplicate-wording",
        message: "Duplicate mission wording needs review.",
      });
    }
    results.set(index, issues);
  });
  return results;
}

export function validGeneratedCandidates(
  candidates: GeneratedMissionCandidate[],
) {
  const report = validateMissionSet(candidates);
  return candidates.filter((_, index) =>
    (report.get(index) ?? []).every((issue) => issue.severity !== "error"),
  );
}
