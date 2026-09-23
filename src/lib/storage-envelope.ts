export type StoredEnvelope<T> = {
  schemaVersion: number;
  updatedAt: number;
  data: T;
};

export type JsonValidator<T> = (value: unknown) => value is T;

export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

function isEnvelope<T>(value: unknown): value is StoredEnvelope<T> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredEnvelope<T>>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.updatedAt === "number" &&
    "data" in candidate
  );
}

export function parseStoredEnvelope<T>(
  raw: string | null,
): StoredEnvelope<T> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isEnvelope<T>(parsed)) return parsed;
    return {
      schemaVersion: 0,
      updatedAt: 0,
      data: parsed as T,
    };
  } catch {
    return null;
  }
}

export function newestStoredEnvelope<T>(
  values: Array<StoredEnvelope<T> | null>,
): StoredEnvelope<T> | null {
  return (
    values
      .filter((value): value is StoredEnvelope<T> => value !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
  );
}

export function selectStoredData<T>(
  primaryRaw: string | null,
  pendingRaw: string | null,
  validate?: JsonValidator<T>,
): T | null {
  const value = newestStoredEnvelope<T>([
    parseStoredEnvelope<T>(primaryRaw),
    parseStoredEnvelope<T>(pendingRaw),
  ]);
  if (!value) return null;
  if (validate && !validate(value.data)) return null;
  return value.data;
}

export function makeStoredEnvelope<T>(
  data: T,
  updatedAt = Date.now(),
): StoredEnvelope<T> {
  return {
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
    updatedAt,
    data,
  };
}
