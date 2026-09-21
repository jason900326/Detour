export type V2TargetDifficulty = 'easy' | 'medium' | 'hard';
export type V2TargetGaze = 'up' | 'level' | 'down' | 'flex';

export type V2EnvironmentKind =
  | 'green-space'
  | 'square'
  | 'pedestrian'
  | 'market'
  | 'food'
  | 'mural'
  | 'street-art'
  | 'artwork'
  | 'culture'
  | 'steps'
  | 'footbridge'
  | 'fountain'
  | 'viewpoint'
  | string;

export type V2Target = {
  id: string;
  emoji: string;
  title: string;
  difficulty: V2TargetDifficulty;
  gaze: V2TargetGaze;
};

/**
 * V2 deliberately uses the system emoji set instead of a new illustration
 * system. The words are the game; the emoji is the small trace left on the
 * ticket after a player finds something.
 */
export const V2_TARGETS: readonly V2Target[] = [
  { id: 'cloud', emoji: '☁️', title: '找一朵雲。', difficulty: 'easy', gaze: 'up' },
  { id: 'car', emoji: '🚗', title: '找一台車。', difficulty: 'easy', gaze: 'level' },
  { id: 'tree', emoji: '🌳', title: '找一棵樹。', difficulty: 'easy', gaze: 'level' },
  { id: 'door', emoji: '🚪', title: '找一扇門。', difficulty: 'easy', gaze: 'level' },
  { id: 'bicycle', emoji: '🚲', title: '找一台腳踏車。', difficulty: 'easy', gaze: 'level' },
  { id: 'window', emoji: '🪟', title: '找一扇窗戶。', difficulty: 'easy', gaze: 'level' },
  { id: 'plant', emoji: '🪴', title: '找一盆盆栽。', difficulty: 'easy', gaze: 'level' },
  { id: 'chair', emoji: '🪑', title: '找一張座椅。', difficulty: 'easy', gaze: 'level' },
  { id: 'flower', emoji: '🌼', title: '找一朵花。', difficulty: 'easy', gaze: 'level' },
  { id: 'streetlight', emoji: '💡', title: '找一盞路燈。', difficulty: 'easy', gaze: 'up' },
  { id: 'sign', emoji: '🪧', title: '找一個路邊牌子。', difficulty: 'easy', gaze: 'level' },
  { id: 'trash-can', emoji: '🗑️', title: '找一個垃圾桶。', difficulty: 'easy', gaze: 'level' },

  { id: 'graffiti', emoji: '🎨', title: '找一個有塗鴉的地方。', difficulty: 'medium', gaze: 'level' },
  { id: 'reflection', emoji: '🪞', title: '找一個有反射的地方。', difficulty: 'medium', gaze: 'level' },
  { id: 'round-shape', emoji: '⭕️', title: '找一個圓形。', difficulty: 'medium', gaze: 'flex' },
  { id: 'triangle', emoji: '🔺', title: '找一個三角形。', difficulty: 'medium', gaze: 'flex' },
  { id: 'number', emoji: '🔢', title: '找一個有數字的東西。', difficulty: 'medium', gaze: 'level' },
  { id: 'red-object', emoji: '🔴', title: '找一個紅色的東西。', difficulty: 'medium', gaze: 'flex' },
  { id: 'repaired', emoji: '🩹', title: '找一個被修補過的地方。', difficulty: 'medium', gaze: 'level' },
  { id: 'added-later', emoji: '➕', title: '找一個後來加上去的東西。', difficulty: 'medium', gaze: 'level' },
  { id: 'many-stickers', emoji: '🏷️', title: '找一個被貼過很多次的地方。', difficulty: 'medium', gaze: 'level' },
  { id: 'modified', emoji: '🛠️', title: '找一個明顯被改裝過的東西。', difficulty: 'medium', gaze: 'level' },
  { id: 'shadow', emoji: '◐', title: '找一個清楚的影子。', difficulty: 'medium', gaze: 'down' },

  { id: 'cat', emoji: '🐱', title: '找一隻貓。', difficulty: 'hard', gaze: 'level' },
  { id: 'unclear-use', emoji: '❔', title: '找一個用途一眼看不懂的東西。', difficulty: 'hard', gaze: 'level' },
  { id: 'unexpected-door', emoji: '🚪', title: '找一扇看起來不像入口的門。', difficulty: 'hard', gaze: 'level' },
  { id: 'patched-surface', emoji: '🧱', title: '找一個有不同材質拼在一起的地方。', difficulty: 'hard', gaze: 'down' },
  { id: 'hidden-green', emoji: '🌿', title: '找一小塊被藏起來的綠色。', difficulty: 'hard', gaze: 'flex' },
];

export function targetDifficultyForNext(args: {
  discoveries: number;
  lastTargetSeconds: number | null;
  lastTargetDifficulty?: V2TargetDifficulty;
}): V2TargetDifficulty {
  if (args.discoveries === 0) return 'easy';
  if (args.lastTargetSeconds !== null && args.lastTargetSeconds > 105) {
    return 'easy';
  }
  if (args.lastTargetDifficulty === 'hard') return 'medium';
  if (args.discoveries >= 3 && (args.lastTargetSeconds ?? 0) < 55) {
    return 'hard';
  }
  return 'medium';
}

function environmentBoost(target: V2Target, kinds: readonly V2EnvironmentKind[]) {
  const environment = new Set(kinds);
  let boost = 0;

  if (
    environment.has('green-space') ||
    environment.has('square') ||
    environment.has('viewpoint')
  ) {
    if (['tree', 'flower', 'cloud', 'chair', 'shadow', 'plant'].includes(target.id)) {
      boost += 1;
    }
  }

  if (environment.has('market') || environment.has('food')) {
    if (['door', 'window', 'sign', 'number', 'red-object', 'reflection'].includes(target.id)) {
      boost += 1;
    }
  }

  if (
    environment.has('mural') ||
    environment.has('street-art') ||
    environment.has('artwork') ||
    environment.has('culture')
  ) {
    if (['graffiti', 'red-object', 'reflection', 'modified', 'added-later'].includes(target.id)) {
      boost += 1;
    }
  }

  if (
    environment.has('pedestrian') ||
    environment.has('steps') ||
    environment.has('footbridge')
  ) {
    if (['door', 'window', 'chair', 'round-shape', 'number', 'repaired'].includes(target.id)) {
      boost += 1;
    }
  }

  // Deliberately cap the weight. OSM is a probability hint, never proof that
  // a specific object exists nearby.
  return Math.min(1, boost);
}

export function replacementDifficultyForV2(
  current: V2TargetDifficulty
): V2TargetDifficulty {
  return current === 'hard' ? 'medium' : current;
}

export function chooseV2Target(args: {
  difficulty: V2TargetDifficulty;
  excludedIds?: readonly string[];
  excludedEmojis?: readonly string[];
  environmentKinds?: readonly V2EnvironmentKind[];
  seed?: number;
}): V2Target {
  const excludedIds = new Set(args.excludedIds ?? []);
  const excludedEmojis = new Set(args.excludedEmojis ?? []);
  const pool = V2_TARGETS.filter(
    (target) =>
      target.difficulty === args.difficulty &&
      !excludedIds.has(target.id) &&
      !excludedEmojis.has(target.emoji)
  );

  const fallbackPool = V2_TARGETS.filter(
    (target) => !excludedIds.has(target.id) && !excludedEmojis.has(target.emoji)
  );
  const source = pool.length > 0 ? pool : fallbackPool;
  const environmentKinds = args.environmentKinds ?? [];
  const weightedSource = source.flatMap((target) => {
    const weight = 1 + environmentBoost(target, environmentKinds);
    return Array.from({ length: weight }, () => target);
  });
  const index =
    Math.abs(Math.floor(args.seed ?? Date.now())) %
    Math.max(1, weightedSource.length);
  return weightedSource[index] ?? source[0] ?? V2_TARGETS[0];
}

export function shouldEnterV2Closing(args: {
  elapsedSeconds: number;
  discoveries: number;
}) {
  return (
    args.discoveries >= 4 ||
    (args.elapsedSeconds >= 8 * 60 && args.discoveries >= 3) ||
    args.elapsedSeconds >= 10 * 60
  );
}

export function shouldForceV2Finish(elapsedSeconds: number) {
  return elapsedSeconds >= 15 * 60;
}

export function shouldOfferV2ClosingTarget(discoveries: number) {
  return discoveries < 4;
}
