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
  hint: string;
  difficulty: Difficulty;
  kind: DiscoveryKind;

  /** Weak probability hints only; never evidence that an object exists. */
  environments?: Environment[];
  /** Legacy single-environment shape kept so old stored journeys remain readable. */
  environment?: Environment;
  /** Observation concepts used by themed Experiences for curation. */
  tags?: string[];
  /** When present, this discovery is reserved for these Experiences. */
  suitableFor?: ExperienceId[];
  /** Explicit opt-out for a themed Experience. */
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

export const DISCOVERIES: Discovery[] = [
  {
    id: "door",
    emoji: "🚪",
    title: "找一扇門。",
    hint: "有些每天經過的入口，你從來沒仔細看過。",
    difficulty: "easy",
    kind: "object",
    tags: ["entrance", "architecture"],
  },
  {
    id: "tree",
    emoji: "🌳",
    title: "找一棵樹。",
    hint: "抬頭看看，它長成了什麼樣子？",
    difficulty: "easy",
    kind: "object",
    environments: ["green"],
    tags: ["nature", "shape"],
  },
  {
    id: "number",
    emoji: "🔢",
    title: "找一個數字。",
    hint: "門牌、招牌，或腳邊的小小標記。",
    difficulty: "easy",
    kind: "feature",
    tags: ["text", "signage"],
  },
  {
    id: "circle",
    emoji: "🟠",
    title: "找一個圓形。",
    hint: "大的、小的、藏在角落的，都算。",
    difficulty: "easy",
    kind: "feature",
    tags: ["shape"],
  },
  {
    id: "car",
    emoji: "🚗",
    title: "找一台車。",
    hint: "留在人行空間，用眼睛找就好。",
    difficulty: "easy",
    kind: "object",
    environments: ["street"],
    tags: ["street-object"],
  },
  {
    id: "plant",
    emoji: "🪴",
    title: "找一盆植物。",
    hint: "看看門口、窗邊，誰在照顧這一點綠？",
    difficulty: "medium",
    kind: "object",
    tags: ["nature", "care"],
  },
  {
    id: "reflection",
    emoji: "🪞",
    title: "找一個有反射的地方。",
    hint: "玻璃、金屬、水面，都可能藏著另一個世界。",
    difficulty: "medium",
    kind: "feature",
    tags: ["reflection", "light", "surface"],
  },
  {
    id: "red",
    emoji: "🔴",
    title: "找一個紅色的東西。",
    hint: "讓一點紅色，從整條街裡跳出來。",
    difficulty: "medium",
    kind: "feature",
    tags: ["color", "contrast"],
  },
  {
    id: "repair",
    emoji: "🩹",
    title: "找一個被修補過的地方。",
    hint: "補丁、填縫、不同顏色的漆，都是線索。",
    difficulty: "medium",
    kind: "detail",
    tags: ["repair", "texture", "architecture"],
  },
  {
    id: "layers",
    emoji: "📜",
    title: "找一處重疊的貼紙。",
    hint: "露出的邊角，留下了不只一次的痕跡。",
    difficulty: "medium",
    kind: "detail",
    environments: ["commercial"],
    tags: ["layering", "signage", "texture"],
  },
  {
    id: "triangle",
    emoji: "🔺",
    title: "找一個三角形。",
    hint: "不一定是標誌，也可能是一塊小小的結構。",
    difficulty: "medium",
    kind: "feature",
    tags: ["shape"],
  },
  {
    id: "bike",
    emoji: "🚲",
    title: "找一台腳踏車。",
    hint: "停在路邊的，也算今天的相遇。",
    difficulty: "easy",
    kind: "object",
    environments: ["street"],
    tags: ["street-object"],
  },
  {
    id: "added",
    emoji: "🔧",
    title: "找一個外加的掛鉤。",
    hint: "門、牆或招牌邊，後來才裝上的小零件。",
    difficulty: "medium",
    kind: "detail",
    tags: ["repair", "architecture", "added"],
  },
  {
    id: "flower",
    emoji: "🌼",
    title: "找一朵花。",
    hint: "從公共步道看就好，不需要走進花圃。",
    difficulty: "medium",
    kind: "object",
    environments: ["green"],
    tags: ["nature", "color"],
  },
  {
    id: "mural",
    emoji: "🎨",
    title: "找一處塗鴉。",
    hint: "牆角的一小筆，也算。",
    difficulty: "hard",
    kind: "detail",
    environments: ["commercial"],
    tags: ["color", "surface"],
  },
  {
    id: "cat",
    emoji: "🐱",
    title: "找一隻貓。",
    hint: "碰見就好，不追牠。沒遇到，隨時換一個。",
    difficulty: "hard",
    kind: "object",
    tags: ["living"],
    unsuitableFor: ["night"],
  },
  {
    id: "oldsign",
    emoji: "🪧",
    title: "找一塊褪色的招牌。",
    hint: "看看有沒有被太陽曬淡的字。",
    difficulty: "hard",
    kind: "detail",
    environments: ["commercial"],
    tags: ["signage", "age", "texture"],
    unsuitableFor: ["night"],
  },

  // Development-only Night Detour content. Same journey engine, different curation.
  {
    id: "night-light-pool",
    emoji: "💡",
    title: "找一塊被燈照亮的地面。",
    hint: "留在安全、能通行的地方，看光落下來的形狀。",
    difficulty: "easy",
    kind: "feature",
    environments: ["street", "commercial"],
    tags: ["night", "light", "shape"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-lit-sign",
    emoji: "✨",
    title: "找一個正在發光的招牌。",
    hint: "從公共步道看就好，注意它怎麼把周圍也染亮。",
    difficulty: "easy",
    kind: "object",
    environments: ["commercial"],
    tags: ["night", "light", "signage", "color"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-shadow-edge",
    emoji: "◐",
    title: "找一道很清楚的影子邊界。",
    hint: "看牆面或地面，哪裡從亮突然變暗？",
    difficulty: "medium",
    kind: "detail",
    tags: ["night", "shadow", "contrast"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-repeated-lights",
    emoji: "💡",
    title: "找一排重複出現的燈。",
    hint: "路燈、騎樓或店面都可以，留在正常步行範圍觀察。",
    difficulty: "medium",
    kind: "feature",
    environments: ["street", "commercial"],
    tags: ["night", "light", "pattern"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-color-contrast",
    emoji: "🟣",
    title: "找兩種在夜裡撞在一起的顏色。",
    hint: "看招牌、牆面或燈光，不需要靠近任何私人空間。",
    difficulty: "medium",
    kind: "feature",
    environments: ["commercial"],
    tags: ["night", "color", "contrast", "light"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-glass-reflection",
    emoji: "🪞",
    title: "找一個把燈光反射回來的表面。",
    hint: "玻璃或金屬都可以，只從公共空間觀察。",
    difficulty: "medium",
    kind: "detail",
    environments: ["commercial", "street"],
    tags: ["night", "reflection", "light", "surface"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  },
  {
    id: "night-silhouette-object",
    emoji: "◼️",
    title: "找一個被光勾出輪廓的物件。",
    hint: "找路邊固定的物件就好，不追人、不追動物。",
    difficulty: "hard",
    kind: "detail",
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

export function effectiveEnvironments(discovery: Discovery) {
  if (discovery.environments?.length) return discovery.environments;
  return discovery.environment ? [discovery.environment] : [];
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
