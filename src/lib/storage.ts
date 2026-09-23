import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  makeStoredEnvelope,
  selectStoredData,
  type JsonValidator,
} from "./storage-envelope";

const PENDING_SUFFIX = ".pending";

/**
 * Reads JSON storage while accepting the legacy plain-JSON format. If a
 * pending write exists, the newest valid copy wins so an interrupted write
 * does not discard the previous journey state.
 */
export async function readStored<T>(
  key: string,
  validate?: JsonValidator<T>,
): Promise<T | null> {
  const [raw, pendingRaw] = await AsyncStorage.multiGet([
    key,
    `${key}${PENDING_SUFFIX}`,
  ]);
  return selectStoredData<T>(raw[1], pendingRaw[1], validate);
}

/**
 * Writes through a pending key first, then replaces the primary value. This
 * is not a database transaction, but it makes AsyncStorage writes recoverable
 * across process termination and keeps the old value intact until the new
 * value is fully serialized.
 */
export async function writeStored<T>(key: string, data: T): Promise<void> {
  const serialized = JSON.stringify(makeStoredEnvelope(data));
  const pendingKey = `${key}${PENDING_SUFFIX}`;

  await AsyncStorage.setItem(pendingKey, serialized);
  await AsyncStorage.setItem(key, serialized);
  await AsyncStorage.removeItem(pendingKey);
}

export async function removeStored(key: string): Promise<void> {
  await AsyncStorage.multiRemove([key, `${key}${PENDING_SUFFIX}`]);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
