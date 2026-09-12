import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Directory, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Circle, Polyline } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';

import {
  buildJourneyPlan,
  COLORS,
  getJourneyProfile,
  getLightContext,
  type ColorChoice,
  type GeoPoint,
  type JourneyPlan,
  type LightContext,
  type Mission,
  type MoodId,
} from '../lib/journey-engine';

import {
  buildNavigationRouteFromPolyline,
  distanceToPolyline,
  guidanceBearingOnPolyline,
  moveToward,
  relativeArrowDegrees,
  remainingDistanceOnPolyline,
  type NavigationRoute,
} from '../lib/navigation-engine';

import {
  buildSceneArrivalMission,
  findSceneCandidates,
  type SceneCandidate,
} from '../lib/scene-engine';

import {
  generateJourneyWithAI,
  isAIEngineConfigured,
  rankSceneCandidatesWithAI,
  testAIEngineConnection,
} from '../lib/ai-engine';

import {
  fetchWalkingRoute,
  resolveRoutedScene,
  type WalkingRoute,
} from '../lib/routing-engine';

import {
  loadSceneFeedback,
  saveSceneFeedback,
  type SceneFeedbackKind,
} from '../lib/scene-feedback';

import {
  buildPlaytestReport,
  clearPlaytestSessions,
  createPlaytestSession,
  DETOUR_PLAYTEST_VERSION,
  getPlaytestTesterId,
  loadPlaytestSessions,
  syncAllPlaytestSessions,
  updatePlaytestSession,
  type PlaytestFeedbackReason,
  type PlaytestRating,
  type PlaytestSession,
} from '../lib/playtest-analytics';

type Stage =
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

type WalkingPace =
  | 'relaxed'
  | 'normal'
  | 'brisk';

type DetourPreferences = {
  onboardingComplete: boolean;
  walkingPace: WalkingPace;
  indoorTest: boolean;
};

const DEFAULT_PREFERENCES: DetourPreferences = {
  onboardingComplete: false,
  walkingPace: 'normal',
  indoorTest: false,
};

type SceneIssueReason =
  | 'closed'
  | 'inaccessible'
  | 'not-worth-it'
  | 'wrong-now';

type SessionSceneFailure = {
  sceneId: string;
  sceneName: string;
  reason: SceneIssueReason;
  createdAt: string;
};

type DetourPrewarm = {
  point: GeoPoint;
  context: LightContext;
  candidatesByMood: Partial<Record<MoodId, SceneCandidate[]>>;
  rankedIdsByMood: Partial<Record<MoodId, string[]>>;
  aiUsedByMood: Partial<Record<MoodId, boolean>>;
  createdAt: number;
};

type CameraSource = 'side' | 'arrival' | 'free';

type CameraRouteResult = {
  requestId: string;
  source: CameraSource;
  photo: SessionPhoto;
};

const CAMERA_RESULT_KEY = '@detour/camera/result/v1';

type SessionPhoto = {
  id: string;
  uri: string;
  missionCode: string;
  missionTitle: string;
  source?: 'mission' | 'free';
  savedToLibrary?: boolean;
};

type MissionResult = 'completed' | 'skipped';

type PassportMission = {
  code: string;
  title: string;
  instruction: string;
  completion: string;
  result?: MissionResult;
  photoRequired?: boolean;
};

type PassportEntry = {
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

const PASSPORT_KEY = '@detour/passport/v1';
const PREFERENCES_KEY = '@detour/preferences/v1';

const INK = '#11110F';
const BONE = '#F1EFE7';
const MUTED = '#77736B';
const LINE = '#C9C5B8';
const SIGNAL = '#FF5A36';
const SOFT = '#E5E1D6';

const TIME_STEPS = [15, 30, 45, 60, 90] as const;
const TIME_MIN = TIME_STEPS[0];
const TIME_MAX = TIME_STEPS[TIME_STEPS.length - 1];

const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走', code: 'WANDER' },
  { id: 'food', label: '吃東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜', code: 'QUIET' },
  { id: 'weird', label: '這是哪', code: 'WEIRD' },
  { id: 'color', label: '色色的', code: 'COLOR' },
  { id: 'surprise', label: '命運', code: 'SURPRISE' },
];

const FREE_CAMERA_MISSION: Mission = {
  id: 'free-frame',
  code: 'FREE FRAME',
  title: '留下現在看到的東西。',
  instruction: '這張照片不會完成任何任務，只是這趟 DETOUR 的自由紀錄。',
  completion: '拍或不拍都不影響主線。',
  photo: false,
  portable: true,
};

function getPaceDistanceScale(
  pace: WalkingPace
) {
  if (pace === 'relaxed') return 0.8;
  if (pace === 'brisk') return 1.15;
  return 1;
}

function walkingPaceLabel(
  pace: WalkingPace
) {
  if (pace === 'relaxed') return '慢一點';
  if (pace === 'brisk') return '快一點';
  return '一般';
}

function moodSymbol(moodId: MoodId) {
  if (moodId === 'wander') return '↗';
  if (moodId === 'food') return '♨';
  if (moodId === 'quiet') return '☾';
  if (moodId === 'weird') return '?';
  if (moodId === 'color') return '◉';
  return '✦';
}

function moodHint(moodId: MoodId) {
  if (moodId === 'wander') {
    return '不設目的，讓路線自己長出來。';
  }

  if (moodId === 'food') {
    return '讓 DETOUR 幫你決定去哪裡吃。';
  }

  if (moodId === 'quiet') {
    return '少一點聲音，留一點空白。';
  }

  if (moodId === 'weird') {
    return '去找平常會錯過的小東西。';
  }

  if (moodId === 'color') {
    return '整趟只追同一個顏色。';
  }

  return '今天的方向完全交給 DETOUR。';
}

function isDrinkLikeFoodCandidate(scene: SceneCandidate) {
  const amenity = scene.tags.amenity ?? '';
  const shop = scene.tags.shop ?? '';
  const cuisine = (scene.tags.cuisine ?? '').toLowerCase();

  return (
    amenity === 'cafe' ||
    ['beverages', 'coffee', 'tea'].includes(shop) ||
    /(bubble_tea|tea|coffee|juice|smoothie)/.test(cuisine)
  );
}

function isMealFoodCandidate(scene: SceneCandidate) {
  return ['restaurant', 'fast_food', 'food_court'].includes(
    scene.tags.amenity ?? ''
  );
}

function applyFoodDestinationWeight(candidates: SceneCandidate[]) {
  // Product rule: when both groups are healthy enough, Food mode chooses a
  // drink-like destination about 80% of the time and a meal about 20%.
  const preferDrink = Math.random() < 0.8;
  const preferred = candidates.filter((scene) =>
    preferDrink ? isDrinkLikeFoodCandidate(scene) : isMealFoodCandidate(scene)
  );

  // Keep route quality/safety first. If there are too few candidates in the
  // rolled category, fall back to the full qualified pool.
  if (preferred.length >= 3) return preferred;

  return [
    ...preferred,
    ...candidates.filter((scene) => !preferred.includes(scene)),
  ];
}

function ticketSerial(
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

function getFilmRollCapacity(_minutes: number) {
  // Every DETOUR keeps one small roll. Camera-first Side Quests plus the
  // arrival frame are designed to fit inside these six intentional photos.
  return 6;
}

function parseMinutes(value: string | null) {
  if (!value) return 0;
  if (value === '90+') return 90;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getRouteDistance(points: GeoPoint[]) {
  if (points.length < 2) return 0;

  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += getDistanceInMeters(
      points[index - 1].latitude,
      points[index - 1].longitude,
      points[index].latitude,
      points[index].longitude
    );
  }

  return total;
}

function offsetPoint(
  point: GeoPoint,
  meters: number,
  bearingDegrees: number
): GeoPoint {
  const earthRadius = 6371000;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = (point.latitude * Math.PI) / 180;
  const longitude = (point.longitude * Math.PI) / 180;
  const angularDistance = meters / earthRadius;

  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) *
        Math.sin(angularDistance) *
        Math.cos(bearing)
  );

  const nextLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(nextLatitude)
    );

  return {
    latitude: (nextLatitude * 180) / Math.PI,
    longitude: (nextLongitude * 180) / Math.PI,
  };
}

function formatPassportDate(iso: string) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} · ${hour}:${minute}`;
}

function formatClockTime(iso?: string) {
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

function contextCode(context: LightContext | null) {
  if (context === 'night') return 'NIGHT';
  if (context === 'twilight') return 'TWILIGHT';
  if (context === 'day') return 'DAY';
  return 'AUTO';
}

export default function HomeScreen() {
  const router = useRouter();
  const activeCameraRequestRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>('boot');
  const [preferences, setPreferences] =
    useState<DetourPreferences>(DEFAULT_PREFERENCES);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingFromSettings, setOnboardingFromSettings] =
    useState(false);

  const [ticketBuildStatus, setTicketBuildStatus] =
    useState('等待開始…');

  const [selectedTime, setSelectedTime] = useState<string | null>('15');
  const [sliderDisplayMinutes, setSliderDisplayMinutes] = useState(15);
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
  const [selectedColor, setSelectedColor] = useState<ColorChoice | null>(null);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [detourStart, setDetourStart] = useState<GeoPoint | null>(null);
  const [activeTrace, setActiveTrace] = useState<GeoPoint[]>([]);

  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [selectedScene, setSelectedScene] =
    useState<SceneCandidate | null>(null);
  const [walkingRoute, setWalkingRoute] =
    useState<WalkingRoute | null>(null);

  const [navigationRoute, setNavigationRoute] =
    useState<NavigationRoute | null>(null);
  const [navigationBeatIndex, setNavigationBeatIndex] = useState(0);
  const [beatRemainingMeters, setBeatRemainingMeters] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [showNextBeatMap, setShowNextBeatMap] = useState(false);
  const [questPulse, setQuestPulse] = useState<
    'side' | 'final' | null
  >(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteFailed, setRerouteFailed] = useState(false);
  const [rerouteCount, setRerouteCount] = useState(0);
  const [detourStartedAt, setDetourStartedAt] =
    useState<string | null>(null);
  const [sceneFailures, setSceneFailures] =
    useState<SessionSceneFailure[]>([]);
  const [replacementLoading, setReplacementLoading] =
    useState(false);

  const [sideMissionIndex, setSideMissionIndex] = useState(0);
  const [missionRevealedIndex, setMissionRevealedIndex] =
    useState<number | null>(null);
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [lightContext, setLightContext] =
    useState<LightContext | null>(null);

  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [missionResults, setMissionResults] =
    useState<Record<string, MissionResult>>({});

  const [passport, setPassport] = useState<PassportEntry[]>([]);
  const [passportLoaded, setPassportLoaded] = useState(false);
  const [lastCompletedEntry, setLastCompletedEntry] =
    useState<PassportEntry | null>(null);
  const [selectedPassportId, setSelectedPassportId] =
    useState<string | null>(null);
  const [passportPhotoIndex, setPassportPhotoIndex] = useState(0);

  const [playtestSessions, setPlaytestSessions] =
    useState<PlaytestSession[]>([]);
  const [playtestTesterId, setPlaytestTesterId] =
    useState('DTR-LOCAL');
  const [
    lastCompletedPlaytestSessionId,
    setLastCompletedPlaytestSessionId,
  ] = useState<string | null>(null);
  const [
    playtestRating,
    setPlaytestRating,
  ] = useState<PlaytestRating | null>(null);
  const [
    playtestFeedbackReasons,
    setPlaytestFeedbackReasons,
  ] = useState<
    PlaytestFeedbackReason[]
  >([]);
  const [
    playtestSyncing,
    setPlaytestSyncing,
  ] = useState(false);
  const [lastAIResult, setLastAIResult] =
    useState<
      'not-run' | 'ai' | 'fallback'
    >('not-run');
  const [
    aiConnectionTesting,
    setAIConnectionTesting,
  ] = useState(false);

  const locationWatcher =
    useRef<Location.LocationSubscription | null>(null);
  const headingWatcher =
    useRef<Location.LocationSubscription | null>(null);
  const missionResultsRef = useRef<Record<string, MissionResult>>({});
  const lastTracePointRef = useRef<GeoPoint | null>(null);
  const planRef = useRef<JourneyPlan | null>(null);
  const navigationRouteRef = useRef<NavigationRoute | null>(null);
  const navigationBeatIndexRef = useRef(0);
  const beatRemainingMetersRef = useRef(0);
  const selectedSceneRef = useRef<SceneCandidate | null>(null);
  const offRouteCountRef = useRef(0);
  const rerouteInFlightRef = useRef(false);
  const checkpointLockedRef = useRef(false);
  const playtestSessionIdRef =
    useRef<string | null>(null);
  const rerouteCountRef = useRef(0);
  const detourStartedAtRef = useRef<string | null>(null);
  const sceneFailuresRef =
    useRef<SessionSceneFailure[]>([]);
  const sideMissionIndexRef = useRef(0);
  const traveledMetersRef = useRef(0);
  const stageRef = useRef<Stage>('boot');
  const prewarmRef = useRef<DetourPrewarm | null>(null);
  const prewarmInFlightRef = useRef(false);
  const shareTicketRef = useRef<any>(null);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenY = useRef(new Animated.Value(0)).current;
  const routeProgress = useRef(new Animated.Value(0)).current;
  const timeSliderProgress = useRef(
    new Animated.Value(0)
  ).current;
  const timeSliderWidthRef = useRef(1);
  const timeSliderStartProgressRef = useRef(0);
  const timeSliderDisplayRef = useRef(15);
  const minutePulse = useRef(new Animated.Value(1)).current;
  const homeEntrance = useRef(new Animated.Value(0)).current;
  const homeRouteMotion = useRef(new Animated.Value(0)).current;

  const mood = useMemo(
    () => MOODS.find((item) => item.id === selectedMood) ?? null,
    [selectedMood]
  );

  const selectedMinutes = parseMinutes(selectedTime);
  const rollCapacity = getFilmRollCapacity(selectedMinutes || 15);
  const previewProfile = getJourneyProfile(selectedMinutes || 15);

  const timeIndexFromRatio = (ratio: number) =>
    Math.max(
      0,
      Math.min(
        TIME_STEPS.length - 1,
        Math.round(Math.max(0, Math.min(1, ratio)) * (TIME_STEPS.length - 1))
      )
    );

  const snapMinutesFromRatio = (ratio: number) =>
    TIME_STEPS[timeIndexFromRatio(ratio)];

  const ratioForMinutes = (minutes: number) => {
    const exactIndex = TIME_STEPS.findIndex((value) => value === minutes);
    const nearestIndex =
      exactIndex >= 0
        ? exactIndex
        : TIME_STEPS.reduce(
            (best, value, index) =>
              Math.abs(value - minutes) < Math.abs(TIME_STEPS[best] - minutes)
                ? index
                : best,
            0
          );

    return nearestIndex / (TIME_STEPS.length - 1);
  };

  const pulseMinute = () => {
    minutePulse.stopAnimation();
    minutePulse.setValue(0.965);
    Animated.spring(minutePulse, {
      toValue: 1,
      speed: 28,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  };

  const previewSliderRatio = (ratio: number, haptic = true) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    timeSliderProgress.setValue(clamped);
    const nextMinutes = snapMinutesFromRatio(clamped);

    if (nextMinutes !== timeSliderDisplayRef.current) {
      timeSliderDisplayRef.current = nextMinutes;
      setSliderDisplayMinutes(nextMinutes);
      pulseMinute();
      if (haptic) void Haptics.selectionAsync();
    }
  };

  const finishSliderRatio = (ratio: number) => {
    const nextMinutes = snapMinutesFromRatio(ratio);
    const snappedRatio = ratioForMinutes(nextMinutes);

    timeSliderDisplayRef.current = nextMinutes;
    setSliderDisplayMinutes(nextMinutes);
    setSelectedTime(String(nextMinutes));

    timeSliderProgress.stopAnimation();
    Animated.spring(timeSliderProgress, {
      toValue: snappedRatio,
      speed: 24,
      bounciness: 5,
      useNativeDriver: false,
    }).start();
  };

  const timeSliderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const width = Math.max(1, timeSliderWidthRef.current);
          const ratio = Math.max(
            0,
            Math.min(1, event.nativeEvent.locationX / width)
          );
          timeSliderStartProgressRef.current = ratio;
          timeSliderProgress.stopAnimation();
          previewSliderRatio(ratio);
        },
        onPanResponderMove: (_event, gestureState) => {
          const width = Math.max(1, timeSliderWidthRef.current);
          const ratio =
            timeSliderStartProgressRef.current + gestureState.dx / width;
          previewSliderRatio(ratio);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const width = Math.max(1, timeSliderWidthRef.current);
          const ratio =
            timeSliderStartProgressRef.current + gestureState.dx / width;
          finishSliderRatio(ratio);
        },
        onPanResponderTerminate: (_event, gestureState) => {
          const width = Math.max(1, timeSliderWidthRef.current);
          const ratio =
            timeSliderStartProgressRef.current + gestureState.dx / width;
          finishSliderRatio(ratio);
        },
      }),
    [timeSliderProgress]
  );

  const currentMission: Mission | null =
    plan?.sideMissions[sideMissionIndex] ?? null;

  const currentNavigationBeat =
    navigationRoute?.beats[navigationBeatIndex] ?? null;

  const navigationProgressRatio = navigationRoute
    ? Math.min(
        1,
        navigationBeatIndex /
          Math.max(1, navigationRoute.beats.length)
      )
    : 0;

  const nextBeatMeters = Math.max(0, beatRemainingMeters);

  const nextBeatLabel =
    currentNavigationBeat?.turn === 'arrive'
      ? 'FINAL BEAT'
      : 'NEXT BEAT';

  const guidanceBearing =
    currentNavigationBeat
      ? latitude !== null &&
        longitude !== null &&
        currentNavigationBeat.segmentCoordinates.length >= 2
        ? guidanceBearingOnPolyline(
            { latitude, longitude },
            currentNavigationBeat.segmentCoordinates
          )
        : currentNavigationBeat.bearingDegrees
      : 0;

  const arrowRotation = currentNavigationBeat
    ? relativeArrowDegrees(
        guidanceBearing,
        deviceHeading
      )
    : 0;

  const nextBeatSegment =
    currentNavigationBeat?.segmentCoordinates?.length
      ? currentNavigationBeat.segmentCoordinates
      : latitude !== null &&
          longitude !== null &&
          currentNavigationBeat
        ? [
            { latitude, longitude },
            currentNavigationBeat.point,
          ]
        : [];

  const paceDistanceScale =
    getPaceDistanceScale(
      preferences.walkingPace
    );

  const darkStage =
    stage === 'developing' ||
    stage === 'journey';

  const chromeDark = darkStage;

  const tracedPassport = useMemo(
    () =>
      passport.filter(
        (entry) => Array.isArray(entry.route) && entry.route.length >= 2
      ),
    [passport]
  );

  const totalDistanceMeters = useMemo(
    () =>
      passport.reduce(
        (sum, entry) => sum + (entry.distanceMeters ?? 0),
        0
      ),
    [passport]
  );

  const totalDiscoveries = useMemo(
    () => passport.reduce((sum, entry) => sum + entry.discoveries, 0),
    [passport]
  );

  const selectedPassportEntry = useMemo(
    () => passport.find((entry) => entry.id === selectedPassportId) ?? null,
    [passport, selectedPassportId]
  );

  const selectedPassportNumber = useMemo(() => {
    if (!selectedPassportEntry) return '00';
    const index = passport.findIndex(
      (entry) => entry.id === selectedPassportEntry.id
    );
    if (index < 0) return '00';
    return String(passport.length - index).padStart(2, '0');
  }, [passport, selectedPassportEntry]);

  const passportMapRegion = useMemo(() => {
    const points = tracedPassport.flatMap((entry) => entry.route ?? []);

    if (points.length === 0) {
      return {
        latitude: 25.0478,
        longitude: 121.5319,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.7, 0.008),
      longitudeDelta: Math.max((maxLon - minLon) * 1.7, 0.008),
    };
  }, [tracedPassport]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    selectedSceneRef.current = selectedScene;
  }, [selectedScene]);

  useEffect(() => {
    navigationRouteRef.current = navigationRoute;
  }, [navigationRoute]);

  useEffect(() => {
    navigationBeatIndexRef.current = navigationBeatIndex;
  }, [navigationBeatIndex]);

  useEffect(() => {
    beatRemainingMetersRef.current = beatRemainingMeters;
  }, [beatRemainingMeters]);

  useEffect(() => {
    sideMissionIndexRef.current = sideMissionIndex;
  }, [sideMissionIndex]);

  useEffect(() => {
    traveledMetersRef.current = traveledMeters;
  }, [traveledMeters]);

  useEffect(() => {
    const nextMinutes = Math.max(
      TIME_MIN,
      Math.min(TIME_MAX, selectedMinutes || 15)
    );
    const nextRatio = ratioForMinutes(nextMinutes);

    timeSliderDisplayRef.current = nextMinutes;
    setSliderDisplayMinutes(nextMinutes);

    Animated.spring(timeSliderProgress, {
      toValue: nextRatio,
      speed: 24,
      bounciness: 4,
      useNativeDriver: false,
    }).start();
  }, [selectedMinutes]);

  useEffect(() => {
    if (stage !== 'time') return;

    homeEntrance.setValue(0);
    homeRouteMotion.setValue(0);

    Animated.timing(homeEntrance, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const routeLoop = Animated.loop(
      Animated.timing(homeRouteMotion, {
        toValue: 1,
        duration: 4600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    routeLoop.start();
    return () => routeLoop.stop();
  }, [stage]);

  useEffect(() => {
    if (stage !== 'time' && stage !== 'mood') return;

    const timer = setTimeout(() => {
      void prewarmDetour();
    }, 180);

    return () => clearTimeout(timer);
  }, [stage]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const consumeCameraResult = async () => {
        try {
          const raw = await AsyncStorage.getItem(CAMERA_RESULT_KEY);

          if (!raw || cancelled) return;

          await AsyncStorage.removeItem(CAMERA_RESULT_KEY);

          const result = JSON.parse(raw) as CameraRouteResult;

          if (cancelled) return;

          await handleCameraRouteResult(result);
        } catch {
          // 相機回傳失敗不應讓整趟 DETOUR crash。
        }
      };

      consumeCameraResult();

      return () => {
        cancelled = true;
      };
    }, [
      photos,
      plan,
      sideMissionIndex,
      passport,
      activeTrace,
      selectedMinutes,
      mood,
      lightContext,
    ])
  );

  useEffect(() => {
    initializeApp();

    return () => {
      stopLocationWatcher();
    };
  }, []);

  useEffect(() => {
    if (stage !== 'preparing') return;

    routeProgress.setValue(0.04);
    setTicketBuildStatus(
      '正在取得現在位置…'
    );

    prepareDetourTicket();
  }, [stage]);

  useEffect(() => {
    if (stage !== 'developing') return;

    const timer = setTimeout(() => {
      transitionTo('finish');
    }, 1450);

    return () => clearTimeout(timer);
  }, [stage]);


  async function initializeApp() {
    await loadPassport();

    const [
      storedPlaytestSessions,
      testerId,
    ] = await Promise.all([
      loadPlaytestSessions(),
      getPlaytestTesterId(),
    ]);

    setPlaytestSessions(
      storedPlaytestSessions
    );
    setPlaytestTesterId(testerId);

    void syncAllPlaytestSessions(
      storedPlaytestSessions
    );

    try {
      const raw =
        await AsyncStorage.getItem(
          PREFERENCES_KEY
        );

      const parsed = raw
        ? (JSON.parse(raw) as Partial<DetourPreferences>)
        : null;

      const nextPreferences: DetourPreferences = {
        ...DEFAULT_PREFERENCES,
        ...(parsed ?? {}),
      };

      setPreferences(nextPreferences);
      setDevMode(
        nextPreferences.indoorTest
      );

      const nextStage: Stage =
        nextPreferences.onboardingComplete
          ? 'time'
          : 'onboarding';

      setStage(nextStage);
      stageRef.current = nextStage;
    } catch {
      setPreferences(
        DEFAULT_PREFERENCES
      );
      setDevMode(false);
      setStage('onboarding');
      stageRef.current =
        'onboarding';
    }
  }

  async function savePreferences(
    nextPreferences: DetourPreferences
  ) {
    setPreferences(nextPreferences);

    try {
      await AsyncStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify(nextPreferences)
      );
    } catch {
      Alert.alert(
        '設定暫時無法儲存',
        '這次仍可繼續使用，但重新開啟 App 後設定可能會恢復。'
      );
    }
  }

  async function setWalkingPace(
    pace: WalkingPace
  ) {
    await Haptics.selectionAsync();

    await savePreferences({
      ...preferences,
      walkingPace: pace,
    });
  }

  async function completeOnboarding() {
    const nextPreferences = {
      ...preferences,
      onboardingComplete: true,
    };

    await savePreferences(
      nextPreferences
    );

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    transitionTo(
      onboardingFromSettings
        ? 'settings'
        : 'time',
      () => {
        setOnboardingStep(0);
        setOnboardingFromSettings(false);
      }
    );
  }

  async function refreshPlaytestSessions() {
    const sessions =
      await loadPlaytestSessions();

    setPlaytestSessions(sessions);
    return sessions;
  }

  async function syncPlaytestDataNow() {
    if (playtestSyncing) return;

    setPlaytestSyncing(true);

    try {
      const sessions =
        await refreshPlaytestSessions();

      const result =
        await syncAllPlaytestSessions(
          sessions
        );

      if (result.failed === 0) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Alert.alert(
          '測試資料已同步',
          `${result.synced} 筆匿名 run 已送到 Detour。`
        );
      } else {
        Alert.alert(
          '部分資料還沒同步',
          `${result.synced} 筆成功，${result.failed} 筆失敗。App 仍保留本機資料，之後可再試。`
        );
      }
    } finally {
      setPlaytestSyncing(false);
    }
  }

  async function rateCompletedDetour(
    rating: PlaytestRating
  ) {
    const sessionId =
      lastCompletedPlaytestSessionId;

    if (!sessionId) return;

    await Haptics.selectionAsync();

    const nextReasons =
      rating === 'not-worth-it'
        ? playtestFeedbackReasons
        : [];

    setPlaytestRating(rating);

    if (rating !== 'not-worth-it') {
      setPlaytestFeedbackReasons([]);
    }

    setPlaytestSessions(
      await updatePlaytestSession(
        sessionId,
        {
          runRating: rating,
          runFeedbackReasons:
            nextReasons,
        }
      )
    );
  }

  async function togglePlaytestFeedbackReason(
    reason: PlaytestFeedbackReason
  ) {
    const sessionId =
      lastCompletedPlaytestSessionId;

    if (
      !sessionId ||
      playtestRating !==
        'not-worth-it'
    ) {
      return;
    }

    await Haptics.selectionAsync();

    const next =
      playtestFeedbackReasons.includes(
        reason
      )
        ? playtestFeedbackReasons.filter(
            (item) =>
              item !== reason
          )
        : [
            ...playtestFeedbackReasons,
            reason,
          ];

    setPlaytestFeedbackReasons(
      next
    );

    setPlaytestSessions(
      await updatePlaytestSession(
        sessionId,
        {
          runRating:
            'not-worth-it',
          runFeedbackReasons:
            next,
        }
      )
    );
  }

  async function runAIConnectionTest() {
    if (aiConnectionTesting) return;

    setAIConnectionTesting(true);

    try {
      const result =
        await testAIEngineConnection();

      if (result.ok) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        Alert.alert(
          'AI 已連線',
          `App → Supabase → OpenAI → Structured Output 全部正常。\n\nAI ranking note:\n${result.message}`
        );
      } else {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        );

        Alert.alert(
          'AI 還沒接通',
          result.message
        );
      }
    } finally {
      setAIConnectionTesting(false);
    }
  }

  async function sharePlaytestData() {
    const sessions =
      await refreshPlaytestSessions();

    if (sessions.length === 0) {
      Alert.alert(
        '還沒有測試資料',
        '完成或嘗試幾趟 DETOUR 後，這裡才會產生報告。'
      );
      return;
    }

    const testerId =
      await getPlaytestTesterId();

    setPlaytestTesterId(testerId);

    await Share.share({
      title: 'DETOUR Playtest Report',
      message:
        buildPlaytestReport(
          sessions,
          testerId
        ),
    });
  }

  function clearPlaytestData() {
    Alert.alert(
      '清除測試統計？',
      '只會刪除此手機的匿名 Playtest 統計，不會清除 Passport。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            await clearPlaytestSessions();
            setPlaytestSessions([]);
            playtestSessionIdRef.current =
              null;

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
          },
        },
      ]
    );
  }

  function replayOnboarding() {
    setOnboardingFromSettings(true);
    setOnboardingStep(0);
    transitionTo('onboarding');
  }

  async function nextOnboardingStep() {
    await Haptics.selectionAsync();

    if (onboardingStep >= 2) {
      await completeOnboarding();
      return;
    }

    setOnboardingStep(
      (value) => value + 1
    );
  }

  async function loadPassport() {
    try {
      const raw = await AsyncStorage.getItem(PASSPORT_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as PassportEntry[];
        if (Array.isArray(parsed)) setPassport(parsed);
      }
    } catch {
      // Local history must never block the prototype.
    } finally {
      setPassportLoaded(true);
    }
  }

  async function savePassport(nextPassport: PassportEntry[]) {
    setPassport(nextPassport);

    try {
      await AsyncStorage.setItem(PASSPORT_KEY, JSON.stringify(nextPassport));
    } catch {
      Alert.alert(
        'Passport 暫時無法儲存',
        '這次 DETOUR 可以完成，但紀錄可能不會保留。'
      );
    }
  }

  async function clearPassport() {
    Alert.alert(
      '清除測試 Passport？',
      '這會刪除目前手機上的所有 DETOUR 測試紀錄。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(PASSPORT_KEY);

            try {
              const photoDirectory = new Directory(Paths.document, 'detour-photos');
              if (photoDirectory.exists) photoDirectory.delete();
            } catch {
              // Passport metadata is already gone; stale local files should
              // never make clearing the collection fail.
            }

            setPassport([]);
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
          },
        },
      ]
    );
  }

  function stopLocationWatcher() {
    if (locationWatcher.current) {
      locationWatcher.current.remove();
      locationWatcher.current = null;
    }

    if (headingWatcher.current) {
      headingWatcher.current.remove();
      headingWatcher.current = null;
    }
  }

  async function startHeadingWatcher() {
    if (headingWatcher.current) {
      headingWatcher.current.remove();
      headingWatcher.current = null;
    }

    try {
      headingWatcher.current = await Location.watchHeadingAsync(
        (heading) => {
          const value =
            heading.trueHeading >= 0
              ? heading.trueHeading
              : heading.magHeading;

          if (Number.isFinite(value)) {
            setDeviceHeading(value);
          }
        }
      );
    } catch {
      // Heading is useful, but the route can still render without it.
    }
  }

  function advanceTicketProgress(
    toValue: number,
    status: string
  ) {
    setTicketBuildStatus(status);

    Animated.timing(
      routeProgress,
      {
        toValue,
        duration: 260,
        easing:
          Easing.out(
            Easing.cubic
          ),
        useNativeDriver: false,
      }
    ).start();
  }

  function animateIn() {
    screenOpacity.setValue(0);
    screenY.setValue(14);

    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(screenY, {
        toValue: 0,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function transitionTo(next: Stage, beforeEnter?: () => void) {
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(screenY, {
        toValue: -6,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      beforeEnter?.();
      setStage(next);
      animateIn();
    });
  }

  async function toggleDevMode() {
    const next = !devMode;
    setDevMode(next);

    await savePreferences({
      ...preferences,
      indoorTest: next,
    });

    await Haptics.notificationAsync(
      next
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );

    Alert.alert(
      next ? '室內測試模式已開啟' : '室內測試模式已關閉',
      next
        ? '仍會查真實 Scene 和真實步行路線，只是用按鈕模擬沿路前進。'
        : '正式模式會使用真實 GPS 沿著步行路線推進。'
    );
  }

  async function chooseTime(time: string) {
    await Haptics.selectionAsync();
    setSelectedTime(time);
  }

  async function continueFromTime() {
    if (!selectedTime) return;

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    transitionTo('mood');
  }

  async function chooseMood(moodId: MoodId) {
    await Haptics.selectionAsync();
    setSelectedMood(moodId);

    // Color Walk draws once per Detour session. Switching away and back keeps
    // the same draw, so there is no hidden reroll interaction.
    if (moodId === 'color' && !selectedColor) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      setSelectedColor(color);
    }
  }

  async function continueFromMood() {
    if (!selectedMood) return;

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    const session =
      await createPlaytestSession({
        devMode,
        minutes:
          selectedMinutes || 15,
        moodId: selectedMood,
      });

    playtestSessionIdRef.current =
      session.id;

    await refreshPlaytestSessions();

    transitionTo('preparing');
  }


  function resetDetour() {
    const testSessionId =
      playtestSessionIdRef.current;

    if (
      testSessionId &&
      [
        'ready',
        'journey',
        'mission',
        'arrival',
        'recovery',
      ].includes(stageRef.current)
    ) {
      void updatePlaytestSession(
        testSessionId,
        {
          status: 'abandoned',
          completedAt:
            new Date().toISOString(),
          rerouteCount:
            rerouteCountRef.current,
          sceneFailureReasons:
            sceneFailuresRef.current.map(
              (failure) =>
                failure.reason
            ),
        }
      ).then(setPlaytestSessions);
    }

    playtestSessionIdRef.current =
      null;
    setLastCompletedPlaytestSessionId(
      null
    );
    setPlaytestRating(null);
    setPlaytestFeedbackReasons([]);

    stopLocationWatcher();
    setSelectedTime('15');
    setSelectedMood(null);
    setSelectedColor(null);
    setLatitude(null);
    setLongitude(null);
    setDetourStart(null);
    setActiveTrace([]);
    setPlan(null);
    setSelectedScene(null);
    setWalkingRoute(null);
    setNavigationRoute(null);
    navigationRouteRef.current = null;
    setNavigationBeatIndex(0);
    navigationBeatIndexRef.current = 0;
    setBeatRemainingMeters(0);
    beatRemainingMetersRef.current = 0;
    setDeviceHeading(0);
    setShowNextBeatMap(false);
    setQuestPulse(null);
    checkpointLockedRef.current = false;
    setIsRerouting(false);
    setRerouteFailed(false);
    setRerouteCount(0);
    rerouteCountRef.current = 0;
    offRouteCountRef.current = 0;
    rerouteInFlightRef.current = false;
    setDetourStartedAt(null);
    detourStartedAtRef.current = null;
    setSceneFailures([]);
    sceneFailuresRef.current = [];
    setReplacementLoading(false);
    selectedSceneRef.current = null;
    setSideMissionIndex(0);
    setTraveledMeters(0);
    setLightContext(null);
    setPhotos([]);
    setLastCompletedEntry(null);
    setSelectedPassportId(null);
    activeCameraRequestRef.current = null;
    setMissionResults({});
    missionResultsRef.current = {};
    lastTracePointRef.current = null;
    planRef.current = null;
    navigationRouteRef.current = null;
    navigationBeatIndexRef.current = 0;
    beatRemainingMetersRef.current = 0;
    sideMissionIndexRef.current = 0;
    traveledMetersRef.current = 0;
    setStage('time');
    screenOpacity.setValue(1);
    screenY.setValue(0);
  }

  function goBack() {
    if (stage === 'settings') {
      transitionTo('time');
      return;
    }

    if (stage === 'onboarding') {
      if (onboardingStep > 0) {
        setOnboardingStep(
          (value) =>
            Math.max(0, value - 1)
        );
        return;
      }

      if (onboardingFromSettings) {
        transitionTo('settings', () => {
          setOnboardingFromSettings(false);
        });
      }

      return;
    }

    if (stage === 'mood') {
      transitionTo('time');
      return;
    }

    if (stage === 'preparing' || stage === 'ready') {
      transitionTo('mood');
      return;
    }

    if (stage === 'passport') {
      transitionTo('time');
      return;
    }

    if (stage === 'passportDetail') {
      transitionTo('passport');
      return;
    }


    if (stage === 'sceneIssue') {
      transitionTo('arrival');
      return;
    }

    if (
      stage === 'journey' ||
      stage === 'mission' ||
      stage === 'arrival'
    ) {
      Alert.alert(
        '結束這次 DETOUR？',
        '目前進度和這次尚未存進 Passport 的照片會消失。',
        [
          { text: '繼續', style: 'cancel' },
          { text: '結束', style: 'destructive', onPress: resetDetour },
        ]
      );
      return;
    }

    if (stage === 'finish') {
      resetDetour();
    }
  }

  function remainingDetourMinutes() {
    const startedAt =
      detourStartedAtRef.current;

    if (!startedAt) {
      return selectedMinutes || 15;
    }

    const elapsedMinutes =
      (Date.now() -
        new Date(startedAt).getTime()) /
      60000;

    return Math.max(
      1,
      (selectedMinutes || 15) -
        elapsedMinutes
    );
  }

  function replacementDistanceBudget(
    minutesLeft: number
  ) {
    // Replacement should feel like recovery, not "start another Detour".
    // Reserve time for arrival and the final task.
    return Math.max(
      70,
      Math.min(
        320,
        Math.round(
          minutesLeft * 52
        )
      )
    );
  }

  function feedbackKindForIssue(
    reason: SceneIssueReason
  ): SceneFeedbackKind {
    if (reason === 'closed') {
      return 'closed';
    }

    if (reason === 'inaccessible') {
      return 'inaccessible';
    }

    if (reason === 'not-worth-it') {
      return 'not-worth-it';
    }

    return 'wrong-now';
  }

  async function replaceFailedDestination(
    reason: SceneIssueReason
  ) {
    const failedScene =
      selectedSceneRef.current;

    const currentPlan =
      planRef.current;

    if (
      !failedScene ||
      !currentPlan
    ) {
      return;
    }

    setReplacementLoading(true);

    const failure: SessionSceneFailure = {
      sceneId: failedScene.id,
      sceneName: failedScene.name,
      reason,
      createdAt:
        new Date().toISOString(),
    };

    const nextFailures = [
      ...sceneFailuresRef.current,
      failure,
    ];

    setSceneFailures(nextFailures);
    sceneFailuresRef.current =
      nextFailures;

    await saveSceneFeedback({
      sceneId: failedScene.id,
      kind: feedbackKindForIssue(reason),
      createdAt: failure.createdAt,
    });

    try {
      let currentPoint: GeoPoint | null =
        latitude !== null &&
        longitude !== null
          ? {
              latitude,
              longitude,
            }
          : null;

      if (!currentPoint) {
        const position =
          await Location.getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.Balanced,
          });

        currentPoint = {
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
        };
      }

      const minutesLeft =
        remainingDetourMinutes();

      const distanceBudget =
        Math.round(
          replacementDistanceBudget(
            minutesLeft
          ) * paceDistanceScale
        );

      const visitedSceneIds = passport
        .map((entry) => entry.sceneId)
        .filter(
          (value): value is string =>
            typeof value === 'string'
        );

      const feedback =
        await loadSceneFeedback();

      const hardExcluded = [
        failedScene.id,
        ...nextFailures.map(
          (item) => item.sceneId
        ),
      ];

      const candidates =
        await findSceneCandidates({
          start: currentPoint,
          moodId:
            selectedMood ?? 'wander',
          context:
            lightContext ?? 'day',
          minutes: Math.max(
            5,
            Math.round(minutesLeft)
          ),
          excludeSceneIds:
            visitedSceneIds,
          hardExcludeSceneIds:
            hardExcluded,
          feedback,
          distanceScale:
            paceDistanceScale,
        });

      if (
        candidates.length === 0
      ) {
        throw new Error(
          '附近沒有第二個夠好的 Scene。'
        );
      }

      const recoveryMood =
        selectedMood ?? 'wander';

      const recoveryContext =
        lightContext ?? 'day';

      const recoveryMinutes =
        Math.max(
          5,
          Math.round(minutesLeft)
        );

      const aiRanking =
        recoveryMood === 'food' || recoveryMood === 'color'
          ? { candidates, usedAI: false }
          : await rankSceneCandidatesWithAI({
              candidates,
              moodId:
                recoveryMood,
              context:
                recoveryContext,
              minutes:
                recoveryMinutes,
            });

      const routed =
        await resolveRoutedScene({
          start: currentPoint,
          candidates:
            aiRanking.candidates,
          minutes:
            recoveryMinutes,
          maxDistanceMeters:
            distanceBudget,
          sideMissionCount: 0,
          avoidRoutes: [
            activeTrace,
            ...passport.slice(0, 5).map((entry) =>
              entry.route && entry.route.length >= 2
                ? entry.route
                : entry.plannedRoute ?? []
            ),
          ].filter((route): route is GeoPoint[] => Array.isArray(route) && route.length >= 2),
        });

      const fallbackArrival =
        recoveryMood === 'color'
          ? currentPlan.arrivalMission
          : buildSceneArrivalMission({
              scene: routed.scene,
              moodId:
                recoveryMood,
              context:
                recoveryContext,
            });

      const aiRecovery =
        recoveryMood === 'color'
          ? null
          : await generateJourneyWithAI({
              scene: routed.scene,
              moodId:
                recoveryMood,
              context:
                recoveryContext,
              minutes:
                recoveryMinutes,
              sideMissionCount: 0,
              routeDistanceMeters:
                routed.route.distanceMeters,
              routeDurationSeconds:
                routed.route.durationSeconds,
            });

      const nextArrivalMission =
        aiRecovery?.arrivalMission ??
        fallbackArrival;

      const nextPlan = {
        ...currentPlan,
        arrivalMission:
          nextArrivalMission,
      };

      // The Side Quests already happened.
      // Recovery only creates a short replacement main-line leg.
      const nextNavigation =
        buildNavigationRouteFromPolyline({
          coordinates:
            routed.route.coordinates,
          totalDistanceMeters:
            routed.route.distanceMeters,
          durationSeconds:
            routed.route.durationSeconds,
          sideMissionCount: 0,
        });

      if (
        nextNavigation.beats.length < 1
      ) {
        throw new Error(
          '替代路線資料不足。'
        );
      }

      setSelectedScene(
        routed.scene
      );
      selectedSceneRef.current =
        routed.scene;

      setWalkingRoute(
        routed.route
      );

      setPlan(nextPlan);
      planRef.current =
        nextPlan;

      setNavigationRoute(
        nextNavigation
      );
      navigationRouteRef.current =
        nextNavigation;

      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstDistance =
        nextNavigation.beats[0]
          ?.segmentDistanceMeters ?? 0;

      setBeatRemainingMeters(
        firstDistance
      );
      beatRemainingMetersRef.current =
        firstDistance;

      setLatitude(
        currentPoint.latitude
      );
      setLongitude(
        currentPoint.longitude
      );

      lastTracePointRef.current =
        currentPoint;

      setShowNextBeatMap(false);
      setRerouteFailed(false);
      offRouteCountRef.current = 0;

      const nextRerouteCount =
        rerouteCountRef.current + 1;

      rerouteCountRef.current =
        nextRerouteCount;

      setRerouteCount(
        nextRerouteCount
      );

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      transitionTo('journey');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '附近暫時找不到替代終點。';

      Alert.alert(
        '這次不用硬撐',
        `${message}\n\n你已經完成的路和任務可以直接收進 Passport。`,
        [
          {
            text: '回到這裡',
            style: 'cancel',
          },
          {
            text: '結束這次',
            onPress: async () => {
              if (
                planRef.current
                  ?.arrivalMission
              ) {
                recordMissionResult(
                  planRef.current
                    .arrivalMission,
                  'skipped'
                );
              }

              await completeDetour();
            },
          },
        ]
      );
    } finally {
      setReplacementLoading(false);
    }
  }

  async function rerouteFromCurrentPosition(
    currentPoint: GeoPoint
  ) {
    if (
      rerouteInFlightRef.current ||
      devMode
    ) {
      return;
    }

    const scene =
      selectedSceneRef.current;
    const currentPlan =
      planRef.current;

    if (!scene || !currentPlan) {
      return;
    }

    rerouteInFlightRef.current = true;
    setIsRerouting(true);
    setRerouteFailed(false);

    try {
      const nextWalkingRoute =
        await fetchWalkingRoute(
          currentPoint,
          scene.point
        );

      const remainingMissionCount =
        Math.max(
          0,
          currentPlan.sideMissions.length -
            sideMissionIndexRef.current
        );

      const nextNavigationRoute =
        buildNavigationRouteFromPolyline({
          coordinates:
            nextWalkingRoute.coordinates,
          totalDistanceMeters:
            nextWalkingRoute.distanceMeters,
          durationSeconds:
            nextWalkingRoute.durationSeconds,
          sideMissionCount:
            remainingMissionCount,
          missionIndexOffset:
            sideMissionIndexRef.current,
        });

      if (
        nextNavigationRoute.beats.length <
        1
      ) {
        throw new Error(
          'No reroute beats'
        );
      }

      setWalkingRoute(
        nextWalkingRoute
      );

      setNavigationRoute(
        nextNavigationRoute
      );
      navigationRouteRef.current =
        nextNavigationRoute;

      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstDistance =
        nextNavigationRoute.beats[0]
          ?.segmentDistanceMeters ?? 0;

      setBeatRemainingMeters(
        firstDistance
      );
      beatRemainingMetersRef.current =
        firstDistance;

      setShowNextBeatMap(false);
      offRouteCountRef.current = 0;

      const nextCount =
        rerouteCountRef.current + 1;

      rerouteCountRef.current =
        nextCount;
      setRerouteCount(nextCount);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch {
      setRerouteFailed(true);
      offRouteCountRef.current = 0;
    } finally {
      setIsRerouting(false);
      rerouteInFlightRef.current = false;
    }
  }

  async function startTraceWatcher() {
    stopLocationWatcher();

    if (devMode) return;

    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 3000,
      },
      (newLocation) => {
        const nextPoint: GeoPoint = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        };

        setLatitude(nextPoint.latitude);
        setLongitude(nextPoint.longitude);

        const previous = lastTracePointRef.current;
        lastTracePointRef.current = nextPoint;

        if (!previous) {
          setActiveTrace((trace) => [...trace, nextPoint]);
          return;
        }

        const moved = getDistanceInMeters(
          previous.latitude,
          previous.longitude,
          nextPoint.latitude,
          nextPoint.longitude
        );

        if (moved < 4 || moved > 80) return;

        setActiveTrace((trace) =>
          trace.length >= 700 ? trace : [...trace, nextPoint]
        );

        if (stageRef.current !== 'journey') return;

        const nextTraveled = traveledMetersRef.current + moved;
        traveledMetersRef.current = nextTraveled;
        setTraveledMeters(nextTraveled);

        const route = navigationRouteRef.current;
        const beat =
          route?.beats[navigationBeatIndexRef.current] ?? null;

        if (!beat) return;

        const remainingOnBeat =
          remainingDistanceOnPolyline(
            nextPoint,
            beat.segmentCoordinates
          );

        setBeatRemainingMeters(
          remainingOnBeat
        );
        beatRemainingMetersRef.current =
          remainingOnBeat;

        const offRouteDistance =
          distanceToPolyline(
            nextPoint,
            route.coordinates
          );

        const gpsAccuracy = newLocation.coords.accuracy ?? 0;
        const offRouteThreshold = Math.max(45, Math.min(70, gpsAccuracy + 30));

        if (offRouteDistance > offRouteThreshold) {
          offRouteCountRef.current += 1;
        } else {
          offRouteCountRef.current = 0;
        }

        if (
          offRouteCountRef.current >= 3 &&
          !rerouteInFlightRef.current
        ) {
          offRouteCountRef.current = 0;
          rerouteFromCurrentPosition(
            nextPoint
          );
          return;
        }

        if (remainingOnBeat <= 12) {
          reachCurrentNavigationBeat();
        }
      }
    );
  }

  async function prewarmDetour() {
    const cached = prewarmRef.current;

    if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) {
      return;
    }

    if (prewarmInFlightRef.current) return;
    prewarmInFlightRef.current = true;

    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') return;

      let location = await Location.getLastKnownPositionAsync({
        maxAge: 3 * 60 * 1000,
        requiredAccuracy: 120,
      });

      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const point: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const context = getLightContext(point, new Date());
      const visitedSceneIds = passport
        .map((entry) => entry.sceneId)
        .filter((value): value is string => typeof value === 'string');
      const sceneFeedback = await loadSceneFeedback();
      const moodIds = MOODS.map((item) => item.id);

      const candidateEntries = await Promise.all(
        moodIds.map(async (moodId) => {
          try {
            const candidates = await findSceneCandidates({
              start: point,
              moodId,
              context,
              minutes: 60,
              excludeSceneIds: visitedSceneIds,
              feedback: sceneFeedback,
              distanceScale: paceDistanceScale,
            });
            return [moodId, candidates] as const;
          } catch {
            return [moodId, [] as SceneCandidate[]] as const;
          }
        })
      );

      const candidatesByMood: Partial<Record<MoodId, SceneCandidate[]>> = {};
      const rankedIdsByMood: Partial<Record<MoodId, string[]>> = {};
      const aiUsedByMood: Partial<Record<MoodId, boolean>> = {};

      for (const [moodId, candidates] of candidateEntries) {
        candidatesByMood[moodId] = candidates;
        rankedIdsByMood[moodId] = candidates.map((candidate) => candidate.id);
        aiUsedByMood[moodId] = false;
      }

      const createdAt = Date.now();
      prewarmRef.current = {
        point,
        context,
        candidatesByMood,
        rankedIdsByMood,
        aiUsedByMood,
        createdAt,
      };

      // Taste ranking continues in the background. Ticket issuance never waits
      // for these calls; local scoring remains a valid fallback.
      if (isAIEngineConfigured()) {
        void Promise.all(
          candidateEntries.map(async ([moodId, candidates]) => {
            if (
              candidates.length === 0 ||
              moodId === 'food' ||
              moodId === 'color'
            ) return;

            try {
              const ranking = await rankSceneCandidatesWithAI({
                candidates,
                moodId,
                context,
                minutes: selectedMinutes || 15,
              });

              const current = prewarmRef.current;
              if (!current || current.createdAt !== createdAt) return;

              current.rankedIdsByMood[moodId] = ranking.candidates.map(
                (candidate) => candidate.id
              );
              current.aiUsedByMood[moodId] = ranking.usedAI;
            } catch {
              // Local ranking is already stored.
            }
          })
        );
      }
    } catch {
      // Prewarming is an optimization. A normal ticket build remains available.
    } finally {
      prewarmInFlightRef.current = false;
    }
  }

  function applyCachedRanking(
    candidates: SceneCandidate[],
    rankedIds: string[] | undefined
  ) {
    if (!rankedIds?.length) return candidates;

    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const ranked = rankedIds
      .map((id) => byId.get(id))
      .filter((candidate): candidate is SceneCandidate => Boolean(candidate));
    const used = new Set(ranked.map((candidate) => candidate.id));

    return [
      ...ranked,
      ...candidates.filter((candidate) => !used.has(candidate.id)),
    ];
  }

  async function prepareDetourTicket() {
    stopLocationWatcher();
    const ticketStartedAt = Date.now();

    let permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      const testSessionId = playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: 'location-permission',
          })
        );
      }

      transitionTo('mood');
      Alert.alert(
        '需要定位才能印出這張票',
        'DETOUR 會用你現在的位置選 Scene、確認步行路線，並判斷白天或夜間情境。'
      );
      return;
    }

    try {
      const finalMood: MoodId = selectedMood ?? 'wander';
      const minutes = selectedMinutes || 15;
      const cached =
        prewarmRef.current &&
        Date.now() - prewarmRef.current.createdAt < 5 * 60 * 1000
          ? prewarmRef.current
          : null;

      let startPoint: GeoPoint;
      let context: LightContext;
      let rankedCandidates: SceneCandidate[];
      let rankingUsedAI = false;

      const cachedCandidates = cached?.candidatesByMood[finalMood] ?? [];

      if (cached && cachedCandidates.length > 0) {
        startPoint = cached.point;
        context = cached.context;

        // Prewarm is primarily an OSM/network warm-up. Candidate distance
        // scoring must still use the duration the user actually selected.
        const visitedSceneIds = passport
          .map((entry) => entry.sceneId)
          .filter((value): value is string => typeof value === 'string');
        const sceneFeedback = await loadSceneFeedback();
        const durationCandidates = await findSceneCandidates({
          start: startPoint,
          moodId: finalMood,
          context,
          minutes,
          excludeSceneIds: visitedSceneIds,
          feedback: sceneFeedback,
          distanceScale: paceDistanceScale,
        });

        if (durationCandidates.length === 0) {
          throw new Error(
            finalMood === 'food'
              ? '附近暫時找不到適合「吃東西」的真實食物 Scene。'
              : '附近暫時沒有找到適合現在情境的 Scene。'
          );
        }

        rankedCandidates = applyCachedRanking(
          durationCandidates,
          cached.rankedIdsByMood[finalMood]
        );
        rankingUsedAI =
          finalMood === 'food' || finalMood === 'color'
            ? false
            : cached.aiUsedByMood[finalMood] ?? false;

        advanceTicketProgress(
          0.58,
          `附近已先準備好。正在確認 ${rankedCandidates.length} 個候選的步行路線…`
        );
      } else {
        advanceTicketProgress(0.12, '正在取得現在位置…');

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        startPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        context = getLightContext(startPoint, new Date());

        advanceTicketProgress(0.24, '位置確認。正在找附近的小發現…');

        const visitedSceneIds = passport
          .map((entry) => entry.sceneId)
          .filter((value): value is string => typeof value === 'string');
        const sceneFeedback = await loadSceneFeedback();
        const sceneCandidates = await findSceneCandidates({
          start: startPoint,
          moodId: finalMood,
          context,
          minutes,
          excludeSceneIds: visitedSceneIds,
          feedback: sceneFeedback,
          distanceScale: paceDistanceScale,
        });

        if (sceneCandidates.length === 0) {
          throw new Error(
            finalMood === 'food'
              ? '附近暫時找不到適合「吃東西」的真實食物 Scene。'
              : '附近暫時沒有找到適合現在情境的 Scene。'
          );
        }

        if (
          isAIEngineConfigured() &&
          finalMood !== 'food' &&
          finalMood !== 'color'
        ) {
          advanceTicketProgress(
            0.46,
            `找到 ${sceneCandidates.length} 個候選。正在做最後挑選…`
          );

          const aiRanking = await rankSceneCandidatesWithAI({
            candidates: sceneCandidates,
            moodId: finalMood,
            context,
            minutes,
          });
          rankedCandidates = aiRanking.candidates;
          rankingUsedAI = aiRanking.usedAI;
        } else {
          rankedCandidates = sceneCandidates;
        }
      }

      if (rankedCandidates.length === 0) {
        throw new Error('附近暫時沒有適合的終點。');
      }

      if (finalMood === 'food') {
        rankedCandidates = applyFoodDestinationWeight(rankedCandidates);
        rankingUsedAI = false;
      }

      setLastAIResult(rankingUsedAI ? 'ai' : 'fallback');

      const recentRoutes = passport
        .slice(0, 6)
        .map((entry) =>
          entry.route && entry.route.length >= 2
            ? entry.route
            : entry.plannedRoute ?? []
        )
        .filter((route): route is GeoPoint[] => Array.isArray(route) && route.length >= 2);

      const routed = await resolveRoutedScene({
        start: startPoint,
        candidates: rankedCandidates,
        minutes,
        distanceScale: paceDistanceScale,
        sideMissionCount: getJourneyProfile(minutes).sideMissionCount,
        avoidRoutes: recentRoutes,
      });

      advanceTicketProgress(
        0.82,
        `步行主線 ${Math.round(routed.route.distanceMeters)}m 已確認。正在出票…`
      );

      const nextPlan = buildJourneyPlan({
        minutes,
        moodId: finalMood,
        context,
        color: selectedColor,
      });
      if (finalMood !== 'color') {
        nextPlan.arrivalMission = buildSceneArrivalMission({
          scene: routed.scene,
          moodId: finalMood,
          context,
        });
      }

      // Side Quests are intentionally deterministic during field testing.
      // They must be instantly available and easy to compare across runs.
      const nextNavigationRoute = buildNavigationRouteFromPolyline({
        coordinates: routed.route.coordinates,
        totalDistanceMeters: routed.route.distanceMeters,
        durationSeconds: routed.route.durationSeconds,
        sideMissionCount: nextPlan.sideMissions.length,
      });

      if (nextNavigationRoute.beats.length < 2) {
        throw new Error(
          '這個終點太近或路線資料不足，暫時無法組成一趟 DETOUR。'
        );
      }

      setLatitude(startPoint.latitude);
      setLongitude(startPoint.longitude);
      setDetourStart(startPoint);
      setSelectedScene(routed.scene);
      selectedSceneRef.current = routed.scene;
      setWalkingRoute(routed.route);
      setPlan(nextPlan);
      planRef.current = nextPlan;
      setNavigationRoute(nextNavigationRoute);
      navigationRouteRef.current = nextNavigationRoute;
      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstBeatDistance =
        nextNavigationRoute.beats[0]?.segmentDistanceMeters ?? 0;
      setBeatRemainingMeters(firstBeatDistance);
      beatRemainingMetersRef.current = firstBeatDistance;
      setShowNextBeatMap(false);
      setSideMissionIndex(0);
      sideMissionIndexRef.current = 0;
      setMissionRevealedIndex(null);
      setTraveledMeters(0);
      traveledMetersRef.current = 0;
      setLightContext(context);
      setPhotos([]);
      setActiveTrace([]);
      setRerouteCount(0);
      rerouteCountRef.current = 0;
      setRerouteFailed(false);
      offRouteCountRef.current = 0;
      rerouteInFlightRef.current = false;
      setSceneFailures([]);
      sceneFailuresRef.current = [];
      lastTracePointRef.current = null;

      advanceTicketProgress(1, '車票完成');

      const testSessionId = playtestSessionIdRef.current;
      if (testSessionId) {
        void updatePlaytestSession(testSessionId, {
          status: 'ready',
          lightContext: context,
          sceneKind: routed.scene.kind,
          plannedDistanceMeters: routed.route.distanceMeters,
          plannedDurationSeconds: routed.route.durationSeconds,
          sideMissionsTotal: nextPlan.sideMissions.length,
        }).then(setPlaytestSessions);
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      console.log(
        `[DETOUR TIMING] ticket ready in ${Date.now() - ticketStartedAt}ms`
      );
      transitionTo('ready');

      // Arrival copy may get an AI polish later, but never blocks the ticket.
      // Color Walk intentionally has no arrival task to rewrite.
      if (isAIEngineConfigured() && finalMood !== 'color') {
        void generateJourneyWithAI({
          scene: routed.scene,
          moodId: finalMood,
          context,
          minutes,
          sideMissionCount: 0,
          missionMilestones: [],
          routeDistanceMeters: routed.route.distanceMeters,
          routeDurationSeconds: routed.route.durationSeconds,
        })
          .then((aiJourney) => {
            if (!aiJourney?.arrivalMission) return;
            if (selectedSceneRef.current?.id !== routed.scene.id) return;

            setPlan((current) => {
              if (!current) return current;
              const updated = {
                ...current,
                arrivalMission: aiJourney.arrivalMission,
              };
              planRef.current = updated;
              return updated;
            });
            setLastAIResult('ai');
          })
          .catch(() => undefined);
      }
    } catch (error) {
      stopLocationWatcher();
      transitionTo('mood');

      const message =
        error instanceof Error
          ? error.message
          : '請確認網路和定位服務後再試一次。';
      const testSessionId = playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: message.slice(0, 120),
          })
        );
      }

      Alert.alert(
        '這張 DETOUR 車票暫時印不出來',
        `${message}\n\n車票只有在終點和步行路線都確認成功後才會發行。`
      );
    }
  }

  async function startDetour() {
    const startPoint =
      detourStart;

    const route =
      navigationRouteRef.current;

    if (
      !startPoint ||
      !route ||
      route.beats.length < 1 ||
      !planRef.current ||
      !selectedSceneRef.current
    ) {
      Alert.alert(
        '這張票還沒準備好',
        '請回上一頁重新印製 DETOUR 車票。'
      );

      return;
    }

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    const startedAt =
      new Date().toISOString();

    setDetourStartedAt(
      startedAt
    );
    detourStartedAtRef.current =
      startedAt;

    const testSessionId =
      playtestSessionIdRef.current;

    if (testSessionId) {
      setPlaytestSessions(
        await updatePlaytestSession(
          testSessionId,
          {
            status: 'started',
            startedAt,
          }
        )
      );
    }

    setActiveTrace([
      startPoint,
    ]);

    lastTracePointRef.current =
      startPoint;

    await startTraceWatcher();
    await startHeadingWatcher();

    setMissionRevealedIndex(null);
    transitionTo('journey');
  }

  function setBeat(index: number) {
    const route = navigationRouteRef.current;
    if (!route) return false;

    const beat = route.beats[index];
    if (!beat) return false;

    setNavigationBeatIndex(index);
    navigationBeatIndexRef.current = index;

    setBeatRemainingMeters(beat.segmentDistanceMeters);
    beatRemainingMetersRef.current = beat.segmentDistanceMeters;

    setShowNextBeatMap(false);
    return true;
  }

  async function reachCurrentNavigationBeat() {
    if (checkpointLockedRef.current) {
      return;
    }

    const route = navigationRouteRef.current;
    if (!route) return;

    const beatIndex = navigationBeatIndexRef.current;
    const beat = route.beats[beatIndex];

    if (!beat) return;

    checkpointLockedRef.current = true;

    setLatitude(beat.point.latitude);
    setLongitude(beat.point.longitude);
    setBeatRemainingMeters(0);
    beatRemainingMetersRef.current = 0;

    setActiveTrace((trace) => {
      const previous = trace[trace.length - 1];

      if (
        previous &&
        getDistanceInMeters(
          previous.latitude,
          previous.longitude,
          beat.point.latitude,
          beat.point.longitude
        ) < 2
      ) {
        return trace;
      }

      return [...trace, beat.point];
    });

    const missionIndexAtBeat =
      beat.missionIndex;
    const isMissionReveal =
      missionIndexAtBeat !== undefined &&
      missionIndexAtBeat >=
        sideMissionIndexRef.current;

    const isFinal =
      beatIndex >=
      route.beats.length - 1;

    if (
      isMissionReveal &&
      missionIndexAtBeat !== undefined
    ) {
      const activeIndex =
        sideMissionIndexRef.current;

      if (missionIndexAtBeat > activeIndex) {
        const previousMission =
          planRef.current?.sideMissions[
            activeIndex
          ];

        if (
          previousMission &&
          !missionResultsRef.current[
            previousMission.id
          ]
        ) {
          recordMissionResult(
            previousMission,
            'skipped'
          );
        }

        sideMissionIndexRef.current =
          missionIndexAtBeat;
        setSideMissionIndex(
          missionIndexAtBeat
        );
      }

      setMissionRevealedIndex(null);
      setQuestPulse('side');

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 420);
      });

      setQuestPulse(null);
      checkpointLockedRef.current = false;
      transitionTo('mission');
      return;
    }

    if (isFinal) {
      setQuestPulse('final');

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 720);
      });

      setQuestPulse(null);
      checkpointLockedRef.current = false;
      transitionTo('arrival');
      return;
    }

    await Haptics.selectionAsync();

    setBeat(beatIndex + 1);
    checkpointLockedRef.current = false;
  }

  async function simulateWalk() {
    if (
      !devMode ||
      !plan ||
      !navigationRoute ||
      stage !== 'journey' ||
      !currentNavigationBeat
    ) {
      return;
    }

    const currentPoint =
      latitude !== null && longitude !== null
        ? { latitude, longitude }
        : detourStart;

    if (!currentPoint) return;

    const currentRemaining = beatRemainingMetersRef.current;
    const step = Math.min(
      currentRemaining,
      selectedMinutes <= 15 ? 18 : 24
    );

    if (step <= 0.5) {
      await reachCurrentNavigationBeat();
      return;
    }

    const nextPoint = moveToward(
      currentPoint,
      currentNavigationBeat.point,
      step
    );

    const nextRemaining = Math.max(
      0,
      currentRemaining - step
    );

    setLatitude(nextPoint.latitude);
    setLongitude(nextPoint.longitude);
    setBeatRemainingMeters(nextRemaining);
    beatRemainingMetersRef.current = nextRemaining;

    const nextTraveled =
      traveledMetersRef.current + step;

    traveledMetersRef.current = nextTraveled;
    setTraveledMeters(nextTraveled);

    setActiveTrace((trace) => [...trace, nextPoint]);

    await Haptics.selectionAsync();

    if (nextRemaining <= 1.5) {
      setTimeout(() => {
        reachCurrentNavigationBeat();
      }, 100);
    }
  }

  function recordMissionResult(mission: Mission, result: MissionResult) {
    const next = {
      ...missionResultsRef.current,
      [mission.id]: result,
    };

    missionResultsRef.current = next;
    setMissionResults(next);
  }

  async function beginCurrentMissionSearch() {
    const route = navigationRouteRef.current;
    if (!route || !currentMission) return;

    await Haptics.selectionAsync();

    const missionIndex =
      sideMissionIndexRef.current;
    const beatIndex =
      navigationBeatIndexRef.current;

    setMissionRevealedIndex(
      missionIndex
    );

    transitionTo('journey', () => {
      if (
        beatIndex <
        route.beats.length - 1
      ) {
        setBeat(beatIndex + 1);
      }
    });
  }

  async function advanceAfterSideMission() {
    if (!plan || !navigationRoute) return;

    const nextMissionIndex =
      sideMissionIndexRef.current + 1;
    sideMissionIndexRef.current =
      nextMissionIndex;
    setMissionRevealedIndex(null);

    const beatIndex =
      navigationBeatIndexRef.current;
    const shouldAdvanceBeat =
      stageRef.current === 'mission';

    if (
      beatIndex >=
      navigationRoute.beats.length - 1
    ) {
      transitionTo('arrival', () => {
        setSideMissionIndex(
          nextMissionIndex
        );
      });
      return;
    }

    transitionTo('journey', () => {
      setSideMissionIndex(
        nextMissionIndex
      );

      if (shouldAdvanceBeat) {
        setBeat(beatIndex + 1);
      }
    });
  }

  async function skipCurrentRequiredMission() {
    if (!currentMission || !currentMission.photo) return;

    recordMissionResult(currentMission, 'skipped');

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning
    );

    await advanceAfterSideMission();
  }

  async function skipArrivalRequiredMission() {
    if (!plan?.arrivalMission.photo) return;

    recordMissionResult(plan.arrivalMission, 'skipped');

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning
    );

    await completeDetour();
  }

  async function completeSideMissionWithoutPhoto() {
    if (!plan || !currentMission) return;

    recordMissionResult(currentMission, 'completed');

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    await advanceAfterSideMission();
  }

  async function completeArrivalWithoutPhoto() {
    if (plan?.arrivalMission) {
      recordMissionResult(plan.arrivalMission, 'completed');
    }

    await completeDetour();
  }

  function openPassportEntry(entry: PassportEntry) {
    setSelectedPassportId(entry.id);
    setPassportPhotoIndex(0);
    transitionTo('passportDetail');
  }

  async function shareJourney(entry: PassportEntry) {
    const message = [
      'DETOUR 旅程票',
      entry.sceneName ? `終點：${entry.sceneName}` : null,
      `${formatPassportDate(entry.completedAt)} · ${entry.minutes} 分鐘`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const ticketUri = await captureRef(shareTicketRef, {
        format: 'jpg',
        quality: 0.94,
        result: 'tmpfile',
      });

      await Share.share({
        title: '分享這趟 DETOUR',
        message,
        url: ticketUri,
      });
    } catch {
      // Sharing should still work even if a device cannot capture the card.
      await Share.share({
        title: '分享這趟 DETOUR',
        message,
      });
    }
  }

  function reservedMissionPhotoCount() {
    if (!plan) return 0;

    const remainingSide = plan.sideMissions
      .slice(sideMissionIndex)
      .filter(
        (mission) =>
          mission.photo &&
          missionResultsRef.current[mission.id] !== 'completed' &&
          missionResultsRef.current[mission.id] !== 'skipped'
      ).length;

    const arrivalReserved =
      plan.arrivalMission.photo &&
      missionResultsRef.current[plan.arrivalMission.id] !== 'completed' &&
      missionResultsRef.current[plan.arrivalMission.id] !== 'skipped'
        ? 1
        : 0;

    return remainingSide + arrivalReserved;
  }

  async function openCamera(source: CameraSource) {
    if (photos.length >= rollCapacity) {
      Alert.alert('這趟已經拍滿了', `每趟 DETOUR 最多留下 ${rollCapacity} 張照片。`);
      return;
    }

    if (source === 'free') {
      const reserved = reservedMissionPhotoCount();
      const freeLimit = Math.max(0, rollCapacity - reserved);

      if (photos.length >= freeLimit) {
        Alert.alert(
          '先留幾張給路上的尋找',
          `剩下 ${reserved} 張底片已保留給還沒完成的拍照尋找。`
        );
        return;
      }
    }

    const colorWalkCameraMission: Mission =
      selectedMood === 'color' && selectedColor
        ? {
            ...FREE_CAMERA_MISSION,
            id: `color-walk-${selectedColor.id}`,
            code: `COLOR · ${selectedColor.code}`,
            title: `拍下${selectedColor.label}。`,
            instruction: `看到${selectedColor.label}就拍；其他時間跟著導航走。`,
            completion: `這張照片留下今天的${selectedColor.label}。`,
          }
        : FREE_CAMERA_MISSION;

    const missionForCamera: Mission | null =
      source === 'arrival'
        ? plan?.arrivalMission ?? null
        : source === 'free'
          ? colorWalkCameraMission
          : currentMission;

    if (!missionForCamera) return;

    const requestId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    activeCameraRequestRef.current = requestId;

    // 清掉上一次未消化的結果，避免 Fast Refresh / crash 後誤吃舊照片。
    await AsyncStorage.removeItem(CAMERA_RESULT_KEY);

    router.push({
      pathname: '/camera',
      params: {
        requestId,
        source,
        missionCode: missionForCamera.code,
        missionTitle: missionForCamera.title,
        savedCount: String(photos.length),
        rollCapacity: String(rollCapacity),
      },
    });
  }

  async function handleCameraRouteResult(result: CameraRouteResult) {
    if (
      !activeCameraRequestRef.current ||
      result.requestId !== activeCameraRequestRef.current
    ) {
      return;
    }

    activeCameraRequestRef.current = null;

    const nextPhotos = [...photos, result.photo];
    setPhotos(nextPhotos);

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    if (result.source === 'free') {
      // 自由拍照只是留下紀錄，不推進主線。
      return;
    }

    const missionForResult =
      result.source === 'arrival'
        ? plan?.arrivalMission ?? null
        : plan?.sideMissions[sideMissionIndex] ?? null;

    // Optional photos are memories only. They must not silently complete
    // listening / breathing / observation missions.
    if (!missionForResult?.photo) {
      return;
    }

    recordMissionResult(missionForResult, 'completed');

    if (result.source === 'arrival') {
      await completeDetour(nextPhotos);
      return;
    }

    await advanceAfterSideMission();
  }

  async function completeDetour(photoOverride?: SessionPhoto[]) {
    stopLocationWatcher();

    const finalMood = mood ?? {
      id: 'wander' as MoodId,
      label: '隨便走',
      code: 'WANDER',
    };

    const route = activeTrace.length >= 2 ? activeTrace : [];
    const finalPhotos = photoOverride ?? photos;
    const missionHistory: PassportMission[] = plan
      ? [...plan.sideMissions, plan.arrivalMission].map((mission) => ({
          code: mission.code,
          title: mission.title,
          instruction: mission.instruction,
          completion: mission.completion,
          result: missionResultsRef.current[mission.id] ?? 'completed',
          photoRequired: mission.photo,
        }))
      : [];
    const discoveries = missionHistory.filter(
      (mission) => mission.result === 'completed'
    ).length;

    const entry: PassportEntry = {
      id: `${Date.now()}`,
      completedAt: new Date().toISOString(),
      city: '台北',
      minutes: selectedMinutes || 15,
      moodId: finalMood.id,
      moodLabel: finalMood.label,
      moodCode: finalMood.code,
      discoveries,
      route,
      distanceMeters: getRouteDistance(route),
      contextCode: plan?.contextCode ?? contextCode(lightContext),
      threadCode: undefined,
      threadLabel: undefined,
      photoCount: finalPhotos.length,
      rollCapacity,
      photos: finalPhotos,
      missions: missionHistory,
      sceneId: selectedScene?.id,
      sceneName: selectedScene?.name,
      sceneKind: selectedScene?.kind,
      sceneLabel: selectedScene?.label,
      scenePoint: selectedScene?.point,
      plannedRouteDistanceMeters:
        walkingRoute?.distanceMeters,
      plannedRouteDurationSeconds:
        walkingRoute?.durationSeconds,
      plannedRoute:
        walkingRoute?.coordinates ?? [],
      startedAt:
        detourStartedAtRef.current ??
        detourStartedAt ??
        undefined,
      actualDurationMinutes:
        detourStartedAtRef.current
          ? Math.max(
              1,
              Math.round(
                (Date.now() -
                  new Date(
                    detourStartedAtRef.current
                  ).getTime()) /
                  60000
              )
            )
          : undefined,
      rerouteCount:
        rerouteCountRef.current,
      sceneFailures:
        sceneFailuresRef.current,
    };

    const testSessionId =
      playtestSessionIdRef.current;

    if (testSessionId) {
      const sideResults =
        plan?.sideMissions.map(
          (mission) =>
            missionResultsRef.current[
              mission.id
            ] ?? 'completed'
        ) ?? [];

      const arrivalResult =
        plan?.arrivalMission
          ? missionResultsRef.current[
              plan.arrivalMission.id
            ] ?? 'completed'
          : 'completed';

      setPlaytestSessions(
        await updatePlaytestSession(
          testSessionId,
          {
            status: 'completed',
            completedAt:
              entry.completedAt,
            actualDurationMinutes:
              entry.actualDurationMinutes,
            sideMissionsCompleted:
              sideResults.filter(
                (result) =>
                  result === 'completed'
              ).length,
            sideMissionsSkipped:
              sideResults.filter(
                (result) =>
                  result === 'skipped'
              ).length,
            arrivalResult,
            rerouteCount:
              rerouteCountRef.current,
            sceneFailureReasons:
              sceneFailuresRef.current.map(
                (failure) =>
                  failure.reason
              ),
            photoCount:
              finalPhotos.length,
            aiRankingUsed:
              lastAIResult === 'ai',
            aiMissionUsed:
              lastAIResult === 'ai',
            sceneKind:
              selectedScene?.kind,
            plannedDistanceMeters:
              walkingRoute?.distanceMeters,
            plannedDurationSeconds:
              walkingRoute?.durationSeconds,
          }
        )
      );

      setLastCompletedPlaytestSessionId(
        testSessionId
      );
      setPlaytestRating(null);
      setPlaytestFeedbackReasons([]);

      playtestSessionIdRef.current =
        null;
    }

    const nextPassport = [entry, ...passport];
    setLastCompletedEntry(entry);
    await savePassport(nextPassport);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    transitionTo('developing');
  }

  return (
    <View
      style={[
        styles.app,
        chromeDark ? styles.appDark : styles.appLight,
      ]}
    >
      <StatusBar
        barStyle={chromeDark ? 'light-content' : 'dark-content'}
      />


      <Animated.View
        style={[
          styles.animatedRoot,
          {
            opacity: screenOpacity,
            transform: [{ translateY: screenY }],
          },
        ]}
      >
        {stage === 'boot' && (
          <View style={styles.bootScreen}>
            <Text style={styles.bootBrand}>
              DETOUR
            </Text>
          </View>
        )}

        {stage === 'onboarding' && (
          <View style={styles.onboardingScreen}>
            <View style={styles.onboardingTop}>
              {onboardingStep > 0 ||
              onboardingFromSettings ? (
                <Pressable
                  onPress={goBack}
                  hitSlop={16}
                  style={styles.onboardingBack}
                >
                  <Text style={styles.onboardingBackText}>
                    ←
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.onboardingBack} />
              )}

              <Text style={styles.onboardingBrand}>
                DETOUR
              </Text>

              <Text style={styles.onboardingCounter}>
                0{onboardingStep + 1} / 03
              </Text>
            </View>

            <View style={styles.onboardingHero}>
              {onboardingStep === 0 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    先選時間
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    給我一點時間。{`\n`}
                    剩下的我決定。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    你只要選時間，還有這次想怎麼晃。
                  </Text>
                </>
              )}

              {onboardingStep === 1 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    終點先保密
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    終點先藏起來。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    照方向走。真的看不懂，再打開那一小段地圖。
                  </Text>
                </>
              )}

              {onboardingStep === 2 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    不對就換
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    不對，{`\n`}
                    就換掉。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    店沒開、進不去、不值得，就換下一個。
                  </Text>
                </>
              )}
            </View>

            <Pressable
              onPress={nextOnboardingStep}
              style={({ pressed }) => [
                styles.onboardingPrimary,
                pressed &&
                  styles.onboardingPrimaryPressed,
              ]}
            >
              <Text style={styles.onboardingPrimaryText}>
                {onboardingStep === 2
                  ? onboardingFromSettings
                    ? '回到設定'
                    : '開始 DETOUR'
                  : '繼續'}
              </Text>
              <Text style={styles.onboardingPrimaryArrow}>
                →
              </Text>
            </Pressable>
          </View>
        )}

        {stage === 'settings' && (
          <View style={styles.settingsScreen}>
            <View style={styles.settingsTop}>
              <Pressable
                onPress={goBack}
                hitSlop={16}
                style={styles.settingsBack}
              >
                <Text style={styles.settingsBackText}>
                  ←
                </Text>
              </Pressable>

              <Pressable
                onLongPress={toggleDevMode}
                delayLongPress={900}
                hitSlop={10}
              >
                <Text style={styles.settingsBrand}>
                  設定
                </Text>
              </Pressable>

              <Text style={styles.settingsMeta}>
                DETOUR
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsScroll}
            >
              <View style={styles.settingsHero}>
                <Text style={styles.settingsEyebrow}>
                  調整步調
                </Text>
                <Text style={styles.settingsTitle}>
                  讓 DETOUR{`\n`}
                  更像你的步伐。
                </Text>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  步行節奏
                </Text>

                {([
                  {
                    id: 'relaxed' as WalkingPace,
                    label: '慢一點',
                    code: 'RELAXED',
                    note: '同樣的空檔，少走一點。',
                  },
                  {
                    id: 'normal' as WalkingPace,
                    label: '一般',
                    code: 'NORMAL',
                    note: '目前 DETOUR 的預設節奏。',
                  },
                  {
                    id: 'brisk' as WalkingPace,
                    label: '快一點',
                    code: 'BRISK',
                    note: '願意多走一點，換更多候選。',
                  },
                ]).map((pace) => {
                  const active =
                    preferences.walkingPace === pace.id;

                  return (
                    <Pressable
                      key={pace.id}
                      onPress={() =>
                        setWalkingPace(pace.id)
                      }
                      style={({ pressed }) => [
                        styles.settingsChoice,
                        active &&
                          styles.settingsChoiceActive,
                        pressed &&
                          styles.pressedLight,
                      ]}
                    >
                      <View>
                        <Text style={styles.settingsChoiceLabel}>
                          {pace.label}
                        </Text>
                        <Text style={styles.settingsChoiceNote}>
                          {pace.note}
                        </Text>
                      </View>

                      <View style={styles.settingsChoiceRight}>
                        <Text style={styles.settingsChoiceMark}>
                          {active ? '●' : '○'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {devMode && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  PROTOTYPE
                </Text>

                <Pressable
                  onPress={toggleDevMode}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      室內測試
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      用真實 Scene / route，
                      但按按鈕模擬前進。
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.settingsActionState,
                      devMode &&
                        styles.settingsActionStateOn,
                    ]}
                  >
                    {devMode ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>
              )}

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  開始導覽
                </Text>

                <Pressable
                  onPress={replayOnboarding}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      再看一次開始導覽
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      不會清除旅程收藏或偏好。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    →
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  旅程資料
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    已完成旅程
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {passport.length} 趟
                  </Text>
                </View>

                <Pressable
                  onPress={clearPassport}
                  style={({ pressed }) => [
                    styles.settingsDanger,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <Text style={styles.settingsDangerText}>
                    清除已完成旅程
                  </Text>
                </Pressable>
              </View>

              {devMode && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  AI ENGINE
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    BACKEND
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {isAIEngineConfigured()
                      ? 'CONFIGURED'
                      : 'NOT CONNECTED'}
                  </Text>
                </View>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    LAST RUN
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {lastAIResult === 'ai'
                      ? 'AI'
                      : lastAIResult ===
                          'fallback'
                        ? 'FALLBACK'
                        : 'NOT RUN YET'}
                  </Text>
                </View>

                <Text style={styles.settingsActionNote}>
                  AI 失敗時 DETOUR 會自動使用內建 Engine，不會中斷旅程。
                </Text>

                <Pressable
                  onPress={runAIConnectionTest}
                  disabled={aiConnectionTesting}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      {aiConnectionTesting
                        ? '正在測試 AI…'
                        : '測試 AI 連線'}
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      真正跑一次 Scene ranking，確認 OpenAI 與 Structured Output。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    ↗
                  </Text>
                </Pressable>
              </View>
              )}

              {devMode && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  PLAYTEST DATA
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    TESTER
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {playtestTesterId}
                  </Text>
                </View>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    RUNS
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {
                      playtestSessions.filter(
                        (session) =>
                          !session.devMode
                      ).length
                    } REAL · {
                      playtestSessions.filter(
                        (session) =>
                          session.devMode
                      ).length
                    } INDOOR
                  </Text>
                </View>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    CLOUD SYNC
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    ON · v{DETOUR_PLAYTEST_VERSION}
                  </Text>
                </View>

                <Pressable
                  onPress={syncPlaytestDataNow}
                  disabled={playtestSyncing}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      {playtestSyncing
                        ? '正在同步…'
                        : '立即同步測試資料'}
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      平常會自動同步；這顆只是測試前手動確認。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    ↗
                  </Text>
                </Pressable>

                <Pressable
                  onPress={sharePlaytestData}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      分享測試報告
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      匿名統計，不包含 GPS、照片、路線或目的地名稱。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    ↗
                  </Text>
                </Pressable>

                <Pressable
                  onPress={clearPlaytestData}
                  style={({ pressed }) => [
                    styles.settingsDanger,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <Text style={styles.settingsDangerText}>
                    清除測試統計
                  </Text>
                </Pressable>
              </View>
              )}

              <View style={styles.settingsPrivacy}>
                <Text style={styles.settingsPrivacyTitle}>
                  定位
                </Text>
                <Text style={styles.settingsPrivacyBody}>
                  DETOUR 會在首頁先用目前位置準備附近候選，
                  讓你選完時間和心情後不用從零開始等。
                  旅程中的定位軌跡仍只留在手機。
                </Text>
              </View>
            </ScrollView>
          </View>
        )}

        {stage === 'time' && (
          <View style={styles.v35HomeScreen}>
            <View style={styles.v35TopBar}>
              <View>
                <Text style={styles.v35Brand}>DETOUR</Text>
                <View style={styles.v35BrandSlash} />
              </View>
              <Pressable
                onPress={() => transitionTo('settings')}
                accessibilityLabel="打開設定"
                style={({ pressed }) => [styles.v35MenuButton, pressed && styles.v35Pressed]}
              >
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLineShort} />
              </Pressable>
            </View>
            <Animated.View
              style={[
                styles.v35RouteSketch,
                {
                  opacity: homeEntrance,
                  transform: [
                    {
                      translateY: homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.v35CityBlock, { left: '4%', height: 46 }]} />
              <View style={[styles.v35CityBlock, { left: '10%', height: 29, width: 18 }]} />

              <View style={[styles.v35RouteDash, { left: '9%', top: 91, width: 108, transform: [{ rotate: '11deg' }] }]} />
              <View style={[styles.v35RouteDash, { left: '35%', top: 80, width: 116, transform: [{ rotate: '-37deg' }] }]} />
              <View style={[styles.v35RouteDash, { left: '59%', top: 67, width: 110, transform: [{ rotate: '24deg' }] }]} />

              <View style={[styles.v35MapPin, { left: '7%', top: 80 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={[styles.v35MapPin, { left: '35%', top: 103 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={[styles.v35MapPin, { left: '59%', top: 37 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={[styles.v35MapPin, { right: '7%', top: 86 }]}><View style={styles.v35MapPinCore} /></View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v36TravelerDot,
                  {
                    transform: [
                      {
                        translateX: homeRouteMotion.interpolate({
                          inputRange: [0, 0.34, 0.64, 1],
                          outputRange: [0, 102, 194, 290],
                        }),
                      },
                      {
                        translateY: homeRouteMotion.interpolate({
                          inputRange: [0, 0.34, 0.64, 1],
                          outputRange: [0, 24, -42, 7],
                        }),
                      },
                      {
                        scale: homeRouteMotion.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.85, 1.08, 0.85],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.v36TravelerDotCore} />
              </Animated.View>

              <View style={styles.v35SketchBench}><View style={styles.v35BenchSeat} /><View style={styles.v35BenchLeg} /><View style={[styles.v35BenchLeg, styles.v35BenchLegRight]} /></View>
              <View style={styles.v35SketchFlag}><View style={styles.v35FlagPole} /><View style={styles.v35FlagCloth} /></View>
            </Animated.View>
            <Text style={styles.v35HomeQuestion}>今天有多少時間，{`\n`}可以拿來偏離一下？</Text>
            <View style={styles.v35Underline} />
            <Animated.View
              style={[
                styles.v35MinuteReadout,
                { transform: [{ scale: minutePulse }] },
              ]}
            >
              <Text style={styles.v35MinuteNumber}>{sliderDisplayMinutes}</Text>
              <Text style={styles.v35MinuteUnit}>分</Text>
            </Animated.View>
            <View
              style={styles.v35SliderWrap}
              onLayout={(event) => {
                timeSliderWidthRef.current = Math.max(
                  1,
                  event.nativeEvent.layout.width
                );
              }}
              {...timeSliderResponder.panHandlers}
            >
              <View style={styles.v35SliderRail} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v35SliderFill,
                  {
                    width: timeSliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
              {TIME_STEPS.map((minute, index) => {
                const progress = index / (TIME_STEPS.length - 1);
                return (
                  <View key={minute} pointerEvents="none" style={[styles.v35TickWrap, { left: `${progress * 100}%` }]}>
                    <View style={[styles.v35Tick, minute <= sliderDisplayMinutes && styles.v35TickActive]} />
                    <Text style={styles.v35TickLabel}>{minute}</Text>
                  </View>
                );
              })}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v35SliderThumb,
                  {
                    left: timeSliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              >
                <View style={styles.v35SliderThumbCore} />
              </Animated.View>
            </View>
            <Animated.View
              style={{
                opacity: homeEntrance,
                transform: [
                  {
                    translateY: homeEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable onPress={continueFromTime} style={({ pressed }) => [styles.v35TicketButton, pressed && styles.v35TicketButtonPressed]}>
                <View style={styles.v35TicketNotchLeft} />
                <View style={styles.v35TicketNotchRight} />
                <Text style={styles.v35TicketArrow}>→</Text>
                <Text style={styles.v35TicketText}>開始 {sliderDisplayMinutes} 分鐘的旅程</Text>
                <View style={styles.v35TicketDivider} />
                <Text style={styles.v35TicketMark}>▰</Text>
              </Pressable>
              <Pressable onPress={() => transitionTo('passport')} style={({ pressed }) => [styles.v35CompletedButton, pressed && styles.v35Pressed]}>
                <Text style={styles.v35CompletedText}>已完成的旅程</Text>
                <View style={styles.v35CompletedCount}><Text style={styles.v35CompletedCountText}>{passport.length}</Text></View>
                <Text style={styles.v35CompletedArrow}>→</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}

        {stage === 'mood' && (
          <View style={styles.v35MoodScreen}>
            <View style={styles.v35MoodTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v35BackButton}><Text style={styles.v35BackArrow}>‹</Text></Pressable>
              <Text style={styles.v35MoodBrand}>DETOUR</Text>
              <View style={styles.v35TimePill}><Text style={styles.v35TimePillIcon}>◷</Text><Text style={styles.v35TimePillText}>{selectedTime} 分</Text></View>
            </View>
            <Text style={styles.v35MoodTitle}>這次想怎麼晃？</Text>
            <View style={styles.v35UnderlineMood} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v35MoodScroll}>
              <View style={styles.v35MoodGrid}>
                {MOODS.map((item) => {
                  const active = selectedMood === item.id;
                  return (
                    <Pressable key={item.id} onPress={() => chooseMood(item.id)} style={({ pressed }) => [styles.v35MoodCard, active && styles.v35MoodCardActive, pressed && styles.v35Pressed]}>
                      <View style={styles.v35MoodArt}>
                        <Text style={[styles.v35MoodSymbol, active && styles.v35MoodSymbolActive]}>{moodSymbol(item.id)}</Text>
                      </View>
                      <Text style={styles.v35MoodCardLabel}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable disabled={!selectedMood} onPress={continueFromMood} style={({ pressed }) => [styles.v35MoodPrimary, !selectedMood && styles.v35MoodPrimaryDisabled, pressed && selectedMood && styles.v35TicketButtonPressed]}>
              <View style={styles.v35TicketNotchLeft} /><View style={styles.v35TicketNotchRight} />
              <Text style={styles.v35MoodPrimaryText}>{selectedMood ? '出發吧！' : '先選一種心情'}</Text>
              <View style={styles.v35MoodPrimaryDivider} /><Text style={styles.v35MoodPrimaryArrow}>→</Text>
            </Pressable>
          </View>
        )}

        {stage === 'preparing' && (
          <View style={styles.v35PreparingScreen}>
            <Text style={styles.v35PreparingBrand}>DETOUR</Text>
            <Text style={styles.v35PreparingTitle}>正在印製車票…</Text><View style={styles.v35PreparingUnderline} />
            <View style={styles.v35Printer}>
              <View style={styles.v35PrinterTop} /><View style={styles.v35PrinterSlot} />
              <Animated.View style={[styles.v35PrintingTicket, { transform: [{ translateY: routeProgress.interpolate({ inputRange: [0, 1], outputRange: [-95, 12] }) }] }]}>
                <View style={styles.v35PrintOrangeBand} /><Text style={styles.v35PrintBrand}>DETOUR</Text><View style={styles.v35PrintDash} />
                <View style={styles.v35PrintFacts}>
                  <View><Text style={styles.v35PrintLabel}>旅程時間</Text><Text style={styles.v35PrintMinute}>{selectedTime}<Text style={styles.v35PrintMinuteUnit}> 分鐘</Text></Text></View>
                  <View style={styles.v35PrintDivider} />
                  <View style={styles.v35PrintMoodBlock}><Text style={styles.v35PrintLabel}>此趟心情</Text><Text style={styles.v35PrintMood}>{mood?.label ?? '—'}{selectedMood === 'color' && selectedColor ? ` · ${selectedColor.label}` : ''}</Text></View>
                </View>
                <View style={styles.v35PrintDash} /><Text style={styles.v35PrintDestination}>目的地　● ???</Text>
                <View style={styles.v35PrintBarcode}>{[2,1,3,1,2,4,1,3,2,1,4,2,1,3,2,1,4,1].map((w,i)=>(<View key={i} style={[styles.v35PrintBar,{width:w}]} />))}</View>
              </Animated.View>
            </View>
            <Text style={styles.v35PreparingStatus}>{ticketBuildStatus}</Text>
          </View>
        )}

        {stage === 'ready' && (
          <View style={styles.ticketReadyScreen}>
            <View style={styles.ticketFlowTop}>
              <Pressable
                onPress={goBack}
                hitSlop={16}
                style={styles.ticketFlowBack}
              >
                <Text style={[styles.ticketFlowBackText]}>
                  ←
                </Text>
              </Pressable>

              <Text style={[styles.ticketFlowBrand]}>
                DETOUR
              </Text>

              <Text style={styles.ticketReadyMeta}>
                車票好了
              </Text>
            </View>

            <View style={styles.ticketReadyHero}>
              <Text style={styles.ticketFlowEyebrow}>
                可以出發了
              </Text>

              <Text style={styles.ticketReadyTitle}>
                這張 DETOUR{`\n`}
                可以出發了。
              </Text>

            </View>

            <View style={styles.detourTicketShellReady}>
              {selectedMood === 'color' && selectedColor && (
                <View
                  style={{
                    height: 8,
                    marginTop: -1,
                    marginHorizontal: -1,
                    backgroundColor: selectedColor.hex,
                  }}
                />
              )}
              <View style={styles.detourTicketPunchLeftTop} />
              <View style={styles.detourTicketPunchRightTop} />
              <View style={styles.detourTicketPunchLeftBottom} />
              <View style={styles.detourTicketPunchRightBottom} />

              <View style={styles.detourTicketHeader}>
                <View>
                  <Text style={styles.detourTicketBrand}>
                    DETOUR
                  </Text>
                  <Text style={styles.detourTicketMicro}>
                    終點保密
                  </Text>
                </View>

                <Text style={styles.detourTicketSerial}>
                  {ticketSerial(
                    selectedTime,
                    selectedMood
                  )}
                </Text>
              </View>

              <View style={styles.detourTicketDash} />

              <View style={styles.detourTicketReadyFacts}>
                <View style={styles.detourTicketReadyFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    時間
                  </Text>
                  <Text style={styles.detourTicketReadyValue}>
                    {selectedTime} 分
                  </Text>
                </View>

                <View style={styles.detourTicketReadyFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    心情
                  </Text>
                  <Text style={styles.detourTicketReadyValue}>
                    {mood?.label ?? '—'}{selectedMood === 'color' && selectedColor ? ` · ${selectedColor.label}` : ''}
                  </Text>
                </View>

                <View style={styles.detourTicketReadyFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    出發
                  </Text>
                  <Text style={styles.detourTicketReadyValue}>
                    現在
                  </Text>
                </View>
              </View>

              <View style={styles.detourTicketDash} />

              <Text style={styles.detourTicketHighlightLabel}>
                這趟
              </Text>

              <View style={styles.detourTicketHighlights}>
                {selectedMood === 'color' && selectedColor ? (
                  <>
                    <Text style={styles.detourTicketHighlight}>
                      • 今天找{selectedColor.label}
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 終點保密
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.detourTicketHighlight}>
                      • {previewProfile.sideMissionCount} 個沿路尋找
                    </Text>
                    <Text style={styles.detourTicketHighlight}>
                      • 終點保密
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.detourTicketDash} />

              <View style={styles.ticketBarcode}>
                {[10, 4, 7, 3, 11, 5, 8, 3, 6, 12, 4, 9, 3, 7, 10, 4, 8, 5].map(
                  (width, index) => (
                    <View
                      key={`ready-bar-${index}`}
                      style={[
                        styles.ticketBarcodeBar,
                        {
                          width:
                            Math.max(
                              2,
                              Math.round(width / 3)
                            ),
                        },
                      ]}
                    />
                  )
                )}
              </View>

              <View style={styles.detourTicketReadyFoot}>
                <Text style={styles.detourTicketFootnote}>
                  去走走
                </Text>

                <Text
                  style={[
                    styles.detourTicketReadyStamp,
                    selectedMood === 'color' && selectedColor
                      ? { color: selectedColor.hex, borderColor: selectedColor.hex }
                      : null,
                  ]}
                >
                  路線好了
                </Text>
              </View>
            </View>

            <Pressable
              onPress={startDetour}
              style={({ pressed }) => [
                styles.ticketReadyPrimary,
                pressed &&
                  styles.ticketReadyPrimaryPressed,
              ]}
            >
              <Text style={styles.ticketReadyPrimaryText}>
                {devMode ? '開始室內測試' : '出發'}
              </Text>

              <Text style={styles.ticketReadyPrimaryArrow}>
                →
              </Text>
            </Pressable>

            {devMode && (
              <Text style={styles.ticketReadyTestLabel}>
                室內測試 · 真實終點 / 路線
              </Text>
            )}
          </View>
        )}

        {stage === 'journey' &&
          plan &&
          navigationRoute &&
          currentNavigationBeat && (
            <View style={styles.v35JourneyScreen}>
              <View style={styles.v35JourneyTop}>
                <Pressable onPress={goBack} hitSlop={16} style={styles.v35JourneyBack}><Text style={styles.v35JourneyBackText}>←</Text></Pressable>
                <Text style={styles.v35JourneyBrand}>DETOUR</Text>
                <View style={styles.v35JourneyProgress}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const progress = navigationRoute.beats.length <= 1 ? 0 : navigationBeatIndex / (navigationRoute.beats.length - 1);
                    const current = Math.min(4, Math.round(progress * 4));
                    return (<View key={index} style={styles.v35JourneyProgressItem}><View style={[styles.v35JourneyProgressDot, index < current && styles.v35JourneyProgressDone, index === current && styles.v35JourneyProgressCurrent]} />{index < 4 && <View style={[styles.v35JourneyProgressLine, index < current && styles.v35JourneyProgressLineDone]} />}</View>);
                  })}<Text style={styles.v35JourneyFlag}>⚑</Text>
                </View>
              </View>
              {showNextBeatMap && latitude !== null && longitude !== null ? (
                <View style={styles.v35JourneyMapWrap}>
                  <MapView style={styles.v35JourneyMap} initialRegion={{ latitude: (latitude + currentNavigationBeat.point.latitude) / 2, longitude: (longitude + currentNavigationBeat.point.longitude) / 2, latitudeDelta: 0.0022, longitudeDelta: 0.0022 }} showsUserLocation showsMyLocationButton={false} showsCompass={false} pitchEnabled={false} rotateEnabled={false}>
                    <Polyline coordinates={nextBeatSegment} strokeColor={SIGNAL} strokeWidth={5} lineCap="round" /><Circle center={currentNavigationBeat.point} radius={10} strokeColor={BONE} strokeWidth={1} fillColor={SIGNAL} />
                  </MapView>
                  <Pressable onPress={() => setShowNextBeatMap(false)} style={styles.v35JourneyMapClose}><Text style={styles.v35JourneyMapCloseText}>×</Text></Pressable>
                </View>
              ) : (
                <View style={styles.v35JourneyHero}>
                  <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35Compass, pressed && styles.v35JourneyPressed]}><View style={styles.v35CompassTicks} /><View style={{ transform: [{ rotate: `${arrowRotation}deg` }] }}><Text style={styles.v35CompassArrow}>↑</Text></View></Pressable>
                  <Text style={styles.v35JourneyDistance}>{Math.round(nextBeatMeters)}<Text style={styles.v35JourneyDistanceUnit}> m</Text></Text>
                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>
                  {selectedMood !== 'color' &&
                    currentMission &&
                    missionRevealedIndex === sideMissionIndex && (
                    <Pressable
                      onPress={() => openCamera('side')}
                      style={({ pressed }) => [{ marginTop: 16, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 16 }, pressed && styles.v35JourneyPressed]}
                    >
                      <Text numberOfLines={1} style={{ flex: 1, color: BONE, fontSize: 17, fontWeight: '800' }}>{currentMission.title}</Text>
                      <Text style={{ color: SIGNAL, fontSize: 12, fontWeight: '800' }}>看到就拍</Text>
                    </Pressable>
                  )}
                  {selectedMood === 'color' && selectedColor && (
                    <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: selectedColor.hex, borderRadius: 999 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selectedColor.hex }} />
                      <Text style={{ color: BONE, fontSize: 15, fontWeight: '800' }}>今天找{selectedColor.label} · 看到就拍</Text>
                    </View>
                  )}
                  {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}
                </View>
              )}
              {questPulse && <View pointerEvents="none" style={styles.v35QuestPulse}><Text style={styles.v35QuestPulseText}>{questPulse === 'side' ? '新的尋找' : '到終點了'}</Text></View>}
              <View style={styles.v35JourneyBottom}>
                <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>↗</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>小地圖</Text></Pressable>
                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>
                {devMode && <Pressable onPress={simulateWalk} style={styles.v35DevAdvance}><Text style={styles.v35DevAdvanceText}>室內測試 · 模擬前進</Text></Pressable>}
              </View>
            </View>
          )}

        {stage === 'mission' && plan && currentMission && (
          <View style={styles.fieldEventScreen}>
            <View style={styles.fieldEventTop}>
              <Pressable
                onPress={goBack}
                hitSlop={16}
                style={styles.fieldEventBack}
              >
                <Text style={styles.fieldEventBackText}>←</Text>
              </Pressable>

              <Text style={styles.fieldEventBrand}>DETOUR</Text>

              <Text style={styles.fieldEventMeta}>
                尋找
              </Text>
            </View>

            <View style={styles.fieldEventRouteStrip}>
              <View style={styles.fieldEventRouteNode}>
                <View style={styles.fieldEventRouteNodeCore} />
              </View>

              <View style={styles.fieldEventRouteLine} />

              <View style={styles.fieldEventRouteQuest}>
                <Text style={styles.fieldEventRouteQuestMark}>✦</Text>
              </View>

              <View style={styles.fieldEventRouteLineMuted} />

              <Text style={styles.fieldEventRouteLabel}>
                找到就拍，找不到就繼續走
              </Text>
            </View>

            <ScrollView
              style={styles.fieldEventScroll}
              contentContainerStyle={styles.fieldEventScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldEventEyebrow}>
                路上找這個
              </Text>

              <Text style={styles.fieldEventTitle}>
                {currentMission.title}
              </Text>

              {plan.context !== 'day' && (
                <Text style={styles.fieldEventContextNote}>
                  留在有照明、公開可走的位置。
                </Text>
              )}
            </ScrollView>

            <View style={styles.fieldEventBottom}>
              <Pressable
                onPress={beginCurrentMissionSearch}
                style={({ pressed }) => [
                  styles.fieldEventPrimary,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.fieldEventPrimaryText}>
                  開始找
                </Text>
                <Text style={styles.fieldEventPrimaryArrow}>
                  →
                </Text>
              </Pressable>

              <Pressable
                onPress={skipCurrentRequiredMission}
                style={({ pressed }) => [
                  styles.fieldEventSkip,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.fieldEventSkipText}>
                  這個先跳過
                </Text>
              </Pressable>
            </View>

          </View>
        )}

        {stage === 'arrival' && plan && (
          <View style={styles.cleanArrivalScreen}>
            <View style={styles.cleanArrivalTop}>
              <Text style={[styles.brand]}>DETOUR</Text>
              <Text style={styles.cleanArrivalMeta}>
                {selectedScene?.label ?? '抵達'}
              </Text>
            </View>

            <View style={styles.arrivalRevealStrip}>
              <View style={styles.arrivalRevealStart} />
              <View style={styles.arrivalRevealLine} />
              <View style={styles.arrivalRevealFlag}>
                <View style={styles.arrivalRevealFlagPole} />
                <View style={styles.arrivalRevealFlagShape} />
              </View>

              <Text style={styles.arrivalRevealLabel}>
                終點揭曉
              </Text>
            </View>

            <View style={styles.cleanArrivalHero}>
              <Text style={styles.cleanArrivalKicker}>
                到了
              </Text>

              <Text style={styles.cleanArrivalPlace}>
                {selectedScene?.name ?? '終點'}
              </Text>


              <Text style={styles.cleanArrivalMission}>
                {plan.arrivalMission.title}
              </Text>

              <Text style={styles.cleanArrivalInstruction}>
                {plan.arrivalMission.instruction}
              </Text>

            </View>

            <View style={styles.cleanArrivalBottom}>
              {plan.arrivalMission.photo ? (
                <>
                  <Pressable
                    onPress={() => openCamera('arrival')}
                    style={({ pressed }) => [
                      styles.cleanArrivalPrimary,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalPrimaryText}>
                      拍下來
                    </Text>
                    <Text style={styles.cleanArrivalPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={skipArrivalRequiredMission}
                    style={({ pressed }) => [
                      styles.cleanArrivalSkip,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalSkipText}>
                      找不到，先完成這趟
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.cleanArrivalActions}>
                  <Pressable
                    onPress={completeArrivalWithoutPhoto}
                    style={({ pressed }) => [
                      styles.cleanArrivalPrimary,
                      styles.cleanArrivalPrimaryFlexible,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalPrimaryText}>
                      完成這次 DETOUR
                    </Text>
                    <Text style={styles.cleanArrivalPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openCamera('arrival')}
                    style={({ pressed }) => [
                      styles.cleanArrivalCamera,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalCameraIcon}>
                      📷
                    </Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() =>
                  transitionTo('sceneIssue')
                }
                style={({ pressed }) => [
                  styles.cleanArrivalProblem,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.cleanArrivalProblemText}>
                  這裡不行
                </Text>
                <Text style={styles.cleanArrivalProblemArrow}>
                  →
                </Text>
              </Pressable>

              <Text style={styles.cleanArrivalSource}>
                地圖資料：OpenStreetMap
              </Text>
            </View>
          </View>
        )}

        {stage === 'sceneIssue' && (
          <View
            style={[
              styles.reissueScreen,
            ]}
          >
            <View style={styles.reissueTop}>
              <Pressable
                disabled={replacementLoading}
                onPress={goBack}
                hitSlop={16}
                style={styles.reissueBack}
              >
                <Text
                  style={[
                    styles.reissueBackText,
                  ]}
                >
                  ←
                </Text>
              </Pressable>

              <Text
                style={[
                  styles.reissueBrand,
                ]}
              >
                DETOUR
              </Text>

              <Text style={styles.reissueMeta}>
                換一條
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.reissueScroll}
            >
              <View style={styles.reissueRouteCard}>
                <View style={styles.reissueRouteHeader}>
                  <Text
                    style={[
                      styles.reissueRouteLabel,
                    ]}
                  >
                    目前路線
                  </Text>

                  <Text style={styles.reissueRouteStatus}>
                    中斷
                  </Text>
                </View>

                <View style={styles.reissueRouteGraphic}>
                  <View style={styles.reissueRouteStart} />
                  <View style={styles.reissueRouteLineDone} />
                  <View style={styles.reissueRouteBreak}>
                    <Text style={styles.reissueRouteBreakText}>×</Text>
                  </View>
                  <View style={styles.reissueRouteLineNext} />
                  <View style={styles.reissueRouteQuestion}>
                    <Text style={styles.reissueRouteQuestionText}>?</Text>
                  </View>
                </View>

                <View style={styles.reissueRouteFoot}>
                  <Text
                    style={[
                      styles.reissueRouteFootText,
                    ]}
                  >
                    已走過的路和尋找會保留
                  </Text>
                  <Text style={styles.reissueRouteFootArrow}>→</Text>
                  <Text
                    style={[
                      styles.reissueRouteFootText,
                    ]}
                  >
                    換一個終點
                  </Text>
                </View>
              </View>

              <View style={styles.reissueHero}>
                <Text style={styles.reissueEyebrow}>
                  這個終點不行
                </Text>

                <Text
                  style={[
                    styles.reissueTitle,
                  ]}
                >
                  沒關係。{`\n`}
                  改走另一條。
                </Text>

                <Text
                  style={[
                    styles.reissueBody,
                  ]}
                >
                  從你現在的位置換一個終點；已完成的尋找會保留。
                </Text>
              </View>

              <Text
                style={[
                  styles.reissueChoiceLabel,
                ]}
              >
                為什麼要換？
              </Text>

              <View style={styles.reissueGrid}>
                {([
                  {
                    id: 'closed' as SceneIssueReason,
                    index: '01',
                    title: '沒開 / 已打烊',
                    note: '這個時間不成立',
                    mark: '○',
                  },
                  {
                    id: 'inaccessible' as SceneIssueReason,
                    index: '02',
                    title: '找不到 / 進不去',
                    note: '現場無法抵達',
                    mark: '↗',
                  },
                  {
                    id: 'not-worth-it' as SceneIssueReason,
                    index: '03',
                    title: '到現場覺得不值得',
                    note: '這裡不夠有趣',
                    mark: '−',
                  },
                  {
                    id: 'wrong-now' as SceneIssueReason,
                    index: '04',
                    title: '我現在不想去這裡',
                    note: '不是現在想要的',
                    mark: '↝',
                  },
                ]).map((reason) => (
                  <Pressable
                    key={reason.id}
                    disabled={replacementLoading}
                    onPress={() =>
                      replaceFailedDestination(reason.id)
                    }
                    style={({ pressed }) => [
                      styles.reissueChoice,
                      pressed && styles.reissueChoicePressed,
                    ]}
                  >
                    <View style={styles.reissueChoiceTop}>
                      <Text style={styles.reissueChoiceMark}>
                        {reason.mark}
                      </Text>
                      <Text
                        style={[
                          styles.reissueChoiceIndex,
                        ]}
                      >
                        {reason.index}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.reissueChoiceTitle,
                      ]}
                    >
                      {reason.title}
                    </Text>

                    <Text
                      style={[
                        styles.reissueChoiceNote,
                      ]}
                    >
                      {reason.note}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {replacementLoading && (
                <View
                  style={[
                    styles.reissueLoadingCard,
                  ]}
                >
                  <View style={styles.reissueLoadingDot} />
                  <Text
                    style={[
                      styles.reissueLoadingText,
                    ]}
                  >
                    正在重新派發一條能在剩餘時間內完成的路線…
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'developing' && (
          <View style={styles.developingScreen}>
            <View style={styles.developingTop}>
              <Text style={styles.brandLight}>DETOUR</Text>
              <Text style={styles.developingMeta}>
                第 {String(passport.length + 1).padStart(2, '0')} 趟
              </Text>
            </View>

            <View style={styles.developingHero}>
              <View style={styles.developingDot} />
<Text style={styles.developingCode}>正在整理</Text>
              <Text style={styles.developingTitle}>
                先別看。{`\n`}
                這趟正在顯影。
              </Text>
              <Text style={styles.developingBody}>
                {photos.length} 張照片
              </Text>
            </View>

            <View style={styles.developingTrack}>
              <View style={styles.developingTrackFill} />
            </View>
          </View>
        )}

        {stage === 'finish' && (
          <View style={styles.v35FinishScreen}>
            <View style={styles.v35FinishTop}><Text style={styles.v35FinishBrand}>DETOUR</Text><Pressable onPress={() => transitionTo('settings')} style={styles.v35FinishMenu}><View style={styles.v35MenuLine} /><View style={styles.v35MenuLine} /><View style={styles.v35MenuLineShort} /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v35FinishScroll}>
              <Text style={styles.v35FinishTitle}>旅程完成</Text>
              <View style={styles.v35Postcard}>
                <View style={styles.v35PostcardTop}><Text style={styles.v35PostcardBrand}>DETOUR</Text><View style={styles.v35FinishStamp}><Text style={styles.v35FinishStampText}>旅程完成</Text><Text style={styles.v35FinishStampPlane}>✦</Text></View></View>
                {photos.length > 0 ? (<><Image source={{ uri: photos[0].uri }} style={styles.v35PostcardHeroPhoto} resizeMode="cover" /><View style={styles.v35PostcardThumbRow}>{photos.slice(0, 3).map((photo) => (<Image key={photo.id} source={{ uri: photo.uri }} style={styles.v35PostcardThumb} resizeMode="cover" />))}</View></>) : (<View style={styles.v35PostcardNoPhoto}><View style={styles.v35PostcardRouteLine} /><View style={styles.v35PostcardRoutePin} /><Text style={styles.v35PostcardNoPhotoText}>{selectedScene?.name ?? '這趟的終點'}</Text></View>)}
                <View style={styles.v35PostcardMetaRow}><View style={styles.v35PostcardPlace}><Text style={styles.v35PostcardPlaceIcon}>●</Text><Text style={styles.v35PostcardPlaceText}>{selectedScene?.name ?? lastCompletedEntry?.city ?? 'DETOUR'}</Text></View><View style={styles.v35PostcardMetaDivider} /><View style={styles.v35PostcardFacts}><Text style={styles.v35PostcardFact}>{formatPassportDate(lastCompletedEntry?.completedAt ?? new Date().toISOString())}</Text><Text style={styles.v35PostcardFact}>{lastCompletedEntry?.minutes ?? selectedMinutes} 分鐘</Text></View></View>
              </View>
              <Pressable onPress={() => { if (lastCompletedEntry) openPassportEntry(lastCompletedEntry); else transitionTo('passport'); }} style={({ pressed }) => [styles.v35FinishPrimary, pressed && styles.v35TicketButtonPressed]}><Text style={styles.v35FinishPrimaryArrow}>→</Text><Text style={styles.v35FinishPrimaryText}>照片回顧</Text></Pressable>
              <Pressable onPress={resetDetour} style={({ pressed }) => [styles.v35FinishSecondary, pressed && styles.v35Pressed]}><Text style={styles.v35FinishSecondaryText}>回到首頁</Text></Pressable>
              <View style={styles.v35FeedbackPanel}>
                <Text style={styles.v35FeedbackTitle}>這趟值得嗎？</Text>
                <View style={styles.playtestRatingRow}>{([{ id: 'replay' as PlaytestRating, label: '會再玩' }, { id: 'okay' as PlaytestRating, label: '還行' }, { id: 'not-worth-it' as PlaytestRating, label: '不值得' }]).map((item) => { const active = playtestRating === item.id; return (<Pressable key={item.id} onPress={() => rateCompletedDetour(item.id)} style={[styles.playtestRatingButton, active && styles.playtestRatingButtonActive]}><Text style={[styles.playtestRatingText, active && styles.playtestRatingTextActive]}>{item.label}</Text></Pressable>); })}</View>
              </View>
            </ScrollView>
          </View>
        )}

        {stage === 'passport' && (
          <View style={styles.passportScreen}>
            <View style={styles.brandRow}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.backInline}>
                <Text style={styles.backArrow}>←</Text>
              </Pressable>
              <Text style={styles.brand}>已完成的旅程</Text>
              <Text style={styles.meta}>收藏</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.passportScroll}
            >
              <View style={styles.passportHero}>
                <Text style={styles.passportKicker}>
                  走完的路，才會留在這裡。
                </Text>
                <Text style={styles.passportTitle}>
                  你的城市，{`\n`}
                  正在慢慢變熟。
                </Text>
              </View>

              <View style={styles.passportStats}>
                <View style={styles.passportStat}>
                  <Text style={styles.passportStatValue}>
                    {String(passport.length).padStart(2, '0')}
                  </Text>
                  <Text style={styles.passportStatLabel}>趟旅程</Text>
                </View>
                <View style={styles.passportStat}>
                  <Text style={styles.passportStatValue}>
                    {(totalDistanceMeters / 1000).toFixed(1)}
                  </Text>
                  <Text style={styles.passportStatLabel}>公里</Text>
                </View>
                <View style={styles.passportStat}>
                  <Text style={styles.passportStatValue}>
                    {totalDiscoveries}
                  </Text>
                  <Text style={styles.passportStatLabel}>個發現</Text>
                </View>
              </View>

              {tracedPassport.length > 0 && (
                <View style={styles.traceMapShell}>
                  <MapView
                    key={`passport-map-${tracedPassport.length}`}
                    style={styles.traceMap}
                    initialRegion={passportMapRegion}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    {tracedPassport.map((entry) => (
                      <Polyline
                        key={`trace-${entry.id}`}
                        coordinates={entry.route ?? []}
                        strokeColor={SIGNAL}
                        strokeWidth={4}
                      />
                    ))}

                    {tracedPassport.map((entry) => {
                      const route = entry.route ?? [];
                      const end = route[route.length - 1];
                      if (!end) return null;

                      return (
                        <Circle
                          key={`end-${entry.id}`}
                          center={end}
                          radius={12}
                          strokeColor={INK}
                          strokeWidth={1}
                          fillColor={SIGNAL}
                        />
                      );
                    })}
                  </MapView>
                </View>
              )}

              <View style={styles.passportSectionHeader}>
                <Text style={styles.passportSectionTitle}>旅程紀錄</Text>
                <Text style={styles.passportSectionMeta}>
                  {passportLoaded ? '已儲存在手機' : '載入中'}
                </Text>
              </View>

              {passport.length === 0 ? (
                <View style={styles.emptyPassport}>
                  <Text style={styles.emptyPassportNumber}>00</Text>
                  <Text style={styles.emptyPassportTitle}>
                    還沒有任何 DETOUR。
                  </Text>
                </View>
              ) : (
                <View style={styles.passportList}>
                  {passport.map((entry, index) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => openPassportEntry(entry)}
                      style={({ pressed }) => [
                        styles.passportCard,
                        pressed && styles.passportCardPressed,
                      ]}
                    >
                      <View style={styles.passportCardTop}>
                        <Text style={styles.passportCardNumber}>
                          {String(passport.length - index).padStart(2, '0')}
                        </Text>
                        <Text style={styles.passportCardDate}>
                          {formatPassportDate(entry.completedAt)}
                        </Text>
                      </View>

                      <Text style={styles.passportCardMode}>
                        {entry.threadLabel ?? entry.moodLabel}
                      </Text>
                      <Text style={styles.passportCardTitle}>
                        {entry.city} · {entry.minutes} 分鐘
                      </Text>

                      {entry.sceneName && (
                        <Text style={styles.passportCardScene}>
                          → {entry.sceneName}
                        </Text>
                      )}

                      <View style={styles.passportCardBottom}>
                        <Text style={styles.passportCardMeta}>
                          {entry.discoveries} 個尋找
                        </Text>
                        <Text style={styles.passportCardMeta}>
                          {entry.photoCount ?? 0} 張照片
                        </Text>
                      </View>

                      <View style={styles.passportOpenRow}>
                        <Text style={styles.passportOpenText}>打開旅程</Text>
                        <Text style={styles.passportOpenArrow}>↗</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {devMode && passport.length > 0 && (
                <Pressable
                  onPress={clearPassport}
                  style={({ pressed }) => [
                    styles.clearPassportButton,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={styles.clearPassportText}>
                    DEV · 清除測試 Passport
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'passportDetail' && selectedPassportEntry && (
          <View style={styles.postcardDetailScreen}>
            <View style={styles.brandRow}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.backInline}>
                <Text style={styles.backArrow}>←</Text>
              </Pressable>
              <Text style={styles.v35ReviewHeaderTitle}>旅程回顧</Text>
              <Text style={styles.meta}></Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.postcardDetailScroll}
            >
              <View style={styles.postcardDetailHero}>
                <Text style={styles.postcardDetailKicker}>
                  {formatPassportDate(selectedPassportEntry.completedAt)}
                </Text>
                <Text style={styles.postcardDetailTitle}>
                  {selectedPassportEntry.moodLabel}
                </Text>
                <Text style={styles.postcardDetailMeta}>
                  {selectedPassportEntry.city} · {selectedPassportEntry.minutes} 分鐘 ·{' '}
                  {selectedPassportEntry.discoveries} 個任務
                </Text>

                {selectedPassportEntry.sceneName && (
                  <Text style={styles.postcardDetailScene}>
                    終點 · {selectedPassportEntry.sceneName}
                  </Text>
                )}
              </View>

              <View style={styles.postcardFacts}>
                <View style={styles.postcardFact}>
                  <Text style={styles.postcardFactLabel}>出發</Text>
                  <Text style={styles.postcardFactValue}>
                    {formatClockTime(
                      selectedPassportEntry.startedAt
                    )}
                  </Text>
                </View>

                <View style={styles.postcardFact}>
                  <Text style={styles.postcardFactLabel}>完成</Text>
                  <Text style={styles.postcardFactValue}>
                    {formatClockTime(
                      selectedPassportEntry.completedAt
                    )}
                  </Text>
                </View>

                <View style={styles.postcardFact}>
                  <Text style={styles.postcardFactLabel}>實際</Text>
                  <Text style={styles.postcardFactValue}>
                    {selectedPassportEntry.actualDurationMinutes
                      ? `${selectedPassportEntry.actualDurationMinutes} 分`
                      : '—'}
                  </Text>
                </View>
              </View>

              {selectedPassportEntry.photos &&
              selectedPassportEntry.photos.length > 0 ? (
                <View style={styles.v35ReviewPhotoSection}>
                  <Image
                    source={{ uri: selectedPassportEntry.photos[Math.min(passportPhotoIndex, selectedPassportEntry.photos.length - 1)].uri }}
                    style={styles.v35ReviewHeroPhoto}
                    resizeMode="cover"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.v35ReviewThumbStrip}>
                    {selectedPassportEntry.photos.map((photo, index) => (<Pressable key={photo.id} onPress={() => setPassportPhotoIndex(index)}><Image source={{ uri: photo.uri }} style={[styles.v35ReviewThumb, index === passportPhotoIndex && styles.v35ReviewThumbActive]} resizeMode="cover" /></Pressable>))}
                  </ScrollView>
                </View>
              ) : (<View style={styles.v35ReviewEmptyPhoto}><Text style={styles.v35ReviewEmptyTitle}>這趟沒有留下照片。</Text></View>)}

              {((selectedPassportEntry.plannedRoute &&
                selectedPassportEntry.plannedRoute.length >= 2) ||
                (selectedPassportEntry.route &&
                  selectedPassportEntry.route.length >= 2)) && (
                  <View style={styles.postcardMapSection}>
                    <View style={styles.postcardSectionHeader}>
                      <Text style={styles.postcardSectionLabel}>
                        走過的路
                      </Text>
                      <Text style={styles.postcardSectionMeta}>
                        {(
                          (selectedPassportEntry.plannedRouteDistanceMeters ??
                            selectedPassportEntry.distanceMeters ??
                            0) / 1000
                        ).toFixed(2)} 公里
                      </Text>
                    </View>

                    <View style={styles.postcardMapLegend}>
                      <View style={styles.postcardLegendItem}>
                        <View style={styles.postcardLegendPlanned} />
                        <Text style={styles.postcardLegendText}>
                          原路線
                        </Text>
                      </View>
                      <View style={styles.postcardLegendItem}>
                        <View style={styles.postcardLegendActual} />
                        <Text style={styles.postcardLegendText}>
                          實際走過
                        </Text>
                      </View>
                      {selectedPassportEntry.rerouteCount ? (
                        <Text style={styles.postcardRerouteMeta}>
                          換過 {selectedPassportEntry.rerouteCount} 次終點
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.postcardMapShell}>
                      <MapView
                        style={styles.postcardMap}
                        initialRegion={(() => {
                          const points = [
                            ...(selectedPassportEntry.plannedRoute ?? []),
                            ...(selectedPassportEntry.route ?? []),
                            ...(selectedPassportEntry.scenePoint
                              ? [selectedPassportEntry.scenePoint]
                              : []),
                          ];

                          const lats = points.map(
                            (point) => point.latitude
                          );
                          const lons = points.map(
                            (point) => point.longitude
                          );

                          const minLat = Math.min(...lats);
                          const maxLat = Math.max(...lats);
                          const minLon = Math.min(...lons);
                          const maxLon = Math.max(...lons);

                          return {
                            latitude:
                              (minLat + maxLat) / 2,
                            longitude:
                              (minLon + maxLon) / 2,
                            latitudeDelta: Math.max(
                              (maxLat - minLat) * 1.8,
                              0.005
                            ),
                            longitudeDelta: Math.max(
                              (maxLon - minLon) * 1.8,
                              0.005
                            ),
                          };
                        })()}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                        scrollEnabled={false}
                        zoomEnabled={false}
                      >
                        {selectedPassportEntry.plannedRoute &&
                          selectedPassportEntry.plannedRoute.length >= 2 && (
                            <Polyline
                              coordinates={
                                selectedPassportEntry.plannedRoute
                              }
                              strokeColor="#9D998F"
                              strokeWidth={3}
                            />
                          )}

                        {selectedPassportEntry.route &&
                          selectedPassportEntry.route.length >= 2 && (
                            <Polyline
                              coordinates={
                                selectedPassportEntry.route
                              }
                              strokeColor={SIGNAL}
                              strokeWidth={4}
                            />
                          )}

                        {selectedPassportEntry.scenePoint && (
                          <Circle
                            center={
                              selectedPassportEntry.scenePoint
                            }
                            radius={10}
                            strokeColor={INK}
                            strokeWidth={1}
                            fillColor={BONE}
                          />
                        )}
                      </MapView>
                    </View>
                  </View>
                )}

              {selectedPassportEntry.sceneFailures &&
                selectedPassportEntry.sceneFailures.length > 0 && (
                  <View style={styles.postcardRecoverySection}>
                    <Text style={styles.postcardSectionLabel}>
                      路上換過終點
                    </Text>

                    <Text style={styles.postcardRecoveryText}>
                      途中換過{' '}
                      {selectedPassportEntry.sceneFailures.length}{' '}
                      次終點；已完成的尋找都有保留。
                    </Text>
                  </View>
                )}

              <View style={styles.postcardMissionSection}>
                <View style={styles.postcardSectionHeader}>
                  <Text style={styles.postcardSectionLabel}>這趟發生的事</Text>
                  <Text style={styles.postcardSectionMeta}>
                    {selectedPassportEntry.missions?.length ?? 0} 個尋找
                  </Text>
                </View>

                {selectedPassportEntry.missions &&
                selectedPassportEntry.missions.length > 0 ? (
                  selectedPassportEntry.missions.map((mission, index) => (
                    <View
                      key={`${selectedPassportEntry.id}-${mission.code}-${index}`}
                      style={styles.postcardMissionRow}
                    >
                      <Text style={styles.postcardMissionNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <View style={styles.postcardMissionCopy}>
                        <View style={styles.postcardMissionCodeRow}>
                          <Text style={styles.postcardMissionCode}>
                            尋找 {String(index + 1).padStart(2, '0')}
                          </Text>
                          <Text
                            style={[
                              styles.postcardMissionResult,
                              mission.result === 'skipped' &&
                                styles.postcardMissionResultSkipped,
                            ]}
                          >
                            {mission.result === 'skipped' ? '跳過' : '完成'}
                          </Text>
                        </View>
                        <Text style={styles.postcardMissionTitle}>
                          {mission.title}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.postcardLegacyText}>
                    這是舊版紀錄，當時還沒有保存任務明細。
                  </Text>
                )}
              </View>
              <View style={styles.v38ShareSection}>
                <Text style={styles.v38SharePreviewLabel}>分享預覽</Text>
                <View
                  ref={shareTicketRef}
                  collapsable={false}
                  style={styles.v38ShareTicket}
                >
                  <View style={styles.v38ShareSignal} />
                  <View style={styles.v38ShareTicketHead}>
                    <View>
                      <Text style={styles.v38ShareBrand}>DETOUR</Text>
                      <Text style={styles.v38ShareMicro}>旅程票</Text>
                    </View>
                    <Text style={styles.v38ShareSerial}>
                      {String(selectedPassportEntry.id).slice(-8).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.v38ShareDash} />

                  <Text style={styles.v38ShareDestinationLabel}>終點</Text>
                  <Text style={styles.v38ShareDestination} numberOfLines={2}>
                    {selectedPassportEntry.sceneName ?? selectedPassportEntry.city ?? 'DETOUR'}
                  </Text>

                  {selectedPassportEntry.photos?.[0]?.uri ? (
                    <Image
                      source={{ uri: selectedPassportEntry.photos[0].uri }}
                      style={styles.v38SharePhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.v38ShareNoPhoto}>
                      <Text style={styles.v38ShareNoPhotoMark}>● ───────── ⚑</Text>
                    </View>
                  )}

                  <View style={styles.v38ShareRouteRow}>
                    <View style={styles.v38ShareRouteStart} />
                    <View style={styles.v38ShareRouteLine} />
                    <Text style={styles.v38ShareRouteFlag}>⚑</Text>
                  </View>

                  <View style={styles.v38ShareFacts}>
                    <View style={styles.v38ShareFact}>
                      <Text style={styles.v38ShareFactLabel}>時間</Text>
                      <Text style={styles.v38ShareFactValue}>{selectedPassportEntry.minutes} 分</Text>
                    </View>
                    <View style={styles.v38ShareFact}>
                      <Text style={styles.v38ShareFactLabel}>心情</Text>
                      <Text style={styles.v38ShareFactValue}>{selectedPassportEntry.moodLabel}</Text>
                    </View>
                    <View style={styles.v38ShareFact}>
                      <Text style={styles.v38ShareFactLabel}>日期</Text>
                      <Text style={styles.v38ShareFactValue}>{formatPassportDate(selectedPassportEntry.completedAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.v38ShareDash} />
                  <View style={styles.v38ShareFoot}>
                    <Text style={styles.v38ShareFootText}>留著這張 DETOUR</Text>
                    <Text style={styles.v38ShareFootText}>{selectedPassportEntry.discoveries} 個尋找</Text>
                  </View>
                </View>
              </View>

              <Pressable onPress={() => shareJourney(selectedPassportEntry)} style={({ pressed }) => [styles.v35ReviewShare, pressed && styles.v35TicketButtonPressed]}>
                <Text style={styles.v35ReviewShareIcon}>↥</Text><Text style={styles.v35ReviewShareText}>分享車票</Text>
              </Pressable>

            </ScrollView>
          </View>
        )}

      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  appLight: { backgroundColor: BONE },
  appDark: { backgroundColor: INK },
  animatedRoot: { flex: 1 },
  pressedLight: { opacity: 0.4 },

  bootScreen: {
    flex: 1,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bootBrand: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 5,
    color: INK,
  },

  onboardingScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  onboardingTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  onboardingBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  onboardingBackText: {
    fontSize: 26,
    color: INK,
  },

  onboardingBrand: {
    marginLeft: 26,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  onboardingCounter: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.6,
    color: MUTED,
  },

  onboardingHero: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 92,
    paddingBottom: 24,
  },

  onboardingEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: SIGNAL,
    marginBottom: 18,
  },

  onboardingTitle: {
    maxWidth: 355,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: INK,
  },

  onboardingBody: {
    marginTop: 28,
    maxWidth: 350,
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: '#3F3D38',
  },

  onboardingNote: {
    marginTop: 24,
    maxWidth: 338,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
    color: INK,
  },

  onboardingPrimary: {
    minHeight: 72,
    paddingHorizontal: 20,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  onboardingPrimaryPressed: {
    opacity: 0.55,
  },

  onboardingPrimaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: BONE,
  },

  onboardingPrimaryArrow: {
    fontSize: 24,
    color: SIGNAL,
  },

  settingsScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
  },

  settingsTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingsBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  settingsBackText: {
    fontSize: 26,
    color: INK,
  },

  settingsBrand: {
    marginLeft: 26,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  settingsMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.6,
    color: MUTED,
  },

  settingsScroll: {
    paddingTop: 28,
    paddingBottom: 64,
  },

  settingsHero: {
    marginBottom: 34,
  },

  settingsEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.9,
    color: SIGNAL,
    marginBottom: 14,
  },

  settingsTitle: {
    maxWidth: 350,
    fontSize: 39,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: -2.1,
    color: INK,
  },

  settingsSection: {
    marginTop: 32,
  },

  settingsSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: MUTED,
    marginBottom: 12,
  },

  settingsChoice: {
    minHeight: 88,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingsChoiceActive: {
    paddingLeft: 10,
  },

  settingsChoiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },

  settingsChoiceNote: {
    marginTop: 7,
    maxWidth: 255,
    fontSize: 13,
    lineHeight: 20,
    color: '#5A5750',
  },

  settingsChoiceRight: {
    alignItems: 'flex-end',
    gap: 5,
  },

  settingsChoiceCode: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: MUTED,
  },

  settingsChoiceMark: {
    fontSize: 14,
    color: SIGNAL,
  },

  settingsAction: {
    minHeight: 84,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingsActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },

  settingsActionNote: {
    marginTop: 7,
    maxWidth: 270,
    fontSize: 13,
    lineHeight: 20,
    color: '#5A5750',
  },

  settingsActionState: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: MUTED,
  },

  settingsActionStateOn: {
    color: SIGNAL,
  },

  settingsActionArrow: {
    fontSize: 18,
    color: SIGNAL,
  },

  settingsDataRow: {
    minHeight: 56,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingsDataLabel: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: INK,
  },

  settingsDataValue: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: MUTED,
  },

  settingsDanger: {
    minHeight: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    justifyContent: 'center',
  },

  settingsDangerText: {
    fontSize: 11,
    color: SIGNAL,
  },

  settingsPrivacy: {
    marginTop: 42,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: LINE,
  },

  settingsPrivacyTitle: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: MUTED,
  },

  settingsPrivacyBody: {
    marginTop: 12,
    maxWidth: 340,
    fontSize: 13,
    lineHeight: 21,
    color: '#5A5750',
  },

  ticketMoodScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  ticketFlowTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },

  ticketFlowBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  ticketFlowBackText: {
    fontSize: 26,
    color: INK,
  },

  ticketFlowBrand: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4.2,
    color: INK,
  },

  ticketFlowTimePill: {
    marginLeft: 'auto',
    minWidth: 66,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  ticketFlowTimeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: BONE,
  },

  ticketFlowTimeUnit: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#A7A29A',
  },

  ticketFlowEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: SIGNAL,
  },

  ticketMoodScroll: {
    flex: 1,
  },

  ticketMoodScrollContent: {
    paddingTop: 24,
    paddingBottom: 12,
  },

  ticketMoodHero: {
    marginTop: 0,
  },

  ticketMoodTitle: {
    marginTop: 11,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '700',
    letterSpacing: -2.1,
    color: INK,
  },

  ticketMoodGrid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  ticketMoodCard: {
    width: '48.5%',
    minHeight: 122,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#F7F4EB',
    justifyContent: 'space-between',
  },

  ticketMoodCardWide: {
    width: '100%',
    minHeight: 96,
  },

  ticketMoodCardActive: {
    borderWidth: 2,
    borderColor: SIGNAL,
    backgroundColor: '#FFF0E9',
  },

  ticketMoodCardPressed: {
    opacity: 0.62,
    transform: [{ translateY: 2 }],
  },

  ticketMoodCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  ticketMoodSymbol: {
    fontSize: 26,
    lineHeight: 30,
    color: INK,
  },

  ticketMoodSymbolActive: {
    color: SIGNAL,
  },

  ticketMoodIndex: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    color: MUTED,
  },

  ticketMoodIndexActive: {
    color: SIGNAL,
  },

  ticketMoodLabel: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: INK,
  },

  ticketMoodHint: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: '#69645C',
  },

  ticketMoodCardFoot: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketMoodCode: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  ticketMoodCodeActive: {
    color: SIGNAL,
  },

  ticketMoodCheck: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#A49F96',
  },

  ticketMoodCheckActive: {
    color: SIGNAL,
  },

  ticketMoodFooter: {
    paddingTop: 10,
    backgroundColor: BONE,
  },

  ticketMoodPrimary: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketMoodPrimaryDisabled: {
    backgroundColor: SOFT,
  },

  ticketMoodPrimaryPressed: {
    opacity: 0.76,
    transform: [{ translateY: 2 }],
  },

  ticketMoodPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: BONE,
  },

  ticketMoodPrimaryArrow: {
    fontSize: 22,
    color: SIGNAL,
  },

  ticketMoodPrimaryTextDisabled: {
    color: '#AAA59B',
  },

  ticketPrepareScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 26,
  },

  ticketPrepareMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  ticketPrepareHero: {
    marginTop: 44,
  },

  ticketPrepareTitle: {
    marginTop: 14,
    fontSize: 44,
    lineHeight: 49,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: INK,
  },

  ticketPrepareSubtitle: {
    marginTop: 18,
    maxWidth: 330,
    fontSize: 14,
    lineHeight: 22,
    color: '#6B665E',
  },

  detourTicketShell: {
    marginTop: 34,
    minHeight: 332,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D3CEC1',
    position: 'relative',
    overflow: 'hidden',
  },

  detourTicketShellReady: {
    marginTop: 24,
    minHeight: 386,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D3CEC1',
    position: 'relative',
    overflow: 'hidden',
  },

  detourTicketPunchLeftTop: {
    position: 'absolute',
    left: -10,
    top: 74,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketPunchRightTop: {
    position: 'absolute',
    right: -10,
    top: 74,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketPunchLeftBottom: {
    position: 'absolute',
    left: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketPunchRightBottom: {
    position: 'absolute',
    right: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  detourTicketBrand: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3.3,
    color: INK,
  },

  detourTicketMicro: {
    marginTop: 5,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

  detourTicketSerial: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },

  detourTicketDash: {
    height: 1,
    marginVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#BDB7AA',
    borderStyle: 'dashed',
  },

  detourTicketFacts: {
    flexDirection: 'row',
    gap: 44,
  },

  detourTicketFact: {
    minWidth: 112,
  },

  detourTicketFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: MUTED,
  },

  detourTicketFactValue: {
    marginTop: 7,
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },

  detourTicketRoutePrint: {
    height: 52,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  detourTicketRouteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  detourTicketRouteLine: {
    height: 2,
    marginLeft: 6,
    backgroundColor: SIGNAL,
  },

  detourTicketRouteEnd: {
    marginLeft: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: SIGNAL,
    backgroundColor: '#FAF7EE',
  },

  detourTicketGenerating: {
    marginTop: -2,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  ticketBarcode: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },

  ticketBarcodeBar: {
    height: 34,
    backgroundColor: INK,
  },

  detourTicketFootnote: {
    marginTop: 9,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: MUTED,
  },

  ticketPrepareBottom: {
    marginTop: 'auto',
  },

  ticketPrepareBottomText: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 18,
    color: MUTED,
  },

  ticketReadyScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  ticketReadyMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  ticketReadyHero: {
    marginTop: 32,
  },

  ticketReadyTitle: {
    marginTop: 13,
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -2.1,
    color: INK,
  },

  ticketReadySubtitle: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    color: '#6B665E',
  },

  detourTicketReadyFacts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  detourTicketReadyFact: {
    width: '31%',
  },

  detourTicketReadyValue: {
    marginTop: 7,
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },

  detourTicketHighlightLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  detourTicketHighlights: {
    marginTop: 10,
    gap: 7,
  },

  detourTicketHighlight: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: INK,
  },

  detourTicketReadyFoot: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  detourTicketReadyStamp: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: SIGNAL,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: SIGNAL,
    transform: [{ rotate: '-4deg' }],
  },

  ticketReadyPrimary: {
    minHeight: 64,
    marginTop: 18,
    paddingHorizontal: 19,
    borderRadius: 15,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketReadyPrimaryPressed: {
    opacity: 0.78,
    transform: [{ translateY: 2 }],
  },

  ticketReadyPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: BONE,
  },

  ticketReadyPrimaryArrow: {
    fontSize: 23,
    color: SIGNAL,
  },

  ticketReadyTestLabel: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  routeHomeScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  routeHomeHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  routeBrandLockup: {
    paddingTop: 3,
  },

  routeBrand: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 5.5,
    color: INK,
  },

  routeBrandTag: {
    marginTop: 8,
    fontSize: 7,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#98948A',
  },

  routeHomeUtilities: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  routePassportButton: {
    minWidth: 54,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  routePassportRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePassportRingInner: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: SIGNAL,
  },

  routePassportBadge: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePassportBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: INK,
  },

  routeUtilityDivider: {
    width: 1,
    height: 32,
    backgroundColor: LINE,
  },

  routeSettingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routeSettingsGlyph: {
    marginTop: -6,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    color: INK,
  },

  routePulseHero: {
    height: 2,
  },

  routePulseGraphic: {
    height: 188,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },

  routePulseStartWrap: {
    position: 'absolute',
    left: 20,
    top: 58,
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePulseHaloLarge: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,90,54,0.08)',
  },

  routePulseHaloSmall: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,90,54,0.12)',
  },

  routePulseStart: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SIGNAL,
    borderWidth: 3,
    borderColor: BONE,
  },

  routePulseStartCore: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BONE,
  },

  routePulseStartLabel: {
    position: 'absolute',
    left: 0,
    top: 20,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  routeSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: SIGNAL,
  },

  routeSegmentOne: {
    left: 63,
    top: 93,
    width: 74,
    transform: [{ rotate: '12deg' }],
  },

  routeSegmentTwo: {
    left: 127,
    top: 82,
    width: 66,
    transform: [{ rotate: '-19deg' }],
  },

  routeSegmentThree: {
    left: 183,
    top: 87,
    width: 74,
    transform: [{ rotate: '43deg' }],
  },

  routeSegmentFour: {
    left: 243,
    top: 119,
    width: 70,
    transform: [{ rotate: '2deg' }],
  },

  routeSegmentFive: {
    right: 16,
    top: 93,
    width: 74,
    transform: [{ rotate: '-48deg' }],
  },

  routeNode: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: BONE,
  },

  routeNodeOne: {
    left: 172,
    top: 59,
  },

  routeNodeOneLabel: {
    position: 'absolute',
    left: 144,
    top: 17,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  routeNodeTwo: {
    left: 246,
    top: 112,
  },

  routeNodeTwoLabel: {
    position: 'absolute',
    left: 228,
    top: 139,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  routeSceneDiscOne: {
    position: 'absolute',
    left: 105,
    top: 110,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#C8C0A9',
    overflow: 'hidden',
  },

  routeSceneDiscOneInner: {
    position: 'absolute',
    left: 15,
    top: -4,
    width: 10,
    height: 54,
    backgroundColor: '#5E6756',
    transform: [{ rotate: '28deg' }],
  },

  routeSceneDiscTwo: {
    position: 'absolute',
    right: 67,
    top: 54,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8E8577',
    overflow: 'hidden',
  },

  routeSceneDiscTwoInner: {
    position: 'absolute',
    right: 10,
    top: 4,
    width: 12,
    height: 40,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  routeDestination: {
    position: 'absolute',
    right: 14,
    top: 40,
    width: 38,
    height: 55,
  },

  routeDestinationDot: {
    position: 'absolute',
    left: 2,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: SIGNAL,
  },

  routeDestinationPole: {
    position: 'absolute',
    left: 8,
    top: 3,
    width: 2,
    height: 42,
    backgroundColor: SIGNAL,
  },

  routeDestinationFlag: {
    position: 'absolute',
    left: 10,
    top: 3,
    width: 23,
    height: 15,
    backgroundColor: SIGNAL,
    transform: [{ skewY: '-10deg' }],
  },

  routeDestinationLabel: {
    position: 'absolute',
    right: 0,
    top: 96,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: MUTED,
    textAlign: 'right',
  },

  routeTinyTreeOne: {
    position: 'absolute',
    left: 45,
    bottom: 12,
    fontSize: 16,
    color: '#C1BDB2',
  },

  routeTinyTreeTwo: {
    position: 'absolute',
    left: 66,
    bottom: 1,
    fontSize: 13,
    color: '#C1BDB2',
  },

  routeTinyMountain: {
    position: 'absolute',
    right: 68,
    bottom: 4,
    fontSize: 30,
    color: '#C9C5B8',
  },

  routeHomeCopy: {
    marginTop: 6,
  },

  routeHomeTitle: {
    fontSize: 41,
    lineHeight: 47,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  routeHomeSubtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '500',
    color: '#6B675F',
  },

  routeTimeRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 9,
  },

  routeTimeButton: {
    flex: 1,
    height: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: INK,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  routeTimeButtonActive: {
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: '#FFF0E9',
  },

  routeTimeButtonPressed: {
    opacity: 0.6,
    transform: [{ translateY: 2 }],
  },

  routeTimeNumber: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: INK,
  },

  routeTimeNumberActive: {
    color: INK,
  },

  routeTimeUnit: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: MUTED,
  },

  routeTimeUnitActive: {
    color: SIGNAL,
  },

  routeSelectedBurst: {
    position: 'absolute',
    top: -15,
    width: 42,
    height: 18,
  },

  routeBurstLeft: {
    position: 'absolute',
    left: 5,
    top: 8,
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '55deg' }],
  },

  routeBurstCenter: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: SIGNAL,
  },

  routeBurstRight: {
    position: 'absolute',
    right: 5,
    top: 8,
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-55deg' }],
  },

  routeHomePrimary: {
    marginTop: 18,
    minHeight: 64,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  routeHomePrimaryDisabled: {
    backgroundColor: SOFT,
  },

  routeHomePrimaryPressed: {
    opacity: 0.78,
    transform: [{ translateY: 2 }],
  },

  routeHomePrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: BONE,
  },

  routeHomePrimaryArrow: {
    fontSize: 24,
    lineHeight: 26,
    color: BONE,
  },

  routeHomePrimaryTextDisabled: {
    color: '#A5A097',
  },

  routeHomeFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  routeHomeFooterText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: MUTED,
  },

  routeHomeTestLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  lightScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  darkScreen: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  brandRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  darkBrandRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3.2,
    color: INK,
  },

  brandLight: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3.2,
    color: BONE,
  },

  meta: {
    marginLeft: 'auto',
    fontSize: 9,
    letterSpacing: 1.8,
    color: MUTED,
  },

  metaLight: {
    marginLeft: 'auto',
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#9A968E',
  },

  homeUtilityCluster: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  homePassportButton: {
    minHeight: 46,
    paddingLeft: 11,
    paddingRight: 13,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  homePassportStamp: {
    fontSize: 21,
    lineHeight: 24,
    color: SIGNAL,
  },

  homePassportLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: INK,
  },

  homePassportMeta: {
    marginTop: 3,
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: MUTED,
  },

  homeSettingsButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeSettingsGlyph: {
    marginTop: -6,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    color: INK,
  },

  homeUtilityPressed: {
    opacity: 0.42,
    transform: [{ scale: 0.97 }],
  },

  backInline: {
    width: 30,
    height: 34,
    justifyContent: 'center',
  },

  backArrow: {
    fontSize: 25,
    lineHeight: 28,
    color: INK,
  },

  homeHero: {
    marginTop: 34,
  },

  homeIntroBlock: {
    maxWidth: 352,
  },

  signalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
    marginBottom: 18,
  },

  signalDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  kicker: {
    maxWidth: 332,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#5A5750',
    marginBottom: 16,
  },

  homeTitle: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '700',
    letterSpacing: -3,
    color: INK,
  },

  homeBody: {
    marginTop: 20,
    maxWidth: 338,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
    color: '#4B4842',
  },

  homeCtaBlock: {
    marginTop: 44,
  },

  homeSectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  homeSectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: INK,
  },

  homeSectionNote: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: SIGNAL,
  },

  timeCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  timeCard: {
    width: '48.3%',
    minHeight: 172,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: INK,
    backgroundColor: '#F6F3EA',
  },

  timeCardPressed: {
    opacity: 0.72,
    transform: [{ translateY: 2 }],
  },

  timeCardCode: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  timeCardTopRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  timeCardNumber: {
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  timeCardArrow: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 20,
    color: SIGNAL,
  },

  timeCardUnit: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: MUTED,
  },

  timeCardBlurb: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: '#4B4842',
  },

  homeFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  bottomNote: {
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '600',
    color: '#5A5750',
    maxWidth: '72%',
  },

  devHomeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  moodHeader: { marginTop: 38, marginBottom: 22 },

  sectionTitle: {
    fontSize: 45,
    lineHeight: 50,
    fontWeight: '600',
    letterSpacing: -2.4,
    color: INK,
  },

  moodList: { borderTopWidth: 1, borderTopColor: LINE },

  moodRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
  },

  moodRowPressed: { paddingLeft: 8, opacity: 0.45 },
  moodIndex: { width: 38, fontSize: 9, letterSpacing: 1.3, color: MUTED },
  moodTextWrap: { flex: 1 },

  moodLabel: {
    fontSize: 22,
    fontWeight: '650',
    letterSpacing: -0.9,
    color: INK,
  },

  moodCode: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: MUTED,
  },

  moodArrow: { fontSize: 20, color: INK },
  colorHero: { marginTop: 38 },
  colorGrid: { borderTopWidth: 1, borderTopColor: LINE },

  colorButton: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  colorButtonPressed: { opacity: 0.45, paddingLeft: 6 },

  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,17,15,0.16)',
  },

  colorLabel: { fontSize: 16, fontWeight: '700', color: INK },
  colorCode: { marginTop: 2, fontSize: 7, letterSpacing: 1.4, color: MUTED },
  colorArrow: { marginLeft: 'auto', fontSize: 18, color: INK },

  randomButton: {
    marginTop: 14,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  randomButtonText: { fontSize: 12, fontWeight: '700', color: INK },

  prepareScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  prepareHero: { marginTop: 44 },

  prepareTitle: {
    fontSize: 47,
    lineHeight: 52,
    fontWeight: '600',
    letterSpacing: -2.5,
    color: INK,
  },

  routeCanvas: {
    height: 120,
    marginTop: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },

  routeStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  routeStroke: { height: 2, marginLeft: 6, backgroundColor: INK },

  routeEnd: {
    marginLeft: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routeEndInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: INK,
  },

  readyHero: { marginTop: 30 },

  readyNumber: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: '700',
    letterSpacing: -8,
    color: INK,
  },

  readyMinutes: {
    marginTop: 4,
    fontSize: 9,
    letterSpacing: 2.5,
    color: MUTED,
  },

  readyTitle: {
    marginTop: 34,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '600',
    letterSpacing: -1.8,
    color: INK,
  },

  ticket: {
    minHeight: 88,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  ticketColumn: { flex: 1, paddingTop: 16, paddingRight: 8 },
  ticketDivider: { width: 1, backgroundColor: LINE, marginHorizontal: 8 },
  ticketLabel: { fontSize: 7, letterSpacing: 1.1, color: MUTED },
  ticketValue: { marginTop: 8, fontSize: 11, fontWeight: '700', color: INK },

  primaryButton: {
    height: 68,
    marginTop: 18,
    paddingHorizontal: 20,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  primaryButtonPressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  primaryButtonText: { fontSize: 17, fontWeight: '700', color: BONE },
  primaryButtonArrow: { fontSize: 24, color: SIGNAL },

  journeyScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  journeyTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  darkBack: { width: 32, height: 36, justifyContent: 'center' },
  darkBackText: { fontSize: 24, color: BONE },

  contextBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  contextBadgeText: { fontSize: 8, letterSpacing: 1.4, color: '#9A968E' },

  mainQuestBar: { marginTop: 22 },
  mainQuestBarFillWrap: { height: 3, backgroundColor: '#34332F' },
  mainQuestBarFill: { height: 3, backgroundColor: SIGNAL },

  mainQuestBarMeta: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  mainQuestMini: { fontSize: 7, letterSpacing: 1.5, color: '#79766F' },

  journeyHero: { flex: 1, justifyContent: 'center' },
  mainQuestLabel: { fontSize: 9, letterSpacing: 2, color: SIGNAL },

  beatArrowWrap: {
    height: 84,
    marginTop: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  beatArrow: {
    fontSize: 58,
    lineHeight: 64,
    color: SIGNAL,
  },

  distanceBig: {
    marginTop: 8,
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '700',
    letterSpacing: -4.8,
    color: BONE,
  },

  journeyInstruction: {
    marginTop: 20,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -1.4,
    color: BONE,
  },

  journeySub: {
    marginTop: 11,
    maxWidth: 300,
    fontSize: 12,
    lineHeight: 20,
    color: '#8E8A82',
  },

  journeyFooter: { gap: 12 },

  sideQuestSummary: {
    minHeight: 54,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#393833',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sideQuestSummaryLabel: { fontSize: 8, letterSpacing: 1.5, color: '#8E8A82' },
  sideQuestSummaryValue: { fontSize: 11, fontWeight: '700', color: BONE },

  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  threadDot: { width: 9, height: 9, borderRadius: 5 },
  threadText: { fontSize: 8, letterSpacing: 1.4, color: '#8E8A82' },

  journeyUtilityRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },

  journeyUtilityText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: '#8E8A82',
  },

  journeyCameraButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#4A4741',
    alignItems: 'center',
    justifyContent: 'center',
  },

  journeyCameraButtonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.96 }],
  },

  journeyCameraIcon: {
    fontSize: 21,
  },

  devPanel: { marginTop: 2, padding: 14, borderWidth: 1, borderColor: '#363430' },
  devPanelTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  devLabel: { fontSize: 8, letterSpacing: 1.4, color: SIGNAL },
  devValue: { fontSize: 9, color: '#8E8A82' },

  devButton: {
    height: 44,
    paddingHorizontal: 13,
    backgroundColor: '#23221F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  devButtonPressed: { backgroundColor: '#33312D' },
  devButtonText: { fontSize: 11, color: BONE },

  navigationArrowField: {
    alignItems: 'center',
    marginBottom: 8,
  },

  navigationCompassRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: '#35332F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  navigationArrowRotator: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navigationArrow: {
    fontSize: 67,
    lineHeight: 76,
    color: SIGNAL,
  },

  headingMeta: {
    marginTop: 11,
    fontSize: 7,
    letterSpacing: 1.25,
    color: '#68655E',
  },

  nextBeatMapButton: {
    width: '100%',
    height: 48,
    marginTop: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#34322E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  nextBeatMapButtonPressed: {
    opacity: 0.45,
  },

  nextBeatMapButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: BONE,
  },

  nextBeatMapWrap: {
    flex: 1,
    marginTop: 20,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1917',
  },

  nextBeatMap: {
    ...StyleSheet.absoluteFillObject,
  },

  nextBeatMapChrome: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  nextBeatMapLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: BONE,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: INK,
  },

  nextBeatMapHint: {
    marginTop: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(17,17,15,0.82)',
    fontSize: 8,
    color: BONE,
  },

  nextBeatMapClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nextBeatMapCloseText: {
    fontSize: 23,
    color: INK,
  },

  devNavNote: {
    marginBottom: 10,
    fontSize: 8,
    lineHeight: 14,
    color: '#77736B',
  },

  cleanJourneyTop: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cleanCloseButton: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  cleanCloseText: {
    fontSize: 28,
    lineHeight: 30,
    color: INK,
  },

  cleanBrand: {
    marginLeft: 28,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  cleanContext: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  cleanContextText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: MUTED,
  },

  cleanJourneyHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 34,
  },

  cleanArrowButton: {
    width: 154,
    height: 154,
    borderRadius: 77,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  cleanArrowButtonPressed: {
    backgroundColor: '#E9E5DA',
  },

  cleanArrowRotator: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanArrow: {
    fontSize: 94,
    lineHeight: 104,
    color: SIGNAL,
    fontWeight: '300',
  },

  cleanDistance: {
    fontSize: 92,
    lineHeight: 102,
    fontWeight: '700',
    letterSpacing: -6,
    color: INK,
  },

  cleanDistanceUnit: {
    fontSize: 34,
    letterSpacing: -1,
    fontWeight: '600',
    color: INK,
  },

  cleanInstruction: {
    marginTop: 30,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1.6,
    textAlign: 'center',
    color: INK,
  },

  cleanHint: {
    marginTop: 14,
    maxWidth: 326,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: '#69645C',
  },

  cleanArrowButtonNear: {
    borderWidth: 1,
    borderColor: 'rgba(255,90,54,0.30)',
    backgroundColor: 'rgba(255,90,54,0.05)',
  },

  cleanArrowNear: {
    color: SIGNAL,
  },

  cleanDistanceNear: {
    color: SIGNAL,
  },

  questPulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  questPulseNode: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  questPulseNodeCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SIGNAL,
  },

  questPulseCode: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.1,
    color: SIGNAL,
  },

  questPulseTitle: {
    marginTop: 13,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -1.3,
    color: INK,
    textAlign: 'center',
  },

  cleanJourneyBottom: {
    minHeight: 88,
    justifyContent: 'flex-end',
  },

  cleanCameraButton: {
    alignSelf: 'flex-end',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  cleanCameraButtonPressed: {
    opacity: 0.45,
    transform: [{ scale: 0.96 }],
  },

  cleanCameraIcon: {
    fontSize: 20,
  },

  cleanDevBar: {
    height: 58,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanDevLabel: {
    fontSize: 7,
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  cleanDevMeta: {
    marginTop: 4,
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
  },

  cleanDevButton: {
    minWidth: 126,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanDevButtonPressed: {
    opacity: 0.55,
  },

  cleanDevButtonText: {
    fontSize: 10,
    color: BONE,
  },

  cleanMapWrap: {
    flex: 1,
    marginTop: 22,
    marginBottom: 18,
    overflow: 'hidden',
    backgroundColor: '#E7E2D6',
    borderWidth: 1,
    borderColor: LINE,
  },

  cleanMap: {
    ...StyleSheet.absoluteFillObject,
  },

  cleanMapTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cleanMapCopy: {
    backgroundColor: BONE,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  cleanMapLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: MUTED,
  },

  cleanMapDistance: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },

  cleanMapClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanMapCloseText: {
    fontSize: 24,
    color: INK,
  },

  cleanMapFootnote: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(17,17,15,0.84)',
    fontSize: 8,
    letterSpacing: 1,
    color: BONE,
  },

  cleanRouteStatus: {
    marginTop: 14,
    fontSize: 9,
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  cleanRouteRetry: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: LINE,
  },

  cleanRouteRetryText: {
    fontSize: 9,
    color: MUTED,
  },

  postcardFacts: {
    marginTop: 22,
    marginBottom: 26,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  postcardFact: {
    minWidth: 82,
  },

  postcardFactLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: MUTED,
  },

  postcardFactValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },

  postcardMapLegend: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  postcardLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  postcardLegendPlanned: {
    width: 18,
    height: 2,
    backgroundColor: '#9D998F',
  },

  postcardLegendActual: {
    width: 18,
    height: 3,
    backgroundColor: SIGNAL,
  },

  postcardLegendText: {
    fontSize: 7,
    letterSpacing: 1.1,
    color: MUTED,
  },

  postcardRerouteMeta: {
    marginLeft: 'auto',
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
  },

  fieldEventScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  fieldEventTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  fieldEventBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  fieldEventBackText: {
    fontSize: 26,
    color: INK,
  },

  fieldEventBrand: {
    marginLeft: 28,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  fieldEventMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.7,
    color: MUTED,
  },

  fieldEventRouteStrip: {
    height: 70,
    marginTop: 28,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  fieldEventRouteNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventRouteNodeCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  fieldEventRouteLine: {
    width: 70,
    height: 2,
    backgroundColor: SIGNAL,
  },

  fieldEventRouteQuest: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventRouteQuestMark: {
    fontSize: 18,
    color: BONE,
  },

  fieldEventRouteLineMuted: {
    flex: 1,
    height: 1,
    backgroundColor: LINE,
  },

  fieldEventRouteLabel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  fieldEventScroll: {
    flex: 1,
  },

  fieldEventScrollContent: {
    paddingTop: 38,
    paddingBottom: 24,
  },

  fieldEventEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: SIGNAL,
  },

  fieldEventTitle: {
    marginTop: 16,
    maxWidth: 350,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  fieldEventInstruction: {
    marginTop: 24,
    maxWidth: 345,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: '#5A5750',
  },

  fieldEventRule: {
    marginTop: 28,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  fieldEventRuleLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: MUTED,
  },

  fieldEventRuleText: {
    marginTop: 9,
    maxWidth: 340,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: INK,
  },

  fieldEventContextNote: {
    marginTop: 18,
    maxWidth: 330,
    fontSize: 11,
    lineHeight: 18,
    color: MUTED,
  },

  fieldEventBottom: {
    gap: 9,
  },

  fieldEventActions: {
    flexDirection: 'row',
    gap: 10,
  },

  fieldEventPrimary: {
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  fieldEventPrimaryFlexible: {
    flex: 1,
  },

  fieldEventPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },

  fieldEventPrimaryArrow: {
    fontSize: 22,
    color: SIGNAL,
  },

  fieldEventCamera: {
    width: 64,
    minHeight: 64,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventCameraIcon: {
    fontSize: 20,
  },

  fieldEventSkip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventSkipText: {
    fontSize: 10,
    color: MUTED,
  },

  cleanMissionScreen: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  cleanMissionTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cleanMissionClose: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  cleanMissionCloseText: {
    fontSize: 28,
    lineHeight: 30,
    color: BONE,
  },

  cleanMissionBrand: {
    marginLeft: 28,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: BONE,
  },

  cleanMissionType: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.8,
    color: '#77736B',
  },

  cleanMissionHero: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 26,
  },

  cleanMissionCode: {
    fontSize: 9,
    letterSpacing: 2,
    color: SIGNAL,
    marginBottom: 18,
  },

  cleanMissionTitle: {
    fontSize: 45,
    lineHeight: 52,
    fontWeight: '650',
    letterSpacing: -2.4,
    color: BONE,
  },

  cleanMissionInstruction: {
    marginTop: 24,
    maxWidth: 345,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: '#B7B2A8',
  },

  cleanMissionCompletion: {
    marginTop: 24,
    maxWidth: 340,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2F2D29',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: BONE,
  },

  cleanMissionContextNote: {
    marginTop: 16,
    maxWidth: 330,
    fontSize: 10,
    lineHeight: 17,
    color: '#77736B',
  },

  cleanMissionBottom: {
    gap: 10,
  },

  cleanMissionActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },

  cleanMissionPrimary: {
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanMissionPrimaryFlexible: {
    flex: 1,
  },

  cleanMissionPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },

  cleanMissionPrimaryArrow: {
    fontSize: 23,
    color: SIGNAL,
  },

  cleanMissionCamera: {
    width: 64,
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#3A3833',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanMissionCameraIcon: {
    fontSize: 21,
  },

  cleanMissionSkip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanMissionSkipText: {
    fontSize: 10,
    color: '#77736B',
  },

  cleanMissionPressed: {
    opacity: 0.5,
  },

  missionScreen: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  missionTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  missionSpineReminder: {
    marginTop: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#34332F',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  missionSpineLabel: { fontSize: 7, letterSpacing: 1.4, color: SIGNAL },
  missionSpineValue: { fontSize: 7, letterSpacing: 1.2, color: '#8E8A82' },

  missionHero: { flex: 1, justifyContent: 'center' },
  missionCode: { fontSize: 10, letterSpacing: 2.1, color: SIGNAL },

  missionTitle: {
    marginTop: 18,
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '600',
    letterSpacing: -2.2,
    color: BONE,
  },

  missionInstruction: {
    marginTop: 24,
    maxWidth: 330,
    fontSize: 15,
    lineHeight: 25,
    color: '#BBB7AE',
  },

  completeRule: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#34332F',
  },

  completeRuleLabel: { fontSize: 8, letterSpacing: 1.4, color: '#77736B' },
  completeRuleText: { marginTop: 9, fontSize: 13, lineHeight: 21, color: BONE },
  missionBottom: { gap: 12 },
  contextNote: { fontSize: 10, lineHeight: 17, color: '#77736B' },

  missionCompleteButton: {
    height: 66,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  missionCompleteButtonPressed: { opacity: 0.82 },
  missionCompleteText: { fontSize: 15, fontWeight: '700', color: INK },
  missionCompleteArrow: { fontSize: 22, color: SIGNAL },
  missionButtonEyebrow: {
    marginBottom: 5,
    fontSize: 7,
    letterSpacing: 1.3,
    color: MUTED,
  },
  optionalMissionActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  optionalCompleteButton: {
    flex: 1,
    minHeight: 70,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalCompleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  optionalCompleteArrow: { fontSize: 22, color: SIGNAL },
  optionalCameraButton: {
    width: 70,
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#4A4741',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionalCameraButtonPressed: { backgroundColor: '#262521' },
  optionalCameraIcon: { fontSize: 25 },
  skipMissionButton: {
    minHeight: 46,
    marginTop: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipMissionPressed: { opacity: 0.45 },
  skipMissionText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8E8A82',
  },
  skipMissionArrow: { fontSize: 16, color: '#8E8A82' },
  arrivalSkipButton: {
    minHeight: 44,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivalSkipText: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: MUTED,
  },

  cleanArrivalScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  cleanArrivalTop: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cleanArrivalMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.8,
    color: MUTED,
  },

  arrivalRevealStrip: {
    height: 58,
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  arrivalRevealStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  arrivalRevealLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    backgroundColor: SIGNAL,
  },

  arrivalRevealFlag: {
    width: 28,
    height: 36,
    position: 'relative',
  },

  arrivalRevealFlagPole: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: 2,
    height: 30,
    backgroundColor: SIGNAL,
  },

  arrivalRevealFlagShape: {
    position: 'absolute',
    left: 6,
    top: 2,
    width: 18,
    height: 12,
    backgroundColor: SIGNAL,
  },

  arrivalRevealLabel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

  cleanArrivalHero: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 26,
  },

  cleanArrivalKicker: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: SIGNAL,
    marginBottom: 14,
  },

  cleanArrivalPlace: {
    fontSize: 43,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -2.3,
    color: INK,
  },

  cleanArrivalCode: {
    marginTop: 32,
    fontSize: 8,
    letterSpacing: 1.7,
    color: MUTED,
  },

  cleanArrivalMission: {
    marginTop: 9,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    color: INK,
  },

  cleanArrivalInstruction: {
    marginTop: 20,
    maxWidth: 345,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: '#5A5750',
  },

  cleanArrivalCompletion: {
    marginTop: 22,
    maxWidth: 340,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: INK,
  },

  cleanArrivalBottom: {
    gap: 9,
  },

  cleanArrivalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  cleanArrivalPrimary: {
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanArrivalPrimaryFlexible: {
    flex: 1,
  },

  cleanArrivalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: BONE,
  },

  cleanArrivalPrimaryArrow: {
    fontSize: 22,
    color: SIGNAL,
  },

  cleanArrivalCamera: {
    width: 64,
    minHeight: 64,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanArrivalCameraIcon: {
    fontSize: 20,
  },

  cleanArrivalSkip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanArrivalSkipText: {
    fontSize: 9,
    color: MUTED,
  },

  cleanArrivalSource: {
    marginTop: 4,
    fontSize: 7,
    letterSpacing: 1.1,
    color: '#A5A197',
  },

  passportCardScene: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 16,
    color: MUTED,
  },

  postcardDetailScene: {
    marginTop: 12,
    fontSize: 9,
    letterSpacing: 1.2,
    color: SIGNAL,
  },

  arrivalScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  arrivalHero: { flex: 1, justifyContent: 'center' },

  arrivalStamp: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },

  arrivalStampText: { fontSize: 22, color: INK, fontWeight: '800' },
  arrivalKicker: { fontSize: 10, letterSpacing: 1.6, color: SIGNAL, marginBottom: 12 },

  arrivalTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '600',
    letterSpacing: -2.2,
    color: INK,
  },

  arrivalMissionCode: { marginTop: 32, fontSize: 9, letterSpacing: 1.8, color: MUTED },

  arrivalMissionTitle: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
    color: INK,
  },

  arrivalInstruction: { marginTop: 12, fontSize: 14, lineHeight: 23, color: MUTED },

  arrivalRule: { paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE },
  arrivalRuleLabel: { fontSize: 8, letterSpacing: 1.3, color: MUTED },
  arrivalRuleText: { marginTop: 8, fontSize: 13, lineHeight: 20, color: INK },

  cameraNativeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  cameraModalScreen: { flex: 1, backgroundColor: '#000' },
  cameraPreview: { flex: 1 },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraView: { ...StyleSheet.absoluteFillObject },

  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },

  cameraTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  cameraClose: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(17,17,15,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraCloseText: { fontSize: 25, color: BONE },

  cameraMissionChip: {
    minHeight: 46,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(17,17,15,0.78)',
    justifyContent: 'center',
  },

  cameraMissionChipText: { fontSize: 8, letterSpacing: 1.4, color: BONE },

  cameraPrompt: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(17,17,15,0.78)',
    padding: 16,
  },

  cameraPromptTitle: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: BONE },
  cameraPromptRule: { marginTop: 8, fontSize: 11, lineHeight: 18, color: '#C9C5BC' },

  cameraBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cameraStatusColumn: { width: 105, gap: 6 },
  cameraReadyText: { fontSize: 7, letterSpacing: 1.3, color: BONE },
  cameraRestartText: { fontSize: 8, lineHeight: 13, color: SIGNAL },
  cameraCount: { width: 105, textAlign: 'right', fontSize: 7, letterSpacing: 1.3, color: BONE },

  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: BONE },
  shutterDisabled: { opacity: 0.35 },
  shutterPressed: { transform: [{ scale: 0.94 }] },

  reviewScreen: { flex: 1, backgroundColor: '#000' },
  reviewImage: { ...StyleSheet.absoluteFillObject },
  reviewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },

  reviewTop: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  reviewBrand: { fontSize: 13, fontWeight: '800', letterSpacing: 2.8, color: '#fff' },
  reviewMeta: { fontSize: 8, letterSpacing: 1.5, color: '#fff' },

  reviewBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    padding: 18,
    backgroundColor: 'rgba(17,17,15,0.86)',
  },

  reviewMissionCode: { fontSize: 8, letterSpacing: 1.5, color: SIGNAL },
  reviewTitle: { marginTop: 9, fontSize: 27, fontWeight: '700', color: BONE },
  reviewLibraryHint: {
    marginTop: 8,
    maxWidth: 300,
    fontSize: 10,
    lineHeight: 16,
    color: '#BDB8AE',
  },
  reviewActions: { marginTop: 18, flexDirection: 'row', gap: 10 },

  reviewSecondary: {
    flex: 1,
    height: 54,
    borderWidth: 1,
    borderColor: '#625F58',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reviewPrimary: {
    flex: 1.5,
    height: 54,
    paddingHorizontal: 14,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  reviewSecondaryText: { fontSize: 13, fontWeight: '700', color: BONE },
  reviewPrimaryText: { fontSize: 13, fontWeight: '700', color: INK },
  reviewPressed: { opacity: 0.75 },

  journeyRollText: {
    marginTop: 6,
    fontSize: 7,
    letterSpacing: 1.3,
    color: '#77736B',
  },

  cleanArrivalProblem: {
    minHeight: 38,
    marginTop: 2,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanArrivalProblemText: {
    fontSize: 10,
    color: MUTED,
  },

  cleanArrivalProblemArrow: {
    fontSize: 14,
    color: MUTED,
  },

  reissueScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
  },

  reissueScreenDark: {
    backgroundColor: '#050505',
  },

  reissueTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reissueBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  reissueBackText: {
    fontSize: 26,
    color: INK,
  },

  reissueBackTextDark: {
    color: BONE,
  },

  reissueBrand: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4.2,
    color: INK,
  },

  reissueBrandDark: {
    color: BONE,
  },

  reissueMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  reissueScroll: {
    paddingTop: 28,
    paddingBottom: 42,
  },

  reissueRouteCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,90,54,0.08)',
  },

  reissueRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  reissueRouteLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

  reissueRouteLabelDark: {
    color: '#AAA49A',
  },

  reissueRouteStatus: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  reissueRouteGraphic: {
    height: 62,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reissueRouteStart: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: SIGNAL,
  },

  reissueRouteLineDone: {
    flex: 1,
    height: 3,
    backgroundColor: SIGNAL,
  },

  reissueRouteBreak: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reissueRouteBreakText: {
    marginTop: -2,
    fontSize: 18,
    fontWeight: '800',
    color: SIGNAL,
  },

  reissueRouteLineNext: {
    flex: 0.55,
    height: 1,
    borderTopWidth: 1,
    borderColor: SIGNAL,
    borderStyle: 'dashed',
  },

  reissueRouteQuestion: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reissueRouteQuestionText: {
    fontSize: 14,
    fontWeight: '800',
    color: SIGNAL,
  },

  reissueRouteFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  reissueRouteFootText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#625E56',
  },

  reissueRouteFootTextDark: {
    color: '#B1ABA2',
  },

  reissueRouteFootArrow: {
    fontSize: 12,
    color: SIGNAL,
  },

  reissueHero: {
    marginTop: 34,
  },

  reissueEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: SIGNAL,
  },

  reissueTitle: {
    marginTop: 12,
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  reissueTitleDark: {
    color: BONE,
  },

  reissueBody: {
    marginTop: 16,
    maxWidth: 342,
    fontSize: 14,
    lineHeight: 22,
    color: '#67625A',
  },

  reissueBodyDark: {
    color: '#B2ACA2',
  },

  reissueChoiceLabel: {
    marginTop: 30,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '800',
    color: INK,
  },

  reissueChoiceLabelDark: {
    color: BONE,
  },

  reissueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  reissueChoice: {
    width: '48.5%',
    minHeight: 132,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#F7F4EB',
  },

  reissueChoiceDark: {
    borderColor: '#3B3731',
    backgroundColor: '#131210',
  },

  reissueChoicePressed: {
    opacity: 0.6,
    transform: [{ translateY: 2 }],
  },

  reissueChoiceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  reissueChoiceMark: {
    fontSize: 22,
    lineHeight: 24,
    color: SIGNAL,
  },

  reissueChoiceIndex: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    color: MUTED,
  },

  reissueChoiceIndexDark: {
    color: '#989289',
  },

  reissueChoiceTitle: {
    marginTop: 24,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: INK,
  },

  reissueChoiceTitleDark: {
    color: BONE,
  },

  reissueChoiceNote: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    color: MUTED,
  },

  reissueChoiceNoteDark: {
    color: '#AAA49B',
  },

  reissueLoadingCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF0E9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  reissueLoadingCardDark: {
    backgroundColor: 'rgba(255,90,54,0.13)',
  },

  reissueLoadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  reissueLoadingText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: INK,
  },

  reissueLoadingTextDark: {
    color: BONE,
  },

  postcardRecoverySection: {
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: LINE,
  },

  postcardRecoveryText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 20,
    color: MUTED,
  },

  developingScreen: {
    flex: 1,
    backgroundColor: '#050505',
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  developingTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  developingMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.8,
    color: '#77736B',
  },

  developingHero: {
    flex: 1,
    justifyContent: 'center',
  },

  developingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: SIGNAL,
    marginBottom: 32,
  },

  developingCode: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.4,
    color: SIGNAL,
    marginBottom: 18,
  },

  developingTitle: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: BONE,
  },

  developingBody: {
    marginTop: 20,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#77736B',
  },

  developingTrack: {
    height: 1,
    backgroundColor: '#2A2926',
    overflow: 'hidden',
  },

  developingTrackFill: {
    width: '72%',
    height: 1,
    backgroundColor: SIGNAL,
  },

  completeScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
  },

  completeScreenDark: {
    backgroundColor: '#050505',
  },

  completeTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },

  completeBrand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4.2,
    color: INK,
  },

  completeBrandDark: {
    color: BONE,
  },

  completeMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  completeScroll: {
    paddingTop: 30,
    paddingBottom: 44,
  },

  completeHero: {
    paddingBottom: 26,
  },

  completeEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: SIGNAL,
  },

  completeTitle: {
    marginTop: 12,
    fontSize: 43,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: INK,
  },

  completeTitleDark: {
    color: BONE,
  },

  completeBody: {
    marginTop: 16,
    maxWidth: 344,
    fontSize: 14,
    lineHeight: 23,
    color: '#67625A',
  },

  completeBodyDark: {
    color: '#B2ACA2',
  },

  completeTicket: {
    minHeight: 362,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D3CEC1',
    backgroundColor: '#FAF7EE',
    position: 'relative',
    overflow: 'hidden',
  },

  completeTicketDark: {
    borderColor: '#3B3731',
    backgroundColor: '#12110F',
  },

  completeTicketPunchLeftTop: {
    position: 'absolute',
    left: -10,
    top: 72,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchRightTop: {
    position: 'absolute',
    right: -10,
    top: 72,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchLeftBottom: {
    position: 'absolute',
    left: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchRightBottom: {
    position: 'absolute',
    right: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchDark: {
    backgroundColor: '#050505',
    borderColor: '#3B3731',
  },

  completeTicketHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  completeTicketBrand: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3.5,
    color: INK,
  },

  completeTicketBrandDark: {
    color: BONE,
  },

  completeTicketStatus: {
    marginTop: 5,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  completeStamp: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: SIGNAL,
    transform: [{ rotate: '-5deg' }],
  },

  completeStampText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  completeDash: {
    height: 1,
    marginVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#BDB7AA',
    borderStyle: 'dashed',
  },

  completeDashDark: {
    borderTopColor: '#454038',
  },

  completeRouteGraphic: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },

  completeRouteStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  completeRouteLineOne: {
    width: '38%',
    height: 3,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '4deg' }],
  },

  completeRouteNode: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: SIGNAL,
  },

  completeRouteLineTwo: {
    flex: 1,
    height: 3,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-5deg' }],
  },

  completeRouteFinish: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  completeRouteFinishCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  completeDestinationLabel: {
    marginTop: 8,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  completeDestinationLabelDark: {
    color: '#979188',
  },

  completeDestination: {
    marginTop: 6,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    color: INK,
  },

  completeDestinationDark: {
    color: BONE,
  },

  completeFacts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  completeFact: {
    width: '31%',
  },

  completeFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },

  completeFactLabelDark: {
    color: '#979188',
  },

  completeFactValue: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '800',
    color: INK,
  },

  completeFactValueDark: {
    color: BONE,
  },

  completeBarcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  completeBarcode: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },

  completeBarcodeBar: {
    height: 28,
    backgroundColor: INK,
  },

  completeBarcodeBarDark: {
    backgroundColor: BONE,
  },

  completeSerial: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: MUTED,
  },

  completeSerialDark: {
    color: '#979188',
  },

  completeFramesSection: {
    marginTop: 26,
  },

  completeSectionHead: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  completeSectionLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: INK,
  },

  completeSectionLabelDark: {
    color: BONE,
  },

  completeSectionMeta: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
  },

  completeSectionMetaDark: {
    color: '#979188',
  },

  completeFrames: {
    gap: 10,
    paddingRight: 20,
  },

  completeFrameWrap: {
    width: 118,
  },

  completeFrame: {
    width: 118,
    height: 154,
    backgroundColor: SOFT,
  },

  completeFrameCode: {
    marginTop: 6,
    fontSize: 7,
    letterSpacing: 1.1,
    color: INK,
  },

  completeFrameCodeDark: {
    color: '#B5AFA5',
  },

  playtestFeedbackPanel: {
    marginTop: 28,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
  },

  playtestFeedbackCode: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  playtestFeedbackTitle: {
    marginTop: 10,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: INK,
  },

  playtestFeedbackBody: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: MUTED,
  },

  playtestRatingRow: {
    marginTop: 17,
    flexDirection: 'row',
    gap: 8,
  },

  playtestRatingButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  playtestRatingButtonActive: {
    borderColor: SIGNAL,
    backgroundColor:
      'rgba(255,90,54,0.07)',
  },

  playtestRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
  },

  playtestRatingTextActive: {
    color: SIGNAL,
  },

  playtestReasonBlock: {
    marginTop: 20,
  },

  playtestReasonLabel: {
    marginBottom: 10,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: MUTED,
  },

  playtestReasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  playtestReasonChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  playtestReasonChipActive: {
    borderColor: SIGNAL,
  },

  playtestReasonText: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
  },

  playtestReasonTextActive: {
    color: SIGNAL,
  },

  completeActions: {
    gap: 10,
    marginTop: 22,
  },

  completePostcardButton: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  completePostcardButtonDark: {
    borderColor: '#4A453E',
  },

  completePostcardText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },

  completePostcardTextDark: {
    color: BONE,
  },

  completePostcardArrow: {
    fontSize: 19,
    color: SIGNAL,
  },

  completeHomeButton: {
    minHeight: 66,
    paddingHorizontal: 19,
    borderRadius: 16,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  completeHomeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#130F0B',
  },

  completeHomeArrow: {
    fontSize: 23,
    color: '#130F0B',
  },

  completePressed: {
    opacity: 0.76,
    transform: [{ translateY: 2 }],
  },

  passportScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
  },

  passportScroll: { paddingTop: 34, paddingBottom: 54 },
  passportHero: { paddingBottom: 42 },
  passportKicker: { fontSize: 11, letterSpacing: 1.3, color: MUTED, marginBottom: 18 },

  passportTitle: {
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '600',
    letterSpacing: -2.4,
    color: INK,
  },

  passportStats: {
    minHeight: 106,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
  },

  passportStat: { flex: 1, justifyContent: 'center' },
  passportStatValue: { fontSize: 28, fontWeight: '700', color: INK },
  passportStatLabel: { marginTop: 6, fontSize: 7, letterSpacing: 1.2, color: MUTED },

  traceMapShell: {
    height: 260,
    marginTop: 34,
    overflow: 'hidden',
    backgroundColor: SOFT,
  },

  traceMap: { ...StyleSheet.absoluteFillObject },

  passportSectionHeader: {
    marginTop: 40,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  passportSectionTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.7, color: INK },
  passportSectionMeta: { fontSize: 7, letterSpacing: 1.2, color: MUTED },

  emptyPassport: {
    minHeight: 220,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 26,
  },

  emptyPassportNumber: { fontSize: 86, fontWeight: '800', color: '#DEDBD0' },
  emptyPassportTitle: { marginTop: 20, fontSize: 24, fontWeight: '600', color: INK },
  passportList: { borderTopWidth: 1, borderTopColor: LINE },

  passportCard: {
    minHeight: 165,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  passportCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  passportCardNumber: { fontSize: 10, letterSpacing: 1.4, color: SIGNAL, fontWeight: '700' },
  passportCardDate: { fontSize: 8, letterSpacing: 1.1, color: MUTED },
  passportCardMode: { marginTop: 22, fontSize: 31, fontWeight: '800', color: INK },
  passportCardTitle: { marginTop: 4, fontSize: 13, color: INK },
  passportCardBottom: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
  passportCardMeta: { fontSize: 8, letterSpacing: 1, color: MUTED },

  passportCardPressed: {
    opacity: 0.5,
    transform: [{ scale: 0.992 }],
  },

  passportOpenRow: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  passportOpenText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  passportOpenArrow: {
    fontSize: 15,
    color: SIGNAL,
  },

  postcardDetailScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
  },

  postcardDetailScroll: {
    paddingTop: 34,
    paddingBottom: 60,
  },

  postcardDetailHero: {
    paddingBottom: 34,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  postcardDetailKicker: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: MUTED,
    marginBottom: 16,
  },

  postcardDetailTitle: {
    fontSize: 50,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -2.8,
    color: INK,
  },

  postcardDetailMeta: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 19,
    color: MUTED,
  },

  postcardSectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  postcardSectionLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: INK,
  },

  postcardSectionMeta: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: MUTED,
  },

  postcardPhotoSection: {
    marginTop: 34,
  },

  postcardHeroPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: SOFT,
  },

  postcardPhotoStrip: {
    gap: 10,
    paddingTop: 12,
    paddingRight: 22,
  },

  postcardPhotoItem: {
    width: 116,
  },

  postcardPhotoThumb: {
    width: 116,
    height: 145,
    backgroundColor: SOFT,
  },

  postcardPhotoCode: {
    marginTop: 6,
    fontSize: 7,
    letterSpacing: 1.1,
    color: MUTED,
  },

  postcardLegacyBlock: {
    marginTop: 34,
    padding: 18,
    borderWidth: 1,
    borderColor: LINE,
  },

  postcardLegacyText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 20,
    color: MUTED,
  },

  postcardMapSection: {
    marginTop: 38,
  },

  postcardMapShell: {
    height: 230,
    overflow: 'hidden',
    backgroundColor: SOFT,
  },

  postcardMap: {
    ...StyleSheet.absoluteFillObject,
  },

  postcardMissionSection: {
    marginTop: 38,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 16,
  },

  postcardMissionRow: {
    minHeight: 86,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    flexDirection: 'row',
  },

  postcardMissionNumber: {
    width: 38,
    fontSize: 8,
    letterSpacing: 1.2,
    color: SIGNAL,
  },

  postcardMissionCopy: {
    flex: 1,
  },

  postcardMissionCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  postcardMissionCode: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },
  postcardMissionResult: {
    fontSize: 7,
    letterSpacing: 1.1,
    color: MUTED,
  },
  postcardMissionResultSkipped: { color: '#9B4B36' },

  postcardMissionTitle: {
    marginTop: 7,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: INK,
  },

  clearPassportButton: {
    marginTop: 30,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  clearPassportText: { fontSize: 8, letterSpacing: 1.2, color: SIGNAL },

  routeHomeScreenDark: {
    backgroundColor: '#050505',
  },

  routeBrandDark: {
    color: BONE,
  },

  routeBrandTagDark: {
    color: '#9F9A90',
  },

  routePassportButtonDark: {
    borderRadius: 22,
  },

  routePassportBadgeDark: {
    backgroundColor: '#26221D',
  },

  routePassportBadgeTextDark: {
    color: BONE,
  },

  routeUtilityDividerDark: {
    backgroundColor: '#36322C',
  },

  routeSettingsButtonDark: {
    borderColor: '#4A453E',
  },

  routeSettingsGlyphDark: {
    color: BONE,
  },

  routePulseLabelDark: {
    color: '#A8A39A',
  },

  routeTinyGraphicDark: {
    color: '#9E9A90',
  },

  routeHomeTitleDark: {
    color: BONE,
  },

  routeHomeSubtitleDark: {
    color: '#B3ADA3',
  },

  routeTimeButtonDark: {
    borderColor: '#403B34',
    backgroundColor: '#151412',
  },

  routeTimeButtonActiveDark: {
    backgroundColor: 'rgba(255,90,54,0.16)',
    borderColor: SIGNAL,
  },

  routeTimeNumberDark: {
    color: BONE,
  },

  routeTimeUnitDark: {
    color: '#A9A39A',
  },

  routeHomePrimaryDark: {
    backgroundColor: SIGNAL,
  },

  routeHomePrimaryDisabledDark: {
    backgroundColor: '#24211D',
  },

  routeHomePrimaryTextDark: {
    color: '#130F0B',
  },

  routeHomePrimaryArrowDark: {
    color: '#130F0B',
  },

  routeHomePrimaryTextDisabledDark: {
    color: '#8D877D',
  },

  routeHomeFooterTextDark: {
    color: '#A8A39A',
  },

  ticketMoodScreenDark: {
    backgroundColor: '#050505',
  },

  ticketFlowBackTextDark: {
    color: BONE,
  },

  ticketFlowBrandDark: {
    color: BONE,
  },

  ticketFlowTimePillDark: {
    backgroundColor: '#11110F',
    borderWidth: 1,
    borderColor: '#3A362F',
  },

  ticketFlowTimeValueDark: {
    color: BONE,
  },

  ticketFlowTimeUnitDark: {
    color: '#B2ADA4',
  },

  ticketMoodTitleDark: {
    color: BONE,
  },

  ticketMoodCardDark: {
    borderColor: '#3A362F',
    backgroundColor: '#131210',
  },

  ticketMoodCardActiveDark: {
    borderColor: SIGNAL,
    backgroundColor: 'rgba(255,90,54,0.12)',
  },

  ticketMoodSymbolDark: {
    color: BONE,
  },

  ticketMoodIndexDark: {
    color: '#AAA59C',
  },

  ticketMoodLabelDark: {
    color: BONE,
  },

  ticketMoodHintDark: {
    color: '#A7A197',
  },

  ticketMoodCodeDark: {
    color: '#9A958C',
  },

  ticketMoodCheckDark: {
    color: '#8D887F',
  },

  ticketMoodFooterDark: {
    backgroundColor: '#050505',
  },

  ticketMoodPrimaryDark: {
    backgroundColor: SIGNAL,
  },

  ticketMoodPrimaryDisabledDark: {
    backgroundColor: '#24211D',
  },

  ticketMoodPrimaryTextDark: {
    color: '#130F0B',
  },

  ticketMoodPrimaryArrowDark: {
    color: '#130F0B',
  },

  ticketMoodPrimaryTextDisabledDark: {
    color: '#8D877D',
  },

  finishScreenDark: {
    backgroundColor: '#050505',
  },

  finishBrandDark: {
    color: BONE,
  },

  finishMetaDark: {
    color: '#A19C92',
  },

  finishTitleDark: {
    color: BONE,
  },

  finishBodyDark: {
    color: '#AFA99F',
  },

  photoStripSectionDark: {
    borderTopColor: '#35312C',
  },

  photoStripLabelDark: {
    color: BONE,
  },

  photoStripMetaDark: {
    color: '#A19C92',
  },

  photoThumbCodeDark: {
    color: '#C1BBB1',
  },

  finishTicketDark: {
    borderColor: '#35312C',
  },

  finishTicketLabelDark: {
    color: '#9B968D',
  },

  finishTicketValueDark: {
    color: BONE,
  },

  finishPassportButtonDark: {
    borderColor: '#4A453E',
  },

  finishPassportTextDark: {
    color: BONE,
  },

  finishButtonDark: {
    backgroundColor: SIGNAL,
  },

  finishButtonTextDark: {
    color: '#130F0B',
  },


  v35Pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  v35HomeScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, paddingHorizontal: 24, paddingBottom: 28 },
  v35TopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v35Brand: { fontSize: 42, lineHeight: 44, fontWeight: '900', letterSpacing: -2.7, color: INK },
  v35BrandSlash: { width: 21, height: 10, marginLeft: 124, marginTop: -5, backgroundColor: SIGNAL, transform: [{ rotate: '-8deg' }] },
  v35MenuButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EAE5DB', alignItems: 'center', justifyContent: 'center', gap: 5 },
  v35MenuLine: { width: 23, height: 3, borderRadius: 2, backgroundColor: INK },
  v35MenuLineShort: { width: 16, height: 3, borderRadius: 2, backgroundColor: INK },
  v35RouteSketch: { height: 145, marginTop: 10, position: 'relative', overflow: 'hidden' },
  v35CityBlock: { position: 'absolute', bottom: 18, width: 26, backgroundColor: '#DCD8CF', opacity: 0.76 },
  v35RouteDash: { position: 'absolute', height: 4, borderRadius: 999, backgroundColor: SIGNAL, opacity: 0.96 },
  v35MapPin: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8', borderWidth: 4, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  v35MapPinCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: SIGNAL },
  v36TravelerDot: { position: 'absolute', left: '7%', top: 84, width: 16, height: 16, borderRadius: 8, backgroundColor: '#F5F1E8', borderWidth: 3, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center', zIndex: 6, shadowColor: SIGNAL, shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  v36TravelerDotCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: SIGNAL },
  v35SketchBench: { position: 'absolute', right: '26%', top: 52, width: 44, height: 30 },
  v35BenchSeat: { position: 'absolute', left: 0, right: 0, top: 8, height: 7, borderRadius: 2, backgroundColor: INK },
  v35BenchLeg: { position: 'absolute', left: 4, bottom: 0, width: 4, height: 15, backgroundColor: INK },
  v35BenchLegRight: { left: undefined, right: 2 },
  v35SketchFlag: { position: 'absolute', right: '6%', top: 47, width: 34, height: 42 },
  v35FlagPole: { position: 'absolute', left: 4, top: 0, width: 4, height: 42, backgroundColor: INK, transform: [{ rotate: '5deg' }] },
  v35FlagCloth: { position: 'absolute', left: 9, top: 3, width: 25, height: 17, backgroundColor: SIGNAL, transform: [{ rotate: '7deg' }] },
  v35HomeQuestion: { marginTop: 4, fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -2.2, color: INK, textAlign: 'center' },
  v35Underline: { alignSelf: 'center', width: 126, height: 7, marginTop: 4, marginLeft: 112, backgroundColor: SIGNAL, borderRadius: 4, transform: [{ rotate: '-5deg' }] },
  v35MinuteReadout: { marginTop: 25, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  v35MinuteNumber: { fontSize: 78, lineHeight: 82, fontWeight: '900', letterSpacing: -4, color: SIGNAL },
  v35MinuteUnit: { marginBottom: 11, fontSize: 17, fontWeight: '900', color: INK },
  v35SliderWrap: { height: 62, marginTop: 11, marginHorizontal: 8, position: 'relative' },
  v35SliderRail: { position: 'absolute', left: 0, right: 0, top: 10, height: 9, borderRadius: 5, backgroundColor: '#D8D4CB' },
  v35SliderFill: { position: 'absolute', left: 0, top: 10, height: 9, borderRadius: 5, backgroundColor: SIGNAL },
  v35TickWrap: { position: 'absolute', top: 5, width: 1, alignItems: 'center' },
  v35Tick: { width: 9, height: 9, marginLeft: -4, borderRadius: 5, backgroundColor: '#BEB9AF' },
  v35TickActive: { backgroundColor: SIGNAL },
  v35TickLabel: { width: 28, marginTop: 12, marginLeft: -14, textAlign: 'center', fontSize: 11, fontWeight: '700', color: INK },
  v35SliderThumb: { position: 'absolute', top: 0, width: 42, height: 42, marginLeft: -21, borderRadius: 21, backgroundColor: BONE, borderWidth: 2, borderColor: '#E9E4DA', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  v35SliderThumbCore: { width: 26, height: 26, borderRadius: 13, backgroundColor: SIGNAL },
  v35TicketButton: { marginTop: 16, minHeight: 78, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, position: 'relative', overflow: 'hidden' },
  v35TicketButtonPressed: { transform: [{ scale: 0.988 }], opacity: 0.88 },
  v35TicketNotchLeft: { position: 'absolute', left: -10, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v35TicketNotchRight: { position: 'absolute', right: -10, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v35TicketArrow: { fontSize: 36, color: INK },
  v35TicketText: { flex: 1, marginLeft: 15, fontSize: 21, fontWeight: '900', letterSpacing: -0.8, color: INK, textAlign: 'center' },
  v35TicketDivider: { width: 1, height: 52, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(17,17,15,0.6)', marginHorizontal: 16 },
  v35TicketMark: { fontSize: 24, color: '#9D331B', transform: [{ rotate: '18deg' }] },
  v35CompletedButton: { marginTop: 11, minHeight: 54, borderWidth: 1, borderColor: '#CFC9BD', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.18)' },
  v35CompletedText: { fontSize: 16, fontWeight: '800', color: INK },
  v35CompletedCount: { marginLeft: 10, minWidth: 25, height: 25, paddingHorizontal: 7, borderRadius: 13, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  v35CompletedCountText: { fontSize: 10, fontWeight: '800', color: BONE },
  v35CompletedArrow: { marginLeft: 'auto', fontSize: 23, color: SIGNAL },
  v35MoodScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 57, paddingHorizontal: 24, paddingBottom: 24 },
  v35MoodTop: { flexDirection: 'row', alignItems: 'center' },
  v35BackButton: { width: 38, height: 44, justifyContent: 'center' },
  v35BackArrow: { fontSize: 48, lineHeight: 48, fontWeight: '300', color: INK },
  v35MoodBrand: { marginLeft: 18, fontSize: 35, fontWeight: '900', letterSpacing: -2, color: INK },
  v35TimePill: { marginLeft: 'auto', minHeight: 48, borderRadius: 24, backgroundColor: INK, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  v35TimePillIcon: { fontSize: 18, fontWeight: '800', color: SIGNAL },
  v35TimePillText: { fontSize: 14, fontWeight: '900', color: BONE },
  v35MoodTitle: { marginTop: 55, fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -2.2, color: INK, textAlign: 'center' },
  v35UnderlineMood: { alignSelf: 'flex-end', marginRight: 43, marginTop: 2, width: 114, height: 6, borderRadius: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-4deg' }] },
  v35MoodScroll: { paddingTop: 34, paddingBottom: 18 },
  v35MoodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  v35MoodCard: { width: '48%', minHeight: 148, borderWidth: 1, borderColor: '#D6D0C5', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  v35MoodCardActive: { borderWidth: 2, borderColor: SIGNAL, backgroundColor: '#F8EFE6' },
  v35MoodArt: { width: 90, height: 72, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  v35MoodSymbol: { fontSize: 54, lineHeight: 60, fontWeight: '900', color: INK },
  v35MoodSymbolActive: { color: INK },
  v35MoodCardLabel: { marginTop: 3, fontSize: 20, fontWeight: '900', color: INK },
  v35MoodPrimary: { minHeight: 72, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  v35MoodPrimaryDisabled: { opacity: 0.42 },
  v35MoodPrimaryText: { fontSize: 29, fontWeight: '900', color: INK },
  v35MoodPrimaryDivider: { position: 'absolute', right: 72, top: 10, bottom: 10, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(17,17,15,0.52)' },
  v35MoodPrimaryArrow: { position: 'absolute', right: 23, fontSize: 31, color: INK },
  v35PreparingScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 62, paddingHorizontal: 24, alignItems: 'center' },
  v35PreparingBrand: { alignSelf: 'flex-start', fontSize: 39, fontWeight: '900', letterSpacing: -2.5, color: INK },
  v35PreparingTitle: { marginTop: 78, fontSize: 44, lineHeight: 49, fontWeight: '900', letterSpacing: -2, color: INK, textAlign: 'center' },
  v35PreparingUnderline: { marginTop: 2, width: 165, height: 7, borderRadius: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-4deg' }] },
  v35Printer: { marginTop: 36, width: '94%', height: 410, position: 'relative', alignItems: 'center', overflow: 'hidden' },
  v35PrinterTop: { position: 'absolute', top: 0, width: '94%', height: 88, borderRadius: 16, backgroundColor: '#A9A49A', borderWidth: 1, borderColor: '#8E887F' },
  v35PrinterSlot: { position: 'absolute', top: 32, width: '83%', height: 24, borderRadius: 10, backgroundColor: '#171614', zIndex: 4 },
  v35PrintingTicket: { position: 'absolute', top: 54, width: '78%', minHeight: 330, backgroundColor: '#F6F1E8', padding: 20, borderWidth: 1, borderColor: '#D2CBC0', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  v35PrintOrangeBand: { height: 26, marginHorizontal: -20, marginTop: -20, marginBottom: 16, backgroundColor: SIGNAL },
  v35PrintBrand: { fontSize: 28, fontWeight: '900', letterSpacing: -1.7, color: INK },
  v35PrintDash: { height: 1, marginVertical: 14, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#BDB7AD' },
  v35PrintFacts: { flexDirection: 'row', alignItems: 'center' },
  v35PrintLabel: { fontSize: 11, fontWeight: '900', color: INK },
  v35PrintMinute: { marginTop: 3, fontSize: 46, lineHeight: 50, fontWeight: '900', letterSpacing: -2, color: SIGNAL },
  v35PrintMinuteUnit: { fontSize: 14, color: INK },
  v35PrintDivider: { width: 1, height: 72, marginHorizontal: 18, backgroundColor: '#C5BFB5' },
  v35PrintMoodBlock: { flex: 1 },
  v35PrintMood: { marginTop: 11, fontSize: 21, lineHeight: 26, fontWeight: '900', color: INK },
  v35PrintDestination: { fontSize: 19, fontWeight: '900', color: INK },
  v35PrintBarcode: { marginTop: 27, height: 42, flexDirection: 'row', gap: 3, justifyContent: 'center', alignItems: 'stretch' },
  v35PrintBar: { backgroundColor: INK },
  v35PreparingStatus: { marginTop: 8, fontSize: 12, fontWeight: '700', color: MUTED, textAlign: 'center' },
  v35JourneyScreen: { flex: 1, backgroundColor: '#090909', paddingTop: 57, paddingHorizontal: 24, paddingBottom: 25 },
  v35JourneyTop: { flexDirection: 'row', alignItems: 'center' },
  v35JourneyBack: { width: 44, height: 44, justifyContent: 'center' },
  v35JourneyBackText: { fontSize: 38, color: BONE },
  v35JourneyBrand: { marginLeft: 10, fontSize: 34, fontWeight: '900', letterSpacing: -2, color: BONE },
  v35JourneyProgress: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  v35JourneyProgressItem: { flexDirection: 'row', alignItems: 'center' },
  v35JourneyProgressDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#6F6F6C', backgroundColor: '#090909' },
  v35JourneyProgressCurrent: { width: 17, height: 17, borderRadius: 9, borderColor: SIGNAL, borderWidth: 4 },
  v35JourneyProgressDone: { borderColor: SIGNAL, backgroundColor: SIGNAL },
  v35JourneyProgressLine: { width: 16, height: 1, marginHorizontal: 4, backgroundColor: '#66645F' },
  v35JourneyProgressLineDone: { backgroundColor: SIGNAL },
  v35JourneyFlag: { marginLeft: 7, fontSize: 18, color: '#8E8C86' },
  v35JourneyHero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 35 },
  v35Compass: { width: 245, height: 245, borderRadius: 123, borderWidth: 18, borderColor: '#272727', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0E0E' },
  v35CompassTicks: { position: 'absolute', top: 25, bottom: 25, left: '50%', width: 5, marginLeft: -2.5, borderTopWidth: 18, borderBottomWidth: 18, borderColor: '#6D6B66' },
  v35CompassArrow: { fontSize: 150, lineHeight: 160, fontWeight: '900', color: SIGNAL },
  v35JourneyDistance: { marginTop: 22, fontSize: 76, lineHeight: 80, fontWeight: '900', letterSpacing: -4, color: SIGNAL },
  v35JourneyDistanceUnit: { fontSize: 30, color: BONE },
  v35JourneyInstruction: { marginTop: 12, fontSize: 29, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4, color: BONE, textAlign: 'center' },
  v35JourneyStatus: { marginTop: 12, fontSize: 12, color: '#A29E95' },
  v35JourneyMapWrap: { flex: 1, marginTop: 28, marginBottom: 24, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#2B2B2B' },
  v35JourneyMap: { flex: 1 },
  v35JourneyMapClose: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(9,9,9,0.82)', alignItems: 'center', justifyContent: 'center' },
  v35JourneyMapCloseText: { fontSize: 24, color: BONE },
  v35QuestPulse: { position: 'absolute', left: 24, right: 24, top: 125, minHeight: 44, borderRadius: 22, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v35QuestPulseText: { fontSize: 13, fontWeight: '900', color: INK },
  v35JourneyBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  v35JourneyCamera: { width: 68, height: 68, borderRadius: 34, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v35JourneyCameraText: { fontSize: 31, color: BONE },
  v35JourneyPrimary: { flex: 1, minHeight: 62, borderWidth: 1, borderColor: '#3A3936', backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, position: 'relative' },
  v35JourneyPrimaryPressed: { opacity: 0.72 },
  v35JourneyPrimaryArrow: { fontSize: 20, color: '#A9A59C' },
  v35JourneyPrimaryDivider: { width: 1, height: 28, marginHorizontal: 13, backgroundColor: '#3A3936' },
  v35JourneyPrimaryText: { flex: 1, fontSize: 16, fontWeight: '800', color: BONE, textAlign: 'center' },
  v35JourneyPressed: { opacity: 0.75 },
  v35DevAdvance: { position: 'absolute', right: 0, bottom: 76, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#2A2926', borderRadius: 13 },
  v35DevAdvanceText: { fontSize: 9, color: '#A9A59B' },
  v35FinishScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58 },
  v35FinishTop: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v35FinishBrand: { fontSize: 40, fontWeight: '900', letterSpacing: -2.5, color: INK },
  v35FinishMenu: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E9E4D9', alignItems: 'center', justifyContent: 'center', gap: 4 },
  v35FinishScroll: { paddingHorizontal: 24, paddingBottom: 50 },
  v35FinishTitle: { marginTop: 40, fontSize: 44, fontWeight: '900', letterSpacing: -2.4, color: INK, textAlign: 'center' },
  v35Postcard: { marginTop: 27, backgroundColor: '#F7F2E9', borderWidth: 1, borderColor: '#E0D9CD', padding: 16, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  v35PostcardTop: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#BDB7AD', marginBottom: 14 },
  v35PostcardBrand: { fontSize: 25, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v35FinishStamp: { width: 82, height: 82, marginTop: 25, borderWidth: 3, borderColor: SIGNAL, borderRadius: 41, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-9deg' }], backgroundColor: 'rgba(245,241,232,0.88)', zIndex: 4 },
  v35FinishStampText: { fontSize: 14, fontWeight: '900', color: SIGNAL },
  v35FinishStampPlane: { marginTop: 4, fontSize: 16, color: SIGNAL },
  v35PostcardHeroPhoto: { width: '100%', height: 236, borderRadius: 13 },
  v35PostcardThumbRow: { marginTop: 8, flexDirection: 'row', gap: 7 },
  v35PostcardThumb: { flex: 1, height: 78, borderRadius: 8 },
  v35PostcardNoPhoto: { height: 225, backgroundColor: '#E7E2D8', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  v35PostcardRouteLine: { position: 'absolute', width: 220, height: 2, backgroundColor: SIGNAL, transform: [{ rotate: '-13deg' }] },
  v35PostcardRoutePin: { width: 22, height: 22, borderRadius: 11, borderWidth: 5, borderColor: SIGNAL, backgroundColor: BONE },
  v35PostcardNoPhotoText: { marginTop: 58, fontSize: 18, fontWeight: '900', color: INK },
  v35PostcardMetaRow: { marginTop: 17, minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  v35PostcardPlace: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  v35PostcardPlaceIcon: { fontSize: 22, color: SIGNAL },
  v35PostcardPlaceText: { flex: 1, fontSize: 22, lineHeight: 27, fontWeight: '900', color: INK },
  v35PostcardMetaDivider: { width: 1, height: 58, marginHorizontal: 14, backgroundColor: '#C9C2B6' },
  v35PostcardFacts: { width: 110, gap: 5 },
  v35PostcardFact: { fontSize: 14, fontWeight: '800', color: INK },
  v35FinishPrimary: { marginTop: 28, minHeight: 68, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  v35FinishPrimaryArrow: { fontSize: 32, color: INK },
  v35FinishPrimaryText: { fontSize: 25, fontWeight: '900', color: INK },
  v35FinishSecondary: { marginTop: 10, minHeight: 56, borderWidth: 1, borderColor: '#CBC5BA', alignItems: 'center', justifyContent: 'center' },
  v35FinishSecondaryText: { fontSize: 16, fontWeight: '800', color: INK },
  v35FeedbackPanel: { marginTop: 30, paddingTop: 21, borderTopWidth: 1, borderColor: '#D3CDC2' },
  v35FeedbackTitle: { marginBottom: 12, fontSize: 15, fontWeight: '900', color: INK },
  v35ReviewHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 29, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v35ReviewPhotoSection: { marginTop: 20 },
  v35ReviewHeroPhoto: { width: '100%', height: 360, borderRadius: 18 },
  v35ReviewThumbStrip: { marginTop: 12, gap: 8, paddingBottom: 4 },
  v35ReviewThumb: { width: 76, height: 76, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  v35ReviewThumbActive: { borderColor: SIGNAL },
  v35ReviewEmptyPhoto: { marginTop: 20, minHeight: 170, borderWidth: 1, borderColor: '#D2CBC0', alignItems: 'center', justifyContent: 'center' },
  v35ReviewEmptyTitle: { fontSize: 16, fontWeight: '800', color: MUTED },
  v35ReviewShare: { marginTop: 26, minHeight: 66, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  v35ReviewShareIcon: { fontSize: 28, color: BONE },
  v35ReviewShareText: { fontSize: 21, fontWeight: '900', color: BONE },


  // v0.38 — five clearer moods; surprise gets the last full-width beat.
  v38MoodWide: {
    width: '100%',
    minHeight: 126,
  },

  v38PhotoPressed: {
    opacity: 0.82,
  },
  v38ZoomBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(17,17,15,0.78)',
  },
  v38ZoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BONE,
  },
  v38ZoomScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  v38ZoomScroll: {
    flex: 1,
  },
  v38ZoomContent: {
    flexGrow: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ZoomImage: {
    width: '100%',
    height: '100%',
    minHeight: 620,
  },
  v38ZoomClose: {
    position: 'absolute',
    top: 58,
    left: 22,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(17,17,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ZoomCloseText: {
    fontSize: 30,
    lineHeight: 32,
    color: BONE,
  },
  v38ZoomHint: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(241,239,231,0.78)',
  },

  v38ShareSection: {
    marginTop: 34,
  },
  v38SharePreviewLabel: {
    marginBottom: 12,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: MUTED,
  },
  v38ShareTicket: {
    width: '100%',
    minHeight: 570,
    padding: 24,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#CFC8B8',
    position: 'relative',
    overflow: 'hidden',
  },
  v38ShareSignal: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 10,
    backgroundColor: SIGNAL,
  },
  v38ShareTicketHead: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  v38ShareBrand: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 2,
    color: INK,
  },
  v38ShareMicro: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: SIGNAL,
  },
  v38ShareSerial: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },
  v38ShareDash: {
    marginVertical: 18,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BEB7A8',
  },
  v38ShareDestinationLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2,
    color: MUTED,
  },
  v38ShareDestination: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: INK,
  },
  v38SharePhoto: {
    marginTop: 18,
    width: '100%',
    height: 205,
    borderRadius: 4,
    backgroundColor: SOFT,
  },
  v38ShareNoPhoto: {
    marginTop: 18,
    height: 205,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ShareNoPhotoMark: {
    fontSize: 20,
    color: SIGNAL,
  },
  v38ShareRouteRow: {
    marginTop: 20,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v38ShareRouteStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },
  v38ShareRouteLine: {
    flex: 1,
    height: 3,
    marginLeft: 5,
    backgroundColor: SIGNAL,
  },
  v38ShareRouteFlag: {
    marginLeft: 6,
    fontSize: 25,
    color: SIGNAL,
  },
  v38ShareFacts: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  v38ShareFact: {
    flex: 1,
  },
  v38ShareFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },
  v38ShareFactValue: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    color: INK,
  },
  v38ShareFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v38ShareFootText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

});
