import { readStored, writeStored } from './storage';

export type SceneFeedbackKind =
  | 'interesting'
  | 'okay'
  | 'boring'
  | 'familiar'
  | 'wrong-now'
  | 'closed'
  | 'inaccessible'
  | 'not-worth-it';

export type SceneFeedbackRecord = {
  sceneId: string;
  kind: SceneFeedbackKind;
  createdAt: string;
};

const STORAGE_KEY = '@detour/scene-feedback/v1';

function isSceneFeedbackRecord(value: unknown): value is SceneFeedbackRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<SceneFeedbackRecord>;
  return (
    typeof record.sceneId === 'string' &&
    typeof record.kind === 'string' &&
    typeof record.createdAt === 'string'
  );
}

function isSceneFeedback(value: unknown): value is SceneFeedbackRecord[] {
  return Array.isArray(value) && value.every(isSceneFeedbackRecord);
}

export async function loadSceneFeedback() {
  try {
    return (await readStored(STORAGE_KEY, isSceneFeedback)) ?? [];
  } catch {
    return [] as SceneFeedbackRecord[];
  }
}

export async function saveSceneFeedback(
  record: SceneFeedbackRecord
) {
  const current = await loadSceneFeedback();

  const next = [
    ...current.filter(
      (item) =>
        !(
          item.sceneId === record.sceneId &&
          item.kind === record.kind
        )
    ),
    record,
  ].slice(-400);

  await writeStored(STORAGE_KEY, next);
}

export function getSceneFeedbackBias(
  sceneId: string,
  records: SceneFeedbackRecord[]
) {
  let score = 0;

  for (const record of records) {
    if (record.sceneId !== sceneId) continue;

    if (record.kind === 'interesting') score += 24;
    if (record.kind === 'okay') score += 2;
    if (record.kind === 'boring') score -= 34;
    if (record.kind === 'familiar') score -= 52;

    // "wrong now" should not permanently bury a place forever.
    if (record.kind === 'wrong-now') {
      const ageHours =
        (Date.now() - new Date(record.createdAt).getTime()) /
        3600000;

      if (ageHours <= 72) score -= 22;
    }

    // Closed can simply be time-of-day related.
    if (record.kind === 'closed') {
      const ageHours =
        (Date.now() - new Date(record.createdAt).getTime()) /
        3600000;

      if (ageHours <= 8) score -= 14;
    }

    // Inaccessible/private is a strong reliability signal.
    if (record.kind === 'inaccessible') score -= 64;

    // "I walked here and this was not worth it" should matter.
    if (record.kind === 'not-worth-it') score -= 46;
  }

  return score;
}
