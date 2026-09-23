export type Point = { latitude: number; longitude: number };
export type Difficulty = "easy" | "medium" | "hard";
export type Environment = "street" | "green" | "commercial";
export type Discovery = {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  difficulty: Difficulty;
  kind: "object" | "feature" | "detail";
  environment?: Environment;
};
export type Found = Discovery & { foundAt: number; seconds: number };
export type PocketJourney = {
  id: string;
  startedAt: number;
  finishedAt?: number;
  origin: Point;
  trace: Point[];
  found: Found[];
  seen: string[];
  target: Discovery | null;
  targetSince: number;
  photos: string[];
  phase: "exploration" | "closing" | "finished";
  closingTargetUsed: boolean;
  endpoint?: { name: string; point: Point };
  area?: string;
  demo?: boolean;
  /** Persisted only while an active journey is backgrounded or awaiting cold-launch recovery. */
  suspendedAt?: number;
  /** Last foreground checkpoint; used to avoid counting time while the app was not actually running. */
  lastActiveAt?: number;
  /** History-only preference. Kept on the journey so it syncs naturally with future account storage. */
  favorite?: boolean;
};

export function shouldDiscardShortEmptyJourney(
  journey: Pick<PocketJourney, "startedAt" | "found" | "photos">,
  now = Date.now(),
) {
  return (
    now - journey.startedAt < 60_000 &&
    journey.found.length === 0 &&
    journey.photos.length === 0
  );
}
export const DISCOVERIES: Discovery[] = [
  {
    id: "door",
    emoji: "🚪",
    title: "找一扇門。",
    hint: "有些每天經過的入口，你從來沒仔細看過。",
    difficulty: "easy",
    kind: "object",
  },
  {
    id: "tree",
    emoji: "🌳",
    title: "找一棵樹。",
    hint: "抬頭看看，它長成了什麼樣子？",
    difficulty: "easy",
    kind: "object",
    environment: "green",
  },
  {
    id: "number",
    emoji: "🔢",
    title: "找一個數字。",
    hint: "門牌、招牌，或腳邊的小小標記。",
    difficulty: "easy",
    kind: "feature",
  },
  {
    id: "circle",
    emoji: "🟠",
    title: "找一個圓形。",
    hint: "大的、小的、藏在角落的，都算。",
    difficulty: "easy",
    kind: "feature",
  },
  {
    id: "car",
    emoji: "🚗",
    title: "找一台車。",
    hint: "留在人行空間，用眼睛找就好。",
    difficulty: "easy",
    kind: "object",
    environment: "street",
  },
  {
    id: "plant",
    emoji: "🪴",
    title: "找一盆植物。",
    hint: "看看門口、窗邊，誰在照顧這一點綠？",
    difficulty: "medium",
    kind: "object",
  },
  {
    id: "reflection",
    emoji: "🪞",
    title: "找一個有反射的地方。",
    hint: "玻璃、金屬、水面，都可能藏著另一個世界。",
    difficulty: "medium",
    kind: "feature",
  },
  {
    id: "red",
    emoji: "🔴",
    title: "找一個紅色的東西。",
    hint: "讓一點紅色，從整條街裡跳出來。",
    difficulty: "medium",
    kind: "feature",
  },
  {
    id: "repair",
    emoji: "🩹",
    title: "找一個被修補過的地方。",
    hint: "補丁、填縫、不同顏色的漆，都是線索。",
    difficulty: "medium",
    kind: "detail",
  },
  {
    id: "layers",
    emoji: "📜",
    title: "找一處重疊的貼紙。",
    hint: "露出的邊角，留下了不只一次的痕跡。",
    difficulty: "medium",
    kind: "detail",
    environment: "commercial",
  },
  {
    id: "triangle",
    emoji: "🔺",
    title: "找一個三角形。",
    hint: "不一定是標誌，也可能是一塊小小的結構。",
    difficulty: "medium",
    kind: "feature",
  },
  {
    id: "bike",
    emoji: "🚲",
    title: "找一台腳踏車。",
    hint: "停在路邊的，也算今天的相遇。",
    difficulty: "easy",
    kind: "object",
    environment: "street",
  },
  {
    id: "added",
    emoji: "🔧",
    title: "找一個外加的掛鉤。",
    hint: "門、牆或招牌邊，後來才裝上的小零件。",
    difficulty: "medium",
    kind: "detail",
  },
  {
    id: "flower",
    emoji: "🌼",
    title: "找一朵花。",
    hint: "從公共步道看就好，不需要走進花圃。",
    difficulty: "medium",
    kind: "object",
    environment: "green",
  },
  {
    id: "mural",
    emoji: "🎨",
    title: "找一處塗鴉。",
    hint: "牆角的一小筆，也算。",
    difficulty: "hard",
    kind: "detail",
    environment: "commercial",
  },
  {
    id: "cat",
    emoji: "🐱",
    title: "找一隻貓。",
    hint: "碰見就好，不追牠。沒遇到，隨時換一個。",
    difficulty: "hard",
    kind: "object",
  },
  {
    id: "oldsign",
    emoji: "🪧",
    title: "找一塊褪色的招牌。",
    hint: "看看有沒有被太陽曬淡的字。",
    difficulty: "hard",
    kind: "detail",
    environment: "commercial",
  },
];

export function chooseDiscovery(
  found: Found[],
  seen: string[],
  environment: Environment = "street",
  random = Math.random,
  light = false,
): Discovery {
  const last = found.at(-1);
  let difficulty: Difficulty =
    !last || light || last.seconds > 100 ? "easy" : "medium";
  if (
    !light &&
    found.length >= 2 &&
    last &&
    last.difficulty !== "hard" &&
    last.seconds < 60 &&
    random() < 0.4
  )
    difficulty = "hard";
  let pool = DISCOVERIES.filter(
    (t) => t.difficulty === difficulty && !seen.includes(t.id),
  );
  if (!pool.length)
    pool = DISCOVERIES.filter(
      (t) => t.difficulty !== "hard" && !seen.slice(-5).includes(t.id),
    );
  const weights = pool.map(
    (t) =>
      (t.environment === environment ? 1.35 : 1) *
      (last?.kind === t.kind ? 0.8 : 1),
  );
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  return (
    pool.find((_, i) => (roll -= weights[i]) <= 0) ?? pool[pool.length - 1]
  );
}

export function phaseAt(
  elapsedSeconds: number,
  foundCount: number,
): PocketJourney["phase"] {
  if (elapsedSeconds >= 900) return "finished";
  if (
    elapsedSeconds >= 600 ||
    (foundCount >= 3 && elapsedSeconds >= 480) ||
    foundCount >= 4
  )
    return "closing";
  return "exploration";
}

export function distance(a: Point, b: Point) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function bearing(a: Point, b: Point) {
  const r = Math.PI / 180;
  const d = (b.longitude - a.longitude) * r;
  return (
    (Math.atan2(
      Math.sin(d) * Math.cos(b.latitude * r),
      Math.cos(a.latitude * r) * Math.sin(b.latitude * r) -
        Math.sin(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos(d),
    ) /
      r +
      360) %
    360
  );
}
export function angle(a: number, b: number) {
  return ((a - b + 540) % 360) - 180;
}

// Reject jumps and poor fixes rather than drawing invented travel across town.
export function appendFix(
  trace: Point[],
  fix: Point,
  accuracy: number,
  secondsSinceLast: number,
): Point[] {
  const last = trace.at(-1);
  if (accuracy > 45) return trace;
  if (!last) return [fix];
  const meters = distance(last, fix);
  if (meters < 5 || meters > Math.max(70, secondsSinceLast * 4)) return trace;
  return [...trace, fix];
}
