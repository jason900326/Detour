declare const process: {
  env: Record<string, string | undefined>;
};

const DEFAULT_SUPABASE_URL =
  'https://ldlhzyfubjbuumikrkuv.supabase.co';

const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_qhZ09r25etnEi-0dURQCYw_EStro0t_';

function publicEnv(name: string) {
  return process.env[name]?.trim();
}

export const DETOUR_API_CONFIG = Object.freeze({
  aiEndpoint:
    publicEnv('EXPO_PUBLIC_DETOUR_AI_URL') ||
    `${DEFAULT_SUPABASE_URL}/functions/v1/detour-ai`,
  sceneEndpoint:
    publicEnv('EXPO_PUBLIC_DETOUR_SCENE_URL') ||
    `${DEFAULT_SUPABASE_URL}/functions/v1/detour-scene`,
  playtestEndpoint:
    publicEnv('EXPO_PUBLIC_DETOUR_PLAYTEST_URL') ||
    `${DEFAULT_SUPABASE_URL}/functions/v1/detour-playtest`,
  supabasePublishableKey:
    publicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY,
});
