import type {
  MissionActionType,
  MissionDirection,
  MissionEnvironmentSuitability,
  MissionRole,
  ObservationConcept,
} from "./pocket-mission-grammar.ts";

export type Difficulty = "easy" | "medium" | "hard";
export type Environment = "street" | "green" | "commercial";
export type DiscoveryKind = "object" | "feature" | "detail";
export type Daylight = "day" | "night" | "any";
export type Weather = "dry" | "rain" | "any";
export type ExperienceId = "core" | "night";

export type Discovery = {
  id: string;
  emoji: string;
  title: string;
  hint?: string;
  difficulty: Difficulty;
  kind: DiscoveryKind;

  /**
   * Mission grammar metadata is optional only for old persisted Journey data.
   * Every current production discovery is linted to provide these fields.
   */
  direction?: MissionDirection;
  actionType?: MissionActionType;
  concept?: ObservationConcept;
  role?: MissionRole;
  environmentSuitability?: MissionEnvironmentSuitability;

  /** Legacy/coarse routing hint kept for old stored journeys and telemetry. */
  environments?: Environment[];
  environment?: Environment;
  tags?: string[];
  suitableFor?: ExperienceId[];
  unsuitableFor?: ExperienceId[];
  availability?: {
    daylight?: Daylight;
    weather?: Weather;
  };
};

export type DetourExperience = {
  id: ExperienceId;
  title: string;
  description: string;
  contentTags: string[];
  availability?: {
    daylight?: Exclude<Daylight, "any">;
    weather?: Exclude<Weather, "any">;
  };
  developmentOnly?: boolean;
};

export type DiscoverySelectionContext = {
  environment?: Environment;
  experienceId?: ExperienceId;
  daylight?: Daylight;
  weather?: Weather;
};

export const EXPERIENCES: Record<ExperienceId, DetourExperience> = {
  core: {
    id: "core",
    title: "Detour",
    description: "注意平常容易略過的城市細節。",
    contentTags: [],
  },
  night: {
    id: "night",
    title: "Night Detour",
    description: "用光、影子、反射和色彩重新看夜裡的街道。",
    contentTags: ["night", "light", "reflection", "shadow", "contrast"],
    availability: { daylight: "night" },
    developmentOnly: true,
  },
};

const universal = {};

export const DISCOVERIES: Discovery[] = [
  {
    id: "door",
    emoji: "🚪",
    title: "找一扇門。",
    hint: "看看平常會直接走過的入口。",
    difficulty: "easy",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "opening",
    role: "quick",
    environmentSuitability: universal,
    tags: ["entrance", "architecture"],
  },
  {
    id: "tree",
    emoji: "🌳",
    title: "找一棵樹。",
    hint: "從公共步道看就好。",
    difficulty: "easy",
    kind: "object",
    direction: "up",
    actionType: "find_one",
    concept: "greenery",
    role: "quick",
    environmentSuitability: { preferred: ["green", "residential", "mixed"] },
    tags: ["nature", "shape"],
  },
  {
    id: "number",
    emoji: "🔢",
    title: "找一個數字。",
    hint: "門牌、招牌或地面標記都算。",
    difficulty: "easy",
    kind: "feature",
    direction: "eye_level",
    actionType: "find_one",
    concept: "number",
    role: "quick",
    environmentSuitability: universal,
    tags: ["text", "signage"],
  },
  {
    id: "circle",
    emoji: "🟠",
    title: "找一個圓形。",
    hint: "大小都算。",
    difficulty: "easy",
    kind: "feature",
    direction: "around",
    actionType: "find_one",
    concept: "shape",
    role: "quick",
    environmentSuitability: universal,
    tags: ["shape"],
  },
  {
    id: "car",
    emoji: "🚗",
    title: "找一台車。",
    hint: "留在人行空間觀察。",
    difficulty: "easy",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "movement",
    role: "quick",
    environmentSuitability: {
      preferred: ["street", "commercial", "mixed"],
      inappropriate: ["green"],
    },
    tags: ["street-object"],
  },
  {
    id: "bike",
    emoji: "🚲",
    title: "找一台腳踏車。",
    hint: "停著的也算。",
    difficulty: "easy",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "movement",
    role: "quick",
    environmentSuitability: {
      preferred: ["street", "residential", "mixed"],
    },
    tags: ["street-object"],
  },
  {
    id: "ground-line",
    emoji: "➖",
    title: "找地上的一條線。",
    hint: "只看安全能走的地方。",
    difficulty: "easy",
    kind: "feature",
    direction: "down",
    actionType: "find_one",
    concept: "boundary",
    role: "quick",
    environmentSuitability: universal,
    tags: ["ground", "line"],
  },
  {
    id: "arrow",
    emoji: "➡️",
    title: "找一個箭頭。",
    hint: "地面、招牌或牆面都可以。",
    difficulty: "easy",
    kind: "feature",
    direction: "around",
    actionType: "find_one",
    concept: "text",
    role: "quick",
    environmentSuitability: universal,
    tags: ["text", "signage"],
  },
  {
    id: "plant",
    emoji: "🪴",
    title: "找一盆植物。",
    hint: "只從公共空間看。",
    difficulty: "medium",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "greenery",
    role: "observation",
    environmentSuitability: {
      preferred: ["residential", "green", "mixed"],
    },
    tags: ["nature"],
  },
  {
    id: "reflection",
    emoji: "🪞",
    title: "找一個反光的地方。",
    hint: "玻璃、金屬或水面都算。",
    difficulty: "medium",
    kind: "feature",
    direction: "eye_level",
    actionType: "find_one",
    concept: "reflection",
    role: "observation",
    environmentSuitability: universal,
    tags: ["reflection", "light", "surface"],
  },
  {
    id: "red",
    emoji: "🔴",
    title: "找一個紅色的東西。",
    hint: "讓它從周圍跳出來。",
    difficulty: "medium",
    kind: "feature",
    direction: "around",
    actionType: "find_one",
    concept: "color",
    role: "observation",
    environmentSuitability: universal,
    tags: ["color", "contrast"],
  },
  {
    id: "repair",
    emoji: "🩹",
    title: "找一個被修補的地方。",
    hint: "看看地面、牆面或招牌。",
    difficulty: "medium",
    kind: "detail",
    direction: "eye_level",
    actionType: "find_one",
    concept: "repair",
    role: "observation",
    environmentSuitability: universal,
    tags: ["repair", "texture", "architecture"],
  },
  {
    id: "patched-ground",
    emoji: "🩹",
    title: "找一塊修補過的地面。",
    hint: "只看安全能走的地方。",
    difficulty: "medium",
    kind: "detail",
    direction: "down",
    actionType: "find_one",
    concept: "repair",
    role: "observation",
    environmentSuitability: universal,
    tags: ["repair", "ground"],
  },
  {
    id: "drain",
    emoji: "▦",
    title: "找一個排水孔。",
    hint: "不用走近車道。",
    difficulty: "medium",
    kind: "object",
    direction: "down",
    actionType: "find_one",
    concept: "material",
    role: "observation",
    environmentSuitability: {
      preferred: ["street", "residential", "mixed"],
    },
    tags: ["ground", "infrastructure"],
  },
  {
    id: "layers",
    emoji: "📜",
    title: "找一處重疊的貼紙。",
    hint: "看看露出的邊角。",
    difficulty: "medium",
    kind: "detail",
    direction: "eye_level",
    actionType: "find_one",
    concept: "layer",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "transit", "mixed"],
    },
    tags: ["layering", "signage", "texture"],
  },
  {
    id: "triangle",
    emoji: "🔺",
    title: "找一個三角形。",
    hint: "標誌或結構都算。",
    difficulty: "medium",
    kind: "feature",
    direction: "around",
    actionType: "find_one",
    concept: "shape",
    role: "observation",
    environmentSuitability: universal,
    tags: ["shape"],
  },
  {
    id: "added",
    emoji: "🔧",
    title: "找一個後來加上的東西。",
    hint: "看看掛鉤、管線或小零件。",
    difficulty: "medium",
    kind: "detail",
    direction: "eye_level",
    actionType: "find_one",
    concept: "addition",
    role: "observation",
    environmentSuitability: universal,
    tags: ["repair", "architecture", "added"],
  },
  {
    id: "flower",
    emoji: "🌼",
    title: "找一朵花。",
    hint: "不需要走進花圃。",
    difficulty: "medium",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "greenery",
    role: "observation",
    environmentSuitability: {
      preferred: ["green", "residential", "mixed"],
    },
    tags: ["nature", "color"],
  },
  {
    id: "upstairs-window",
    emoji: "🪟",
    title: "找一扇二樓以上的窗。",
    hint: "抬頭看一下建築。",
    difficulty: "medium",
    kind: "object",
    direction: "up",
    actionType: "find_one",
    concept: "opening",
    role: "observation",
    environmentSuitability: {
      preferred: ["street", "commercial", "residential", "mixed"],
    },
    tags: ["architecture", "opening"],
  },
  {
    id: "overhead",
    emoji: "⬆️",
    title: "找一個掛在頭頂的東西。",
    hint: "不用離開正常步行空間。",
    difficulty: "medium",
    kind: "detail",
    direction: "up",
    actionType: "find_one",
    concept: "addition",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "street", "mixed"],
    },
    tags: ["height", "detail"],
  },
  {
    id: "repeated-shapes",
    emoji: "◯",
    title: "找三個重複的形狀。",
    hint: "同一排或不同地方都算。",
    difficulty: "medium",
    kind: "feature",
    direction: "around",
    actionType: "find_pattern",
    concept: "repetition",
    role: "observation",
    environmentSuitability: universal,
    tags: ["pattern", "shape"],
  },
  {
    id: "same-color-pair",
    emoji: "🎨",
    title: "找兩個一樣顏色的東西。",
    hint: "不用是同一種物件。",
    difficulty: "medium",
    kind: "feature",
    direction: "around",
    actionType: "find_pattern",
    concept: "color",
    role: "observation",
    environmentSuitability: universal,
    tags: ["color", "repetition"],
  },
  {
    id: "old-new",
    emoji: "↔️",
    title: "找一個新的和一個舊的東西。",
    hint: "讓它們出現在同一個視線裡。",
    difficulty: "medium",
    kind: "detail",
    direction: "around",
    actionType: "compare",
    concept: "age",
    role: "observation",
    environmentSuitability: universal,
    tags: ["age", "compare"],
  },
  {
    id: "material-pair",
    emoji: "◫",
    title: "找兩種不同材質。",
    hint: "例如金屬和磁磚。",
    difficulty: "medium",
    kind: "detail",
    direction: "around",
    actionType: "compare",
    concept: "material",
    role: "observation",
    environmentSuitability: universal,
    tags: ["material", "compare"],
  },
  {
    id: "distant-tall",
    emoji: "🏙️",
    title: "找遠處最高的東西。",
    hint: "站在原本能安全走的位置看。",
    difficulty: "medium",
    kind: "feature",
    direction: "distance",
    actionType: "find_one",
    concept: "height",
    role: "observation",
    environmentSuitability: universal,
    tags: ["height", "distance"],
  },
  {
    id: "distant-sign",
    emoji: "🪧",
    title: "找一個遠處看得到的招牌。",
    hint: "不用特地走過去。",
    difficulty: "medium",
    kind: "object",
    direction: "distance",
    actionType: "find_one",
    concept: "text",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "street", "mixed"],
    },
    tags: ["signage", "distance"],
  },
  {
    id: "view-two-roads",
    emoji: "↗️",
    title: "找一個能看到兩條路的位置。",
    hint: "留在安全、不擋路的位置。",
    difficulty: "easy",
    kind: "feature",
    direction: "distance",
    actionType: "choose_viewpoint",
    concept: "boundary",
    role: "rhythm_change",
    environmentSuitability: {
      preferred: ["street", "plaza", "pedestrian", "mixed"],
    },
    tags: ["viewpoint", "flow"],
  },
  {
    id: "watch-people-flow",
    emoji: "↔️",
    title: "停 30 秒，看人往哪邊走。",
    hint: "找安全、不擋路的位置。",
    difficulty: "easy",
    kind: "feature",
    direction: "stop_and_watch",
    actionType: "stop_and_observe",
    concept: "flow",
    role: "rhythm_change",
    environmentSuitability: {
      preferred: ["commercial", "plaza", "pedestrian", "transit"],
      inappropriate: ["green"],
    },
    tags: ["flow", "movement"],
  },
  {
    id: "watch-car-flow",
    emoji: "🚙",
    title: "停 30 秒，看車從哪邊來。",
    hint: "只在人行空間觀察。",
    difficulty: "easy",
    kind: "feature",
    direction: "stop_and_watch",
    actionType: "stop_and_observe",
    concept: "flow",
    role: "rhythm_change",
    environmentSuitability: {
      preferred: ["street", "commercial", "transit"],
      inappropriate: ["green", "pedestrian"],
    },
    tags: ["flow", "movement"],
  },
  {
    id: "rest-seat",
    emoji: "🪑",
    title: "找個可以安全坐一下的地方。",
    hint: "不用特地繞遠。",
    difficulty: "easy",
    kind: "object",
    direction: "stop_and_watch",
    actionType: "rest",
    concept: "seat",
    role: "rhythm_change",
    environmentSuitability: {
      preferred: ["green", "plaza", "pedestrian", "transit"],
    },
    tags: ["rest", "seat"],
  },
  {
    id: "rest-pause",
    emoji: "⏸️",
    title: "找個不擋路的位置停一下。",
    hint: "停 20 秒就好。",
    difficulty: "easy",
    kind: "feature",
    direction: "stop_and_watch",
    actionType: "rest",
    concept: "flow",
    role: "rhythm_change",
    environmentSuitability: universal,
    tags: ["rest", "pause"],
  },
  {
    id: "mural",
    emoji: "🎨",
    title: "找一處塗鴉。",
    hint: "牆角的一小筆也算。",
    difficulty: "hard",
    kind: "detail",
    direction: "eye_level",
    actionType: "find_one",
    concept: "color",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "mixed"],
    },
    tags: ["color", "surface"],
  },
  {
    id: "cat",
    emoji: "🐱",
    title: "找一隻貓。",
    hint: "碰見就好，不要追牠。",
    difficulty: "hard",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "movement",
    role: "observation",
    environmentSuitability: {
      preferred: ["residential", "mixed"],
    },
    tags: ["living"],
    unsuitableFor: ["night"],
  },
  {
    id: "oldsign",
    emoji: "🪧",
    title: "找一塊褪色的招牌。",
    hint: "看看被日曬留下的差異。",
    difficulty: "hard",
    kind: "detail",
    direction: "eye_level",
    actionType: "find_one",
    concept: "wear",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "street", "mixed"],
    },
    tags: ["signage", "age", "texture"],
    unsuitableFor: ["night"],
  },

  // Development-only Night Detour content.
  {
    id: "night-light-pool",
    emoji: "💡",
    title: "找一塊被燈照亮的地面。",
    hint: "留在正常步行範圍。",
    difficulty: "easy",
    kind: "feature",
    direction: "down",
    actionType: "find_one",
    concept: "light",
    role: "quick",
    environmentSuitability: {
      preferred: ["street", "commercial", "pedestrian", "mixed"],
    },
    tags: ["night", "light", "shape"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-lit-sign",
    emoji: "✨",
    title: "找一個發光的招牌。",
    hint: "從公共步道看就好。",
    difficulty: "easy",
    kind: "object",
    direction: "eye_level",
    actionType: "find_one",
    concept: "light",
    role: "quick",
    environmentSuitability: {
      preferred: ["commercial", "street", "mixed"],
    },
    tags: ["night", "light", "signage", "color"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-shadow-edge",
    emoji: "◐",
    title: "找一道清楚的影子邊界。",
    hint: "看看牆面或地面。",
    difficulty: "medium",
    kind: "detail",
    direction: "around",
    actionType: "find_one",
    concept: "shadow",
    role: "observation",
    environmentSuitability: universal,
    tags: ["night", "shadow", "contrast"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-repeated-lights",
    emoji: "💡",
    title: "找一排重複的燈。",
    hint: "路燈、騎樓或店面都算。",
    difficulty: "medium",
    kind: "feature",
    direction: "distance",
    actionType: "find_pattern",
    concept: "repetition",
    role: "observation",
    environmentSuitability: {
      preferred: ["street", "commercial", "mixed"],
    },
    tags: ["night", "light", "pattern"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-color-contrast",
    emoji: "🟣",
    title: "找兩種撞在一起的燈光顏色。",
    hint: "看招牌、牆面或地面。",
    difficulty: "medium",
    kind: "feature",
    direction: "around",
    actionType: "compare",
    concept: "color",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "mixed"],
    },
    tags: ["night", "color", "contrast", "light"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-glass-reflection",
    emoji: "🪞",
    title: "找一個反射燈光的表面。",
    hint: "玻璃或金屬都可以。",
    difficulty: "medium",
    kind: "detail",
    direction: "eye_level",
    actionType: "find_one",
    concept: "reflection",
    role: "observation",
    environmentSuitability: {
      preferred: ["commercial", "street", "mixed"],
    },
    tags: ["night", "reflection", "light", "surface"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-silhouette-object",
    emoji: "◼️",
    title: "找一個被光勾出輪廓的物件。",
    hint: "只看路邊的固定物件。",
    difficulty: "hard",
    kind: "detail",
    direction: "distance",
    actionType: "find_one",
    concept: "light",
    role: "observation",
    environmentSuitability: universal,
    tags: ["night", "light", "contrast", "shape"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
];

function contextValue(
  context: DiscoverySelectionContext | Environment | undefined,
): DiscoverySelectionContext {
  if (typeof context === "string") return { environment: context };
  return context ?? {};
}

export function getExperience(id: ExperienceId | undefined) {
  return EXPERIENCES[id ?? "core"];
}

export function effectiveEnvironments(discovery: Discovery): Environment[] {
  if (discovery.environments?.length) return discovery.environments;
  if (discovery.environment) return [discovery.environment];
  const preferred = discovery.environmentSuitability?.preferred ?? [];
  return preferred.filter(
    (environment): environment is Environment =>
      environment === "street" ||
      environment === "green" ||
      environment === "commercial",
  );
}

function availabilityMatches(
  expected: Daylight | Weather | undefined,
  actual: Daylight | Weather | undefined,
) {
  if (!expected || expected === "any") return true;
  return actual === expected;
}

export function discoveryAvailable(
  discovery: Discovery,
  rawContext?: DiscoverySelectionContext | Environment,
) {
  const context = contextValue(rawContext);
  const experienceId = context.experienceId ?? "core";

  if (discovery.unsuitableFor?.includes(experienceId)) return false;
  if (
    discovery.suitableFor?.length &&
    !discovery.suitableFor.includes(experienceId)
  )
    return false;
  if (
    !availabilityMatches(
      discovery.availability?.daylight,
      context.daylight,
    )
  )
    return false;
  if (
    !availabilityMatches(
      discovery.availability?.weather,
      context.weather,
    )
  )
    return false;

  return true;
}

export function filterDiscoveries(
  discoveries: Discovery[],
  context?: DiscoverySelectionContext | Environment,
) {
  return discoveries.filter((discovery) =>
    discoveryAvailable(discovery, context),
  );
}

export function discoveryMatchesExperience(
  discovery: Discovery,
  experienceId: ExperienceId | undefined,
) {
  const experience = getExperience(experienceId);
  if (experience.id === "core") return true;
  if (discovery.suitableFor?.includes(experience.id)) return true;
  const tags = discovery.tags ?? [];
  return tags.some((tag) => experience.contentTags.includes(tag));
}
