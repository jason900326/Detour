import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  PanResponder,
  Share,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { captureRef } from 'react-native-view-shot';

import {
  buildJourneyPlan,
  COLORS,
  getJourneyProfile,
  getLightContext,
  pickSideEvent,
  type ColorChoice,
  type GeoPoint,
  type JourneyPlan,
  type LightContext,
  type Mission,
  type MoodId,
  type SideEvent,
  type SideEventContext,
  type SideEventGaze,
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
  testAIEngineConnection,
} from '../lib/ai-engine';

import {
  fetchWalkingRoute,
  prewarmWalkingRoutes,
  resolveRoutedScene,
  type RoutedScene,
  type WalkingRoute,
} from '../lib/routing-engine';

import {
  loadSceneFeedback,
  saveSceneFeedback,
  type SceneFeedbackKind,
} from '../lib/scene-feedback';

import {
  createPlaytestSession,
  getPlaytestTesterId,
  loadPlaytestSessions,
  syncAllPlaytestSessions,
  updatePlaytestSession,
} from '../lib/playtest-analytics';

import {
  CAMERA_RESULT_KEY,
  DEFAULT_PREFERENCES,
  FREE_CAMERA_MISSION,
  MOODS,
  PREFERENCES_KEY,
  TIME_MAX,
  TIME_MIN,
  TIME_STEPS,
  getPaceDistanceScale,
  type CameraRouteResult,
  type CameraSource,
  type DetourPreferences,
  type DetourPrewarm,
  type PassportEntry,
  type SceneIssueReason,
  type SessionPhoto,
  type SessionSceneFailure,
  type Stage,
  type WalkingPace,
} from '../lib/app-model';

import { applyFoodDestinationWeight } from '../lib/journey-selection';
import { getDistanceInMeters, getRouteDistance } from '../lib/geo-utils';
import { ABANDONABLE_STAGES, canTransition } from '../lib/stage-flow';
import { usePassportStore } from './use-passport-store';
import { usePlaytestStore } from './use-playtest-store';
import {
  contextCode,
  parseMinutes,
} from '../lib/detour-formatters';

export function useDetourHomeController() {
  const router = useRouter();
  const activeCameraRequestRef = useRef<string | null>(null);
  const turnReminderBeatIdRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>('boot');
  const [preferences, setPreferences] =
    useState<DetourPreferences>(DEFAULT_PREFERENCES);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingFromSettings, setOnboardingFromSettings] =
    useState(false);

  const [ticketBuildStatus, setTicketBuildStatus] =
    useState('等待開始…');
  const [ticketBuildError, setTicketBuildError] = useState<string | null>(null);

  const [selectedTime, setSelectedTime] = useState<string | null>(String(TIME_MIN));
  const [sliderDisplayMinutes, setSliderDisplayMinutes] = useState(TIME_MIN);
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
  const [questPulse, setQuestPulse] = useState<'side' | 'final' | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteFailed, setRerouteFailed] = useState(false);
  const [rerouteCount, setRerouteCount] = useState(0);
  const [detourStartedAt, setDetourStartedAt] = useState<string | null>(null);
  const [sceneFailures, setSceneFailures] = useState<SessionSceneFailure[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);

  const [activeSideEvent, setActiveSideEvent] = useState<SideEvent | null>(null);
  const [sideEventSlot, setSideEventSlot] = useState(0);
  const [sideEventsShown, setSideEventsShown] = useState(0);
  const [sideEventReplacements, setSideEventReplacements] = useState(0);
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [developerToolsUnlocked, setDeveloperToolsUnlocked] = useState(false);
  const [lightContext, setLightContext] = useState<LightContext | null>(null);
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);

  const {
    passport,
    setPassport,
    passportLoaded,
    setPassportLoaded,
    lastCompletedEntry,
    setLastCompletedEntry,
    selectedPassportId,
    setSelectedPassportId,
    passportPhotoIndex,
    setPassportPhotoIndex,
    loadPassport,
    savePassport,
    clearPassport,
  } = usePassportStore();

  const playtestSessionIdRef = useRef<string | null>(null);

  const {
    playtestSessions,
    setPlaytestSessions,
    playtestTesterId,
    setPlaytestTesterId,
    lastCompletedPlaytestSessionId,
    setLastCompletedPlaytestSessionId,
    playtestRating,
    setPlaytestRating,
    playtestFeedbackReasons,
    setPlaytestFeedbackReasons,
    playtestSyncing,
    setPlaytestSyncing,
    refreshPlaytestSessions,
    syncPlaytestDataNow,
    rateCompletedDetour,
    togglePlaytestFeedbackReason,
    sharePlaytestData,
    clearPlaytestData,
  } = usePlaytestStore(playtestSessionIdRef);

  const [lastAIResult, setLastAIResult] =
    useState<'not-run' | 'ai' | 'fallback'>('not-run');
  const [aiConnectionTesting, setAIConnectionTesting] = useState(false);

  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const headingWatcher = useRef<Location.LocationSubscription | null>(null);
  const lastTracePointRef = useRef<GeoPoint | null>(null);
  const lastMovementSampleAtRef = useRef<number | null>(null);
  const effectiveMovingSecondsRef = useRef(0);
  const planRef = useRef<JourneyPlan | null>(null);
  const navigationRouteRef = useRef<NavigationRoute | null>(null);
  const navigationBeatIndexRef = useRef(0);
  const beatRemainingMetersRef = useRef(0);
  const selectedSceneRef = useRef<SceneCandidate | null>(null);
  const offRouteCountRef = useRef(0);
  const rerouteInFlightRef = useRef(false);
  const checkpointLockedRef = useRef(false);
  const rerouteCountRef = useRef(0);
  const detourStartedAtRef = useRef<string | null>(null);
  const sceneFailuresRef = useRef<SessionSceneFailure[]>([]);
  const activeSideEventRef = useRef<SideEvent | null>(null);
  const sideEventSlotRef = useRef(0);
  const sideEventsShownRef = useRef(0);
  const sideEventReplacementsRef = useRef(0);
  const sideEventSeenIdsRef = useRef<Set<string>>(new Set());
  const previousSideEventGazeRef = useRef<SideEventGaze | null>(null);
  const traveledMetersRef = useRef(0);
  const stageRef = useRef<Stage>('boot');
  const prewarmRef = useRef<DetourPrewarm | null>(null);
  const prewarmInFlightRef = useRef(false);
  const shareTicketRef = useRef<any>(null);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenY = useRef(new Animated.Value(0)).current;
  const routeProgress = useRef(new Animated.Value(0)).current;
  const ticketVisualReadyRef = useRef(false);
  const ticketVisualReadyResolverRef = useRef<(() => void) | null>(null);
  const printerPulse = useRef(new Animated.Value(0)).current;
  const ticketStamp = useRef(new Animated.Value(0)).current;
  const [ticketReadyUnlocked, setTicketReadyUnlocked] = useState(false);
  const timeSliderProgress = useRef(new Animated.Value(0)).current;
  const timeSliderWidthRef = useRef(1);
  const timeSliderStartProgressRef = useRef(0);
  const timeSliderDisplayRef = useRef(TIME_MIN);
  const minutePulse = useRef(new Animated.Value(1)).current;
  const homeEntrance = useRef(new Animated.Value(0)).current;
  const homeRouteMotion = useRef(new Animated.Value(0)).current;

  const resetTicketVisualReady = useCallback(() => {
    ticketVisualReadyRef.current = false;
    ticketVisualReadyResolverRef.current = null;
  }, []);

  const markTicketVisualReady = useCallback(() => {
    if (ticketVisualReadyRef.current) return;
    ticketVisualReadyRef.current = true;
    const resolve = ticketVisualReadyResolverRef.current;
    ticketVisualReadyResolverRef.current = null;
    resolve?.();
  }, []);

  const waitForTicketVisualReady = useCallback(() => {
    if (ticketVisualReadyRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      ticketVisualReadyResolverRef.current = resolve;
    });
  }, []);

  const mood = useMemo(
    () => MOODS.find((item) => item.id === selectedMood) ?? null,
    [selectedMood]
  );

  const selectedMinutes = parseMinutes(selectedTime);
  const previewProfile = getJourneyProfile(selectedMinutes || TIME_MIN);

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

  const currentNavigationBeat =
    navigationRoute?.beats[navigationBeatIndex] ?? null;

  const navigationProgressRatio = navigationRoute
    ? Math.min(
        1,
        navigationBeatIndex / Math.max(1, navigationRoute.beats.length)
      )
    : 0;

  const nextBeatMeters = Math.max(0, beatRemainingMeters);
  const nextBeatLabel =
    currentNavigationBeat?.turn === 'arrive' ? 'FINAL BEAT' : 'NEXT BEAT';

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
    ? relativeArrowDegrees(guidanceBearing, deviceHeading)
    : 0;

  const nextBeatSegment =
    currentNavigationBeat?.segmentCoordinates?.length
      ? currentNavigationBeat.segmentCoordinates
      : latitude !== null && longitude !== null && currentNavigationBeat
        ? [{ latitude, longitude }, currentNavigationBeat.point]
        : [];

  const paceDistanceScale = getPaceDistanceScale(preferences.walkingPace);
  const darkStage = stage === 'developing' || stage === 'journey';
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
    traveledMetersRef.current = traveledMeters;
  }, [traveledMeters]);

  useEffect(() => {
    const nextMinutes = Math.max(
      TIME_MIN,
      Math.min(TIME_MAX, selectedMinutes || TIME_MIN)
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
    if (stage !== 'mood') return;
    const warmMood = selectedMood ?? 'wander';
    const timer = setTimeout(() => {
      void prewarmDetour(warmMood);
    }, selectedMood ? 40 : 0);

    return () => clearTimeout(timer);
  }, [stage, selectedMood, selectedMinutes]);

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

      void consumeCameraResult();
      return () => {
        cancelled = true;
      };
    }, [photos, plan, passport, activeTrace, selectedMinutes, mood, lightContext])
  );

  useEffect(() => {
    void initializeApp();
    return () => stopLocationWatcher();
  }, []);

  useEffect(() => {
    if (stage !== 'preparing') return;

    routeProgress.setValue(0);
    setTicketBuildError(null);
    setTicketBuildStatus('正在取得現在位置…');

    printerPulse.setValue(0);
    const printerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(printerPulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(printerPulse, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    printerLoop.start();
    void prepareDetourTicket();

    return () => printerLoop.stop();
  }, [stage]);

  useEffect(() => {
    if (stage !== 'ready') return;

    setTicketReadyUnlocked(false);
    ticketStamp.setValue(0);

    const impactTimer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 290);

    const stampTimer = setTimeout(() => {
      Animated.timing(ticketStamp, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.back(1.25)),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setTicketReadyUnlocked(true);
      });
    }, 180);

    return () => {
      clearTimeout(impactTimer);
      clearTimeout(stampTimer);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'developing') return;
    const timer = setTimeout(() => transitionTo('finish'), 1450);
    return () => clearTimeout(timer);
  }, [stage]);

  async function initializeApp() {
    await loadPassport();

    const [storedPlaytestSessions, testerId] = await Promise.all([
      loadPlaytestSessions(),
      getPlaytestTesterId(),
    ]);

    setPlaytestSessions(storedPlaytestSessions);
    setPlaytestTesterId(testerId);
    void syncAllPlaytestSessions(storedPlaytestSessions);

    try {
      const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
      const parsed = raw
        ? (JSON.parse(raw) as Partial<DetourPreferences>)
        : null;
      const nextPreferences: DetourPreferences = {
        ...DEFAULT_PREFERENCES,
        ...(parsed ?? {}),
      };

      setPreferences(nextPreferences);
      setDevMode(nextPreferences.indoorTest);

      const nextStage: Stage =
        nextPreferences.onboardingComplete ? 'time' : 'onboarding';
      setStage(nextStage);
      stageRef.current = nextStage;
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
      setDevMode(false);
      setStage('onboarding');
      stageRef.current = 'onboarding';
    }
  }

  async function savePreferences(nextPreferences: DetourPreferences) {
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

  async function setWalkingPace(pace: WalkingPace) {
    await Haptics.selectionAsync();
    await savePreferences({ ...preferences, walkingPace: pace });
  }

  async function toggleNightRoutePreference() {
    await Haptics.selectionAsync();
    await savePreferences({
      ...preferences,
      preferLegibleRoutesAtNight: !preferences.preferLegibleRoutesAtNight,
    });
  }

  function routingContext(context: LightContext): LightContext {
    if (context === 'night' && !preferences.preferLegibleRoutesAtNight) {
      return 'day';
    }
    return context;
  }

  async function completeOnboarding() {
    const nextPreferences = { ...preferences, onboardingComplete: true };
    await savePreferences(nextPreferences);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    transitionTo(
      onboardingFromSettings ? 'settings' : 'time',
      () => {
        setOnboardingStep(0);
        setOnboardingFromSettings(false);
      }
    );
  }

  async function runAIConnectionTest() {
    if (aiConnectionTesting) return;
    setAIConnectionTesting(true);

    try {
      const result = await testAIEngineConnection();
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
        Alert.alert('AI 還沒接通', result.message);
      }
    } finally {
      setAIConnectionTesting(false);
    }
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
    setOnboardingStep((value) => value + 1);
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
      headingWatcher.current = await Location.watchHeadingAsync((heading) => {
        const value =
          heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
        if (Number.isFinite(value)) setDeviceHeading(value);
      });
    } catch {
      // Heading is useful, but the route can still render without it.
    }
  }

  function advanceTicketProgress(_toValue: number, status: string) {
    setTicketBuildStatus(status);
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
    const current = stageRef.current;
    if (!canTransition(current, next)) {
      console.warn(`[DETOUR FLOW] blocked invalid transition ${current} -> ${next}`);
      return;
    }

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

  async function toggleDeveloperTools() {
    const next = !developerToolsUnlocked;
    setDeveloperToolsUnlocked(next);
    await Haptics.selectionAsync();
  }

  async function toggleDevMode() {
    const next = !devMode;
    setDevMode(next);
    await savePreferences({ ...preferences, indoorTest: next });
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    transitionTo('mood');
  }

  async function chooseMood(moodId: MoodId) {
    await Haptics.selectionAsync();
    setSelectedMood(moodId);
    void prewarmDetour(moodId);

    if (moodId === 'color' && !selectedColor) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      setSelectedColor(color);
    }
  }

  async function continueFromMood() {
    if (!selectedMood) return;

    resetTicketVisualReady();
    routeProgress.stopAnimation();
    routeProgress.setValue(0);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const session = await createPlaytestSession({
      devMode,
      minutes: selectedMinutes || TIME_MIN,
      moodId: selectedMood,
    });

    playtestSessionIdRef.current = session.id;
    void refreshPlaytestSessions();
    transitionTo('preparing');
  }

  function resetSideEventRuntime() {
    setActiveSideEvent(null);
    activeSideEventRef.current = null;
    setSideEventSlot(0);
    sideEventSlotRef.current = 0;
    setSideEventsShown(0);
    sideEventsShownRef.current = 0;
    setSideEventReplacements(0);
    sideEventReplacementsRef.current = 0;
    sideEventSeenIdsRef.current = new Set();
    previousSideEventGazeRef.current = null;
    effectiveMovingSecondsRef.current = 0;
    lastMovementSampleAtRef.current = null;
  }

  function resetDetour() {
    const testSessionId = playtestSessionIdRef.current;

    if (testSessionId && ABANDONABLE_STAGES.has(stageRef.current)) {
      void updatePlaytestSession(testSessionId, {
        status: 'abandoned',
        completedAt: new Date().toISOString(),
        sideEventsShown: sideEventsShownRef.current,
        sideEventReplacements: sideEventReplacementsRef.current,
        rerouteCount: rerouteCountRef.current,
        sceneFailureReasons: sceneFailuresRef.current.map(
          (failure) => failure.reason
        ),
      }).then(setPlaytestSessions);
    }

    playtestSessionIdRef.current = null;
    setLastCompletedPlaytestSessionId(null);
    setPlaytestRating(null);
    setPlaytestFeedbackReasons([]);

    stopLocationWatcher();
    setSelectedTime(String(TIME_MIN));
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
    resetSideEventRuntime();
    setTraveledMeters(0);
    traveledMetersRef.current = 0;
    setLightContext(null);
    setPhotos([]);
    setLastCompletedEntry(null);
    setSelectedPassportId(null);
    activeCameraRequestRef.current = null;
    lastTracePointRef.current = null;
    planRef.current = null;
    setStage('time');
    stageRef.current = 'time';
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
        setOnboardingStep((value) => Math.max(0, value - 1));
        return;
      }
      if (onboardingFromSettings) {
        transitionTo('settings', () => setOnboardingFromSettings(false));
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

    if (stage === 'journey' || stage === 'arrival') {
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

    if (stage === 'finish') resetDetour();
  }

  const edgeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          const safeBackStages: Stage[] = [
            'onboarding',
            'settings',
            'mood',
            'preparing',
            'ready',
            'sceneIssue',
            'passport',
            'passportDetail',
          ];

          if (!safeBackStages.includes(stage)) return false;
          if (
            stage === 'onboarding' &&
            onboardingStep === 0 &&
            !onboardingFromSettings
          ) {
            return false;
          }

          const horizontalEnough =
            gestureState.dx > 12 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35;

          return gestureState.x0 <= 30 && horizontalEnough;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= 72 && gestureState.vx > 0.12) {
            void Haptics.selectionAsync();
            goBack();
          }
        },
      }),
    [stage, onboardingStep, onboardingFromSettings]
  );

  function remainingDetourMinutes() {
    const startedAt = detourStartedAtRef.current;
    if (!startedAt) return selectedMinutes || TIME_MIN;

    const elapsedMinutes =
      (Date.now() - new Date(startedAt).getTime()) / 60000;
    return Math.max(1, (selectedMinutes || TIME_MIN) - elapsedMinutes);
  }

  function replacementDistanceBudget(minutesLeft: number) {
    return Math.max(
      70,
      Math.min(320, Math.round(minutesLeft * 52))
    );
  }

  function feedbackKindForIssue(
    reason: SceneIssueReason
  ): SceneFeedbackKind {
    if (reason === 'closed') return 'closed';
    if (reason === 'inaccessible') return 'inaccessible';
    if (reason === 'not-worth-it') return 'not-worth-it';
    return 'wrong-now';
  }

  function currentAllowedSideEventContexts(): SideEventContext[] {
    const allowed: SideEventContext[] = ['safe-stop'];
    const beat =
      navigationRouteRef.current?.beats[navigationBeatIndexRef.current] ?? null;
    const remaining = beatRemainingMetersRef.current;

    if (
      beat &&
      ['left', 'right', 'slight-left', 'slight-right'].includes(beat.turn) &&
      remaining >= 45 &&
      remaining <= 140
    ) {
      allowed.push('corner');
    }

    return allowed;
  }

  function presentSideEvent(options?: {
    advanceSlot?: boolean;
    countAsReplacement?: boolean;
  }) {
    const currentPlan = planRef.current;
    if (!currentPlan || selectedMood === 'color') return null;

    const next = pickSideEvent({
      seenIds: sideEventSeenIdsRef.current,
      previousGaze: previousSideEventGazeRef.current,
      allowedContexts: currentAllowedSideEventContexts(),
    });

    if (!next) return null;

    sideEventSeenIdsRef.current.add(next.id);
    previousSideEventGazeRef.current = next.gaze;
    activeSideEventRef.current = next;
    setActiveSideEvent(next);

    const nextShown = sideEventsShownRef.current + 1;
    sideEventsShownRef.current = nextShown;
    setSideEventsShown(nextShown);

    if (options?.advanceSlot) {
      const nextSlot = sideEventSlotRef.current + 1;
      sideEventSlotRef.current = nextSlot;
      setSideEventSlot(nextSlot);
    }

    if (options?.countAsReplacement) {
      const nextCount = sideEventReplacementsRef.current + 1;
      sideEventReplacementsRef.current = nextCount;
      setSideEventReplacements(nextCount);
    }

    setQuestPulse('side');
    setTimeout(() => setQuestPulse((pulse) => (pulse === 'side' ? null : pulse)), 700);
    return next;
  }

  async function acknowledgeActiveSideEvent() {
    const next = presentSideEvent();
    if (next) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function replaceActiveSideEvent() {
    const next = presentSideEvent({ countAsReplacement: true });
    if (next) await Haptics.selectionAsync();
  }

  function refreshSideEventAfterPhoto() {
    presentSideEvent();
  }

  function maybeTriggerSideEvent(currentPoint: GeoPoint) {
    const currentPlan = planRef.current;
    const route = navigationRouteRef.current;

    if (
      !currentPlan ||
      !route ||
      stageRef.current !== 'journey' ||
      selectedMood === 'color'
    ) {
      return;
    }

    const slot = sideEventSlotRef.current;
    const window = currentPlan.profile.triggerWindows[slot];
    if (!window) return;

    const remainingRoute = remainingDistanceOnPolyline(
      currentPoint,
      route.coordinates
    );
    const progress = Math.max(
      0,
      Math.min(1, 1 - remainingRoute / Math.max(1, route.totalDistanceMeters))
    );
    const movingSeconds = effectiveMovingSecondsRef.current;
    const due =
      progress >= window.targetProgress ||
      movingSeconds >= window.targetMovingSeconds;

    if (!due || remainingRoute < 55) return;

    const beat = route.beats[navigationBeatIndexRef.current];
    const remainingBeat = beatRemainingMetersRef.current;
    const nearNavigationDecision =
      beat &&
      beat.turn !== 'continue' &&
      beat.turn !== 'start' &&
      remainingBeat > 0 &&
      remainingBeat < 32;

    if (nearNavigationDecision) return;

    presentSideEvent({ advanceSlot: true });
  }

  async function replaceFailedDestination(reason: SceneIssueReason) {
    const failedScene = selectedSceneRef.current;
    const currentPlan = planRef.current;
    if (!failedScene || !currentPlan) return;

    setReplacementLoading(true);

    const failure: SessionSceneFailure = {
      sceneId: failedScene.id,
      sceneName: failedScene.name,
      reason,
      createdAt: new Date().toISOString(),
    };
    const nextFailures = [...sceneFailuresRef.current, failure];
    setSceneFailures(nextFailures);
    sceneFailuresRef.current = nextFailures;

    await saveSceneFeedback({
      sceneId: failedScene.id,
      kind: feedbackKindForIssue(reason),
      createdAt: failure.createdAt,
    });

    try {
      let currentPoint: GeoPoint | null =
        latitude !== null && longitude !== null
          ? { latitude, longitude }
          : null;

      if (!currentPoint) {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        currentPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }

      const minutesLeft = remainingDetourMinutes();
      const distanceBudget = Math.round(
        replacementDistanceBudget(minutesLeft) * paceDistanceScale
      );
      const visitedSceneIds = passport
        .map((entry) => entry.sceneId)
        .filter((value): value is string => typeof value === 'string');
      const feedback = await loadSceneFeedback();
      const hardExcluded = [
        failedScene.id,
        ...nextFailures.map((item) => item.sceneId),
      ];

      const candidates = await findSceneCandidates({
        start: currentPoint,
        moodId: selectedMood ?? 'wander',
        context: lightContext ?? 'day',
        minutes: Math.max(5, Math.round(minutesLeft)),
        excludeSceneIds: visitedSceneIds,
        hardExcludeSceneIds: hardExcluded,
        feedback,
        distanceScale: paceDistanceScale,
      });

      if (candidates.length === 0) {
        throw new Error('附近沒有第二個夠好的 Scene。');
      }

      const recoveryMood = selectedMood ?? 'wander';
      const recoveryContext = lightContext ?? 'day';
      const recoveryMinutes = Math.max(5, Math.round(minutesLeft));
      const routed = await resolveRoutedScene({
        start: currentPoint,
        candidates,
        minutes: recoveryMinutes,
        maxDistanceMeters: distanceBudget,
        sideEventCount: 0,
        context: routingContext(recoveryContext),
        avoidRoutes: [
          activeTrace,
          ...passport.slice(0, 5).map((entry) =>
            entry.route && entry.route.length >= 2
              ? entry.route
              : entry.plannedRoute ?? []
          ),
        ].filter(
          (route): route is GeoPoint[] =>
            Array.isArray(route) && route.length >= 2
        ),
      });

      const nextArrivalMission =
        recoveryMood === 'color'
          ? currentPlan.arrivalMission
          : buildSceneArrivalMission({
              scene: routed.scene,
              moodId: recoveryMood,
              context: recoveryContext,
            });
      const nextPlan = {
        ...currentPlan,
        arrivalMission: nextArrivalMission,
      };
      const nextNavigation = buildNavigationRouteFromPolyline({
        coordinates: routed.route.coordinates,
        totalDistanceMeters: routed.route.distanceMeters,
        durationSeconds: routed.route.durationSeconds,
      });

      if (nextNavigation.beats.length < 1) {
        throw new Error('替代路線資料不足。');
      }

      setSelectedScene(routed.scene);
      selectedSceneRef.current = routed.scene;
      setWalkingRoute(routed.route);
      setPlan(nextPlan);
      planRef.current = nextPlan;
      setNavigationRoute(nextNavigation);
      navigationRouteRef.current = nextNavigation;
      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstDistance = nextNavigation.beats[0]?.segmentDistanceMeters ?? 0;
      setBeatRemainingMeters(firstDistance);
      beatRemainingMetersRef.current = firstDistance;
      setLatitude(currentPoint.latitude);
      setLongitude(currentPoint.longitude);
      lastTracePointRef.current = currentPoint;
      setShowNextBeatMap(false);
      setRerouteFailed(false);
      offRouteCountRef.current = 0;

      const nextRerouteCount = rerouteCountRef.current + 1;
      rerouteCountRef.current = nextRerouteCount;
      setRerouteCount(nextRerouteCount);

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
        `${message}\n\n已經走過的路和拍下來的照片可以直接收進 Passport。`,
        [
          { text: '回到這裡', style: 'cancel' },
          { text: '結束這次', onPress: () => void completeDetour() },
        ]
      );
    } finally {
      setReplacementLoading(false);
    }
  }

  async function rerouteFromCurrentPosition(currentPoint: GeoPoint) {
    if (rerouteInFlightRef.current || devMode) return;

    const scene = selectedSceneRef.current;
    if (!scene || !planRef.current) return;

    rerouteInFlightRef.current = true;
    setIsRerouting(true);
    setRerouteFailed(false);

    try {
      const nextWalkingRoute = await fetchWalkingRoute(
        currentPoint,
        scene.point,
        undefined,
        { context: routingContext(lightContext ?? 'day') }
      );
      const nextNavigationRoute = buildNavigationRouteFromPolyline({
        coordinates: nextWalkingRoute.coordinates,
        totalDistanceMeters: nextWalkingRoute.distanceMeters,
        durationSeconds: nextWalkingRoute.durationSeconds,
      });

      if (nextNavigationRoute.beats.length < 1) {
        throw new Error('No reroute beats');
      }

      setWalkingRoute(nextWalkingRoute);
      setNavigationRoute(nextNavigationRoute);
      navigationRouteRef.current = nextNavigationRoute;
      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstDistance =
        nextNavigationRoute.beats[0]?.segmentDistanceMeters ?? 0;
      setBeatRemainingMeters(firstDistance);
      beatRemainingMetersRef.current = firstDistance;
      setShowNextBeatMap(false);
      offRouteCountRef.current = 0;

      const nextCount = rerouteCountRef.current + 1;
      rerouteCountRef.current = nextCount;
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
        const sampleAt = newLocation.timestamp || Date.now();
        const previousSampleAt = lastMovementSampleAtRef.current;
        lastMovementSampleAtRef.current = sampleAt;

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

        if (previousSampleAt !== null) {
          const sampleSeconds = Math.max(
            0,
            Math.min(10, (sampleAt - previousSampleAt) / 1000)
          );
          effectiveMovingSecondsRef.current += sampleSeconds;
        }

        setActiveTrace((trace) =>
          trace.length >= 700 ? trace : [...trace, nextPoint]
        );

        if (stageRef.current !== 'journey') return;

        const nextTraveled = traveledMetersRef.current + moved;
        traveledMetersRef.current = nextTraveled;
        setTraveledMeters(nextTraveled);

        const route = navigationRouteRef.current;
        const beat = route?.beats[navigationBeatIndexRef.current] ?? null;
        if (!route || !beat) return;

        const remainingOnBeat = remainingDistanceOnPolyline(
          nextPoint,
          beat.segmentCoordinates
        );
        setBeatRemainingMeters(remainingOnBeat);
        beatRemainingMetersRef.current = remainingOnBeat;

        const shouldRemindForTurn =
          ['left', 'right', 'slight-left', 'slight-right', 'arrive'].includes(
            beat.turn
          ) &&
          remainingOnBeat > 12 &&
          remainingOnBeat <= 60 &&
          turnReminderBeatIdRef.current !== beat.id;

        if (shouldRemindForTurn) {
          turnReminderBeatIdRef.current = beat.id;
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );
        }

        const offRouteDistance = distanceToPolyline(
          nextPoint,
          route.coordinates
        );
        const gpsAccuracy = newLocation.coords.accuracy ?? 0;
        const offRouteThreshold = Math.max(
          45,
          Math.min(70, gpsAccuracy + 30)
        );

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
          void rerouteFromCurrentPosition(nextPoint);
          return;
        }

        maybeTriggerSideEvent(nextPoint);

        if (remainingOnBeat <= 12) {
          void reachCurrentNavigationBeat();
        }
      }
    );
  }

  async function prewarmDetour(moodOverride?: MoodId) {
    const targetMood = moodOverride ?? selectedMood;
    if (!targetMood) return;

    const cached = prewarmRef.current;
    if (
      cached &&
      Date.now() - cached.createdAt < 5 * 60 * 1000 &&
      (cached.candidatesByMood[targetMood]?.length ?? 0) > 0
    ) {
      return;
    }

    if (prewarmInFlightRef.current) return;
    prewarmInFlightRef.current = true;

    try {
      const permission = await Location.getForegroundPermissionsAsync();
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
      const minutes = selectedMinutes || TIME_MIN;

      const candidates = await findSceneCandidates({
        start: point,
        moodId: targetMood,
        context,
        minutes,
        excludeSceneIds: visitedSceneIds,
        feedback: sceneFeedback,
        distanceScale: paceDistanceScale,
      });

      prewarmRef.current = {
        point,
        context,
        candidatesByMood: { [targetMood]: candidates },
        rankedIdsByMood: {
          [targetMood]: candidates.map((candidate) => candidate.id),
        },
        aiUsedByMood: { [targetMood]: false },
        createdAt: Date.now(),
      };

      void prewarmWalkingRoutes(
        point,
        candidates,
        2,
        minutes,
        paceDistanceScale,
        routingContext(context)
      );
    } catch {
      // Prewarming is only an optimization.
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
    setTicketBuildError(null);
    const ticketStartedAt = Date.now();

    routeProgress.stopAnimation();
    routeProgress.setValue(0);
    await waitForTicketVisualReady();

    Animated.timing(routeProgress, {
      toValue: 0.13,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

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
      setTicketBuildStatus('需要定位才能繼續');
      setTicketBuildError(
        '允許定位後再試一次。DETOUR 只會用現在的位置找這趟的終點和步行路線。'
      );
      return;
    }

    try {
      const finalMood: MoodId = selectedMood ?? 'wander';
      const minutes = selectedMinutes || TIME_MIN;
      const profile = getJourneyProfile(minutes);
      const plannedSideEventCount =
        finalMood === 'color' ? 0 : profile.sideEventCount;
      const cached =
        prewarmRef.current &&
        Date.now() - prewarmRef.current.createdAt < 5 * 60 * 1000
          ? prewarmRef.current
          : null;

      let startPoint: GeoPoint;
      let context: LightContext;
      let rankedCandidates: SceneCandidate[];
      let rankingUsedAI = false;
      let routed: RoutedScene;

      if (cached) {
          startPoint = cached.point;
          context = cached.context;

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

          let location = await Location.getLastKnownPositionAsync({
            maxAge: 2 * 60 * 1000,
            requiredAccuracy: 150,
          });

          if (!location) {
            location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
          }

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

          advanceTicketProgress(
            0.46,
            `找到 ${sceneCandidates.length} 個候選。正在確認步行路線…`
          );
          rankedCandidates = sceneCandidates;
      }

      if (rankedCandidates.length === 0) {
        throw new Error('附近暫時沒有適合的終點。');
      }

      if (finalMood === 'food') {
        rankedCandidates = applyFoodDestinationWeight(rankedCandidates);
        rankingUsedAI = false;
      }

      const recentRoutes = passport
          .slice(0, 6)
          .map((entry) =>
            entry.route && entry.route.length >= 2
              ? entry.route
              : entry.plannedRoute ?? []
          )
          .filter(
            (route): route is GeoPoint[] =>
              Array.isArray(route) && route.length >= 2
          );

      routed = await resolveRoutedScene({
          start: startPoint,
          candidates: rankedCandidates,
          minutes,
          distanceScale: paceDistanceScale,
          sideEventCount: plannedSideEventCount,
          context: routingContext(context),
          avoidRoutes: recentRoutes,
      });
      setLastAIResult(rankingUsedAI ? 'ai' : 'fallback');
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

      const nextNavigationRoute = buildNavigationRouteFromPolyline({
        coordinates: routed.route.coordinates,
        totalDistanceMeters: routed.route.distanceMeters,
        durationSeconds: routed.route.durationSeconds,
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
      resetSideEventRuntime();
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

      setTicketBuildStatus('車票完成');

      const minimumPrintMs = 300;
      const remainingPrintMs = Math.max(
        0,
        minimumPrintMs - (Date.now() - ticketStartedAt)
      );
      if (remainingPrintMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remainingPrintMs);
        });
      }

      routeProgress.stopAnimation();
      await new Promise<void>((resolve) => {
        Animated.timing(routeProgress, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }).start(() => resolve());
      });

      const testSessionId = playtestSessionIdRef.current;
      if (testSessionId) {
        void updatePlaytestSession(testSessionId, {
          status: 'ready',
          lightContext: context,
          sceneKind: routed.scene.kind,
          plannedDistanceMeters: routed.route.distanceMeters,
          plannedDurationSeconds: routed.route.durationSeconds,
          sideEventsPlanned: nextPlan.profile.sideEventCount,
        }).then(setPlaytestSessions);
      }

      console.log(
        `[DETOUR TIMING] ticket ready in ${Date.now() - ticketStartedAt}ms`
      );
      setStage('ready');
      stageRef.current = 'ready';
    } catch (error) {
      stopLocationWatcher();

      const message =
        error instanceof Error
          ? error.message
          : '請確認網路和定位服務後再試一次。';
      const testSessionId = playtestSessionIdRef.current;

      setTicketBuildStatus('這張票沒有印成功');
      setTicketBuildError(message);
      routeProgress.stopAnimation();

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: message.slice(0, 120),
          })
        );
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }

  async function startDetour() {
    const startPoint = detourStart;
    const route = navigationRouteRef.current;

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

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const startedAt = new Date().toISOString();
    setDetourStartedAt(startedAt);
    detourStartedAtRef.current = startedAt;
    effectiveMovingSecondsRef.current = 0;
    lastMovementSampleAtRef.current = Date.now();

    const testSessionId = playtestSessionIdRef.current;
    if (testSessionId) {
      setPlaytestSessions(
        await updatePlaytestSession(testSessionId, {
          status: 'started',
          startedAt,
        })
      );
    }

    setActiveTrace([startPoint]);
    lastTracePointRef.current = startPoint;
    transitionTo('journey');
    await startTraceWatcher();
    await startHeadingWatcher();
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
    if (checkpointLockedRef.current) return;

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

    const isFinal = beatIndex >= route.beats.length - 1;

    if (isFinal) {
      setQuestPulse('final');
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 720));
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
    const nextRemaining = Math.max(0, currentRemaining - step);

    setLatitude(nextPoint.latitude);
    setLongitude(nextPoint.longitude);
    setBeatRemainingMeters(nextRemaining);
    beatRemainingMetersRef.current = nextRemaining;

    const nextTraveled = traveledMetersRef.current + step;
    traveledMetersRef.current = nextTraveled;
    setTraveledMeters(nextTraveled);
    effectiveMovingSecondsRef.current += step / 1.25;
    setActiveTrace((trace) => [...trace, nextPoint]);
    maybeTriggerSideEvent(nextPoint);

    await Haptics.selectionAsync();

    if (nextRemaining <= 1.5) {
      setTimeout(() => void reachCurrentNavigationBeat(), 100);
    }
  }

  async function simulateNextBeat() {
    if (!devMode) return;
    const route = navigationRouteRef.current;
    const beat = route?.beats[navigationBeatIndexRef.current];
    if (!beat) return;

    const previousPoint =
      latitude !== null && longitude !== null
        ? { latitude, longitude }
        : detourStart ?? beat.point;
    const moved = getDistanceInMeters(
      previousPoint.latitude,
      previousPoint.longitude,
      beat.point.latitude,
      beat.point.longitude
    );

    setLatitude(beat.point.latitude);
    setLongitude(beat.point.longitude);
    setBeatRemainingMeters(0);
    beatRemainingMetersRef.current = 0;
    const nextTraveled = traveledMetersRef.current + moved;
    traveledMetersRef.current = nextTraveled;
    setTraveledMeters(nextTraveled);
    effectiveMovingSecondsRef.current += moved / 1.25;
    setActiveTrace((trace) => [...trace, beat.point]);
    maybeTriggerSideEvent(beat.point);
    await Haptics.selectionAsync();
    setTimeout(() => void reachCurrentNavigationBeat(), 80);
  }

  function openPassportEntry(entry: PassportEntry) {
    setSelectedPassportId(entry.id);
    setPassportPhotoIndex(0);
    transitionTo('passportDetail');
  }

  async function shareJourney(entry: PassportEntry, headline?: string) {
    const message =
      headline?.replace(/\s*\n\s*/g, ' ').trim() ||
      `DETOUR · ${entry.moodLabel}`;

    try {
      const ticketUri = await captureRef(shareTicketRef, {
        format: 'jpg',
        quality: 0.96,
        result: 'tmpfile',
      });

      await Share.share({
        title: '分享這趟 DETOUR',
        message,
        url: ticketUri,
      });
    } catch {
      await Share.share({
        title: '分享這趟 DETOUR',
        message,
      });
    }
  }

  async function openCamera(source: CameraSource) {
    const colorWalkCameraMission: Mission =
      selectedMood === 'color' && selectedColor
        ? {
            ...FREE_CAMERA_MISSION,
            id: `color-walk-${selectedColor.id}`,
            code: `COLOR · ${selectedColor.code}`,
            title: `拍下${selectedColor.label}。`,
            instruction: `看到${selectedColor.label}就拍；其他時間跟著導航走。`,
          }
        : FREE_CAMERA_MISSION;

    const sideEventCameraMission: Mission | null =
      activeSideEventRef.current?.photoSuggested
        ? {
            id: activeSideEventRef.current.id,
            code: 'SIDE EVENT',
            title: activeSideEventRef.current.title,
            instruction: activeSideEventRef.current.instruction,
            completion: '',
            photo: true,
            portable: true,
          }
        : null;

    const missionForCamera: Mission | null =
      source === 'arrival'
        ? plan?.arrivalMission ?? null
        : source === 'free'
          ? colorWalkCameraMission
          : sideEventCameraMission;

    if (!missionForCamera) return;

    const requestId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    activeCameraRequestRef.current = requestId;
    await AsyncStorage.removeItem(CAMERA_RESULT_KEY);

    router.push({
      pathname: '/camera',
      params: {
        requestId,
        source,
        missionCode: missionForCamera.code,
        missionTitle: missionForCamera.title,
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

    if (result.source === 'side') {
      refreshSideEventAfterPhoto();
    }
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

    const entry: PassportEntry = {
      id: `${Date.now()}`,
      completedAt: new Date().toISOString(),
      city: '台北',
      minutes: selectedMinutes || TIME_MIN,
      moodId: finalMood.id,
      moodLabel: finalMood.label,
      moodCode: finalMood.code,
      discoveries: finalPhotos.length,
      route,
      distanceMeters: getRouteDistance(route),
      contextCode: plan?.contextCode ?? contextCode(lightContext),
      threadCode: undefined,
      threadLabel: undefined,
      photoCount: finalPhotos.length,
      photos: finalPhotos,
      sideEventsShown: sideEventsShownRef.current,
      sideEventReplacements: sideEventReplacementsRef.current,
      sceneId: selectedScene?.id,
      sceneName: selectedScene?.name,
      sceneKind: selectedScene?.kind,
      sceneLabel: selectedScene?.label,
      scenePoint: selectedScene?.point,
      plannedRouteDistanceMeters: walkingRoute?.distanceMeters,
      plannedRouteDurationSeconds: walkingRoute?.durationSeconds,
      plannedRoute: walkingRoute?.coordinates ?? [],
      startedAt: detourStartedAtRef.current ?? detourStartedAt ?? undefined,
      actualDurationMinutes: detourStartedAtRef.current
        ? Math.max(
            1,
            Math.round(
              (Date.now() -
                new Date(detourStartedAtRef.current).getTime()) /
                60000
            )
          )
        : undefined,
      rerouteCount: rerouteCountRef.current,
      sceneFailures: sceneFailuresRef.current,
    };

    const testSessionId = playtestSessionIdRef.current;
    if (testSessionId) {
      setPlaytestSessions(
        await updatePlaytestSession(testSessionId, {
          status: 'completed',
          completedAt: entry.completedAt,
          actualDurationMinutes: entry.actualDurationMinutes,
          sideEventsShown: sideEventsShownRef.current,
          sideEventReplacements: sideEventReplacementsRef.current,
          rerouteCount: rerouteCountRef.current,
          sceneFailureReasons: sceneFailuresRef.current.map(
            (failure) => failure.reason
          ),
          photoCount: finalPhotos.length,
          aiRankingUsed: lastAIResult === 'ai',
          sceneKind: selectedScene?.kind,
          plannedDistanceMeters: walkingRoute?.distanceMeters,
          plannedDurationSeconds: walkingRoute?.durationSeconds,
        })
      );

      setLastCompletedPlaytestSessionId(testSessionId);
      setPlaytestRating(null);
      setPlaytestFeedbackReasons([]);
      playtestSessionIdRef.current = null;
    }

    const nextPassport = [entry, ...passport];
    setLastCompletedEntry(entry);
    await savePassport(nextPassport);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    transitionTo('developing');
  }

  return {
    router,
    activeCameraRequestRef,
    stage,
    setStage,
    preferences,
    setPreferences,
    onboardingStep,
    setOnboardingStep,
    onboardingFromSettings,
    setOnboardingFromSettings,
    ticketBuildStatus,
    setTicketBuildStatus,
    ticketBuildError,
    setTicketBuildError,
    selectedTime,
    setSelectedTime,
    sliderDisplayMinutes,
    setSliderDisplayMinutes,
    selectedMood,
    setSelectedMood,
    selectedColor,
    setSelectedColor,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    detourStart,
    setDetourStart,
    activeTrace,
    setActiveTrace,
    plan,
    setPlan,
    selectedScene,
    setSelectedScene,
    walkingRoute,
    setWalkingRoute,
    navigationRoute,
    setNavigationRoute,
    navigationBeatIndex,
    setNavigationBeatIndex,
    beatRemainingMeters,
    setBeatRemainingMeters,
    deviceHeading,
    setDeviceHeading,
    showNextBeatMap,
    setShowNextBeatMap,
    questPulse,
    setQuestPulse,
    isRerouting,
    setIsRerouting,
    rerouteFailed,
    setRerouteFailed,
    rerouteCount,
    setRerouteCount,
    detourStartedAt,
    setDetourStartedAt,
    sceneFailures,
    setSceneFailures,
    replacementLoading,
    setReplacementLoading,
    activeSideEvent,
    sideEventSlot,
    sideEventsShown,
    sideEventReplacements,
    traveledMeters,
    setTraveledMeters,
    devMode,
    setDevMode,
    developerToolsUnlocked,
    setDeveloperToolsUnlocked,
    lightContext,
    setLightContext,
    photos,
    setPhotos,
    passport,
    setPassport,
    passportLoaded,
    setPassportLoaded,
    lastCompletedEntry,
    setLastCompletedEntry,
    selectedPassportId,
    setSelectedPassportId,
    passportPhotoIndex,
    setPassportPhotoIndex,
    playtestSessions,
    setPlaytestSessions,
    playtestTesterId,
    setPlaytestTesterId,
    lastCompletedPlaytestSessionId,
    setLastCompletedPlaytestSessionId,
    playtestRating,
    setPlaytestRating,
    playtestFeedbackReasons,
    setPlaytestFeedbackReasons,
    playtestSyncing,
    setPlaytestSyncing,
    lastAIResult,
    setLastAIResult,
    aiConnectionTesting,
    setAIConnectionTesting,
    locationWatcher,
    headingWatcher,
    lastTracePointRef,
    planRef,
    navigationRouteRef,
    navigationBeatIndexRef,
    beatRemainingMetersRef,
    selectedSceneRef,
    offRouteCountRef,
    rerouteInFlightRef,
    checkpointLockedRef,
    playtestSessionIdRef,
    rerouteCountRef,
    detourStartedAtRef,
    sceneFailuresRef,
    activeSideEventRef,
    sideEventSlotRef,
    sideEventsShownRef,
    sideEventReplacementsRef,
    effectiveMovingSecondsRef,
    traveledMetersRef,
    stageRef,
    prewarmRef,
    prewarmInFlightRef,
    shareTicketRef,
    screenOpacity,
    screenY,
    routeProgress,
    markTicketVisualReady,
    printerPulse,
    ticketStamp,
    ticketReadyUnlocked,
    setTicketReadyUnlocked,
    timeSliderProgress,
    timeSliderWidthRef,
    timeSliderStartProgressRef,
    timeSliderDisplayRef,
    minutePulse,
    homeEntrance,
    homeRouteMotion,
    mood,
    selectedMinutes,
    previewProfile,
    timeIndexFromRatio,
    snapMinutesFromRatio,
    ratioForMinutes,
    pulseMinute,
    previewSliderRatio,
    finishSliderRatio,
    timeSliderResponder,
    currentNavigationBeat,
    navigationProgressRatio,
    nextBeatMeters,
    nextBeatLabel,
    guidanceBearing,
    arrowRotation,
    nextBeatSegment,
    paceDistanceScale,
    darkStage,
    chromeDark,
    tracedPassport,
    totalDistanceMeters,
    totalDiscoveries,
    selectedPassportEntry,
    selectedPassportNumber,
    passportMapRegion,
    initializeApp,
    savePreferences,
    setWalkingPace,
    toggleNightRoutePreference,
    completeOnboarding,
    refreshPlaytestSessions,
    syncPlaytestDataNow,
    rateCompletedDetour,
    togglePlaytestFeedbackReason,
    runAIConnectionTest,
    sharePlaytestData,
    clearPlaytestData,
    replayOnboarding,
    nextOnboardingStep,
    loadPassport,
    savePassport,
    clearPassport,
    stopLocationWatcher,
    startHeadingWatcher,
    advanceTicketProgress,
    animateIn,
    transitionTo,
    toggleDeveloperTools,
    toggleDevMode,
    chooseTime,
    continueFromTime,
    chooseMood,
    continueFromMood,
    resetDetour,
    goBack,
    edgeBackResponder,
    remainingDetourMinutes,
    replacementDistanceBudget,
    feedbackKindForIssue,
    acknowledgeActiveSideEvent,
    replaceActiveSideEvent,
    replaceFailedDestination,
    rerouteFromCurrentPosition,
    startTraceWatcher,
    prewarmDetour,
    applyCachedRanking,
    prepareDetourTicket,
    startDetour,
    setBeat,
    reachCurrentNavigationBeat,
    simulateWalk,
    simulateNextBeat,
    openPassportEntry,
    shareJourney,
    openCamera,
    handleCameraRouteResult,
    completeDetour,
  };
}
