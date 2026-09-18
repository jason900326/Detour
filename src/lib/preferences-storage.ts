import {
  DEFAULT_PREFERENCES,
  type DetourPreferences,
} from './app-model';
import { isRecord } from './storage';

/**
 * Preferences are user-controlled persisted input. Only known fields and
 * enum values are allowed to cross into the app state.
 */
export function parseDetourPreferences(raw: unknown): DetourPreferences {
  if (!isRecord(raw)) return DEFAULT_PREFERENCES;

  return {
    onboardingComplete:
      typeof raw.onboardingComplete === 'boolean'
        ? raw.onboardingComplete
        : DEFAULT_PREFERENCES.onboardingComplete,
    walkingPace:
      raw.walkingPace === 'relaxed' ||
      raw.walkingPace === 'normal' ||
      raw.walkingPace === 'brisk'
        ? raw.walkingPace
        : DEFAULT_PREFERENCES.walkingPace,
    preferLegibleRoutesAtNight:
      typeof raw.preferLegibleRoutesAtNight === 'boolean'
        ? raw.preferLegibleRoutesAtNight
        : DEFAULT_PREFERENCES.preferLegibleRoutesAtNight,
    indoorTest:
      typeof raw.indoorTest === 'boolean'
        ? raw.indoorTest
        : DEFAULT_PREFERENCES.indoorTest,
  };
}
