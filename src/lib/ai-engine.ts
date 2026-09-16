import { DETOUR_API_CONFIG } from './app-config';
import type { LightContext, MoodId } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

const {
  aiEndpoint: AI_ENDPOINT,
  supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
} = DETOUR_API_CONFIG;

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

export type AIRankingResult = {
  candidates: SceneCandidate[];
  usedAI: boolean;
};

export type AIConnectionTestResult = {
  ok: boolean;
  message: string;
};

export function isAIEngineConfigured() {
  return AI_ENDPOINT.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;
}

export async function testAIEngineConnection(): Promise<AIConnectionTestResult> {
  if (!isAIEngineConfigured()) {
    return {
      ok: false,
      message: 'AI backend URL or Supabase publishable key is missing.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        mode: 'rank-scenes',
        moodId: 'wander',
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
            scoreReasons: ['specific visual identity'],
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
            tags: { place: 'square' },
            scoreReasons: ['generic open space'],
          },
        ],
      }),
      signal: controller.signal,
    });

    const raw = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}: ${raw.slice(0, 280)}`,
      };
    }

    let parsed: RankScenesResponse | null = null;
    try {
      parsed = JSON.parse(raw) as RankScenesResponse;
    } catch {
      return { ok: false, message: 'AI backend returned invalid JSON.' };
    }

    if (!Array.isArray(parsed.rankedSceneIds) || parsed.rankedSceneIds.length < 1) {
      return {
        ok: false,
        message: 'OpenAI responded, but the structured ranking payload was invalid.',
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
      message: error instanceof Error ? error.message : 'Unknown AI connection error.',
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeTags(tags: Record<string, string>) {
  const next: Record<string, string> = {};

  for (const key of SAFE_TAG_KEYS) {
    const value = tags[key];
    if (typeof value === 'string') next[key] = value.slice(0, 220);
  }

  return next;
}

function serializeScene(scene: SceneCandidate): SafeScene {
  return {
    id: scene.id,
    kind: scene.kind,
    label: scene.label,
    name: scene.name.slice(0, 120),
    straightDistanceMeters: Math.round(scene.straightDistanceMeters),
    deterministicScore: Math.round(scene.score),
    qualityScore: Math.round(scene.qualityScore),
    tier: scene.tier,
    previouslyVisited: scene.previouslyVisited,
    tags: safeTags(scene.tags),
    scoreReasons: scene.scoreReasons
      .slice(0, 8)
      .map((reason) => reason.slice(0, 100)),
  };
}

async function postAI<T>(payload: unknown, timeoutMs: number): Promise<T | null> {
  if (!AI_ENDPOINT) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function rankSceneCandidatesWithAI(args: {
  candidates: SceneCandidate[];
  moodId: MoodId;
  context: LightContext;
  minutes: number;
}): Promise<AIRankingResult> {
  if (!isAIEngineConfigured() || args.candidates.length < 2) {
    return { candidates: args.candidates, usedAI: false };
  }

  const pool = args.candidates.slice(0, 14);
  const result = await postAI<RankScenesResponse>(
    {
      mode: 'rank-scenes',
      moodId: args.moodId,
      context: args.context,
      minutes: args.minutes,
      candidates: pool.map(serializeScene),
    },
    6500
  );

  if (!result || !Array.isArray(result.rankedSceneIds)) {
    return { candidates: args.candidates, usedAI: false };
  }

  const byId = new Map(pool.map((scene) => [scene.id, scene] as const));
  const seen = new Set<string>();
  const ranked = result.rankedSceneIds
    .filter((id) => {
      if (typeof id !== 'string' || seen.has(id) || !byId.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => byId.get(id)!);

  if (ranked.length === 0) {
    return { candidates: args.candidates, usedAI: false };
  }

  return {
    candidates: [
      ...ranked,
      ...args.candidates.filter((scene) => !seen.has(scene.id)),
    ],
    usedAI: true,
  };
}
