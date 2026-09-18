import AsyncStorage from '@react-native-async-storage/async-storage';

type StoredEnvelope<T> = {
  schemaVersion: number;
  updatedAt: number;
  data: T;
};

type JsonValidator<T> = (value: unknown) => value is T;

const CURRENT_SCHEMA_VERSION = 1;
const PENDING_SUFFIX = '.pending';

function isEnvelope<T>(value: unknown): value is StoredEnvelope<T> {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<StoredEnvelope<T>>;
  return (
    typeof candidate.schemaVersion === 'number' &&
    typeof candidate.updatedAt === 'number' &&
    'data' in candidate
  );
}

function parseValue<T>(raw: string | null): StoredEnvelope<T> | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isEnvelope<T>(parsed)) return parsed;

    // v1 keys were written as plain JSON. Reading that shape keeps upgrades
    // backward compatible; the next write moves it into an envelope.
    return {
      schemaVersion: 0,
      updatedAt: 0,
      data: parsed as T,
    };
  } catch {
    return null;
  }
}

function newest<T>(
  values: Array<StoredEnvelope<T> | null>
): StoredEnvelope<T> | null {
  return values
    .filter((value): value is StoredEnvelope<T> => value !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

/**
 * Reads JSON storage while accepting the legacy plain-JSON format. If a
 * pending write exists, the newest valid copy wins so an interrupted write
 * does not discard the previous journey state.
 */
export async function readStored<T>(
  key: string,
  validate?: JsonValidator<T>
): Promise<T | null> {
  const [raw, pendingRaw] = await AsyncStorage.multiGet([
    key,
    `${key}${PENDING_SUFFIX}`,
  ]);

  const value = newest<T>([
    parseValue<T>(raw[1]),
    parseValue<T>(pendingRaw[1]),
  ]);

  if (!value) return null;
  if (validate && !validate(value.data)) return null;
  return value.data;
}

/**
 * Writes through a pending key first, then replaces the primary value. This
 * is not a database transaction, but it makes AsyncStorage writes recoverable
 * across process termination and keeps the old value intact until the new
 * value is fully serialized.
 */
export async function writeStored<T>(key: string, data: T): Promise<void> {
  const envelope: StoredEnvelope<T> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
    data,
  };
  const serialized = JSON.stringify(envelope);
  const pendingKey = `${key}${PENDING_SUFFIX}`;

  await AsyncStorage.setItem(pendingKey, serialized);
  await AsyncStorage.setItem(key, serialized);
  await AsyncStorage.removeItem(pendingKey);
}

export async function removeStored(key: string): Promise<void> {
  await AsyncStorage.multiRemove([key, `${key}${PENDING_SUFFIX}`]);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
