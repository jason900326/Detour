import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  LightContext,
  Mission,
  MissionFamily,
  MoodId,
} from './journey-engine';

import type {
  SceneCandidate,
} from './scene-engine';

declare const process: {
  env: Record<string, string | undefined>;
};

// These two values are intentionally safe to ship in the mobile client.
// They identify the public Supabase project/function; they are NOT secrets.
// Environment variables can still override them for future staging projects.
const DEFAULT_AI_ENDPOINT =
  'https://ldlhzyfubjbuumikrkuv.supabase.co/functions/v1/detour-ai';

const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_qhZ09r25etnEi-0dURQCYw_EStro0t_';

const AI_ENDPOINT =
  process.env.EXPO_PUBLIC_DETOUR_AI_URL?.trim() ||
  DEFAULT_AI_ENDPOINT;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

const SAFE_TAG_KEYS = [
  'amenity',
  'tourism',
  'artwork_type',
  'artwork_subject',
  'historic',
  'leisure',
  'shop',
  'place',
  'highway',
  'bridge',
  'surface',
  'lit',
  'opening_hours',
  'wheelchair',
  'description',
  'artist_name',
  'heritage',
] as const;

type SafeScene = {
  id: string;
  kind: string;
  label: string;
  name: string;
  straightDistanceMeters: number;
  deterministicScore: number;
  qualityScore: number;
  tier: string;
  previouslyVisited: boolean;
  tags: Record<string, string>;
  scoreReasons: string[];
};

type RankScenesResponse = {
  rankedSceneIds: string[];
  selectionNote?: string;
};

type MissionDraft = {
  code: string;
  family: MissionFamily;
  title: string;
  instruction: string;
  completion: string;
  photo: boolean;
};

type MissionSlot = {
  index: number;
  phase:
    | 'warmup'
    | 'discover'
    | 'shift'
    | 'anticipate';
  targetMeters: number;
};

type RecentMission = {
  code: string;
  family: MissionFamily;
  title: string;
  createdAt: string;
};

type MissionPlanResponse = {
  sideMissions: MissionDraft[];
  arrivalMission: MissionDraft;
  creativeNote?: string;
};

export type AIRankingResult = {
  candidates: SceneCandidate[];
  usedAI: boolean;
};

export type AIJourneyResult = {
  sideMissions: Mission[];
  arrivalMission: Mission;
};

export type AIConnectionTestResult = {
  ok: boolean;
  message: string;
};

const AI_MISSION_HISTORY_KEY =
  '@detour/ai-mission-history/v1';

const MISSION_FAMILIES: MissionFamily[] = [
  'count',
  'contrast',
  'scale',
  'texture',
  'sound',
  'movement',
  'framing',
  'boundary',
  'pattern',
  'perspective',
];

const VAGUE_PHRASES = [
  '感受一下',
  '感受周圍',
  '感受這裡',
  '觀察周遭',
  '觀察周圍',
  '看看周圍',
  '看看附近',
  '找一個有趣',
  '找個有趣',
  '任何有趣',
  '隨便找',
  '留意周圍',
];

async function loadRecentAIMissions(): Promise<RecentMission[]> {
  try {
    const raw =
      await AsyncStorage.getItem(
        AI_MISSION_HISTORY_KEY
      );

    if (!raw) return [];

    const parsed =
      JSON.parse(raw) as RecentMission[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.code === 'string' &&
          typeof item.title === 'string' &&
          MISSION_FAMILIES.includes(
            item.family
          )
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

async function rememberAIMissions(
  missions: Mission[]
) {
  const additions: RecentMission[] =
    missions
      .filter(
        (mission) =>
          mission.family &&
          MISSION_FAMILIES.includes(
            mission.family
          )
      )
      .map((mission) => ({
        code: mission.code,
        family: mission.family!,
        title: mission.title,
        createdAt:
          new Date().toISOString(),
      }));

  if (additions.length === 0) {
    return;
  }

  try {
    const current =
      await loadRecentAIMissions();

    await AsyncStorage.setItem(
      AI_MISSION_HISTORY_KEY,
      JSON.stringify([
        ...additions,
        ...current,
      ].slice(0, 30))
    );
  } catch {
    // Mission history should never block a journey.
  }
}

function buildMissionSlots(
  count: number,
  routeDistanceMeters: number,
  milestones?: number[]
): MissionSlot[] {
  if (count <= 0) return [];

  const fallback =
    Array.from(
      { length: count },
      (_, index) =>
        (index + 1) /
        (count + 1)
    );

  const source =
    milestones &&
    milestones.length === count
      ? milestones
      : fallback;

  return source.map(
    (progress, index) => {
      const ratio =
        count <= 1
          ? 0
          : index /
            (count - 1);

      const phase:
        MissionSlot['phase'] =
        index === 0
          ? 'warmup'
          : index === count - 1
            ? 'anticipate'
            : ratio < 0.55
              ? 'discover'
              : 'shift';

      return {
        index: index + 1,
        phase,
        targetMeters:
          Math.max(
            15,
            Math.round(
              routeDistanceMeters *
                progress
            )
          ),
      };
    }
  );
}

export function isAIEngineConfigured() {
  return (
    AI_ENDPOINT.length > 0 &&
    SUPABASE_PUBLISHABLE_KEY.length > 0
  );
}

export async function testAIEngineConnection(): Promise<AIConnectionTestResult> {
  if (!isAIEngineConfigured()) {
    return {
      ok: false,
      message:
        'AI backend URL or Supabase publishable key is missing.',
    };
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          apikey:
            SUPABASE_PUBLISHABLE_KEY,
        },
        body:
          JSON.stringify({
            mode: 'rank-scenes',
            moodId: 'weird',
            context: 'day',
            minutes: 30,
            candidates: [
              {
                id: 'test-art',
                kind: 'artwork',
                label: '公共藝術',
                name: '測試公共藝術',
                straightDistanceMeters: 240,
                deterministicScore: 78,
                qualityScore: 82,
                tier: 'primary',
                previouslyVisited: false,
                tags: {
                  tourism: 'artwork',
                  artwork_type: 'sculpture',
                },
                scoreReasons: [
                  'specific visual identity',
                ],
              },
              {
                id: 'test-square',
                kind: 'square',
                label: '廣場',
                name: '測試廣場',
                straightDistanceMeters: 180,
                deterministicScore: 68,
                qualityScore: 63,
                tier: 'primary',
                previouslyVisited: false,
                tags: {
                  place: 'square',
                },
                scoreReasons: [
                  'generic open space',
                ],
              },
            ],
          }),
        signal: controller.signal,
      });

    const raw =
      await response.text();

    if (!response.ok) {
      return {
        ok: false,
        message:
          `HTTP ${response.status}: ${raw.slice(0, 280)}`,
      };
    }

    let parsed:
      | RankScenesResponse
      | null = null;

    try {
      parsed =
        JSON.parse(raw) as RankScenesResponse;
    } catch {
      return {
        ok: false,
        message:
          'AI backend returned invalid JSON.',
      };
    }

    if (
      !Array.isArray(
        parsed.rankedSceneIds
      ) ||
      parsed.rankedSceneIds.length <
        1
    ) {
      return {
        ok: false,
        message:
          'OpenAI responded, but the structured ranking payload was invalid.',
      };
    }

    return {
      ok: true,
      message:
        parsed.selectionNote?.trim() ||
        `Structured ranking received: ${parsed.rankedSceneIds.join(', ')}`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown AI connection error.',
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeTags(
  tags: Record<string, string>
) {
  const next: Record<string, string> = {};

  for (const key of SAFE_TAG_KEYS) {
    const value = tags[key];

    if (typeof value === 'string') {
      next[key] = value.slice(0, 220);
    }
  }

  return next;
}

function serializeScene(
  scene: SceneCandidate
): SafeScene {
  return {
    id: scene.id,
    kind: scene.kind,
    label: scene.label,
    name: scene.name.slice(0, 120),
    straightDistanceMeters:
      Math.round(
        scene.straightDistanceMeters
      ),
    deterministicScore:
      Math.round(scene.score),
    qualityScore:
      Math.round(scene.qualityScore),
    tier: scene.tier,
    previouslyVisited:
      scene.previouslyVisited,
    tags: safeTags(scene.tags),
    scoreReasons:
      scene.scoreReasons
        .slice(0, 8)
        .map((reason) =>
          reason.slice(0, 100)
        ),
  };
}

async function postAI<T>(
  payload: unknown,
  timeoutMs: number
): Promise<T | null> {
  if (!AI_ENDPOINT) {
    return null;
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          apikey:
            SUPABASE_PUBLISHABLE_KEY,
        },
        body:
          JSON.stringify(payload),
        signal: controller.signal,
      });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function rankSceneCandidatesWithAI(
  args: {
    candidates: SceneCandidate[];
    moodId: MoodId;
    context: LightContext;
    minutes: number;
  }
): Promise<AIRankingResult> {
  if (
    !isAIEngineConfigured() ||
    args.candidates.length < 2
  ) {
    return {
      candidates:
        args.candidates,
      usedAI: false,
    };
  }

  const pool =
    args.candidates.slice(0, 14);

  const result =
    await postAI<RankScenesResponse>(
      {
        mode: 'rank-scenes',
        moodId: args.moodId,
        context: args.context,
        minutes: args.minutes,
        candidates:
          pool.map(serializeScene),
      },
      6500
    );

  if (
    !result ||
    !Array.isArray(
      result.rankedSceneIds
    )
  ) {
    return {
      candidates:
        args.candidates,
      usedAI: false,
    };
  }

  const byId =
    new Map(
      pool.map(
        (scene) =>
          [scene.id, scene] as const
      )
    );

  const seen =
    new Set<string>();

  const ranked =
    result.rankedSceneIds
      .filter((id) => {
        if (
          typeof id !== 'string' ||
          seen.has(id) ||
          !byId.has(id)
        ) {
          return false;
        }

        seen.add(id);
        return true;
      })
      .map(
        (id) =>
          byId.get(id)!
      );

  if (ranked.length === 0) {
    return {
      candidates:
        args.candidates,
      usedAI: false,
    };
  }

  const remainder =
    args.candidates.filter(
      (scene) =>
        !seen.has(scene.id)
    );

  return {
    candidates: [
      ...ranked,
      ...remainder,
    ],
    usedAI: true,
  };
}

function isMissionDraft(
  value: unknown
): value is MissionDraft {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const mission =
    value as Partial<MissionDraft>;

  return (
    typeof mission.code ===
      'string' &&
    mission.code.length > 0 &&
    typeof mission.family ===
      'string' &&
    MISSION_FAMILIES.includes(
      mission.family as MissionFamily
    ) &&
    typeof mission.title ===
      'string' &&
    mission.title.length > 0 &&
    typeof mission.instruction ===
      'string' &&
    mission.instruction.length > 0 &&
    typeof mission.completion ===
      'string' &&
    mission.completion.length > 0 &&
    typeof mission.photo ===
      'boolean'
  );
}

function normalizeMission(
  draft: MissionDraft,
  id: string,
  portable: boolean
): Mission {
  return {
    id,
    code:
      draft.code
        .trim()
        .slice(0, 40),
    family: draft.family,
    title:
      draft.title
        .trim()
        .slice(0, 90),
    instruction:
      draft.instruction
        .trim()
        .slice(0, 260),
    completion:
      draft.completion
        .trim()
        .slice(0, 180),
    photo: draft.photo,
    portable,
  };
}

function missionPlanPassesQualityGate(
  result: MissionPlanResponse,
  hiddenSceneName: string
) {
  const side =
    result.sideMissions;

  const codes =
    side.map(
      (mission) =>
        mission.code
          .trim()
          .toLowerCase()
    );

  const titles =
    side.map(
      (mission) =>
        mission.title
          .trim()
          .toLowerCase()
    );

  const families =
    side.map(
      (mission) =>
        mission.family
    );

  if (
    new Set(codes).size !==
      codes.length ||
    new Set(titles).size !==
      titles.length ||
    new Set(families).size !==
      families.length
  ) {
    return false;
  }

  if (
    side.filter(
      (mission) =>
        mission.photo
    ).length > 1
  ) {
    return false;
  }

  const hiddenName =
    hiddenSceneName
      .trim()
      .toLowerCase();

  for (const mission of side) {
    const combined =
      `${mission.title} ${mission.instruction} ${mission.completion}`
        .toLowerCase();

    if (
      hiddenName.length >= 2 &&
      combined.includes(
        hiddenName
      )
    ) {
      return false;
    }

    if (
      VAGUE_PHRASES.some(
        (phrase) =>
          combined.includes(
            phrase
          )
      )
    ) {
      return false;
    }
  }

  return true;
}

export async function generateJourneyWithAI(
  args: {
    scene: SceneCandidate;
    moodId: MoodId;
    context: LightContext;
    minutes: number;
    sideMissionCount: number;
    routeDistanceMeters: number;
    routeDurationSeconds?: number;
    missionMilestones?: number[];
  }
): Promise<AIJourneyResult | null> {
  if (!isAIEngineConfigured()) {
    return null;
  }

  const recentMissions =
    await loadRecentAIMissions();

  const result =
    await postAI<MissionPlanResponse>(
      {
        mode:
          'generate-missions',
        moodId: args.moodId,
        context: args.context,
        minutes: args.minutes,
        sideMissionCount:
          args.sideMissionCount,
        missionSlots:
          buildMissionSlots(
            args.sideMissionCount,
            args.routeDistanceMeters,
            args.missionMilestones
          ),
        recentMissions:
          recentMissions
            .slice(0, 18)
            .map((mission) => ({
              code: mission.code,
              family: mission.family,
              title: mission.title,
            })),
        route: {
          distanceMeters:
            Math.round(
              args.routeDistanceMeters
            ),
          durationSeconds:
            args.routeDurationSeconds
              ? Math.round(
                  args.routeDurationSeconds
                )
              : null,
        },
        scene:
          serializeScene(args.scene),
      },
      10000
    );

  if (
    !result ||
    !Array.isArray(
      result.sideMissions
    ) ||
    result.sideMissions.length !==
      args.sideMissionCount ||
    !result.sideMissions.every(
      isMissionDraft
    ) ||
    !isMissionDraft(
      result.arrivalMission
    ) ||
    !missionPlanPassesQualityGate(
      result,
      args.scene.name
    )
  ) {
    return null;
  }

  const sideMissions =
    result.sideMissions.map(
      (mission, index) =>
        normalizeMission(
          mission,
          `ai-side-${args.scene.id}-${index + 1}`,
          true
        )
    );

  const arrivalMission =
    normalizeMission(
      result.arrivalMission,
      `ai-arrival-${args.scene.id}`,
      false
    );

  await rememberAIMissions(
    sideMissions
  );

  return {
    sideMissions,
    arrivalMission,
  };
}
