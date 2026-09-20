export type HybridDirection = 'left' | 'straight' | 'right';

export type HybridDecision = {
  direction: HybridDirection;
  bearingDegrees: number;
  reason: 'avoid-repeat' | 'explore';
};

const DIRECTION_OFFSETS: Record<HybridDirection, number> = {
  left: -90,
  straight: 0,
  right: 90,
};

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function rotate<T>(items: readonly T[], amount: number) {
  if (items.length === 0) return [];

  const offset = ((amount % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function bearingForDirection(
  headingDegrees: number,
  direction: HybridDirection
) {
  return normalizeDegrees(
    headingDegrees + DIRECTION_OFFSETS[direction]
  );
}

export function chooseHybridDirection(args: {
  headingDegrees?: number | null;
  recentDirections?: readonly HybridDirection[];
  step: number;
}): HybridDecision {
  const heading = Number.isFinite(args.headingDegrees)
    ? Number(args.headingDegrees)
    : 0;
  const recent = args.recentDirections ?? [];
  const order = rotate(
    ['straight', 'right', 'left'] as const,
    args.step
  );
  const recentWindow = recent.slice(-2);
  const selected =
    order.find((direction) => !recentWindow.includes(direction)) ??
    order.find((direction) => direction !== recent[recent.length - 1]) ??
    order[0];
  const lastDirection = recent[recent.length - 1];

  return {
    direction: selected,
    bearingDegrees: bearingForDirection(heading, selected),
    reason:
      lastDirection && selected !== lastDirection
        ? 'avoid-repeat'
        : 'explore',
  };
}
