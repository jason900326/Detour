import type {
  GeoPoint,
  LightContext,
  Mission,
  MoodId,
} from './journey-engine';
import type { SceneCandidate } from './scene-engine';

export type Stage =
  | 'boot'
  | 'onboarding'
  | 'settings'
  | 'time'
  | 'mood'
  | 'preparing'
  | 'ready'
  | 'journey'
  | 'mission'
  | 'arrival'
  | 'sceneIssue'
  | 'developing'
  | 'finish'
  | 'passport'
  | 'passportDetail';

export type WalkingPace = 'relaxed' | 'normal' | 'brisk';

export type DetourPreferences = {
  onboardingComplete: boolean;
  walkingPace: WalkingPace;
  indoorTest: boolean;
};

export const DEFAULT_PREFERENCES: DetourPreferences = {
  onboardingComplete: false,
  walkingPace: 'normal',
  indoorTest: false,
};

export type SceneIssueReason =
  | 'closed'
  | 'inaccessible'
  | 'not-worth-it'
  | 'wrong-now';

export type SessionSceneFailure = {
  sceneId: string;
  sceneName: string;
  reason: SceneIssueReason;
  createdAt: string;
};

export type DetourPrewarm = {
  point: GeoPoint;
  context: LightContext;
  candidatesByMood: Partial<Record<MoodId, SceneCandidate[]>>;
  rankedIdsByMood: Partial<Record<MoodId, string[]>>;
  aiUsedByMood: Partial<Record<MoodId, boolean>>;
  createdAt: number;
};

export type CameraSource = 'side' | 'arrival' | 'free';

export type SessionPhoto = {
  id: string;
  uri: string;
  missionCode: string;
  missionTitle: string;
  source?: 'mission' | 'free';
  savedToLibrary?: boolean;
};

export type CameraRouteResult = {
  requestId: string;
  source: CameraSource;
  photo: SessionPhoto;
};

export type MissionResult = 'completed' | 'skipped';

export type PassportMission = {
  code: string;
  title: string;
  instruction: string;
  completion: string;
  result?: MissionResult;
  photoRequired?: boolean;
};

export type PassportEntry = {
  id: string;
  completedAt: string;
  city: string;
  minutes: number;
  moodId: string;
  moodLabel: string;
  moodCode: string;
  discoveries: number;
  route?: GeoPoint[];
  distanceMeters?: number;
  contextCode?: string;
  threadCode?: string;
  threadLabel?: string;
  photoCount?: number;
  rollCapacity?: number;
  photos?: SessionPhoto[];
  missions?: PassportMission[];
  sceneId?: string;
  sceneName?: string;
  sceneKind?: string;
  sceneLabel?: string;
  scenePoint?: GeoPoint;
  plannedRouteDistanceMeters?: number;
  plannedRouteDurationSeconds?: number;
  plannedRoute?: GeoPoint[];
  startedAt?: string;
  actualDurationMinutes?: number;
  rerouteCount?: number;
  sceneFailures?: SessionSceneFailure[];
};

export const CAMERA_RESULT_KEY = '@detour/camera/result/v1';
export const PASSPORT_KEY = '@detour/passport/v1';
export const PREFERENCES_KEY = '@detour/preferences/v1';

export const TIME_STEPS = [15, 30, 45, 60, 90] as const;
export const TIME_MIN = TIME_STEPS[0];
export const TIME_MAX = TIME_STEPS[TIME_STEPS.length - 1];

export const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走', code: 'WANDER' },
  { id: 'food', label: '吃東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜', code: 'QUIET' },
  { id: 'weird', label: '這是哪', code: 'WEIRD' },
  { id: 'color', label: '色色的', code: 'COLOR' },
  { id: 'surprise', label: '命運', code: 'SURPRISE' },
];

export const FREE_CAMERA_MISSION: Mission = {
  id: 'free-frame',
  code: 'FREE FRAME',
  title: '留下現在看到的東西。',
  instruction: '這張照片不會完成任何任務，只是這趟 DETOUR 的自由紀錄。',
  completion: '拍或不拍都不影響主線。',
  photo: false,
  portable: true,
};

export function getPaceDistanceScale(pace: WalkingPace) {
  if (pace === 'relaxed') return 0.8;
  if (pace === 'brisk') return 1.15;
  return 1;
}

export function walkingPaceLabel(pace: WalkingPace) {
  if (pace === 'relaxed') return '慢一點';
  if (pace === 'brisk') return '快一點';
  return '一般';
}
