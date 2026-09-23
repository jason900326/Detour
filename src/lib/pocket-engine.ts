import type {
  Discovery,
  ExperienceId,
} from "./pocket-content";

export type {
  Daylight,
  DetourExperience,
  Difficulty,
  Discovery,
  DiscoveryKind,
  DiscoverySelectionContext,
  Environment,
  ExperienceId,
  Weather,
} from "./pocket-content";

export type Point = { latitude: number; longitude: number };
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
  /** Undefined on old saved journeys; undefined is interpreted as core. */
  experienceId?: ExperienceId;
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
