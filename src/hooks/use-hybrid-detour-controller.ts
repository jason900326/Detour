import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { useLocationWatchers } from './use-location-watchers';
import { measureMovementSample } from '../lib/location-trace-logic';
import {
  buildNavigationRouteFromPolyline,
  distanceBetween,
  distanceToPolyline,
  remainingDistanceOnPolyline,
  type NavigationRoute,
} from '../lib/navigation-engine';
import { offsetPoint } from '../lib/geo-utils';
import {
  getContextMeta,
  getLightContext,
  type GeoPoint,
} from '../lib/journey-engine';
import { fetchWalkingRoute } from '../lib/routing-engine';
import {
  chooseHybridDirection,
  type HybridDirection,
} from '../lib/hybrid-detour/decision-engine';

export type HybridDetourPhase =
  | 'home'
  | 'starting'
  | 'walking'
  | 'chapter'
  | 'finished'
  | 'error';

const SEGMENTS_PER_CHAPTER = 3;
const SEGMENT_TARGET_METERS = 120;
const BEAT_REACHED_METERS = 24;
const ROUTE_CLOSE_METERS = 35;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return '這次沒有取得附近的步行路線，請稍後再試。';
}

function directionCopy(direction: HybridDirection) {
  if (direction === 'left') {
    return {
      label: '往左邊岔一下',
      instruction: '這次，往左邊岔。',
      hint: '不用找終點，只跟著這個選擇走一小段。',
    };
  }

  if (direction === 'right') {
    return {
      label: '往右邊岔一下',
      instruction: '這次，往右邊岔。',
      hint: '不用找終點，只跟著這個選擇走一小段。',
    };
  }

  return {
    label: '先往前走',
    instruction: '這次，先往前走。',
    hint: '不用找終點，只跟著這個選擇走一小段。',
  };
}

export function useHybridDetourController() {
  const [phase, setPhase] = useState<HybridDetourPhase>('home');
  const [instruction, setInstruction] = useState('先走第一小段。');
  const [hint, setHint] = useState('只看眼前這個方向。');
  const [error, setError] = useState<string | null>(null);
  const [lightLabel, setLightLabel] = useState<string | null>(null);
  const [decisionLabel, setDecisionLabel] = useState<string | null>(null);
  const [segmentNumber, setSegmentNumber] = useState(0);
  const [trace, setTrace] = useState<GeoPoint[]>([]);
  const [distanceTraveled, setDistanceTraveled] = useState(0);

  const activeRef = useRef(false);
  const sessionRef = useRef(0);
  const preparingRef = useRef(false);
  const pointRef = useRef<GeoPoint | null>(null);
  const previousPointRef = useRef<GeoPoint | null>(null);
  const previousSampleAtRef = useRef<number | null>(null);
  const headingRef = useRef(0);
  const routeRef = useRef<NavigationRoute | null>(null);
  const beatIndexRef = useRef(0);
  const segmentsRef = useRef(0);
  const recentDirectionsRef = useRef<HybridDirection[]>([]);
  const traceRef = useRef<GeoPoint[]>([]);
  const stopWatchersRef = useRef<(() => void) | null>(null);

  const stopActiveSession = useCallback(() => {
    activeRef.current = false;
    sessionRef.current += 1;
    preparingRef.current = false;
    routeRef.current = null;
    stopWatchersRef.current?.();
  }, []);

  const resetToHome = useCallback(() => {
    stopActiveSession();
    pointRef.current = null;
    previousPointRef.current = null;
    previousSampleAtRef.current = null;
    recentDirectionsRef.current = [];
    segmentsRef.current = 0;
    traceRef.current = [];
    setTrace([]);
    setDistanceTraveled(0);
    setSegmentNumber(0);
    setError(null);
    setLightLabel(null);
    setDecisionLabel(null);
    setInstruction('先走第一小段。');
    setHint('只看眼前這個方向。');
    setPhase('home');
  }, [stopActiveSession]);

  const finish = useCallback(() => {
    stopActiveSession();
    setPhase('finished');
  }, [stopActiveSession]);

  const prepareNextSegment = useCallback(
    async (startPoint: GeoPoint, sessionId: number) => {
      if (
        !activeRef.current ||
        sessionRef.current !== sessionId ||
        preparingRef.current
      ) {
        return;
      }

      preparingRef.current = true;
      routeRef.current = null;
      setPhase('walking');
      setInstruction('先往前走。');
      setHint('先沿著眼前安全的方向走，不用等 DETOUR 告訴你去哪裡。');

      try {
        const context = getLightContext(startPoint);
        const contextMeta = getContextMeta(context);

        if (context === 'night') {
          throw new Error(
            '現在天色已暗，這版實驗先不開始。請在白天或天色明亮時再試。'
          );
        }

        setLightLabel(contextMeta.label);

        const decision = chooseHybridDirection({
          headingDegrees: headingRef.current,
          recentDirections: recentDirectionsRef.current,
          step: segmentsRef.current,
        });
        const decisionMessage = directionCopy(decision.direction);

        setDecisionLabel(decisionMessage.label);
        if (segmentsRef.current > 0) {
          setInstruction(decisionMessage.instruction);
          setHint(decisionMessage.hint);
        }

        const destination = offsetPoint(
          startPoint,
          SEGMENT_TARGET_METERS,
          decision.bearingDegrees
        );
        const route = await fetchWalkingRoute(
          startPoint,
          destination,
          5200,
          {
            purpose: 'interactive',
            deadlineAt: Date.now() + 6500,
            context,
          }
        );

        if (
          !activeRef.current ||
          sessionRef.current !== sessionId
        ) {
          return;
        }

        if (route.coordinates.length < 2 || route.distanceMeters < 24) {
          throw new Error('附近沒有足夠長的步行路線，請換個位置再試。');
        }

        const navigationRoute = buildNavigationRouteFromPolyline({
          coordinates: route.coordinates,
          totalDistanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        });

        if (navigationRoute.beats.length === 0) {
          throw new Error('這段路沒有可用的步行指示，請稍後再試。');
        }

        routeRef.current = navigationRoute;
        beatIndexRef.current = 0;
        recentDirectionsRef.current = [
          ...recentDirectionsRef.current,
          decision.direction,
        ].slice(-4);
        const firstBeat = navigationRoute.beats[0];

        setSegmentNumber(segmentsRef.current + 1);
        setInstruction(firstBeat.instruction);
        setHint(
          context === 'twilight'
            ? '天色正在變暗，只走原本就安全、看得清楚的路。'
            : firstBeat.hint
        );
        setPhase('walking');
      } catch (nextError) {
        if (
          !activeRef.current ||
          sessionRef.current !== sessionId
        ) {
          return;
        }

        stopActiveSession();
        setError(errorMessage(nextError));
        setPhase('error');
      } finally {
        preparingRef.current = false;
      }
    },
    [stopActiveSession]
  );

  const completeSegment = useCallback(async () => {
    if (
      !activeRef.current ||
      preparingRef.current ||
      !pointRef.current
    ) {
      return;
    }

    segmentsRef.current += 1;
    routeRef.current = null;

    if (segmentsRef.current >= SEGMENTS_PER_CHAPTER) {
      setPhase('chapter');
      setInstruction('這一小段完成了。');
      setHint('要不要讓 DETOUR 再替你岔一次？');
      return;
    }

    await prepareNextSegment(pointRef.current, sessionRef.current);
  }, [prepareNextSegment]);

  const handleLocation = useCallback(
    (location: Location.LocationObject) => {
      if (!activeRef.current) return;

      const nextPoint: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const previousPoint = previousPointRef.current;
      const sampleAt = location.timestamp || Date.now();

      pointRef.current = nextPoint;
      previousPointRef.current = nextPoint;

      if (previousPoint) {
        const sample = measureMovementSample({
          previous: previousPoint,
          next: nextPoint,
          previousSampleAt: previousSampleAtRef.current,
          sampleAt,
          distanceMeters: distanceBetween,
        });

        if (sample) {
          const nextTrace = [...traceRef.current, nextPoint];
          traceRef.current = nextTrace;
          setTrace(nextTrace);
          setDistanceTraveled((current) => current + sample.movedMeters);
        }
      }

      previousSampleAtRef.current = sampleAt;

      const route = routeRef.current;
      if (!route || preparingRef.current) return;

      const beat = route.beats[beatIndexRef.current];
      if (!beat) return;

      const closeToBeat =
        distanceBetween(nextPoint, beat.point) <= BEAT_REACHED_METERS;
      const closeToSegment =
        distanceToPolyline(nextPoint, beat.segmentCoordinates) <=
          ROUTE_CLOSE_METERS &&
        remainingDistanceOnPolyline(
          nextPoint,
          beat.segmentCoordinates
        ) <= BEAT_REACHED_METERS;

      if (!closeToBeat && !closeToSegment) return;

      if (beatIndexRef.current >= route.beats.length - 1) {
        void completeSegment();
        return;
      }

      beatIndexRef.current += 1;
      const nextBeat = route.beats[beatIndexRef.current];
      setInstruction(nextBeat.instruction);
      setHint(nextBeat.hint);
    },
    [completeSegment]
  );

  const handleHeading = useCallback(
    (heading: Location.LocationHeadingObject) => {
      const value =
        heading.trueHeading >= 0
          ? heading.trueHeading
          : heading.magHeading;

      if (Number.isFinite(value) && value >= 0) {
        headingRef.current = value;
      }
    },
    []
  );

  const {
    stopLocationWatcher,
    startHeadingWatcher,
    startTraceWatcher,
  } = useLocationWatchers({
    devMode: false,
    onLocation: handleLocation,
    onHeading: handleHeading,
  });
  stopWatchersRef.current = stopLocationWatcher;

  const start = useCallback(async () => {
    if (activeRef.current) return;

    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    activeRef.current = true;
    preparingRef.current = false;
    routeRef.current = null;
    segmentsRef.current = 0;
    recentDirectionsRef.current = [];
    traceRef.current = [];
    setTrace([]);
    setDistanceTraveled(0);
    setSegmentNumber(0);
    setError(null);
    setDecisionLabel(null);
    setInstruction('先往前走。');
    setHint('先沿著眼前安全的方向走，不用等 DETOUR 告訴你去哪裡。');
    setPhase('walking');

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        throw new Error('需要開啟定位權限，才能開始這次實驗。');
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const startPoint: GeoPoint = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      pointRef.current = startPoint;
      previousPointRef.current = startPoint;
      previousSampleAtRef.current = current.timestamp || Date.now();
      headingRef.current =
        current.coords.heading !== null &&
        current.coords.heading !== undefined &&
        current.coords.heading >= 0
          ? current.coords.heading
          : 0;
      traceRef.current = [startPoint];
      setTrace([startPoint]);

      await startTraceWatcher();
      await startHeadingWatcher();
      await prepareNextSegment(startPoint, sessionId);
    } catch (startError) {
      if (sessionRef.current !== sessionId) return;

      stopActiveSession();
      setError(errorMessage(startError));
      setPhase('error');
    }
  }, [
    prepareNextSegment,
    startHeadingWatcher,
    startTraceWatcher,
    stopActiveSession,
  ]);

  const continueChapter = useCallback(async () => {
    if (!activeRef.current || !pointRef.current) return;

    segmentsRef.current = 0;
    setSegmentNumber(0);
    await prepareNextSegment(pointRef.current, sessionRef.current);
  }, [prepareNextSegment]);

  useEffect(() => {
    return () => {
      stopActiveSession();
    };
  }, [stopActiveSession]);

  return {
    phase,
    instruction,
    hint,
    error,
    lightLabel,
    decisionLabel,
    segmentNumber,
    trace,
    distanceTraveled,
    start,
    finish,
    continueChapter,
    resetToHome,
  };
}
