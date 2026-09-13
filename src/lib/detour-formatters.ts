import type { LightContext, MoodId } from './journey-engine';

export function ticketSerial(
  time: string | null,
  moodId: MoodId | null
) {
  const timeCode =
    time?.replace('+', 'P') ?? '00';

  const moodCode =
    moodId?.slice(0, 3).toUpperCase() ??
    '---';

  return `DTR-${timeCode}-${moodCode}`;
}

export function parseMinutes(value: string | null) {
  if (!value) return 0;
  if (value === '90+') return 90;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPassportDate(iso: string) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} · ${hour}:${minute}`;
}

export function formatClockTime(iso?: string) {
  if (!iso) return '—';

  const date = new Date(iso);
  const hour = String(
    date.getHours()
  ).padStart(2, '0');
  const minute = String(
    date.getMinutes()
  ).padStart(2, '0');

  return `${hour}:${minute}`;
}

export function contextCode(context: LightContext | null) {
  if (context === 'night') return 'NIGHT';
  if (context === 'twilight') return 'TWILIGHT';
  if (context === 'day') return 'DAY';
  return 'AUTO';
}
