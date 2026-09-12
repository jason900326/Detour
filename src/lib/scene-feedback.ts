import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function loadSceneFeedback() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) return [] as SceneFeedbackRecord[];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [] as SceneFeedbackRecord[];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.sceneId === 'string' &&
        typeof item.kind === 'string'
    ) as SceneFeedbackRecord[];
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

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(next)
  );
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
