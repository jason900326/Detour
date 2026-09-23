export const MISSION_DIRECTIONS = [
  "up",
  "eye_level",
  "down",
  "around",
  "distance",
  "stop_and_watch",
] as const;

export type MissionDirection = (typeof MISSION_DIRECTIONS)[number];

export const MISSION_ACTION_TYPES = [
  "find_one",
  "find_pattern",
  "compare",
  "count",
  "choose_viewpoint",
  "stop_and_observe",
  "rest",
] as const;

export type MissionActionType = (typeof MISSION_ACTION_TYPES)[number];

export const OBSERVATION_CONCEPTS = [
  "color",
  "shape",
  "material",
  "age",
  "repair",
  "addition",
  "repetition",
  "reflection",
  "light",
  "shadow",
  "text",
  "number",
  "movement",
  "flow",
  "height",
  "layer",
  "wear",
  "boundary",
  "opening",
  "seat",
  "greenery",
] as const;

export type ObservationConcept = (typeof OBSERVATION_CONCEPTS)[number];

export const MISSION_ROLES = [
  "quick",
  "observation",
  "rhythm_change",
] as const;

export type MissionRole = (typeof MISSION_ROLES)[number];

export const MISSION_ENVIRONMENTS = [
  "street",
  "commercial",
  "residential",
  "green",
  "plaza",
  "pedestrian",
  "transit",
  "mixed",
] as const;

export type MissionEnvironment = (typeof MISSION_ENVIRONMENTS)[number];

export type MissionEnvironmentSuitability = {
  /** Empty preferred means broadly usable. */
  preferred?: MissionEnvironment[];
  inappropriate?: MissionEnvironment[];
};

export type MissionGrammarMetadata = {
  direction: MissionDirection;
  actionType: MissionActionType;
  concept: ObservationConcept;
  role: MissionRole;
  environmentSuitability: MissionEnvironmentSuitability;
};

export type GeneratedMissionCandidate = MissionGrammarMetadata & {
  title: string;
  hint?: string;
  difficulty: "easy" | "medium" | "hard";
  sourceTemplate: string;
};

type TemplateSpec = {
  sourceTemplate: string;
  direction: MissionDirection;
  actionType: MissionActionType;
  concept: ObservationConcept;
  role: MissionRole;
  difficulty: GeneratedMissionCandidate["difficulty"];
  hint?: string;
  preferredEnvironments?: MissionEnvironment[];
  variants: string[];
};

const TEMPLATE_SPECS: TemplateSpec[] = [
  {
    sourceTemplate: "color-find",
    direction: "eye_level",
    actionType: "find_one",
    concept: "color",
    role: "quick",
    difficulty: "easy",
    variants: [
      "找一個紅色的東西。",
      "找一個藍色的東西。",
      "找一個黃色的東西。",
      "找一個綠色的東西。",
      "找一個黑白相間的東西。",
    ],
  },
  {
    sourceTemplate: "shape-find",
    direction: "around",
    actionType: "find_one",
    concept: "shape",
    role: "quick",
    difficulty: "easy",
    variants: [
      "找一個圓形。",
      "找一個三角形。",
      "找一個長方形。",
      "找一個有弧線的東西。",
    ],
  },
  {
    sourceTemplate: "text-number",
    direction: "eye_level",
    actionType: "find_one",
    concept: "number",
    role: "quick",
    difficulty: "easy",
    variants: [
      "找一個數字。",
      "找一個兩位數。",
      "找一個箭頭。",
      "找一個重複的字。",
    ],
  },
  {
    sourceTemplate: "ground-detail",
    direction: "down",
    actionType: "find_one",
    concept: "repair",
    role: "observation",
    difficulty: "medium",
    hint: "只看安全能走的地方。",
    variants: [
      "找一塊修補過的地面。",
      "找地上的一條線。",
      "找一個排水孔。",
      "找一塊不同材質的地面。",
      "找一個磨損的地面標記。",
    ],
  },
  {
    sourceTemplate: "upper-detail",
    direction: "up",
    actionType: "find_one",
    concept: "opening",
    role: "observation",
    difficulty: "medium",
    variants: [
      "找一扇二樓以上的窗。",
      "找一個掛在頭頂的東西。",
      "找一個高過屋頂的東西。",
      "找一個屋簷下的細節。",
    ],
  },
  {
    sourceTemplate: "repair-addition",
    direction: "eye_level",
    actionType: "find_one",
    concept: "addition",
    role: "observation",
    difficulty: "medium",
    variants: [
      "找一個後來加上的東西。",
      "找一個被修補的地方。",
      "找一個不同顏色的補丁。",
      "找一個外加的小零件。",
    ],
  },
  {
    sourceTemplate: "reflection-light",
    direction: "eye_level",
    actionType: "find_one",
    concept: "reflection",
    role: "observation",
    difficulty: "medium",
    variants: [
      "找一個反光的地方。",
      "找一個能看到倒影的表面。",
      "找一塊被光照亮的表面。",
      "找一道清楚的影子邊界。",
    ],
  },
  {
    sourceTemplate: "pattern-repeat",
    direction: "around",
    actionType: "find_pattern",
    concept: "repetition",
    role: "observation",
    difficulty: "medium",
    variants: [
      "找三個重複的東西。",
      "找一排一樣的形狀。",
      "找兩個一樣顏色的東西。",
      "找三個相同的圖案。",
      "找一組重複的線條。",
    ],
  },
  {
    sourceTemplate: "compare-old-new",
    direction: "around",
    actionType: "compare",
    concept: "age",
    role: "observation",
    difficulty: "medium",
    variants: [
      "找一個新的和一個舊的東西。",
      "找兩種不同材質放在一起。",
      "找一個完整和一個磨損的東西。",
      "找兩個大小差很多的東西。",
    ],
  },
  {
    sourceTemplate: "distance-landmark",
    direction: "distance",
    actionType: "find_one",
    concept: "height",
    role: "observation",
    difficulty: "medium",
    variants: [
      "找遠處最高的東西。",
      "找一個遠處看得到的招牌。",
      "找一個比周圍高很多的東西。",
      "找遠處最明顯的形狀。",
    ],
  },
  {
    sourceTemplate: "viewpoint",
    direction: "distance",
    actionType: "choose_viewpoint",
    concept: "boundary",
    role: "rhythm_change",
    difficulty: "easy",
    hint: "留在安全、不擋路的位置。",
    variants: [
      "找一個能看到兩條路的位置。",
      "找一個能看一小段街景的位置。",
      "找一個視線比較開的地方。",
    ],
  },
  {
    sourceTemplate: "flow-watch",
    direction: "stop_and_watch",
    actionType: "stop_and_observe",
    concept: "flow",
    role: "rhythm_change",
    difficulty: "easy",
    hint: "找安全、不擋路的位置。",
    preferredEnvironments: ["commercial", "plaza", "pedestrian", "transit"],
    variants: [
      "停 30 秒，看人往哪邊走。",
      "停 30 秒，看車從哪邊來。",
      "停 20 秒，看哪邊比較多人。",
    ],
  },
  {
    sourceTemplate: "count-flow",
    direction: "stop_and_watch",
    actionType: "count",
    concept: "movement",
    role: "rhythm_change",
    difficulty: "medium",
    hint: "站在安全的人行空間。",
    preferredEnvironments: ["street", "commercial", "transit"],
    variants: [
      "數 5 台經過的車。",
      "數 5 個經過的移動物。",
      "數 3 個相同方向的移動物。",
    ],
  },
  {
    sourceTemplate: "rest",
    direction: "stop_and_watch",
    actionType: "rest",
    concept: "seat",
    role: "rhythm_change",
    difficulty: "easy",
    hint: "不用特地繞遠。",
    preferredEnvironments: ["green", "plaza", "pedestrian", "transit"],
    variants: [
      "找個可以安全坐一下的地方。",
      "找個不擋路的位置停一下。",
      "找一個可以短暫休息的地方。",
    ],
  },
  {
    sourceTemplate: "greenery",
    direction: "eye_level",
    actionType: "find_one",
    concept: "greenery",
    role: "quick",
    difficulty: "easy",
    preferredEnvironments: ["green", "residential", "mixed"],
    variants: [
      "找一棵樹。",
      "找一盆植物。",
      "找一片落葉。",
      "找一朵花。",
    ],
  },
];

export function generateMissionGrammarCandidates(): GeneratedMissionCandidate[] {
  return TEMPLATE_SPECS.flatMap((template) =>
    template.variants.map((title) => ({
      title,
      hint: template.hint,
      direction: template.direction,
      actionType: template.actionType,
      concept: template.concept,
      role: template.role,
      difficulty: template.difficulty,
      preferredEnvironments: template.preferredEnvironments,
      environmentSuitability: {
        preferred: template.preferredEnvironments,
      },
      sourceTemplate: template.sourceTemplate,
    })),
  );
}
