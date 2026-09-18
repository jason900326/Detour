import type {
  ColorChoice,
  GeoPoint,
  JourneyPlan,
  LightContext,
  MoodId,
  SideEvent,
  SideEventGaze,
} from './journey-engine';
import type { NavigationRoute } from './navigation-engine';
import type { SceneCandidate } from './scene-engine';
import type {
  SessionPhoto,
  SessionSceneFailure,
} from './app-model';
import type { WalkingRoute } from './routing-engine';
import { isRecord } from './storage';

export type ActiveJourneySnapshot = {
  version: 1;
  stage: 'journey' | 'arrival';
  selectedTime: string | null;
  selectedMood: MoodId | null;
  selectedColor: ColorChoice | null;
  latitude: number | null;
  longitude: number | null;
  detourStart: GeoPoint | null;
  activeTrace: GeoPoint[];
  plan: JourneyPlan;
  selectedScene: SceneCandidate;
  walkingRoute: WalkingRoute;
  navigationRoute: NavigationRoute;
  navigationBeatIndex: number;
  beatRemainingMeters: number;
  deviceHeading: number;
  detourStartedAt: string;
  sceneFailures: SessionSceneFailure[];
  activeSideEvent: SideEvent | null;
  sideEventPhotoConfirmed: boolean;
  sideEventSlot: number;
  sideEventsShown: number;
  sideEventReplacements: number;
  sideEventSeenIds: string[];
  previousSideEventGaze: SideEventGaze | null;
  traveledMeters: number;
  lightContext: LightContext | null;
  photos: SessionPhoto[];
  effectiveMovingSeconds: number;
};

export function parseActiveJourneySnapshot(
  raw: unknown
): ActiveJourneySnapshot | null {
  if (!isRecord(raw)) return null;

  const snapshot = raw as Partial<ActiveJourneySnapshot>;
  if (
    snapshot.version !== 1 ||
    (snapshot.stage !== 'journey' && snapshot.stage !== 'arrival') ||
    !snapshot.plan ||
    !snapshot.selectedScene ||
    !snapshot.walkingRoute ||
    !snapshot.navigationRoute ||
    typeof snapshot.detourStartedAt !== 'string' ||
    !Array.isArray(snapshot.activeTrace) ||
    !Array.isArray(snapshot.sceneFailures) ||
    !Array.isArray(snapshot.photos) ||
    !Number.isFinite(snapshot.navigationBeatIndex) ||
    !Number.isFinite(snapshot.beatRemainingMeters) ||
    !Number.isFinite(snapshot.effectiveMovingSeconds)
  ) {
    return null;
  }

  return snapshot as ActiveJourneySnapshot;
}
