import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  PanResponder,
  Share,
} from 'react-native';

import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
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
  type MoodId,
  type SideEvent,
  type SideEventGaze,
} from '../lib/journey-engine';
import {
  createActiveJourneySnapshot,
  parseActiveJourneySnapshot,
  type ActiveJourneySnapshot,
} from '../lib/active-journey-storage';

import {
  buildNavigationRouteFromPolyline,
  guidanceBearingOnPolyline,
  moveToward,
  relativeArrowDegrees,
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
  ACTIVE_JOURNEY_KEY,
  DEFAULT_PREFERENCES,
  MOODS,
  PREFERENCES_KEY,
  TIME_MAX,
  TIME_MIN,
  TIME_STEPS,
  getPaceDistanceScale,
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
import {
  readStored,
  removeStored,
  writeStored,
} from '../lib/storage';
import { parseDetourPreferences } from '../lib/preferences-storage';
import { useCameraRouteBridge } from './use-camera-route-bridge';
import { useJourneyLocationController } from './use-journey-location-controller';
import { useLocationWatchers } from './use-location-watchers';
import { useNavigationBeatController } from './use-navigation-beat-controller';
import { useRerouteController } from './use-reroute-controller';
import { useSideEventController } from './use-side-event-controller';

export function useDetourHomeController() {
  const router = useRouter();
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
  const [elapsedJourneySeconds, setElapsedJourneySeconds] = useState(0);
  const [sceneFailures, setSceneFailures] = useState<SessionSceneFailure[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);

  const [activeSideEvent, setActiveSideEvent] = useState<SideEvent | null>(null);
  const [sideEventPhotoConfirmed, setSideEventPhotoConfirmed] = useState(false);
  const [sideEventSlot, setSideEventSlot] = useState(0);
  const [sideEventsShown, setSideEventsShown] = useState(0);
  const [sideEventReplacements, setSideEventReplacements] = useState(0);
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [developerToolsUnlocked, setDeveloperToolsUnlocked] = useState(false);
  const [lightContext, setLightContext] = useState<LightContext | null>(null);
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [recoverySnapshot, setRecoverySnapshot] =
    useState<ActiveJourneySnapshot | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [directStartActive, setDirectStartActive] = useState(false);

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

  const lastTracePointRef = useRef<GeoPoint | null>(null);
  const lastMovementSampleAtRef = useRef<number | null>(null);
  const effectiveMovingSecondsRef = useRef(0);
  const planRef = useRef<JourneyPlan | null>(null);
  const navigationRouteRef = useRef<NavigationRoute | null>(null);
  const navigationBeatIndexRef = useRef(0);
  const beatRemainingMetersRef = useRef(0);
  const selectedSceneRef = useRef<SceneCandidate | null>(null);
  const offRouteCountRef = useRef(0);
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
  const directStartRef = useRef(false);

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

  const cameraBridge = useCameraRouteBridge({
    router,
    selectedMood,
    selectedColor,
    plan,
    activeSideEventRef,
    photos,
    setPhotos,
    setSideEventPhotoConfirmed,
    persistActiveJourneySnapshot,
  });

  const rerouteController = useRerouteController({
    devMode,
    routeContext: routingContext(lightContext ?? 'day'),
    planRef,
    selectedSceneRef,
    offRouteCountRef,
    rerouteCountRef,
    navigationRouteRef,
    navigationBeatIndexRef,
    beatRemainingMetersRef,
    setIsRerouting,
    setRerouteFailed,
    setWalkingRoute,
    setNavigationRoute,
    setNavigationBeatIndex,
    setBeatRemainingMeters,
    setShowNextBeatMap,
    setRerouteCount,
  });
  const rerouteInFlightRef = rerouteController.rerouteInFlightRef;
  const rerouteFromCurrentPosition =
    rerouteController.rerouteFromCurrentPosition;

  const navigationBeatController = useNavigationBeatController({
    navigationRouteRef,
    navigationBeatIndexRef,
    beatRemainingMetersRef,
    checkpointLockedRef,
    setLatitude,
    setLongitude,
    setNavigationBeatIndex,
    setBeatRemainingMeters,
    setShowNextBeatMap,
    setActiveTrace,
    setQuestPulse,
    transitionTo,
  });
  const setBeat = navigationBeatController.setBeat;
  const reachCurrentNavigationBeat =
    navigationBeatController.reachCurrentNavigationBeat;

  const sideEventController = useSideEventController({
    selectedMood,
    stageRef,
    planRef,
    lastMovementSampleAtRef,
    navigationRouteRef,
    navigationBeatIndexRef,
    beatRemainingMetersRef,
    effectiveMovingSecondsRef,
    activeSideEventRef,
    sideEventSlotRef,
    sideEventsShownRef,
    sideEventReplacementsRef,
    sideEventSeenIdsRef,
    previousSideEventGazeRef,
    setActiveSideEvent,
    setSideEventPhotoConfirmed,
    setSideEventSlot,
    setSideEventsShown,
    setSideEventReplacements,
  });
  const {
    acknowledgeActiveSideEvent,
    maybeTriggerSideEvent,
    replaceActiveSideEvent,
    presentInitialSideEvent,
    resetSideEventRuntime,
  } = sideEventController;

  const journeyLocationController = useJourneyLocationController({
    stageRef,
    lastTracePointRef,
    lastMovementSampleAtRef,
    effectiveMovingSecondsRef,
    traveledMetersRef,
    navigationRouteRef,
    navigationBeatIndexRef,
    beatRemainingMetersRef,
    offRouteCountRef,
    rerouteInFlightRef,
    setLatitude,
    setLongitude,
    setDeviceHeading,
    setActiveTrace,
    setTraveledMeters,
    setBeatRemainingMeters,
    rerouteFromCurrentPosition,
    maybeTriggerSideEvent,
    reachCurrentNavigationBeat,
  });
  const handleHeadingUpdate = journeyLocationController.handleHeadingUpdate;
  const handleLocationUpdate = journeyLocationController.handleLocationUpdate;

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

  function buildActiveJourneySnapshot(): ActiveJourneySnapshot | null {
    if (
      (stage !== 'journey' && stage !== 'arrival') ||
      !detourStartedAt ||
      !plan ||
      !selectedScene ||
      !walkingRoute ||
      !navigationRoute
    ) {
      return null;
    }

    return createActiveJourneySnapshot({
      stage,
      selectedTime,
      selectedMood,
      selectedColor,
      latitude,
      longitude,
      detourStart,
      activeTrace,
      plan,
      selectedScene,
      walkingRoute,
      navigationRoute,
      navigationBeatIndex,
      beatRemainingMeters,
      deviceHeading,
      detourStartedAt,
      sceneFailures,
      activeSideEvent,
      sideEventPhotoConfirmed,
      sideEventSlot,
      sideEventsShown,
      sideEventReplacements,
      sideEventSeenIds: [...sideEventSeenIdsRef.current],
      previousSideEventGaze: previousSideEventGazeRef.current,
      traveledMeters,
      lightContext,
      photos,
      effectiveMovingSeconds: effectiveMovingSecondsRef.current,
    });
  }

  async function persistActiveJourneySnapshot() {
    const snapshot = buildActiveJourneySnapshot();
    if (!snapshot) return;

    try {
      await writeStored(ACTIVE_JOURNEY_KEY, snapshot);
    } catch (error) {
      console.warn('DETOUR active journey snapshot failed:', error);
    }
  }

  useEffect(() => {
    const snapshot = buildActiveJourneySnapshot();
    if (!snapshot) return;

    const timer = setTimeout(() => {
      void writeStored(ACTIVE_JOURNEY_KEY, snapshot).catch((error) => {
        console.warn('DETOUR active journey snapshot failed:', error);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [
    activeSideEvent,
    activeTrace,
    beatRemainingMeters,
    detourStart,
    detourStartedAt,
    deviceHeading,
    latitude,
    lightContext,
    longitude,
    navigationBeatIndex,
    navigationRoute,
    photos,
    plan,
    sceneFailures,
    selectedColor,
    selectedMood,
    selectedScene,
    selectedTime,
    sideEventPhotoConfirmed,
    sideEventReplacements,
    sideEventSlot,
    sideEventsShown,
    stage,
    traveledMeters,
    walkingRoute,
  ]);

  useEffect(() => {
    if (stage !== 'journey' || !detourStartedAt) return;

    const startedAtMs = new Date(detourStartedAt).getTime();
    const updateElapsed = () => {
      setElapsedJourneySeconds(
        Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [detourStartedAt, stage]);

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
          if (cancelled) return;
          await cameraBridge.consumeCameraResult();
        } catch {
          // 相機回傳失敗不應讓整趟 DETOUR crash。
        }
      };

      void consumeCameraResult();
      return () => {
        cancelled = true;
      };
    }, [cameraBridge.consumeCameraResult])
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

  async function restoreActiveJourney(snapshot: ActiveJourneySnapshot) {
    try {

      setSelectedTime(snapshot.selectedTime);
      setSelectedMood(snapshot.selectedMood);
      setSelectedColor(snapshot.selectedColor);
      setLatitude(snapshot.latitude);
      setLongitude(snapshot.longitude);
      setDetourStart(snapshot.detourStart);
      setActiveTrace(snapshot.activeTrace ?? []);
      setPlan(snapshot.plan);
      planRef.current = snapshot.plan;
      setSelectedScene(snapshot.selectedScene);
      selectedSceneRef.current = snapshot.selectedScene;
      setWalkingRoute(snapshot.walkingRoute);
      setNavigationRoute(snapshot.navigationRoute);
      navigationRouteRef.current = snapshot.navigationRoute;
      setNavigationBeatIndex(snapshot.navigationBeatIndex ?? 0);
      navigationBeatIndexRef.current = snapshot.navigationBeatIndex ?? 0;
      setBeatRemainingMeters(snapshot.beatRemainingMeters ?? 0);
      beatRemainingMetersRef.current = snapshot.beatRemainingMeters ?? 0;
      setDeviceHeading(snapshot.deviceHeading ?? 0);
      setDetourStartedAt(snapshot.detourStartedAt);
      detourStartedAtRef.current = snapshot.detourStartedAt;
      setSceneFailures(snapshot.sceneFailures ?? []);
      sceneFailuresRef.current = snapshot.sceneFailures ?? [];
      setActiveSideEvent(snapshot.activeSideEvent ?? null);
      activeSideEventRef.current = snapshot.activeSideEvent ?? null;
      setSideEventPhotoConfirmed(snapshot.sideEventPhotoConfirmed ?? false);
      setSideEventSlot(snapshot.sideEventSlot ?? 0);
      sideEventSlotRef.current = snapshot.sideEventSlot ?? 0;
      setSideEventsShown(snapshot.sideEventsShown ?? 0);
      sideEventsShownRef.current = snapshot.sideEventsShown ?? 0;
      setSideEventReplacements(snapshot.sideEventReplacements ?? 0);
      sideEventReplacementsRef.current = snapshot.sideEventReplacements ?? 0;
      sideEventSeenIdsRef.current = new Set(snapshot.sideEventSeenIds ?? []);
      previousSideEventGazeRef.current = snapshot.previousSideEventGaze ?? null;
      setTraveledMeters(snapshot.traveledMeters ?? 0);
      traveledMetersRef.current = snapshot.traveledMeters ?? 0;
      setLightContext(snapshot.lightContext ?? null);
      setPhotos(snapshot.photos ?? []);
      effectiveMovingSecondsRef.current = snapshot.effectiveMovingSeconds ?? 0;
      lastTracePointRef.current =
        snapshot.activeTrace?.[snapshot.activeTrace.length - 1] ??
        snapshot.detourStart;
      setShowNextBeatMap(false);
      setRerouteFailed(false);
      setIsRerouting(false);
      setQuestPulse(null);

      setStage(snapshot.stage);
      stageRef.current = snapshot.stage;

      if (snapshot.stage === 'journey') {
        lastMovementSampleAtRef.current = Date.now();
        await startTraceWatcher();
        await startHeadingWatcher();
      }

      return true;
    } catch (error) {
      console.warn('DETOUR active journey restore failed:', error);
      await removeStored(ACTIVE_JOURNEY_KEY).catch(() => undefined);
      return false;
    }
  }

  async function continueRecoveredJourney() {
    if (!recoverySnapshot || recoveryLoading) return;

    setRecoveryLoading(true);
    const restored = await restoreActiveJourney(recoverySnapshot);
    if (restored) setRecoverySnapshot(null);
    setRecoveryLoading(false);
  }

  async function discardRecoveredJourney() {
    if (recoveryLoading) return;

    setRecoveryLoading(true);
    await removeStored(ACTIVE_JOURNEY_KEY).catch(() => undefined);
    setRecoverySnapshot(null);
    setRecoveryLoading(false);

    const nextStage: Stage = preferences.onboardingComplete ? 'time' : 'onboarding';
    setStage(nextStage);
    stageRef.current = nextStage;
  }

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
      const [parsed, activeJourneyRaw] = await Promise.all([
        readStored<unknown>(PREFERENCES_KEY),
        readStored<unknown>(ACTIVE_JOURNEY_KEY),
      ]);
      const nextPreferences = parseDetourPreferences(parsed);

      setPreferences(nextPreferences);
      setDevMode(nextPreferences.indoorTest);

      const parsedRecoverySnapshot = parseActiveJourneySnapshot(activeJourneyRaw);
      if (nextPreferences.onboardingComplete && parsedRecoverySnapshot) {
        setRecoverySnapshot(parsedRecoverySnapshot);
        return;
      }

      if (activeJourneyRaw) {
        await removeStored(ACTIVE_JOURNEY_KEY).catch(() => undefined);
      }

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
      await writeStored(PREFERENCES_KEY, nextPreferences);
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

  async function startDirectDetour() {
    if (stageRef.current !== 'time' || directStartRef.current) return;

    const defaultMinutes = 15;
    const defaultMood: MoodId = 'wander';
    directStartRef.current = true;
    setDirectStartActive(true);
    setSelectedTime(String(defaultMinutes));
    setSliderDisplayMinutes(defaultMinutes);
    timeSliderDisplayRef.current = defaultMinutes;
    setSelectedMood(defaultMood);
    setSelectedColor(null);
    resetTicketVisualReady();
    routeProgress.stopAnimation();
    routeProgress.setValue(0);

    const session = await createPlaytestSession({
      devMode,
      minutes: defaultMinutes,
      moodId: defaultMood,
    });
    playtestSessionIdRef.current = session.id;
    void refreshPlaytestSessions();
    transitionTo('preparing');
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

  function resetDetour() {
    const testSessionId = playtestSessionIdRef.current;
    void removeStored(ACTIVE_JOURNEY_KEY);

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
    setElapsedJourneySeconds(0);
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
    directStartRef.current = false;
    setDirectStartActive(false);
    cameraBridge.resetCameraRequest();
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
      if (directStartRef.current) {
        directStartRef.current = false;
        setDirectStartActive(false);
        transitionTo('time');
      } else {
        transitionTo('mood');
      }
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
    // The selected time is a planning budget, not a deadline. A replacement
    // destination should remain viable even when a real walk runs long.
    return selectedMinutes || TIME_MIN;
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

  const locationWatchers = useLocationWatchers({
    devMode,
    onLocation: handleLocationUpdate,
    onHeading: handleHeadingUpdate,
  });
  const stopLocationWatcher = locationWatchers.stopLocationWatcher;
  const startHeadingWatcher = locationWatchers.startHeadingWatcher;
  const startTraceWatcher = locationWatchers.startTraceWatcher;

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
    if (!directStartRef.current) {
      await waitForTicketVisualReady();
    }

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

      if (directStartRef.current) {
        await startDetour({ directStart: true, immediateSideEvent: true });
      }
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

  async function startDetour(options?: {
    directStart?: boolean;
    immediateSideEvent?: boolean;
  }) {
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
    transitionTo('journey', () => {
      if (options?.directStart) {
        directStartRef.current = false;
        setDirectStartActive(false);
      }
      if (options?.immediateSideEvent) {
        presentInitialSideEvent();
      }
    });
    await startTraceWatcher();
    await startHeadingWatcher();
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
    await removeStored(ACTIVE_JOURNEY_KEY);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    transitionTo('developing');
  }

  return {
    router,
    activeCameraRequestRef: cameraBridge.activeCameraRequestRef,
    stage,
    setStage,
    directStartActive,
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
    elapsedJourneySeconds,
    setElapsedJourneySeconds,
    sceneFailures,
    setSceneFailures,
    replacementLoading,
    setReplacementLoading,
    activeSideEvent,
    sideEventPhotoConfirmed,
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
    recoverySnapshot,
    recoveryLoading,
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
    locationWatcher: locationWatchers.locationWatcher,
    headingWatcher: locationWatchers.headingWatcher,
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
    startDirectDetour,
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
    openCamera: cameraBridge.openCamera,
    handleCameraRouteResult: cameraBridge.handleCameraRouteResult,
    continueRecoveredJourney,
    discardRecoveredJourney,
    completeDetour,
  };
}
