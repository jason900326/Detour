import Constants from 'expo-constants';

// package.json is the release version source. app.config.js exposes it to Expo.
export const DETOUR_BUILD_VERSION =
  Constants.expoConfig?.version ?? '0.0.0';
