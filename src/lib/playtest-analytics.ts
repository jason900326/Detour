import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYTEST_KEY = '@detour/playtest/v1';
const TESTER_KEY = '@detour/playtest-tester/v1';

const PLAYTEST_SYNC_ENDPOINT =
  'https://ldlhzyfubjbuumikrkuv.supabase.co/functions/v1/detour-playtest';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_qhZ09r25etnEi-0dURQCYw_EStro0t_';

export const DETOUR_PLAYTEST_VERSION =
  '0.32.0';

export type PlaytestStatus =
  | 'ticket-failed'
  | 'ready'
  | 'started'
  | 'completed'
  | 'abandoned';

export type PlaytestRating =
  | 'replay'
  | 'okay'
  | 'not-worth-it';

export type PlaytestFeedbackReason =
  | 'destination'
  | 'mission'
  | 'distance'
  | 'navigation'
  | 'awkward'
  | 'other';

export type PlaytestSession = {
  id: string;
  createdAt: string;
  status: PlaytestStatus;
  devMode: boolean;
  minutes: number;
  moodId: string;
  lightContext?: string;
  sceneKind?: string;
  plannedDistanceMeters?: number;
  plannedDurationSeconds?: number;
  sideMissionsTotal?: number;
  startedAt?: string;
  completedAt?: string;
  actualDurationMinutes?: number;
  sideMissionsCompleted?: number;
  sideMissionsSkipped?: number;
  arrivalResult?: 'completed' | 'skipped';
  rerouteCount?: number;
  sceneFailureReasons?: string[];
  photoCount?: number;
  failureReason?: string;
  aiRankingUsed?: boolean;
  aiMissionUsed?: boolean;
  runRating?: PlaytestRating;
  runFeedbackReasons?: PlaytestFeedbackReason[];
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export async function getPlaytestTesterId() {
  try {
    const current = await AsyncStorage.getItem(TESTER_KEY);

    if (current) return current;

    const id = `DTR-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    await AsyncStorage.setItem(TESTER_KEY, id);
    return id;
  } catch {
    return 'DTR-LOCAL';
  }
}

async function syncPlaytestSession(
  session: PlaytestSession
) {
  const testerId =
    await getPlaytestTesterId();

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      5000
    );

  try {
    const response =
      await fetch(
        PLAYTEST_SYNC_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            apikey:
              SUPABASE_PUBLISHABLE_KEY,
          },
          body:
            JSON.stringify({
              mode: 'sync-run',
              appVersion:
                DETOUR_PLAYTEST_VERSION,
              testerId,
              session,
            }),
          signal:
            controller.signal,
        }
      );

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function syncAllPlaytestSessions(
  sessions?: PlaytestSession[]
) {
  const source =
    sessions ??
    (await loadPlaytestSessions());

  let synced = 0;
  let failed = 0;

  for (const session of source) {
    const ok =
      await syncPlaytestSession(
        session
      );

    if (ok) {
      synced += 1;
    } else {
      failed += 1;
    }
  }

  return {
    synced,
    failed,
    total: source.length,
  };
}

export async function loadPlaytestSessions(): Promise<PlaytestSession[]> {
  try {
    const raw = await AsyncStorage.getItem(PLAYTEST_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as PlaytestSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePlaytestSessions(
  sessions: PlaytestSession[]
) {
  const next = sessions.slice(0, 200);

  try {
    await AsyncStorage.setItem(
      PLAYTEST_KEY,
      JSON.stringify(next)
    );
  } catch {
    // Playtest telemetry must never block DETOUR.
  }

  return next;
}

export async function createPlaytestSession(input: {
  devMode: boolean;
  minutes: number;
  moodId: string;
}) {
  const session: PlaytestSession = {
    id: makeId('run'),
    createdAt: new Date().toISOString(),
    status: 'ready',
    ...input,
  };

  const current = await loadPlaytestSessions();
  await savePlaytestSessions([session, ...current]);

  void syncPlaytestSession(
    session
  );

  return session;
}

export async function updatePlaytestSession(
  id: string,
  patch: Partial<PlaytestSession>
) {
  const current = await loadPlaytestSessions();

  let changed:
    | PlaytestSession
    | null = null;

  const next = current.map((session) => {
    if (session.id !== id) {
      return session;
    }

    changed = {
      ...session,
      ...patch,
    };

    return changed;
  });

  const saved =
    await savePlaytestSessions(next);

  if (changed) {
    void syncPlaytestSession(
      changed
    );
  }

  return saved;
}

export async function clearPlaytestSessions() {
  try {
    await AsyncStorage.removeItem(PLAYTEST_KEY);
  } catch {
    // Ignore prototype storage failures.
  }
}

function percent(a: number, b: number) {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) /
      values.length
  );
}

function breakdown(
  title: string,
  rows: Record<
    string,
    { total: number; completed: number; rerouted: number }
  >
) {
  const body = Object.entries(rows)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([key, value]) =>
        `${key}: ${value.completed}/${value.total} complete (${percent(
          value.completed,
          value.total
        )}) · ${value.rerouted} reroute`
    );

  return `${title}\n${body.length ? body.join('\n') : '—'}`;
}

export function buildPlaytestReport(
  sessions: PlaytestSession[],
  testerId: string
) {
  const real = sessions.filter((session) => !session.devMode);
  const indoor = sessions.filter((session) => session.devMode);

  const ticketFailed = real.filter(
    (session) => session.status === 'ticket-failed'
  ).length;

  const started = real.filter((session) =>
    ['started', 'completed', 'abandoned'].includes(session.status)
  );

  const completed = real.filter(
    (session) => session.status === 'completed'
  );

  const abandoned = real.filter(
    (session) => session.status === 'abandoned'
  ).length;

  const rerouted = completed.filter(
    (session) => (session.rerouteCount ?? 0) > 0
  ).length;

  const rated = completed.filter(
    (session) =>
      Boolean(session.runRating)
  );

  const replayRated =
    rated.filter(
      (session) =>
        session.runRating ===
        'replay'
    ).length;

  const okayRated =
    rated.filter(
      (session) =>
        session.runRating ===
        'okay'
    ).length;

  const notWorthRated =
    rated.filter(
      (session) =>
        session.runRating ===
        'not-worth-it'
    ).length;

  const sideCompleted = completed.reduce(
    (sum, session) =>
      sum + (session.sideMissionsCompleted ?? 0),
    0
  );

  const sideSkipped = completed.reduce(
    (sum, session) =>
      sum + (session.sideMissionsSkipped ?? 0),
    0
  );

  const sideTotal = sideCompleted + sideSkipped;

  const durations = completed
    .map((session) => session.actualDurationMinutes)
    .filter(
      (value): value is number => typeof value === 'number'
    );

  const distances = completed
    .map((session) => session.plannedDistanceMeters)
    .filter(
      (value): value is number => typeof value === 'number'
    );

  const reasons: Record<string, number> = {};

  for (const session of real) {
    for (const reason of session.sceneFailureReasons ?? []) {
      reasons[reason] = (reasons[reason] ?? 0) + 1;
    }
  }

  const reasonText =
    Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n') || '—';

  const byScene: Record<
    string,
    { total: number; completed: number; rerouted: number }
  > = {};

  const byMood: Record<
    string,
    { total: number; completed: number; rerouted: number }
  > = {};

  const byTime: Record<
    string,
    { total: number; completed: number; rerouted: number }
  > = {};

  for (const session of real) {
    const done = session.status === 'completed';
    const reroute = (session.rerouteCount ?? 0) > 0;

    const keys: Array<
      [
        Record<
          string,
          { total: number; completed: number; rerouted: number }
        >,
        string
      ]
    > = [
      [byScene, session.sceneKind ?? 'unknown'],
      [byMood, session.moodId || 'unknown'],
      [byTime, `${session.minutes}m`],
    ];

    for (const [bucket, key] of keys) {
      bucket[key] ??= {
        total: 0,
        completed: 0,
        rerouted: 0,
      };

      bucket[key].total += 1;
      if (done) bucket[key].completed += 1;
      if (reroute) bucket[key].rerouted += 1;
    }
  }

  const avgDuration = average(durations);
  const avgDistance = average(distances);

  return [
    'DETOUR PLAYTEST REPORT',
    `Tester: ${testerId}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'PRIVACY',
    'No GPS coordinates, route trace, photos or destination names included.',
    '',
    'REAL-WORLD RUNS',
    `Ticket attempts: ${real.length}`,
    `Ticket ready: ${real.length - ticketFailed}/${real.length} (${percent(
      real.length - ticketFailed,
      real.length
    )})`,
    `Started: ${started.length}`,
    `Completed: ${completed.length}/${started.length} (${percent(
      completed.length,
      started.length
    )})`,
    `Abandoned: ${abandoned}`,
    `Runs with reroute: ${rerouted}/${completed.length} (${percent(
      rerouted,
      completed.length
    )})`,
    `Side quests completed: ${sideCompleted}/${sideTotal} (${percent(
      sideCompleted,
      sideTotal
    )})`,
    `Worth rating: ${rated.length} rated · ${replayRated} replay · ${okayRated} okay · ${notWorthRated} not-worth-it`,
    `Average actual duration: ${
      avgDuration === null ? '—' : `${avgDuration} min`
    }`,
    `Average planned walk: ${
      avgDistance === null ? '—' : `${avgDistance} m`
    }`,
    '',
    'RECOVERY REASONS',
    reasonText,
    '',
    breakdown('BY SCENE TYPE', byScene),
    '',
    breakdown('BY MOOD', byMood),
    '',
    breakdown('BY TIME', byTime),
    '',
    'INDOOR TEST',
    `${indoor.length} runs (excluded from real-world rates)`,
  ].join('\n');
}
