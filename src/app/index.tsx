import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync as requestMediaLibraryPermissionsAsync } from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Circle, Polyline } from 'react-native-maps';

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
  | 'color'
  | 'preparing'
  | 'ready'
  | 'journey'
  | 'mission'
  | 'arrival'
  | 'sceneIssue'
  | 'camera'
  | 'photoReview'
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

const TIMES = ['15', '30', '60', '90+'];

const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走走', code: 'WANDER' },
  { id: 'food', label: '吃點東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜一下', code: 'QUIET' },
  { id: 'weird', label: '奇怪一點', code: 'WEIRD' },
  { id: 'surprise', label: '隨機帶我走', code: 'SURPRISE' },
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
  if (moodId === 'wander') return '↝';
  if (moodId === 'food') return '◍';
  if (moodId === 'quiet') return '○';
  if (moodId === 'weird') return '✦';
  return '◇';
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
    return '挑一條平常不會選的路。';
  }

  return '完全交給 DETOUR。';
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

function getFilmRollCapacity(minutes: number) {
  if (minutes <= 15) return 6;
  if (minutes <= 30) return 8;
  if (minutes <= 60) return 12;
  return 16;
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

  const [selectedTime, setSelectedTime] = useState<string | null>(null);
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
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [lightContext, setLightContext] =
    useState<LightContext | null>(null);

  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [cameraSource, setCameraSource] =
    useState<CameraSource | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] =
    useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [missionResults, setMissionResults] =
    useState<Record<string, MissionResult>>({});
  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [passport, setPassport] = useState<PassportEntry[]>([]);
  const [passportLoaded, setPassportLoaded] = useState(false);
  const [lastCompletedEntry, setLastCompletedEntry] =
    useState<PassportEntry | null>(null);
  const [selectedPassportId, setSelectedPassportId] =
    useState<string | null>(null);

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
  const cameraRef = useRef<CameraView | null>(null);
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

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenY = useRef(new Animated.Value(0)).current;
  const routeProgress = useRef(new Animated.Value(0)).current;

  const mood = useMemo(
    () => MOODS.find((item) => item.id === selectedMood) ?? null,
    [selectedMood]
  );

  const selectedMinutes = parseMinutes(selectedTime);
  const rollCapacity = getFilmRollCapacity(selectedMinutes || 15);
  const previewProfile = getJourneyProfile(selectedMinutes || 15);

  const currentMission: Mission | null =
    plan?.sideMissions[sideMissionIndex] ?? null;

  const activeCameraMission: Mission | null =
    cameraSource === 'arrival'
      ? plan?.arrivalMission ?? null
      : cameraSource === 'free'
        ? FREE_CAMERA_MISSION
        : currentMission;

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
    stage === 'camera' ||
    stage === 'developing';

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
    setSelectedColor(null);
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

  async function chooseColor(color: ColorChoice) {
    await Haptics.selectionAsync();
    transitionTo('preparing', () => setSelectedColor(color));
  }

  async function randomColor() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    await chooseColor(color);
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
    setSelectedTime(null);
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
    setCameraSource(null);
    setCapturedPhotoUri(null);
    setLastCompletedEntry(null);
    setSelectedPassportId(null);
    activeCameraRequestRef.current = null;
    setCameraReady(false);
    setCameraMountError(null);
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

    if (stage === 'color') {
      setSelectedMood(null);
      transitionTo('mood');
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

    if (stage === 'camera') {
      transitionTo(
        cameraSource === 'arrival'
          ? 'arrival'
          : cameraSource === 'free'
            ? 'journey'
            : 'mission'
      );
      return;
    }

    if (stage === 'photoReview') {
      transitionTo('camera', () => setCapturedPhotoUri(null));
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
        await rankSceneCandidatesWithAI({
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
        });

      const fallbackArrival =
        buildSceneArrivalMission({
          scene: routed.scene,
          moodId:
            recoveryMood,
          context:
            recoveryContext,
        });

      const aiRecovery =
        await generateJourneyWithAI({
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

        if (offRouteDistance > 45) {
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

  async function prepareDetourTicket() {
    stopLocationWatcher();

    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      const testSessionId =
        playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(
            testSessionId,
            {
              status: 'ticket-failed',
              failureReason:
                'location-permission',
            }
          )
        );
      }

      transitionTo('mood');

      Alert.alert(
        '需要定位才能印出這張票',
        'DETOUR 會在印車票時用你現在的位置選 Scene、確認步行路線，並判斷 DAY / TWILIGHT / NIGHT。'
      );

      return;
    }

    try {
      advanceTicketProgress(
        0.12,
        '正在取得現在位置…'
      );

      const location =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      const startPoint: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      advanceTicketProgress(
        0.24,
        '位置確認。正在找附近 Scene…'
      );

      const context = getLightContext(
        startPoint,
        new Date()
      );

      const finalMood: MoodId =
        selectedMood ?? 'wander';

      const minutes =
        selectedMinutes || 15;

      const visitedSceneIds = passport
        .map((entry) => entry.sceneId)
        .filter(
          (value): value is string =>
            typeof value === 'string'
        );

      const sceneFeedback =
        await loadSceneFeedback();

      const sceneCandidates =
        await findSceneCandidates({
          start: startPoint,
          moodId: finalMood,
          context,
          minutes,
          excludeSceneIds:
            visitedSceneIds,
          feedback:
            sceneFeedback,
          distanceScale:
            paceDistanceScale,
        });

      if (
        sceneCandidates.length === 0
      ) {
        throw new Error(
          finalMood === 'food'
            ? '附近暫時找不到適合「吃點東西」的真實食物 Scene。'
            : '附近暫時沒有找到適合現在情境的 Scene。'
        );
      }

      if (isAIEngineConfigured()) {
        advanceTicketProgress(
          0.48,
          `找到 ${sceneCandidates.length} 個候選。AI 正在挑終點…`
        );
      } else {
        advanceTicketProgress(
          0.48,
          `找到 ${sceneCandidates.length} 個候選。正在確認步行路線…`
        );
      }

      const aiRanking =
        await rankSceneCandidatesWithAI({
          candidates:
            sceneCandidates,
          moodId:
            finalMood,
          context,
          minutes,
        });

      setLastAIResult(
        aiRanking.usedAI
          ? 'ai'
          : 'fallback'
      );

      const routed =
        await resolveRoutedScene({
          start: startPoint,
          candidates:
            aiRanking.candidates,
          minutes,
          distanceScale:
            paceDistanceScale,
        });

      advanceTicketProgress(
        0.78,
        `步行路線確認：${Math.round(
          routed.route.distanceMeters
        )}m。正在安排任務…`
      );

      const nextPlan =
        buildJourneyPlan({
          minutes,
          moodId: finalMood,
          context,
          color: selectedColor,
        });

      const fallbackArrivalMission =
        buildSceneArrivalMission({
          scene: routed.scene,
          moodId: finalMood,
          context,
        });

      if (isAIEngineConfigured()) {
        advanceTicketProgress(
          0.82,
          '路線確認。AI 正在安排這趟任務…'
        );
      }

      const aiJourney =
        await generateJourneyWithAI({
          scene: routed.scene,
          moodId: finalMood,
          context,
          minutes,
          sideMissionCount:
            nextPlan.sideMissions.length,
          missionMilestones:
            nextPlan.profile.milestones,
          routeDistanceMeters:
            routed.route.distanceMeters,
          routeDurationSeconds:
            routed.route.durationSeconds,
        });

      if (aiJourney) {
        nextPlan.sideMissions =
          aiJourney.sideMissions;

        nextPlan.arrivalMission =
          aiJourney.arrivalMission;

        setLastAIResult('ai');
      } else {
        nextPlan.arrivalMission =
          fallbackArrivalMission;

        if (isAIEngineConfigured()) {
          setLastAIResult(
            'fallback'
          );
        }
      }

      const nextNavigationRoute =
        buildNavigationRouteFromPolyline({
          coordinates:
            routed.route.coordinates,
          totalDistanceMeters:
            routed.route.distanceMeters,
          durationSeconds:
            routed.route.durationSeconds,
          sideMissionCount:
            nextPlan.sideMissions.length,
        });

      advanceTicketProgress(
        0.92,
        '主線與任務已鎖定。正在完成車票…'
      );

      if (
        nextNavigationRoute.beats.length <
        2
      ) {
        throw new Error(
          '這個 Scene 太近或路線資料不足，暫時無法組成一趟 DETOUR。'
        );
      }

      // Everything below is what the ticket promises.
      // By the time READY appears, the route really is locked.
      setLatitude(
        startPoint.latitude
      );
      setLongitude(
        startPoint.longitude
      );
      setDetourStart(
        startPoint
      );

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
        nextNavigationRoute
      );
      navigationRouteRef.current =
        nextNavigationRoute;

      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstBeatDistance =
        nextNavigationRoute.beats[0]
          ?.segmentDistanceMeters ?? 0;

      setBeatRemainingMeters(
        firstBeatDistance
      );
      beatRemainingMetersRef.current =
        firstBeatDistance;

      setShowNextBeatMap(false);

      setSideMissionIndex(0);
      sideMissionIndexRef.current = 0;

      setTraveledMeters(0);
      traveledMetersRef.current = 0;

      setLightContext(context);

      setPhotos([]);
      setActiveTrace([]);

      setRerouteCount(0);
      rerouteCountRef.current = 0;

      setRerouteFailed(false);
      offRouteCountRef.current = 0;
      rerouteInFlightRef.current =
        false;

      setSceneFailures([]);
      sceneFailuresRef.current = [];

      lastTracePointRef.current =
        null;

      advanceTicketProgress(
        1,
        'ROUTE LOCKED'
      );

      const testSessionId =
        playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(
            testSessionId,
            {
              status: 'ready',
              lightContext: context,
              sceneKind:
                routed.scene.kind,
              plannedDistanceMeters:
                routed.route.distanceMeters,
              plannedDurationSeconds:
                routed.route.durationSeconds,
              sideMissionsTotal:
                nextPlan.sideMissions.length,
            }
          )
        );
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      transitionTo('ready');
    } catch (error) {
      stopLocationWatcher();

      transitionTo('mood');

      const message =
        error instanceof Error
          ? error.message
          : '請確認網路和定位服務後再試一次。';

      const testSessionId =
        playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(
            testSessionId,
            {
              status: 'ticket-failed',
              failureReason:
                message.slice(0, 120),
            }
          )
        );
      }

      Alert.alert(
        '這張 DETOUR 車票暫時印不出來',
        `${message}\n\n車票只有在 Scene 和步行路線都確認成功後才會發行。`
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

    const isSideQuest =
      beat.missionIndex !== undefined &&
      beat.missionIndex ===
        sideMissionIndexRef.current;

    const isFinal =
      beatIndex >=
      route.beats.length - 1;

    if (isSideQuest) {
      setQuestPulse('side');

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 620);
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

  async function advanceAfterSideMission() {
    if (!plan || !navigationRoute) return;

    const nextMissionIndex = sideMissionIndex + 1;
    sideMissionIndexRef.current = nextMissionIndex;

    const beatIndex = navigationBeatIndexRef.current;

    if (beatIndex >= navigationRoute.beats.length - 1) {
      transitionTo('arrival', () => {
        setSideMissionIndex(nextMissionIndex);
      });
      return;
    }

    transitionTo('journey', () => {
      setSideMissionIndex(nextMissionIndex);
      setBeat(beatIndex + 1);
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

  async function persistPhoto(tempUri: string) {
    try {
      const directory = new Directory(Paths.document, 'detour-photos');
      directory.create({ idempotent: true, intermediates: true });

      const source = new File(tempUri);
      const destination = new File(
        directory,
        `detour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
      );

      await source.copy(destination);
      return destination.uri;
    } catch {
      return tempUri;
    }
  }

  async function savePhotoToSystemLibrary(localUri: string) {
    try {
      const permission = await requestMediaLibraryPermissionsAsync(true);

      if (permission.status !== 'granted') {
        return false;
      }

      const asset = await Asset.create(localUri);
      const album = await Album.get('DETOUR');

      if (album) {
        await album.add(asset);
      } else {
        await Album.create('DETOUR', [asset]);
      }

      return true;
    } catch {
      return false;
    }
  }

  function openPassportEntry(entry: PassportEntry) {
    setSelectedPassportId(entry.id);
    transitionTo('passportDetail');
  }

  async function openCamera(source: CameraSource) {
    const missionForCamera: Mission | null =
      source === 'arrival'
        ? plan?.arrivalMission ?? null
        : source === 'free'
          ? FREE_CAMERA_MISSION
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
        missionCompletion: missionForCamera.completion,
        photoRequired: missionForCamera.photo ? '1' : '0',
        savedCount: String(photos.length),
        rollCapacity: String(rollCapacity),
        rollNumber: String(passport.length + 1),
      },
    });
  }

  async function takePhoto() {
    if (!cameraReady || !cameraRef.current) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.82,
      });

      if (!photo?.uri) return;

      const stableUri = await persistPhoto(photo.uri);

      transitionTo('photoReview', () => {
        setCapturedPhotoUri(stableUri);
      });
    } catch {
      Alert.alert('拍照失敗', '相機沒有成功留下照片，請再試一次。');
    }
  }

  function retakePhoto() {
    transitionTo('camera', () => {
      setCapturedPhotoUri(null);
      setCameraReady(false);
    });
  }

  async function keepPhoto() {
    if (!capturedPhotoUri || !activeCameraMission || !cameraSource) return;

    const savedToLibrary = await savePhotoToSystemLibrary(capturedPhotoUri);

    const newPhoto: SessionPhoto = {
      id: `${Date.now()}`,
      uri: capturedPhotoUri,
      missionCode: activeCameraMission.code,
      missionTitle: activeCameraMission.title,
      source: cameraSource === 'free' ? 'free' : 'mission',
      savedToLibrary,
    };

    const nextPhotos = [...photos, newPhoto];
    setPhotos(nextPhotos);

    if (cameraSource !== 'free') {
      recordMissionResult(activeCameraMission, 'completed');
    }

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    if (cameraSource === 'free') {
      transitionTo('journey', () => {
        setCapturedPhotoUri(null);
        setCameraSource(null);
      });
      return;
    }

    if (cameraSource === 'arrival') {
      setCapturedPhotoUri(null);
      setCameraSource(null);
      await completeDetour(nextPhotos);
      return;
    }

    if (!plan) return;

    const nextIndex = sideMissionIndex + 1;
    sideMissionIndexRef.current = nextIndex;

    if (
      nextIndex >= plan.sideMissions.length &&
      traveledMetersRef.current >= plan.profile.targetDistanceMeters
    ) {
      transitionTo('arrival', () => {
        setSideMissionIndex(nextIndex);
        setCapturedPhotoUri(null);
        setCameraSource(null);
      });
      return;
    }

    transitionTo('journey', () => {
      setSideMissionIndex(nextIndex);
      setCapturedPhotoUri(null);
      setCameraSource(null);
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
      label: '隨便走走',
      code: 'WANDER',
    };

    const route = activeTrace.length >= 2 ? activeTrace : [];
    const discoveries = (plan?.sideMissions.length ?? 0) + 1;
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

    const nextPassport = [entry, ...passport].slice(0, 50);
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

      <Modal
        visible={stage === 'camera' && !!activeCameraMission}
        animationType="none"
        presentationStyle="fullScreen"
        onRequestClose={goBack}
      >
        {activeCameraMission && (
          <View style={styles.cameraModalScreen}>
            <CameraView
              key={`detour-camera-${cameraSessionKey}`}
              ref={cameraRef}
              style={styles.cameraPreview}
              facing="back"
              mode="picture"
              onCameraReady={() => setCameraReady(true)}
              onMountError={(event) => {
                setCameraReady(false);
                setCameraMountError(event.message);
              }}
            />

            <View style={styles.cameraOverlay} pointerEvents="box-none">
              <View style={styles.cameraTop}>
                <Pressable onPress={goBack} style={styles.cameraClose}>
                  <Text style={styles.cameraCloseText}>×</Text>
                </Pressable>

                <View style={styles.cameraMissionChip}>
                  <Text style={styles.cameraMissionChipText}>
                    {cameraSource === 'arrival'
                      ? 'FINAL'
                      : cameraSource === 'free'
                        ? 'FREE FRAME'
                        : 'SIDE QUEST'} ·{' '}
                    {activeCameraMission.code}
                  </Text>
                </View>
              </View>

              <View style={styles.cameraPrompt}>
                <Text style={styles.cameraPromptTitle}>
                  {activeCameraMission.title}
                </Text>
                <Text style={styles.cameraPromptRule}>
                  {cameraSource === 'free'
                    ? '自由拍攝。留下這張後會回到主線，不會推進任務。'
                    : activeCameraMission.photo
                      ? activeCameraMission.completion
                      : '這張照片是你自己的紀錄；不拍也可以完成任務。'}
                </Text>
              </View>

              <View style={styles.cameraBottom}>
                <View style={styles.cameraStatusColumn}>
                  <Text style={styles.cameraReadyText}>
                    {cameraMountError
                      ? 'PREVIEW ERROR'
                      : cameraReady
                        ? 'READY'
                        : 'CAMERA STARTING'}
                  </Text>

                  {devMode && cameraReady && (
                    <Pressable
                      onPress={() => {
                        setCameraReady(false);
                        setCameraMountError(null);
                        setCameraSessionKey((value) => value + 1);
                      }}
                      hitSlop={10}
                    >
                      <Text style={styles.cameraRestartText}>
                        預覽黑畫面？重啟
                      </Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  disabled={!cameraReady}
                  onPress={takePhoto}
                  style={({ pressed }) => [
                    styles.shutterOuter,
                    !cameraReady && styles.shutterDisabled,
                    pressed && styles.shutterPressed,
                  ]}
                >
                  <View style={styles.shutterInner} />
                </Pressable>

                <Text style={styles.cameraCount}>{photos.length} SAVED</Text>
              </View>
            </View>
          </View>
        )}
      </Modal>

      <Modal
        visible={
          stage === 'photoReview' &&
          !!capturedPhotoUri &&
          !!activeCameraMission
        }
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={goBack}
      >
        {capturedPhotoUri && activeCameraMission && (
          <View style={styles.reviewScreen}>
            <Image
              key={capturedPhotoUri}
              source={{ uri: capturedPhotoUri }}
              style={styles.reviewImage}
              resizeMode="cover"
              fadeDuration={0}
              onError={(event) => {
                Alert.alert(
                  '照片預覽失敗',
                  `照片有拍到，但預覽載入失敗：${event.nativeEvent.error}`
                );
              }}
            />

            <View style={styles.reviewShade} />

            <View style={styles.reviewTop}>
              <Text style={styles.reviewBrand}>DETOUR</Text>
              <Text style={styles.reviewMeta}>PHOTO CHECK</Text>
            </View>

            <View style={styles.reviewBottom}>
              <Text style={styles.reviewMissionCode}>
                {activeCameraMission.code}
              </Text>
              <Text style={styles.reviewTitle}>留下這張？</Text>
              <Text style={styles.reviewLibraryHint}>
                留下後會存進 DETOUR Passport，也會加入 iPhone「照片」。
              </Text>

              <View style={styles.reviewActions}>
                <Pressable
                  onPress={retakePhoto}
                  style={({ pressed }) => [
                    styles.reviewSecondary,
                    pressed && styles.reviewPressed,
                  ]}
                >
                  <Text style={styles.reviewSecondaryText}>重拍</Text>
                </Pressable>

                <Pressable
                  onPress={keepPhoto}
                  style={({ pressed }) => [
                    styles.reviewPrimary,
                    pressed && styles.reviewPressed,
                  ]}
                >
                  <Text style={styles.reviewPrimaryText}>留下這張</Text>
                  <Text style={styles.reviewPrimaryText}>→</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

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
                    THE PROMISE
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    給我一點時間。{`\n`}
                    剩下的我決定。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    你只選空檔和現在的心情。DETOUR
                    會決定方向、Scene，還有路上會發生什麼。
                  </Text>
                  <Text style={styles.onboardingNote}>
                    不是景點清單，也不用先規劃。
                  </Text>
                </>
              )}

              {onboardingStep === 1 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    HIDDEN DESTINATION
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    終點先藏起來。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    主線只告訴你下一小段的方向與距離。
                    真的看不懂時，點箭頭才看那一小段地圖。
                  </Text>
                  <Text style={styles.onboardingNote}>
                    不是要你盲走，只是不把整趟一開始就說完。
                  </Text>
                </>
              )}

              {onboardingStep === 2 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    YOU CAN CHANGE IT
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    不對，{`\n`}
                    就換掉。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    店沒開、進不去、到了覺得不值得，都可以換終點。
                    已完成的任務不會消失。
                  </Text>
                  <Text style={styles.onboardingNote}>
                    定位只在開始 DETOUR 後使用。測試版會匿名回傳完成率、
                    AI / fallback 與你的簡短評分；不包含 GPS、路線、照片或目的地名稱。
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

              <Text style={styles.settingsBrand}>
                SETTINGS
              </Text>

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
                  WALK YOUR WAY
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
                        <Text style={styles.settingsChoiceCode}>
                          {pace.code}
                        </Text>
                        <Text style={styles.settingsChoiceMark}>
                          {active ? '●' : '○'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

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

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  FIRST RUN
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
                      不會清除 Passport 或偏好。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    →
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  DATA
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    PASSPORT
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {passport.length} DETOURS
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
                    清除測試 Passport
                  </Text>
                </Pressable>
              </View>

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

              <View style={styles.settingsPrivacy}>
                <Text style={styles.settingsPrivacyTitle}>
                  LOCATION
                </Text>
                <Text style={styles.settingsPrivacyBody}>
                  DETOUR 不會在開 App 時先要求定位。
                  只有你按下「開始繞路」後，才會用目前位置找 Scene、
                  算步行路線與推進導航。
                </Text>
              </View>
            </ScrollView>
          </View>
        )}

        {stage === 'time' && (
          <View style={[styles.routeHomeScreen]}>
            <View style={styles.routeHomeHeader}>
              <View style={styles.routeBrandLockup}>
                <Text style={[styles.routeBrand]}>DETOUR</Text>
                <Text style={[styles.routeBrandTag]}>
                  SMALL DETOURS{`\n`}BIGGER DAYS
                </Text>
              </View>

              <View style={styles.routeHomeUtilities}>
                <Pressable
                  onPress={() => transitionTo('passport')}
                  accessibilityLabel="打開 Passport"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.routePassportButton,
                    pressed && styles.homeUtilityPressed,
                  ]}
                >
                  <View style={styles.routePassportRing}>
                    <View style={styles.routePassportRingInner} />
                  </View>

                  <View style={[styles.routePassportBadge]}>
                    <Text style={[styles.routePassportBadgeText]}>
                      {passport.length > 99
                        ? '99+'
                        : String(passport.length).padStart(2, '0')}
                    </Text>
                  </View>
                </Pressable>

                <View style={[styles.routeUtilityDivider]} />

                <Pressable
                  onPress={() => transitionTo('settings')}
                  accessibilityLabel="打開設定"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.routeSettingsButton,
                    pressed && styles.homeUtilityPressed,
                  ]}
                >
                  <Text style={[styles.routeSettingsGlyph]}>•••</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.routePulseHero}>
            </View>

            <View style={styles.routePulseGraphic}>
              <View style={styles.routePulseStartWrap}>
                <View style={styles.routePulseHaloLarge} />
                <View style={styles.routePulseHaloSmall} />
                <View style={styles.routePulseStart} />
                <View style={styles.routePulseStartCore} />
              </View>

              <Text style={[styles.routePulseStartLabel]}>
                HERE{`\n`}YOU ARE
              </Text>

              <View style={[styles.routeSegment, styles.routeSegmentOne]} />
              <View style={[styles.routeSegment, styles.routeSegmentTwo]} />
              <View style={[styles.routeSegment, styles.routeSegmentThree]} />
              <View style={[styles.routeSegment, styles.routeSegmentFour]} />
              <View style={[styles.routeSegment, styles.routeSegmentFive]} />

              <View style={[styles.routeNode, styles.routeNodeOne]} />
              <Text style={[styles.routeNodeOneLabel]}>
                SAME CITY{`\n`}NEW STORIES
              </Text>

              <View style={[styles.routeNode, styles.routeNodeTwo]} />
              <Text style={[styles.routeNodeTwoLabel]}>
                A LITTLE{`\n`}FURTHER
              </Text>

              <View style={styles.routeSceneDiscOne}>
                <View style={styles.routeSceneDiscOneInner} />
              </View>

              <View style={styles.routeSceneDiscTwo}>
                <View style={styles.routeSceneDiscTwoInner} />
              </View>

              <View style={styles.routeDestination}>
                <View style={styles.routeDestinationDot} />
                <View style={styles.routeDestinationPole} />
                <View style={styles.routeDestinationFlag} />
              </View>

              <Text style={[styles.routeDestinationLabel]}>
                GOOD{`\n`}THINGS{`\n`}AHEAD
              </Text>

              <Text style={[styles.routeTinyTreeOne]}>▲</Text>
              <Text style={[styles.routeTinyTreeTwo]}>▲</Text>
              <Text style={[styles.routeTinyMountain]}>⌃</Text>
            </View>

            <View style={styles.routeHomeCopy}>
              <Text style={[styles.routeHomeTitle]}>
                不用先想去哪。
              </Text>

              <Text style={[styles.routeHomeSubtitle]}>
                先選你現在有幾分鐘，{`\n`}
                剩下交給 DETOUR。
              </Text>
            </View>

            <View style={styles.routeTimeRow}>
              {TIMES.map((time) => {
                const active =
                  selectedTime === time;

                return (
                  <Pressable
                    key={time}
                    onPress={() => chooseTime(time)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.routeTimeButton,
                      active && styles.routeTimeButtonActive,
                      pressed && styles.routeTimeButtonPressed,
                    ]}
                  >
                    {active && (
                      <View style={styles.routeSelectedBurst}>
                        <View style={styles.routeBurstLeft} />
                        <View style={styles.routeBurstCenter} />
                        <View style={styles.routeBurstRight} />
                      </View>
                    )}

                    <Text
                      style={[
                        styles.routeTimeNumber,
                        active && styles.routeTimeNumberActive,
                      ]}
                    >
                      {time}
                    </Text>

                    <Text
                      style={[
                        styles.routeTimeUnit,
                        active && styles.routeTimeUnitActive,
                      ]}
                    >
                      MIN
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={!selectedTime}
              onPress={continueFromTime}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.routeHomePrimary,
                !selectedTime &&
                  styles.routeHomePrimaryDisabled,
                pressed &&
                  selectedTime &&
                  styles.routeHomePrimaryPressed,
              ]}
            >
              <Text
                style={[
                  styles.routeHomePrimaryText,
                  !selectedTime &&
                    styles.routeHomePrimaryTextDisabled,
                ]}
              >
                {selectedTime
                  ? `開始 ${selectedTime} 分鐘 DETOUR`
                  : '先選一個時間'}
              </Text>

              <Text
                style={[
                  styles.routeHomePrimaryArrow,
                  !selectedTime &&
                    styles.routeHomePrimaryTextDisabled,
                ]}
              >
                →
              </Text>
            </Pressable>

            <View style={styles.routeHomeFooter}>
              <Text style={[styles.routeHomeFooterText]}>
                徒步 · {walkingPaceLabel(
                  preferences.walkingPace
                )}節奏
              </Text>

              {devMode && (
                <Text style={styles.routeHomeTestLabel}>
                  INDOOR TEST
                </Text>
              )}
            </View>
          </View>
        )}

        {stage === 'mood' && (
          <View style={[styles.ticketMoodScreen]}>
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

              <View style={[styles.ticketFlowTimePill]}>
                <Text style={[styles.ticketFlowTimeValue]}>
                  {selectedTime}
                </Text>
                <Text style={[styles.ticketFlowTimeUnit]}>
                  MIN
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.ticketMoodScroll}
              contentContainerStyle={styles.ticketMoodScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.ticketMoodHero}>
                <Text style={styles.ticketFlowEyebrow}>
                  CHOOSE THE MOOD
                </Text>

                <Text style={[styles.ticketMoodTitle]}>
                  今天想要{`\n`}
                  哪種繞法？
                </Text>
              </View>

              <View style={styles.ticketMoodGrid}>
                {MOODS.map((item, index) => {
                  const active =
                    selectedMood === item.id;

                  const fullWidth =
                    index === MOODS.length - 1;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        chooseMood(item.id)
                      }
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: active,
                      }}
                      style={({ pressed }) => [
                        styles.ticketMoodCard,
                        fullWidth &&
                          styles.ticketMoodCardWide,
                        active &&
                          styles.ticketMoodCardActive,
                        pressed &&
                          styles.ticketMoodCardPressed,
                      ]}
                    >
                      <View style={styles.ticketMoodCardTop}>
                        <Text
                          style={[
                            styles.ticketMoodSymbol,
                            active &&
                              styles.ticketMoodSymbolActive,
                          ]}
                        >
                          {moodSymbol(item.id)}
                        </Text>

                        <Text
                          style={[
                            styles.ticketMoodIndex,
                            active &&
                              styles.ticketMoodIndexActive,
                          ]}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                      </View>

                      <Text style={[styles.ticketMoodLabel]}>
                        {item.label}
                      </Text>

                      <Text style={[styles.ticketMoodHint]}>
                        {moodHint(item.id)}
                      </Text>

                      <View style={styles.ticketMoodCardFoot}>
                        <Text
                          style={[
                            styles.ticketMoodCode,
                            active &&
                              styles.ticketMoodCodeActive,
                          ]}
                        >
                          {item.code}
                        </Text>

                        <Text
                          style={[
                            styles.ticketMoodCheck,
                            active &&
                              styles.ticketMoodCheckActive,
                          ]}
                        >
                          {active ? 'SELECTED' : '○'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.ticketMoodFooter]}>
              <Pressable
                disabled={!selectedMood}
                onPress={continueFromMood}
                style={({ pressed }) => [
                  styles.ticketMoodPrimary,
                  !selectedMood &&
                    styles.ticketMoodPrimaryDisabled,
                  pressed &&
                    selectedMood &&
                    styles.ticketMoodPrimaryPressed,
                ]}
              >
                <Text
                  style={[
                    styles.ticketMoodPrimaryText,
                    !selectedMood &&
                      styles.ticketMoodPrimaryTextDisabled,
                  ]}
                >
                  {selectedMood
                    ? '印製這趟 DETOUR 車票'
                    : '先選一種心情'}
                </Text>

                <Text
                  style={[
                    styles.ticketMoodPrimaryArrow,
                    !selectedMood &&
                      styles.ticketMoodPrimaryTextDisabled,
                  ]}
                >
                  →
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {stage === 'color' && (
          <View style={styles.lightScreen}>
            <View style={styles.brandRow}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.backInline}>
                <Text style={styles.backArrow}>←</Text>
              </Pressable>
              <Text style={styles.brand}>COLOR WALK</Text>
              <Text style={styles.meta}>{selectedTime} MIN</Text>
            </View>

            <View style={styles.colorHero}>
              <Text style={styles.kicker}>這個顏色會穿過整條主線。</Text>
              <Text style={styles.sectionTitle}>
                今天追哪個{`\n`}
                顏色？
              </Text>
            </View>

            <View>
              <View style={styles.colorGrid}>
                {COLORS.map((color) => (
                  <Pressable
                    key={color.id}
                    onPress={() => chooseColor(color)}
                    style={({ pressed }) => [
                      styles.colorButton,
                      pressed && styles.colorButtonPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color.hex },
                      ]}
                    />
                    <View>
                      <Text style={styles.colorLabel}>{color.label}</Text>
                      <Text style={styles.colorCode}>{color.code}</Text>
                    </View>
                    <Text style={styles.colorArrow}>→</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={randomColor}
                style={({ pressed }) => [
                  styles.randomButton,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.randomButtonText}>隨機替我選</Text>
                <Text style={styles.randomButtonText}>↻</Text>
              </Pressable>
            </View>
          </View>
        )}

        {stage === 'preparing' && (
          <View style={styles.ticketPrepareScreen}>
            <View style={styles.ticketFlowTop}>
              <View style={styles.ticketFlowBack} />
              <Text style={[styles.ticketFlowBrand]}>
                DETOUR
              </Text>
              <Text style={styles.ticketPrepareMeta}>
                PRINTING
              </Text>
            </View>

            <View style={styles.ticketPrepareHero}>
              <Text style={styles.ticketFlowEyebrow}>
                ROUTE GENERATING
              </Text>

              <Text style={styles.ticketPrepareTitle}>
                正在替你{`\n`}
                鎖定這趟路線…
              </Text>

              <Text style={styles.ticketPrepareSubtitle}>
                正在確認附近 Scene、步行路線和沿途任務。票印好就直接上路。
              </Text>
            </View>

            <View style={styles.detourTicketShell}>
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
                    SPECIAL ROUTE
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

              <View style={styles.detourTicketFacts}>
                <View style={styles.detourTicketFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    TIME
                  </Text>
                  <Text style={styles.detourTicketFactValue}>
                    {selectedTime} MIN
                  </Text>
                </View>

                <View style={styles.detourTicketFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    MOOD
                  </Text>
                  <Text style={styles.detourTicketFactValue}>
                    {mood?.label ?? '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.detourTicketRoutePrint}>
                <View style={styles.detourTicketRouteDot} />

                <Animated.View
                  style={[
                    styles.detourTicketRouteLine,
                    {
                      width:
                        routeProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['4%', '78%'],
                        }),
                    },
                  ]}
                />

                <Animated.View
                  style={[
                    styles.detourTicketRouteEnd,
                    {
                      opacity:
                        routeProgress.interpolate({
                          inputRange: [0.72, 1],
                          outputRange: [0, 1],
                          extrapolate: 'clamp',
                        }),
                    },
                  ]}
                />
              </View>

              <Text style={styles.detourTicketGenerating}>
                {ticketBuildStatus}
              </Text>

              <View style={styles.detourTicketDash} />

              <View style={styles.ticketBarcode}>
                {[10, 4, 7, 3, 11, 5, 8, 3, 6, 12, 4, 9, 3, 7, 10, 4].map(
                  (width, index) => (
                    <View
                      key={`prepare-bar-${index}`}
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

              <Text style={styles.detourTicketFootnote}>
                GOOD IDEAS DEPART ANYTIME
              </Text>
            </View>

            <View style={styles.ticketPrepareBottom}>
              <Text style={styles.ticketPrepareBottomText}>
                車票只會在 Scene、真實步行路線與任務都確認成功後發行。
              </Text>
            </View>
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
                TICKET READY
              </Text>
            </View>

            <View style={styles.ticketReadyHero}>
              <Text style={styles.ticketFlowEyebrow}>
                YOUR ROUTE IS READY
              </Text>

              <Text style={styles.ticketReadyTitle}>
                你的 DETOUR{`\n`}
                已經開好了。
              </Text>

              <Text style={styles.ticketReadySubtitle}>
                Scene、步行主線和任務都已鎖定。終點繼續保密。
              </Text>
            </View>

            <View style={styles.detourTicketShellReady}>
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
                    YOUR ROUTE IS READY
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
                    TIME
                  </Text>
                  <Text style={styles.detourTicketReadyValue}>
                    {selectedTime} MIN
                  </Text>
                </View>

                <View style={styles.detourTicketReadyFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    MOOD
                  </Text>
                  <Text style={styles.detourTicketReadyValue}>
                    {mood?.label ?? '—'}
                  </Text>
                </View>

                <View style={styles.detourTicketReadyFact}>
                  <Text style={styles.detourTicketFactLabel}>
                    START
                  </Text>
                  <Text style={styles.detourTicketReadyValue}>
                    NOW
                  </Text>
                </View>
              </View>

              <View style={styles.detourTicketDash} />

              <Text style={styles.detourTicketHighlightLabel}>
                HIGHLIGHTS
              </Text>

              <View style={styles.detourTicketHighlights}>
                <Text style={styles.detourTicketHighlight}>
                  • 1 條隱藏主線
                </Text>
                <Text style={styles.detourTicketHighlight}>
                  • {previewProfile.sideMissionCount} 個支線任務
                </Text>
                <Text style={styles.detourTicketHighlight}>
                  • 1 個抵達任務
                </Text>
                <Text style={styles.detourTicketHighlight}>
                  • 終點先保密
                </Text>
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
                  KEEP EXPLORING
                </Text>

                <Text style={styles.detourTicketReadyStamp}>
                  ROUTE LOCKED
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
                {devMode
                  ? '使用這張票開始室內主線'
                  : '使用這張票開始 DETOUR'}
              </Text>

              <Text style={styles.ticketReadyPrimaryArrow}>
                →
              </Text>
            </Pressable>

            {devMode && (
              <Text style={styles.ticketReadyTestLabel}>
                INDOOR TEST · 真實 Scene / 真實 Route
              </Text>
            )}
          </View>
        )}

        {stage === 'journey' &&
          plan &&
          navigationRoute &&
          currentNavigationBeat && (
            <View style={styles.journeyScreen}>
              <View style={styles.cleanJourneyTop}>
                <Pressable
                  onPress={goBack}
                  hitSlop={16}
                  style={styles.cleanCloseButton}
                >
                  <Text style={styles.cleanCloseText}>×</Text>
                </Pressable>

                <Text style={styles.cleanBrand}>DETOUR</Text>

                <View style={styles.cleanContext}>
                  <View style={styles.signalDotSmall} />
                  <Text style={styles.cleanContextText}>
                    {plan.contextCode}
                  </Text>
                </View>
              </View>

              {showNextBeatMap &&
              latitude !== null &&
              longitude !== null ? (
                <View style={styles.cleanMapWrap}>
                  <MapView
                    style={styles.cleanMap}
                    initialRegion={{
                      latitude:
                        (latitude +
                          currentNavigationBeat.point.latitude) /
                        2,
                      longitude:
                        (longitude +
                          currentNavigationBeat.point.longitude) /
                        2,
                      latitudeDelta: 0.0022,
                      longitudeDelta: 0.0022,
                    }}
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Polyline
                      coordinates={nextBeatSegment}
                      strokeColor={SIGNAL}
                      strokeWidth={5}
                      lineCap="round"
                    />

                    <Circle
                      center={currentNavigationBeat.point}
                      radius={10}
                      strokeColor={INK}
                      strokeWidth={1}
                      fillColor={SIGNAL}
                    />
                  </MapView>

                  <View style={styles.cleanMapTop}>
                    <View style={styles.cleanMapCopy}>
                      <Text style={styles.cleanMapLabel}>
                        下一個節點
                      </Text>
                      <Text style={styles.cleanMapDistance}>
                        {Math.round(nextBeatMeters)} m
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setShowNextBeatMap(false)}
                      style={styles.cleanMapClose}
                    >
                      <Text style={styles.cleanMapCloseText}>×</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.cleanMapFootnote}>
                    只顯示眼前這一小段。
                  </Text>
                </View>
              ) : (
                <View style={styles.cleanJourneyHero}>
                  <Pressable
                    onPress={() => setShowNextBeatMap(true)}
                    accessibilityLabel="查看下一個節點"
                    style={({ pressed }) => [
                      styles.cleanArrowButton,
                      nextBeatMeters <= 25 &&
                        styles.cleanArrowButtonNear,
                      pressed && styles.cleanArrowButtonPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.cleanArrowRotator,
                        {
                          transform: [
                            { rotate: `${arrowRotation}deg` },
                          ],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cleanArrow,
                          nextBeatMeters <= 25 &&
                            styles.cleanArrowNear,
                        ]}
                      >
                        ↑
                      </Text>
                    </View>
                  </Pressable>

                  <Text
                    style={[
                      styles.cleanDistance,
                      nextBeatMeters <= 25 &&
                        styles.cleanDistanceNear,
                    ]}
                  >
                    {Math.round(nextBeatMeters)}
                    <Text style={styles.cleanDistanceUnit}> m</Text>
                  </Text>

                  <Text style={styles.cleanInstruction}>
                    {currentNavigationBeat.instruction}
                  </Text>

                  <Text style={styles.cleanHint}>
                    {currentNavigationBeat.hint}
                  </Text>

                  {isRerouting && (
                    <Text style={styles.cleanRouteStatus}>
                      重新找路…
                    </Text>
                  )}

                  {rerouteFailed &&
                    latitude !== null &&
                    longitude !== null && (
                      <Pressable
                        onPress={() =>
                          rerouteFromCurrentPosition({
                            latitude,
                            longitude,
                          })
                        }
                        style={styles.cleanRouteRetry}
                      >
                        <Text style={styles.cleanRouteRetryText}>
                          路線更新失敗 · 再試
                        </Text>
                      </Pressable>
                    )}
                </View>
              )}

              {questPulse && (
                <View
                  pointerEvents="none"
                  style={styles.questPulseOverlay}
                >
                  <View style={styles.questPulseNode}>
                    <View style={styles.questPulseNodeCore} />
                  </View>

                  <Text style={styles.questPulseCode}>
                    {questPulse === 'side'
                      ? 'SIDE QUEST FOUND'
                      : 'FINAL NODE'}
                  </Text>

                  <Text style={styles.questPulseTitle}>
                    {questPulse === 'side'
                      ? '路上有事發生了。'
                      : '主線到站。'}
                  </Text>
                </View>
              )}

              <View style={styles.cleanJourneyBottom}>
                <Pressable
                  onPress={() => openCamera('free')}
                  accessibilityLabel="自由拍照"
                  style={({ pressed }) => [
                    styles.cleanCameraButton,
                    pressed && styles.cleanCameraButtonPressed,
                  ]}
                >
                  <Text style={styles.cleanCameraIcon}>📷</Text>
                </Pressable>

                {devMode && (
                  <View style={styles.cleanDevBar}>
                    <View>
                      <Text style={styles.cleanDevLabel}>
                        INDOOR TEST
                      </Text>
                      <Text style={styles.cleanDevMeta}>
                        {Math.round(beatRemainingMeters)} M TO NEXT
                      </Text>
                    </View>

                    <Pressable
                      onPress={simulateWalk}
                      style={({ pressed }) => [
                        styles.cleanDevButton,
                        pressed && styles.cleanDevButtonPressed,
                      ]}
                    >
                      <Text style={styles.cleanDevButtonText}>
                        模擬前進
                      </Text>
                      <Text style={styles.cleanDevButtonText}>＋</Text>
                    </Pressable>
                  </View>
                )}
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
                FIELD EVENT
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
                MAIN QUEST CONTINUES
              </Text>
            </View>

            <ScrollView
              style={styles.fieldEventScroll}
              contentContainerStyle={styles.fieldEventScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldEventEyebrow}>
                SIDE QUEST · {currentMission.code}
              </Text>

              <Text style={styles.fieldEventTitle}>
                {currentMission.title}
              </Text>

              <Text style={styles.fieldEventInstruction}>
                {currentMission.instruction}
              </Text>

              <View style={styles.fieldEventRule}>
                <Text style={styles.fieldEventRuleLabel}>
                  CLEAR CONDITION
                </Text>
                <Text style={styles.fieldEventRuleText}>
                  {currentMission.completion}
                </Text>
              </View>

              {plan.context !== 'day' && (
                <Text style={styles.fieldEventContextNote}>
                  {plan.contextNote}
                </Text>
              )}
            </ScrollView>

            <View style={styles.fieldEventBottom}>
              {currentMission.photo ? (
                <>
                  <Pressable
                    onPress={() => openCamera('side')}
                    style={({ pressed }) => [
                      styles.fieldEventPrimary,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventPrimaryText}>
                      拍下來
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
                      找不到，跳過這個任務
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.fieldEventActions}>
                  <Pressable
                    onPress={completeSideMissionWithoutPhoto}
                    style={({ pressed }) => [
                      styles.fieldEventPrimary,
                      styles.fieldEventPrimaryFlexible,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventPrimaryText}>
                      完成這個 Side Quest
                    </Text>
                    <Text style={styles.fieldEventPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openCamera('side')}
                    accessibilityLabel="拍一張照片"
                    style={({ pressed }) => [
                      styles.fieldEventCamera,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.fieldEventCameraIcon}>
                      📷
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

          </View>
        )}

        {stage === 'arrival' && plan && (
          <View style={styles.cleanArrivalScreen}>
            <View style={styles.cleanArrivalTop}>
              <Text style={[styles.brand]}>DETOUR</Text>
              <Text style={styles.cleanArrivalMeta}>
                {selectedScene?.label ?? 'ARRIVAL'}
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
                DESTINATION REVEALED
              </Text>
            </View>

            <View style={styles.cleanArrivalHero}>
              <Text style={styles.cleanArrivalKicker}>
                MAIN QUEST · ARRIVAL
              </Text>

              <Text style={styles.cleanArrivalPlace}>
                {selectedScene?.name ?? '終點'}
              </Text>

              <Text style={styles.cleanArrivalCode}>
                {plan.arrivalMission.code}
              </Text>

              <Text style={styles.cleanArrivalMission}>
                {plan.arrivalMission.title}
              </Text>

              <Text style={styles.cleanArrivalInstruction}>
                {plan.arrivalMission.instruction}
              </Text>

              <Text style={styles.cleanArrivalCompletion}>
                完成：{plan.arrivalMission.completion}
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
                      找不到，跳過最後任務
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
                Scene + walking route · OpenStreetMap
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
                ROUTE REISSUE
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
                    CURRENT ROUTE
                  </Text>

                  <Text style={styles.reissueRouteStatus}>
                    INTERRUPTED
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
                    已走過的路和 Side Quest 保留
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
                  THIS ONE DOESN'T WORK
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
                  告訴 DETOUR 發生什麼事。會從你現在的位置重新找終點，不會重跑已完成的任務。
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
                    note: 'Scene 不夠有趣',
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
                ROLL {String(passport.length).padStart(2, '0')}
              </Text>
            </View>

            <View style={styles.developingHero}>
              <View style={styles.developingDot} />
              <Text style={styles.developingCode}>DEVELOPING</Text>
              <Text style={styles.developingTitle}>
                先別看。{`\n`}
                這趟正在顯影。
              </Text>
              <Text style={styles.developingBody}>
                {photos.length} FRAME{photos.length === 1 ? '' : 'S'} ·{' '}
                {contextCode(lightContext)}
              </Text>
            </View>

            <View style={styles.developingTrack}>
              <View style={styles.developingTrackFill} />
            </View>
          </View>
        )}

        {stage === 'finish' && (
          <View
            style={[
              styles.completeScreen,
            ]}
          >
            <View style={styles.completeTop}>
              <Text
                style={[
                  styles.completeBrand,
                ]}
              >
                DETOUR
              </Text>

              <Text style={styles.completeMeta}>
                ROUTE COMPLETE
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.completeScroll}
            >
              <View style={styles.completeHero}>
                <Text style={styles.completeEyebrow}>
                  YOU MADE A DETOUR
                </Text>

                <Text
                  style={[
                    styles.completeTitle,
                  ]}
                >
                  這趟完成了。
                </Text>

                <Text
                  style={[
                    styles.completeBody,
                  ]}
                >
                  {selectedScene
                    ? `主線最後到了「${selectedScene.name}」。`
                    : '這次主線已完成。'}
                  {' '}走過的路、任務和照片已經收進 Passport。
                </Text>
              </View>

              <View
                style={[
                  styles.completeTicket,
                ]}
              >
                <View style={[styles.completeTicketPunchLeftTop]} />
                <View style={[styles.completeTicketPunchRightTop]} />
                <View style={[styles.completeTicketPunchLeftBottom]} />
                <View style={[styles.completeTicketPunchRightBottom]} />

                <View style={styles.completeTicketHead}>
                  <View>
                    <Text
                      style={[
                        styles.completeTicketBrand,
                      ]}
                    >
                      DETOUR
                    </Text>
                    <Text style={styles.completeTicketStatus}>
                      COMPLETED
                    </Text>
                  </View>

                  <View style={styles.completeStamp}>
                    <Text style={styles.completeStampText}>
                      DONE
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.completeDash,
                  ]}
                />

                <View style={styles.completeRouteGraphic}>
                  <View style={styles.completeRouteStart} />
                  <View style={styles.completeRouteLineOne} />
                  <View style={styles.completeRouteNode} />
                  <View style={styles.completeRouteLineTwo} />
                  <View style={styles.completeRouteFinish}>
                    <View style={styles.completeRouteFinishCore} />
                  </View>
                </View>

                <Text
                  style={[
                    styles.completeDestinationLabel,
                  ]}
                >
                  DESTINATION
                </Text>
                <Text
                  style={[
                    styles.completeDestination,
                  ]}
                  numberOfLines={2}
                >
                  {selectedScene?.name ?? 'DETOUR COMPLETE'}
                </Text>

                <View
                  style={[
                    styles.completeDash,
                  ]}
                />

                <View style={styles.completeFacts}>
                  <View style={styles.completeFact}>
                    <Text
                      style={[
                        styles.completeFactLabel,
                      ]}
                    >
                      TIME
                    </Text>
                    <Text
                      style={[
                        styles.completeFactValue,
                      ]}
                    >
                      {lastCompletedEntry?.minutes ?? selectedMinutes} MIN
                    </Text>
                  </View>

                  <View style={styles.completeFact}>
                    <Text
                      style={[
                        styles.completeFactLabel,
                      ]}
                    >
                      SIDE QUESTS
                    </Text>
                    <Text
                      style={[
                        styles.completeFactValue,
                      ]}
                    >
                      {plan?.sideMissions.length ?? 0}
                    </Text>
                  </View>

                  <View style={styles.completeFact}>
                    <Text
                      style={[
                        styles.completeFactLabel,
                      ]}
                    >
                      FILM
                    </Text>
                    <Text
                      style={[
                        styles.completeFactValue,
                      ]}
                    >
                      {lastCompletedEntry?.photoCount ?? photos.length} /{' '}
                      {lastCompletedEntry?.rollCapacity ?? rollCapacity}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.completeDash,
                  ]}
                />

                <View style={styles.completeBarcodeRow}>
                  <View style={styles.completeBarcode}>
                    {[3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1].map(
                      (width, index) => (
                        <View
                          key={`complete-${index}`}
                          style={[
                            styles.completeBarcodeBar,
                            { width },
                          ]}
                        />
                      )
                    )}
                  </View>

                  <Text
                    style={[
                      styles.completeSerial,
                    ]}
                  >
                    {ticketSerial(selectedTime, selectedMood)}
                  </Text>
                </View>
              </View>

              {photos.length > 0 && (
                <View style={styles.completeFramesSection}>
                  <View style={styles.completeSectionHead}>
                    <Text
                      style={[
                        styles.completeSectionLabel,
                      ]}
                    >
                      DEVELOPED FRAMES
                    </Text>
                    <Text
                      style={[
                        styles.completeSectionMeta,
                      ]}
                    >
                      {photos.length} EXPOSED
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.completeFrames}
                  >
                    {photos.map((photo) => (
                      <View key={photo.id} style={styles.completeFrameWrap}>
                        <Image source={{ uri: photo.uri }} style={styles.completeFrame} />
                        <Text
                          style={[
                            styles.completeFrameCode,
                          ]}
                        >
                          {photo.missionCode}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.playtestFeedbackPanel}>
                <Text style={styles.playtestFeedbackCode}>
                  PLAYTEST SIGNAL
                </Text>
                <Text style={styles.playtestFeedbackTitle}>
                  這趟值得嗎？
                </Text>
                <Text style={styles.playtestFeedbackBody}>
                  一個點擊就好。這會直接匿名回傳給 DETOUR。
                </Text>

                <View style={styles.playtestRatingRow}>
                  {([
                    {
                      id: 'replay' as PlaytestRating,
                      label: '會再玩',
                    },
                    {
                      id: 'okay' as PlaytestRating,
                      label: '還行',
                    },
                    {
                      id: 'not-worth-it' as PlaytestRating,
                      label: '不值得',
                    },
                  ]).map((item) => {
                    const active =
                      playtestRating ===
                      item.id;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() =>
                          rateCompletedDetour(
                            item.id
                          )
                        }
                        style={({ pressed }) => [
                          styles.playtestRatingButton,
                          active &&
                            styles.playtestRatingButtonActive,
                          pressed &&
                            styles.completePressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.playtestRatingText,
                            active &&
                              styles.playtestRatingTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {playtestRating ===
                  'not-worth-it' && (
                  <View style={styles.playtestReasonBlock}>
                    <Text style={styles.playtestReasonLabel}>
                      哪裡掉分？可複選。
                    </Text>

                    <View style={styles.playtestReasonRow}>
                      {([
                        {
                          id: 'destination' as PlaytestFeedbackReason,
                          label: '終點普通',
                        },
                        {
                          id: 'mission' as PlaytestFeedbackReason,
                          label: '任務無聊',
                        },
                        {
                          id: 'distance' as PlaytestFeedbackReason,
                          label: '走太久',
                        },
                        {
                          id: 'navigation' as PlaytestFeedbackReason,
                          label: '導航難懂',
                        },
                        {
                          id: 'awkward' as PlaytestFeedbackReason,
                          label: '做起來尷尬',
                        },
                        {
                          id: 'other' as PlaytestFeedbackReason,
                          label: '其他',
                        },
                      ]).map((item) => {
                        const active =
                          playtestFeedbackReasons.includes(
                            item.id
                          );

                        return (
                          <Pressable
                            key={item.id}
                            onPress={() =>
                              togglePlaytestFeedbackReason(
                                item.id
                              )
                            }
                            style={({ pressed }) => [
                              styles.playtestReasonChip,
                              active &&
                                styles.playtestReasonChipActive,
                              pressed &&
                                styles.completePressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.playtestReasonText,
                                active &&
                                  styles.playtestReasonTextActive,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.completeActions}>
                <Pressable
                  onPress={() => {
                    if (lastCompletedEntry) {
                      openPassportEntry(lastCompletedEntry);
                    } else {
                      transitionTo('passport');
                    }
                  }}
                  style={({ pressed }) => [
                    styles.completePostcardButton,
                    pressed && styles.completePressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.completePostcardText,
                    ]}
                  >
                    打開這張 Postcard
                  </Text>
                  <Text style={styles.completePostcardArrow}>↗</Text>
                </Pressable>

                <Pressable
                  onPress={resetDetour}
                  style={({ pressed }) => [
                    styles.completeHomeButton,
                    pressed && styles.completePressed,
                  ]}
                >
                  <Text style={styles.completeHomeText}>
                    完成 · 回首頁
                  </Text>
                  <Text style={styles.completeHomeArrow}>→</Text>
                </Pressable>
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
              <Text style={styles.brand}>PASSPORT</Text>
              <Text style={styles.meta}>TAIPEI</Text>
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
                  <Text style={styles.passportStatLabel}>DETOURS</Text>
                </View>
                <View style={styles.passportStat}>
                  <Text style={styles.passportStatValue}>
                    {(totalDistanceMeters / 1000).toFixed(1)}
                  </Text>
                  <Text style={styles.passportStatLabel}>KM TRACED</Text>
                </View>
                <View style={styles.passportStat}>
                  <Text style={styles.passportStatValue}>
                    {totalDiscoveries}
                  </Text>
                  <Text style={styles.passportStatLabel}>MISSIONS</Text>
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
                <Text style={styles.passportSectionTitle}>RECENT DETOURS</Text>
                <Text style={styles.passportSectionMeta}>
                  {passportLoaded ? 'LOCAL PASSPORT' : 'LOADING'}
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
                        {entry.threadCode ?? entry.moodCode}
                      </Text>
                      <Text style={styles.passportCardTitle}>
                        {entry.city} · {entry.minutes} 分鐘 ·{' '}
                        {entry.contextCode ?? '—'}
                      </Text>

                      {entry.sceneName && (
                        <Text style={styles.passportCardScene}>
                          → {entry.sceneName}
                        </Text>
                      )}

                      <View style={styles.passportCardBottom}>
                        <Text style={styles.passportCardMeta}>
                          {entry.discoveries} MISSIONS
                        </Text>
                        <Text style={styles.passportCardMeta}>
                          {entry.photoCount ?? 0} PHOTOS
                        </Text>
                      </View>

                      <View style={styles.passportOpenRow}>
                        <Text style={styles.passportOpenText}>OPEN POSTCARD</Text>
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
              <Text style={styles.brand}>POSTCARD {selectedPassportNumber}</Text>
              <Text style={styles.meta}>
                {selectedPassportEntry.contextCode ?? '—'}
              </Text>
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
                  {selectedPassportEntry.moodCode}
                </Text>
                <Text style={styles.postcardDetailMeta}>
                  {selectedPassportEntry.city} · {selectedPassportEntry.minutes} 分鐘 ·{' '}
                  {selectedPassportEntry.discoveries} 個任務
                </Text>

                {selectedPassportEntry.sceneName && (
                  <Text style={styles.postcardDetailScene}>
                    DESTINATION · {selectedPassportEntry.sceneName}
                  </Text>
                )}
              </View>

              <View style={styles.postcardFacts}>
                <View style={styles.postcardFact}>
                  <Text style={styles.postcardFactLabel}>START</Text>
                  <Text style={styles.postcardFactValue}>
                    {formatClockTime(
                      selectedPassportEntry.startedAt
                    )}
                  </Text>
                </View>

                <View style={styles.postcardFact}>
                  <Text style={styles.postcardFactLabel}>END</Text>
                  <Text style={styles.postcardFactValue}>
                    {formatClockTime(
                      selectedPassportEntry.completedAt
                    )}
                  </Text>
                </View>

                <View style={styles.postcardFact}>
                  <Text style={styles.postcardFactLabel}>ACTUAL</Text>
                  <Text style={styles.postcardFactValue}>
                    {selectedPassportEntry.actualDurationMinutes
                      ? `${selectedPassportEntry.actualDurationMinutes} MIN`
                      : '—'}
                  </Text>
                </View>
              </View>

              {selectedPassportEntry.photos &&
              selectedPassportEntry.photos.length > 0 ? (
                <View style={styles.postcardPhotoSection}>
                  <View style={styles.postcardSectionHeader}>
                    <Text style={styles.postcardSectionLabel}>FILM ROLL</Text>
                    <Text style={styles.postcardSectionMeta}>
                      {selectedPassportEntry.photos.length} /{' '}
                      {selectedPassportEntry.rollCapacity ??
                        selectedPassportEntry.photos.length} EXPOSED
                    </Text>
                  </View>

                  <Image
                    source={{ uri: selectedPassportEntry.photos[0].uri }}
                    style={styles.postcardHeroPhoto}
                    resizeMode="cover"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.postcardPhotoStrip}
                  >
                    {selectedPassportEntry.photos.map((photo) => (
                      <View key={photo.id} style={styles.postcardPhotoItem}>
                        <Image
                          source={{ uri: photo.uri }}
                          style={styles.postcardPhotoThumb}
                          resizeMode="cover"
                        />
                        <Text style={styles.postcardPhotoCode}>
                          {photo.missionCode}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.postcardLegacyBlock}>
                  <Text style={styles.postcardSectionLabel}>PHOTOS</Text>
                  <Text style={styles.postcardLegacyText}>
                    這是舊版測試紀錄，當時還沒有把照片永久存進 Postcard。
                  </Text>
                </View>
              )}

              {((selectedPassportEntry.plannedRoute &&
                selectedPassportEntry.plannedRoute.length >= 2) ||
                (selectedPassportEntry.route &&
                  selectedPassportEntry.route.length >= 2)) && (
                  <View style={styles.postcardMapSection}>
                    <View style={styles.postcardSectionHeader}>
                      <Text style={styles.postcardSectionLabel}>
                        ROUTE / TRACE
                      </Text>
                      <Text style={styles.postcardSectionMeta}>
                        {(
                          (selectedPassportEntry.plannedRouteDistanceMeters ??
                            selectedPassportEntry.distanceMeters ??
                            0) / 1000
                        ).toFixed(2)} KM
                      </Text>
                    </View>

                    <View style={styles.postcardMapLegend}>
                      <View style={styles.postcardLegendItem}>
                        <View style={styles.postcardLegendPlanned} />
                        <Text style={styles.postcardLegendText}>
                          PLANNED
                        </Text>
                      </View>
                      <View style={styles.postcardLegendItem}>
                        <View style={styles.postcardLegendActual} />
                        <Text style={styles.postcardLegendText}>
                          ACTUAL
                        </Text>
                      </View>
                      {selectedPassportEntry.rerouteCount ? (
                        <Text style={styles.postcardRerouteMeta}>
                          {selectedPassportEntry.rerouteCount} REROUTE
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
                      RECOVERY
                    </Text>

                    <Text style={styles.postcardRecoveryText}>
                      途中換過{' '}
                      {selectedPassportEntry.sceneFailures.length}{' '}
                      次終點；已完成的任務都有保留。
                    </Text>
                  </View>
                )}

              <View style={styles.postcardMissionSection}>
                <View style={styles.postcardSectionHeader}>
                  <Text style={styles.postcardSectionLabel}>WHAT HAPPENED</Text>
                  <Text style={styles.postcardSectionMeta}>
                    {selectedPassportEntry.missions?.length ?? 0} MISSIONS
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
                            {mission.code}
                          </Text>
                          <Text
                            style={[
                              styles.postcardMissionResult,
                              mission.result === 'skipped' &&
                                styles.postcardMissionResultSkipped,
                            ]}
                          >
                            {mission.result === 'skipped' ? 'SKIPPED' : 'DONE'}
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

});
