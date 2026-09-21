import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Share } from 'react-native';

import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import {
  CAMERA_RESULT_KEY,
  type CameraRouteResult,
  type PassportEntry,
  type SessionPhoto,
} from '../lib/app-model';
import { getLightContext, type GeoPoint, type LightContext } from '../lib/journey-engine';
import {
  buildNavigationRouteFromPolyline,
  bearingBetween,
  distanceBetween,
  distanceToPolyline,
  remainingDistanceOnPolyline,
  type NavigationRoute,
} from '../lib/navigation-engine';
import { getDistanceInMeters, getRouteDistance } from '../lib/geo-utils';
import {
  fetchWalkingRoute,
  type WalkingRoute,
} from '../lib/routing-engine';
import { findSceneCandidates } from '../lib/scene-engine';
import { readStored, removeStored } from '../lib/storage';
import {
  chooseV2Target,
  shouldEnterV2Closing,
  shouldForceV2Finish,
  shouldOfferV2ClosingTarget,
  shouldKeepV2TargetIntoClosing,
  targetDifficultyForNext,
  replacementDifficultyForV2,
  resolveV2CompletionPlace,
  type V2TargetDifficulty,
  type V2Target,
} from '../lib/v2-journey';
import {
  buildShortRouteDestinations,
  chooseBestV2Route,
  closingStopPriority,
  type V2RouteOption,
} from '../lib/v2-routing';
import {
  closingRouteTargetDistanceMeters,
  isPlausibleV2MovementSample,
  isSpatiallyConsistentOffRouteSample,
  isTrustedV2GpsAccuracy,
  isUsableV2StartAccuracy,
} from '../lib/v2-routing-policy';
import { usePassportStore } from './use-passport-store';
import {
  createIndoorWalkingRoute,
  indoorClosingDestination,
  indoorDeviationPoint,
  INDOOR_START_POINT,
  pointAlongPolyline,
} from '../lib/v2-indoor-playtest';

export type V2Phase = 'home' | 'starting' | 'exploration' | 'closing' | 'finish' | 'history' | 'share';
export type V2PlaytestMode = 'live' | 'indoor';

export type V2RouteState = {
  id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  walkingRoute: WalkingRoute;
  navigationRoute: NavigationRoute;
  beatIndex: number;
  purpose: 'exploration' | 'closing';
  label?: string;
};

type V2RoutePurpose = 'exploration' | 'closing';

const V2_MINUTES = 10;
const CLOSING_START_SECONDS = 8 * 60;
const MAX_JOURNEY_SECONDS = 15 * 60;
const OFF_ROUTE_CONFIRMATIONS = 2;

function isCameraRouteResult(value: unknown): value is CameraRouteResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<CameraRouteResult>;
  return Boolean(
    result.requestId &&
      (result.source === 'free' || result.source === 'side' || result.source === 'arrival') &&
      result.photo &&
      typeof result.photo.uri === 'string'
  );
}

function makeTicketSerial() {
  return `DTR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}


async function resolveAreaLabel(
  point: GeoPoint | null,
  mode: V2PlaytestMode
) {
  if (mode === 'indoor') return '室內測試';
  if (!point) return '這一帶';

  try {
    const [address] = await withTimeout(
      Location.reverseGeocodeAsync(point),
      1800,
      'reverse-geocode-timeout'
    );
    if (!address) return '這一帶';

    const primary = address.district ?? address.city ?? address.subregion;
    const secondary =
      address.city && address.city !== primary
        ? address.city
        : address.region && address.region !== primary
          ? address.region
          : null;

    return [primary, secondary].filter(Boolean).join(' · ') || '這一帶';
  } catch {
    // A friendly rough area is useful for History, but geocoding must never
    // block completion or turn coordinates into a visible fallback.
    return '這一帶';
  }
}

export function useV2DetourController() {
  const router = useRouter();
  const [phase, setPhase] = useState<V2Phase>('home');
  const [playtestMode, setPlaytestMode] = useState<V2PlaytestMode>('live');
  const [currentPoint, setCurrentPoint] = useState<GeoPoint | null>(null);
  const [heading, setHeading] = useState(0);
  const [lightContext, setLightContext] = useState<LightContext>('day');
  const [routeState, setRouteState] = useState<V2RouteState | null>(null);
  const [activeTarget, setActiveTarget] = useState<V2Target | null>(null);
  const [emojiTrail, setEmojiTrail] = useState<string[]>([]);
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [trace, setTrace] = useState<GeoPoint[]>([]);
  const [discoveries, setDiscoveries] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPlanning, setIsPlanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [endPlaceLabel, setEndPlaceLabel] = useState<string | null>(null);
  const [ticketSerial, setTicketSerial] = useState(makeTicketSerial);
  const [historyDetail, setHistoryDetail] = useState<PassportEntry | null>(null);
  const [shareEntry, setShareEntry] = useState<PassportEntry | null>(null);

  const phaseRef = useRef<V2Phase>('home');
  const playtestModeRef = useRef<V2PlaytestMode>('live');
  const currentPointRef = useRef<GeoPoint | null>(null);
  const journeyAnchorRef = useRef<GeoPoint | null>(null);
  const routeStateRef = useRef<V2RouteState | null>(null);
  const activeTargetRef = useRef<V2Target | null>(null);
  const emojiTrailRef = useRef<string[]>([]);
  const photosRef = useRef<SessionPhoto[]>([]);
  const traceRef = useRef<GeoPoint[]>([]);
  const discoveriesRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const targetStartedAtRef = useRef<number | null>(null);
  const previousTargetIdsRef = useRef<string[]>([]);
  const previousRouteCoordinatesRef = useRef<GeoPoint[][]>([]);
  const previousBearingRef = useRef<number | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const lastTrustedTracePointRef = useRef<GeoPoint | null>(null);
  const lastTrustedTraceTimestampRef = useRef<number | null>(null);
  const endPlaceLabelRef = useRef<string | null>(null);
  const routeRequestRef = useRef(0);
  const routePlanningRef = useRef(false);
  const finishInFlightRef = useRef(false);
  const finishRequestRef = useRef(0);
  const ticketSerialRef = useRef(ticketSerial);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const headingWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const watcherGenerationRef = useRef(0);
  const indoorRouteProgressRef = useRef(0);
  const offRouteSamplesRef = useRef(0);
  const offRouteCandidateRef = useRef<GeoPoint | null>(null);
  const environmentKindsRef = useRef<string[]>([]);
  const environmentRequestRef = useRef(0);
  const cameraRequestIdRef = useRef<string | null>(null);
  const shareReturnPhaseRef = useRef<'finish' | 'history'>('finish');

  const {
    passport,
    passportLoaded,
    loadPassport,
    savePassport,
  } = usePassportStore();
  const passportRef = useRef(passport);
  const passportLoadedRef = useRef(passportLoaded);

  const setPhaseSafe = useCallback((next: V2Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const setPlaytestModeSafe = useCallback((next: V2PlaytestMode) => {
    playtestModeRef.current = next;
    setPlaytestMode(next);
  }, []);

  const setRouteSafe = useCallback((next: V2RouteState | null) => {
    routeStateRef.current = next;
    setRouteState(next);
  }, []);

  const setTargetSafe = useCallback((next: V2Target | null) => {
    activeTargetRef.current = next;
    targetStartedAtRef.current = next ? Date.now() : null;
    setActiveTarget(next);
  }, []);

  const stopWatchers = useCallback(() => {
    watcherGenerationRef.current += 1;
    locationWatcherRef.current?.remove();
    locationWatcherRef.current = null;
    headingWatcherRef.current?.remove();
    headingWatcherRef.current = null;
  }, []);

  const refreshEnvironmentHints = useCallback(async (point: GeoPoint) => {
    if (playtestModeRef.current !== 'live') return;
    const requestId = environmentRequestRef.current + 1;
    environmentRequestRef.current = requestId;

    try {
      const context = getLightContext(point);
      const candidates = await findSceneCandidates({
        start: point,
        moodId: 'wander',
        context,
        minutes: V2_MINUTES,
        distanceScale: 0.45,
      });
      if (requestId !== environmentRequestRef.current) return;
      environmentKindsRef.current = Array.from(
        new Set(candidates.slice(0, 16).map((candidate) => candidate.kind))
      );
    } catch {
      // Environment data is only a weak probability hint. The generic target
      // pool must remain fully playable when OSM/Overpass is unavailable.
    }
  }, []);

  const registerRoute = useCallback(
    (option: V2RouteOption) => {
      if (playtestModeRef.current === 'indoor') {
        indoorRouteProgressRef.current = 0;
      }
      const next: V2RouteState = {
        id: `${option.purpose}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        origin: option.origin,
        destination: option.destination,
        walkingRoute: option.walkingRoute,
        navigationRoute: option.navigationRoute,
        beatIndex: 0,
        purpose: option.purpose,
        label: option.label,
      };
      setRouteSafe(next);
      offRouteSamplesRef.current = 0;
      offRouteCandidateRef.current = null;
      previousRouteCoordinatesRef.current = [
        option.walkingRoute.coordinates,
        ...previousRouteCoordinatesRef.current,
      ].slice(0, 5);
      if (option.walkingRoute.coordinates.length > 1) {
        previousBearingRef.current = bearingBetween(
          option.origin,
          option.walkingRoute.coordinates[1]
        );
      }
      return next;
    },
    [setRouteSafe]
  );

  const planShortRoute = useCallback(
    async (origin: GeoPoint, purpose: V2RoutePurpose, fixedDestination?: {
      point: GeoPoint;
      label: string;
    }) => {
      if (routePlanningRef.current) return false;

      const requestId = routeRequestRef.current + 1;
      routeRequestRef.current = requestId;
      routePlanningRef.current = true;
      setIsPlanning(true);
      setErrorMessage(null);

      try {
        if (playtestModeRef.current === 'indoor') {
          const seed = Date.now() + discoveriesRef.current * 17;
          const destinations = fixedDestination
            ? [fixedDestination.point]
            : buildShortRouteDestinations(
                origin,
                seed,
                previousBearingRef.current,
                journeyAnchorRef.current
              );

          const options: V2RouteOption[] = destinations.map((destination, index) => {
            const walkingRoute = createIndoorWalkingRoute(
              origin,
              purpose,
              seed + index,
              destination
            );
            return {
              origin,
              destination,
              walkingRoute,
              navigationRoute: buildNavigationRouteFromPolyline({
                coordinates: walkingRoute.coordinates,
                totalDistanceMeters: walkingRoute.distanceMeters,
                durationSeconds: walkingRoute.durationSeconds,
              }),
              purpose,
              label: fixedDestination?.label,
            };
          });

          const indoorOption =
            chooseBestV2Route(
              options,
              [
                ...(traceRef.current.length > 1 ? [traceRef.current] : []),
                ...previousRouteCoordinatesRef.current,
              ],
              previousBearingRef.current,
              purpose
            ) ?? options[0];

          if (!indoorOption || requestId !== routeRequestRef.current) return false;
          registerRoute(indoorOption);
          if (purpose === 'closing') {
            endPlaceLabelRef.current = fixedDestination?.label ?? '室內測試收尾點';
            setEndPlaceLabel(endPlaceLabelRef.current);
          }
          return true;
        }

        const context = getLightContext(origin);
        setLightContext(context);

        const destinations = fixedDestination
          ? [fixedDestination.point]
          : buildShortRouteDestinations(
              origin,
              Date.now() + discoveriesRef.current * 17 + previousRouteCoordinatesRef.current.length,
              previousBearingRef.current,
              journeyAnchorRef.current
            );

        const results = await Promise.allSettled(
          destinations.map((destination) =>
            fetchWalkingRoute(origin, destination, 9000, {
              purpose: 'interactive',
              context,
            })
          )
        );

        if (requestId !== routeRequestRef.current) return false;

        const options: V2RouteOption[] = results.flatMap((result, index) => {
          if (result.status !== 'fulfilled') return [];
          const walkingRoute = result.value;
          const destination = destinations[index];
          return [
            {
              origin,
              destination,
              walkingRoute,
              navigationRoute: buildNavigationRouteFromPolyline({
                coordinates: walkingRoute.coordinates,
                totalDistanceMeters: walkingRoute.distanceMeters,
                durationSeconds: walkingRoute.durationSeconds,
              }),
              purpose,
              label: fixedDestination?.label,
            },
          ];
        });

        const best = chooseBestV2Route(
          options,
          [
            ...(traceRef.current.length > 1 ? [traceRef.current] : []),
            ...previousRouteCoordinatesRef.current,
          ],
          previousBearingRef.current,
          purpose
        );

        if (!best) {
          throw new Error('附近這次沒有找到適合的步行小段。');
        }

        registerRoute(best);
        if (purpose === 'closing' && best.label) {
          endPlaceLabelRef.current = best.label;
          setEndPlaceLabel(best.label);
        }
        return true;
      } catch (error) {
        if (requestId === routeRequestRef.current) {
          setErrorMessage(error instanceof Error ? error.message : '路線暫時沒有回應。');
        }
        return false;
      } finally {
        if (requestId === routeRequestRef.current) {
          routePlanningRef.current = false;
          setIsPlanning(false);
        }
      }
    },
    [registerRoute]
  );

  const planClosingRoute = useCallback(
    async (origin: GeoPoint, currentElapsedSeconds: number) => {
      const closingTargetMeters =
        closingRouteTargetDistanceMeters(currentElapsedSeconds);
      const closingRequestId = routeRequestRef.current + 1;
      routeRequestRef.current = closingRequestId;
      setRouteSafe(null);
      setPhaseSafe('closing');
      if (shouldOfferV2ClosingTarget(discoveriesRef.current)) {
        const existingTarget = activeTargetRef.current;
        const existingTargetAgeSeconds = targetStartedAtRef.current
          ? Math.max(
              1,
              Math.round((Date.now() - targetStartedAtRef.current) / 1000)
            )
          : null;
        const keepExistingTarget =
          existingTarget &&
          shouldKeepV2TargetIntoClosing({
            difficulty: existingTarget.difficulty,
            targetAgeSeconds: existingTargetAgeSeconds,
          });

        if (!keepExistingTarget) {
          const closingTarget = chooseV2Target({
            difficulty: 'easy',
            excludedIds: previousTargetIdsRef.current,
            excludedEmojis: emojiTrailRef.current,
            environmentKinds: environmentKindsRef.current,
            seed: Date.now() + 911,
          });
          previousTargetIdsRef.current = [
            ...previousTargetIdsRef.current,
            closingTarget.id,
          ].slice(-8);
          setTargetSafe(closingTarget);
        }
      } else {
        setTargetSafe(null);
      }
      setStatusMessage('差不多了，再往這邊走一小段。');

      if (playtestModeRef.current === 'indoor') {
        return planShortRoute(origin, 'closing', {
          point: indoorClosingDestination(
            origin,
            Date.now(),
            closingTargetMeters
          ),
          label: '室內測試收尾點',
        });
      }

      routePlanningRef.current = true;
      setIsPlanning(true);

      let bestOption: V2RouteOption | null = null;
      try {
        const context = getLightContext(origin);
        const candidates = await findSceneCandidates({
          start: origin,
          moodId: 'wander',
          context,
          minutes: V2_MINUTES,
          distanceScale: Math.min(
            0.95,
            Math.max(0.55, (closingTargetMeters / 480) * 0.9)
          ),
        });
        const minimumStraightDistance = Math.min(
          180,
          closingTargetMeters * 0.35
        );
        const endCandidates = candidates
          .filter(
            (candidate) =>
              ['green-space', 'square', 'pedestrian', 'footbridge', 'viewpoint', 'fountain'].includes(
                candidate.kind
              ) &&
              candidate.straightDistanceMeters >= minimumStraightDistance
          )
          .sort((a, b) => {
            const suitability =
              closingStopPriority(a.kind) - closingStopPriority(b.kind);
            if (suitability !== 0) return suitability;
            return (
              Math.abs(a.straightDistanceMeters - closingTargetMeters) -
              Math.abs(b.straightDistanceMeters - closingTargetMeters)
            );
          });

        const results = await Promise.allSettled(
          endCandidates.slice(0, 5).map(async (candidate) => ({
            candidate,
            route: await fetchWalkingRoute(origin, candidate.point, 8000, {
              purpose: 'interactive',
              context,
            }),
          }))
        );
        const options: V2RouteOption[] = results.flatMap((result) => {
          if (result.status !== 'fulfilled') return [];
          const { candidate, route } = result.value;
          return [
            {
              origin,
              destination: candidate.point,
              walkingRoute: route,
              navigationRoute: buildNavigationRouteFromPolyline({
                coordinates: route.coordinates,
                totalDistanceMeters: route.distanceMeters,
                durationSeconds: route.durationSeconds,
              }),
              purpose: 'closing' as const,
              label: candidate.name,
            },
          ];
        });
        const distanceEligibleOptions = options.filter(
          (option) =>
            option.walkingRoute.distanceMeters >= closingTargetMeters * 0.55
        );
        bestOption = chooseBestV2Route(
          distanceEligibleOptions,
          [
            ...(traceRef.current.length > 1 ? [traceRef.current] : []),
            ...previousRouteCoordinatesRef.current,
          ],
          previousBearingRef.current,
          'closing',
          closingTargetMeters
        );
      } catch {
        // A closing location is a bonus from the environment. The journey
        // can still end at a safe nearby route point if OSM is unavailable.
      } finally {
        if (closingRequestId === routeRequestRef.current) {
          routePlanningRef.current = false;
          setIsPlanning(false);
        }
      }

      if (closingRequestId !== routeRequestRef.current || phaseRef.current !== 'closing') {
        return false;
      }

      if (bestOption) {
        registerRoute(bestOption);
        endPlaceLabelRef.current = bestOption.label ?? '附近的停留點';
        setEndPlaceLabel(endPlaceLabelRef.current);
        return true;
      }

      endPlaceLabelRef.current = '附近的停留點';
      setEndPlaceLabel(endPlaceLabelRef.current);
      const fallbackScale = closingTargetMeters / 175;
      const fallbackDestinations = buildShortRouteDestinations(
        origin,
        Date.now() + 404,
        previousBearingRef.current,
        journeyAnchorRef.current,
        fallbackScale
      );
      const fallbackPoint =
        fallbackDestinations[1] ??
        fallbackDestinations[0] ??
        origin;
      return planShortRoute(origin, 'closing', {
        point: fallbackPoint,
        label: '附近的停留點',
      });
    },
    [planShortRoute, registerRoute, setPhaseSafe, setTargetSafe]
  );

  const finishJourney = useCallback(
    async (reason: 'arrived' | 'time-limit' | 'manual') => {
      if (finishInFlightRef.current || phaseRef.current === 'finish') return;
      const finishRequestId = finishRequestRef.current + 1;
      finishRequestRef.current = finishRequestId;
      finishInFlightRef.current = true;
      stopWatchers();
      routeRequestRef.current += 1;
      setRouteSafe(null);
      setTargetSafe(null);

      const finishedAt = Date.now();
      const startedAt = startedAtRef.current ?? finishedAt;
      const durationSeconds = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
      const point = currentPointRef.current;
      const areaLabel = await resolveAreaLabel(point, playtestModeRef.current);
      if (finishRequestId !== finishRequestRef.current) return;

      const resolvedEndPlace = resolveV2CompletionPlace({
        reason,
        selectedEndPlace: endPlaceLabelRef.current,
        indoor: playtestModeRef.current === 'indoor',
      });
      endPlaceLabelRef.current = resolvedEndPlace;
      setEndPlaceLabel(resolvedEndPlace);

      const entry: PassportEntry = {
        id: `v2-${finishedAt}-${Math.random().toString(36).slice(2, 7)}`,
        completedAt: new Date(finishedAt).toISOString(),
        city: areaLabel,
        minutes: V2_MINUTES,
        moodId: 'v2',
        moodLabel: '自由探索',
        moodCode: 'V2_PLAYTEST',
        discoveries: discoveriesRef.current,
        route: traceRef.current,
        distanceMeters: getRouteDistance(traceRef.current),
        photoCount: photosRef.current.length,
        photos: photosRef.current,
        startedAt: new Date(startedAt).toISOString(),
        actualDurationMinutes: durationSeconds / 60,
        sceneName: resolvedEndPlace,
        threadLabel: reason,
        emojiTrail: emojiTrailRef.current,
        ticketSerial: ticketSerialRef.current,
      };

      const existingPassport = passportLoadedRef.current
        ? passportRef.current
        : await loadPassport();
      if (finishRequestId !== finishRequestRef.current) return;

      passportLoadedRef.current = true;
      const nextPassport = [entry, ...existingPassport];
      passportRef.current = nextPassport;
      await savePassport(nextPassport);
      if (finishRequestId !== finishRequestRef.current) return;

      setShareEntry(entry);
      setElapsedSeconds(durationSeconds);
      setStatusMessage(
        reason === 'time-limit'
          ? '15 分鐘到了。不是失敗，這趟就停在這裡。'
          : '這趟路留在票上了。'
      );
      setPhaseSafe('finish');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (finishRequestId === finishRequestRef.current) {
        finishInFlightRef.current = false;
      }
    },
    [loadPassport, savePassport, setPhaseSafe, setRouteSafe, setTargetSafe, stopWatchers]
  );

  const enterClosingIfNeeded = useCallback(
    (point: GeoPoint, currentElapsedSeconds: number) => {
      if (phaseRef.current !== 'exploration') return false;
      if (
        !shouldEnterV2Closing({
          elapsedSeconds: currentElapsedSeconds,
          discoveries: discoveriesRef.current,
        })
      ) {
        return false;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      void planClosingRoute(point, currentElapsedSeconds);
      return true;
    },
    [planClosingRoute]
  );

  const handleLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      if (!isUsableV2StartAccuracy(location.coords.accuracy)) {
        throw new Error('目前定位精度還不夠。請移到較開闊的位置後再試一次。');
      }

      const point: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      lastPointRef.current = point;
      currentPointRef.current = point;
      setCurrentPoint(point);
      setLightContext(getLightContext(point));

      const accuracy = location.coords.accuracy;
      const trustedGps = isTrustedV2GpsAccuracy(accuracy);
      const trustedPrevious = lastTrustedTracePointRef.current;
      const previousTrustedTimestamp = lastTrustedTraceTimestampRef.current;
      const trustedSegmentDistance = trustedPrevious
        ? distanceBetween(trustedPrevious, point)
        : 0;
      const trustedSegmentSeconds = previousTrustedTimestamp
        ? Math.max(0.25, (location.timestamp - previousTrustedTimestamp) / 1000)
        : 999;
      const plausibleMovement = isPlausibleV2MovementSample({
        distanceMeters: trustedSegmentDistance,
        elapsedSeconds: trustedSegmentSeconds,
        indoor: playtestModeRef.current === 'indoor',
      });
      const trustedForJourney = trustedGps && plausibleMovement;

      if (
        trustedForJourney &&
        (!trustedPrevious ||
          getDistanceInMeters(
            trustedPrevious.latitude,
            trustedPrevious.longitude,
            point.latitude,
            point.longitude
          ) >= 2)
      ) {
        traceRef.current = [...traceRef.current, point].slice(-800);
        setTrace(traceRef.current);
        if (trustedPrevious && trustedSegmentDistance >= 8) {
          previousBearingRef.current = bearingBetween(trustedPrevious, point);
        }
        lastTrustedTracePointRef.current = point;
        lastTrustedTraceTimestampRef.current = location.timestamp;
      }

      if (phaseRef.current !== 'exploration' && phaseRef.current !== 'closing') return;

      const route = routeStateRef.current;
      if (!route || routePlanningRef.current) return;

      const beat = route.navigationRoute.beats[route.beatIndex];
      if (!beat) return;

      const remaining = remainingDistanceOnPolyline(point, beat.segmentCoordinates);
      const offRouteDistance = distanceToPolyline(point, route.navigationRoute.coordinates);

      // Low-quality samples may move the visible dot, but they must never
      // advance a beat, trigger a reroute, or finish the Journey.
      if (!trustedForJourney) {
        offRouteSamplesRef.current = 0;
        offRouteCandidateRef.current = null;
        return;
      }

      if (offRouteDistance > 75) {
        const previousOffRouteCandidate = offRouteCandidateRef.current;
        const spatiallyConsistent = isSpatiallyConsistentOffRouteSample({
          previous: previousOffRouteCandidate,
          current: point,
          distanceMeters: distanceBetween,
        });

        if (!spatiallyConsistent) {
          offRouteCandidateRef.current = point;
          offRouteSamplesRef.current = 1;
          return;
        }

        offRouteCandidateRef.current = point;
        offRouteSamplesRef.current += 1;
        if (offRouteSamplesRef.current < OFF_ROUTE_CONFIRMATIONS) return;

        offRouteSamplesRef.current = 0;
        offRouteCandidateRef.current = null;
        const closingDestination = route.purpose === 'closing'
          ? {
              point: route.destination,
              label: route.label ?? endPlaceLabelRef.current ?? '附近的停留點',
            }
          : undefined;
        void planShortRoute(point, route.purpose, closingDestination);
        return;
      }

      offRouteSamplesRef.current = 0;
      offRouteCandidateRef.current = null;
      if (remaining > 14) return;

      const isLastBeat = route.beatIndex >= route.navigationRoute.beats.length - 1;
      if (!isLastBeat) {
        const next = { ...route, beatIndex: route.beatIndex + 1 };
        routeStateRef.current = next;
        setRouteState(next);
        const nextTurn = next.navigationRoute.beats[next.beatIndex]?.turn;
        if (
          nextTurn === 'left' ||
          nextTurn === 'right' ||
          nextTurn === 'slight-left' ||
          nextTurn === 'slight-right'
        ) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        return;
      }

      if (route.purpose === 'closing') {
        void finishJourney('arrived');
        return;
      }

      // Reaching the end of a short segment does not end the journey. The
      // current target remains active and the next short segment begins from
      // the player's actual location.
      void planShortRoute(point, 'exploration');
    },
    [finishJourney, planShortRoute]
  );

  const startWatchers = useCallback(async () => {
    stopWatchers();
    const generation = watcherGenerationRef.current;

    try {
      const headingWatcher = await Location.watchHeadingAsync((nextHeading) => {
        const value = nextHeading.trueHeading >= 0 ? nextHeading.trueHeading : nextHeading.magHeading;
        if (Number.isFinite(value)) setHeading(value);
      });
      if (generation !== watcherGenerationRef.current) {
        headingWatcher.remove();
        return false;
      }
      headingWatcherRef.current = headingWatcher;
    } catch {
      // A route still works without a compass heading.
    }

    if (generation !== watcherGenerationRef.current) return false;

    try {
      const locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        handleLocationUpdate
      );
      if (generation !== watcherGenerationRef.current) {
        locationWatcher.remove();
        return false;
      }
      locationWatcherRef.current = locationWatcher;
      return true;
    } catch {
      if (generation === watcherGenerationRef.current) {
        stopWatchers();
        setErrorMessage('定位追蹤暫時中斷。回到 App 後會再嘗試連線。');
      }
      return false;
    }
  }, [handleLocationUpdate, stopWatchers]);

  const chooseNextTarget = useCallback(
    (
      lastTargetSeconds: number | null,
      lastTargetDifficulty?: V2TargetDifficulty
    ) => {
      const difficulty = targetDifficultyForNext({
        discoveries: discoveriesRef.current,
        lastTargetSeconds,
        lastTargetDifficulty,
      });
      const target = chooseV2Target({
        difficulty,
        excludedIds: previousTargetIdsRef.current,
        excludedEmojis: emojiTrailRef.current,
        environmentKinds: environmentKindsRef.current,
        seed: Date.now() + discoveriesRef.current * 17,
      });
      previousTargetIdsRef.current = [...previousTargetIdsRef.current, target.id].slice(-8);
      setTargetSafe(target);
      return target;
    },
    [setTargetSafe]
  );

  const startJourney = useCallback(async (mode: V2PlaytestMode = 'live') => {
    if (phaseRef.current !== 'home' && phaseRef.current !== 'finish') return;
    setPlaytestModeSafe(mode);
    setPhaseSafe('starting');
    setErrorMessage(null);
    setStatusMessage(
      mode === 'indoor'
        ? '室內測試：按下模擬走路，推進這趟旅程。'
        : '正在找一條適合先走的小段。'
    );
    const nextTicketSerial = makeTicketSerial();
    ticketSerialRef.current = nextTicketSerial;
    setTicketSerial(nextTicketSerial);
    setEmojiTrail([]);
    emojiTrailRef.current = [];
    setPhotos([]);
    photosRef.current = [];
    setShareEntry(null);
    cameraRequestIdRef.current = null;
    await removeStored(CAMERA_RESULT_KEY).catch(() => undefined);
    setTrace([]);
    traceRef.current = [];
    setDiscoveries(0);
    discoveriesRef.current = 0;
    setElapsedSeconds(0);
    previousTargetIdsRef.current = [];
    previousRouteCoordinatesRef.current = [];
    previousBearingRef.current = null;
    environmentRequestRef.current += 1;
    environmentKindsRef.current = [];
    journeyAnchorRef.current = null;
    endPlaceLabelRef.current = null;
    setEndPlaceLabel(null);
    finishRequestRef.current += 1;
    finishInFlightRef.current = false;
    indoorRouteProgressRef.current = 0;
    offRouteSamplesRef.current = 0;
    offRouteCandidateRef.current = null;
    lastTrustedTracePointRef.current = null;
    lastTrustedTraceTimestampRef.current = null;
    stopWatchers();
    routeRequestRef.current += 1;
    routePlanningRef.current = false;
    setRouteSafe(null);

    if (mode === 'indoor') {
      const point = INDOOR_START_POINT;
      currentPointRef.current = point;
      journeyAnchorRef.current = point;
      lastPointRef.current = point;
      lastTrustedTracePointRef.current = point;
      lastTrustedTraceTimestampRef.current = Date.now();
      traceRef.current = [point];
      setCurrentPoint(point);
      setTrace([point]);
      setLightContext(getLightContext(point));
      startedAtRef.current = Date.now();
      setPhaseSafe('exploration');
      chooseNextTarget(null);

      const routed = await planShortRoute(point, 'exploration');
      if (!routed) {
        setPhaseSafe('home');
        return;
      }

      setStatusMessage('室內測試：按下「走 35m」推進。');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setErrorMessage('需要位置權限，Detour 才能從你現在的位置安排下一小段。');
      setPhaseSafe('home');
      return;
    }

    try {
      const location = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        10000,
        '定位逾時，請確認定位服務後再試一次。'
      );
      const point: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      currentPointRef.current = point;
      journeyAnchorRef.current = point;
      lastPointRef.current = point;
      lastTrustedTracePointRef.current = point;
      lastTrustedTraceTimestampRef.current = location.timestamp;
      traceRef.current = [point];
      setCurrentPoint(point);
      setTrace([point]);
      setLightContext(getLightContext(point));
      startedAtRef.current = Date.now();
      setPhaseSafe('exploration');
      chooseNextTarget(null);
      void refreshEnvironmentHints(point);
      const watchersStarted = await startWatchers();
      if (!watchersStarted) {
        setPhaseSafe('home');
        return;
      }
      const routed = await planShortRoute(point, 'exploration');
      if (!routed) {
        stopWatchers();
        setPhaseSafe('home');
        return;
      }
      setStatusMessage('沿這段路找找看。');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      stopWatchers();
      setErrorMessage(error instanceof Error ? error.message : '目前位置讀取失敗。');
      setPhaseSafe('home');
    }
  }, [
    chooseNextTarget,
    planShortRoute,
    refreshEnvironmentHints,
    setPhaseSafe,
    setPlaytestModeSafe,
    startWatchers,
    stopWatchers,
  ]);

  const startIndoorJourney = useCallback(() => {
    void startJourney('indoor');
  }, [startJourney]);

  const markFound = useCallback(async () => {
    const target = activeTargetRef.current;
    const currentPhase = phaseRef.current;
    if (
      !target ||
      (currentPhase !== 'exploration' && currentPhase !== 'closing')
    ) {
      return;
    }

    const targetSeconds = targetStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - targetStartedAtRef.current) / 1000))
      : null;
    const nextTrail = [...emojiTrailRef.current, target.emoji];
    emojiTrailRef.current = nextTrail;
    setEmojiTrail(nextTrail);
    discoveriesRef.current += 1;
    setDiscoveries(discoveriesRef.current);
    setTargetSafe(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (currentPhase === 'closing') {
      setStatusMessage('最後一個也留在票上了。繼續最後一段。');
      return;
    }

    setStatusMessage('留在票上了。下一段正在形成。');
    const point = currentPointRef.current;
    const elapsed = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
    if (point && enterClosingIfNeeded(point, elapsed)) return;

    chooseNextTarget(targetSeconds, target.difficulty);
    if (point) {
      // Finding something is the authoritative moment for the next segment.
      // Cancel any older reroute that may still be resolving and form the next
      // short route from the player's position at the moment they tapped.
      routeRequestRef.current += 1;
      routePlanningRef.current = false;
      setIsPlanning(false);
      void refreshEnvironmentHints(point);
      void planShortRoute(point, 'exploration');
    }
  }, [chooseNextTarget, enterClosingIfNeeded, planShortRoute, refreshEnvironmentHints, setTargetSafe]);

  const replaceTarget = useCallback(() => {
    if (
      (phaseRef.current !== 'exploration' && phaseRef.current !== 'closing') ||
      !activeTargetRef.current
    ) {
      return;
    }
    const difficulty =
      phaseRef.current === 'closing'
        ? 'easy'
        : replacementDifficultyForV2(activeTargetRef.current.difficulty);
    const target = chooseV2Target({
      difficulty,
      excludedIds: previousTargetIdsRef.current,
      excludedEmojis: emojiTrailRef.current,
      environmentKinds: environmentKindsRef.current,
      seed: Date.now() + previousTargetIdsRef.current.length * 31,
    });
    previousTargetIdsRef.current = [...previousTargetIdsRef.current, target.id].slice(-8);
    setTargetSafe(target);
    setStatusMessage('換一個，繼續走。');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [setTargetSafe]);

  const retryCurrentRoute = useCallback(async () => {
    const point = currentPointRef.current;
    const currentPhase = phaseRef.current;
    if (!point || (currentPhase !== 'exploration' && currentPhase !== 'closing')) {
      return false;
    }

    if (
      playtestModeRef.current === 'live' &&
      AppState.currentState === 'active'
    ) {
      const watchersReady = await startWatchers();
      if (!watchersReady) return false;
    }

    const currentRoute = routeStateRef.current;
    if (currentPhase === 'closing' && !currentRoute) {
      const currentElapsedSeconds = startedAtRef.current
        ? Math.max(0, (Date.now() - startedAtRef.current) / 1000)
        : CLOSING_START_SECONDS;
      return planClosingRoute(point, currentElapsedSeconds);
    }

    const closingDestination = currentPhase === 'closing' && currentRoute
      ? {
          point: currentRoute.destination,
          label: currentRoute.label ?? endPlaceLabelRef.current ?? '附近的停留點',
        }
      : undefined;

    return planShortRoute(point, currentPhase, closingDestination);
  }, [planClosingRoute, planShortRoute, startWatchers]);

  const simulateIndoorStep = useCallback(
    (distanceMeters = 35) => {
      if (playtestModeRef.current !== 'indoor') return;
      if (phaseRef.current !== 'exploration' && phaseRef.current !== 'closing') return;

      const route = routeStateRef.current;
      if (!route) return;

      const nextProgress = indoorRouteProgressRef.current + distanceMeters;
      const point = pointAlongPolyline(
        route.navigationRoute.coordinates,
        nextProgress
      );
      if (!point) return;

      indoorRouteProgressRef.current = nextProgress;
      handleLocationUpdate({
        coords: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: 0,
          accuracy: 5,
          altitudeAccuracy: 5,
          heading: heading,
          speed: 1.25,
        },
        timestamp: Date.now(),
      });
    },
    [handleLocationUpdate, heading]
  );

  const simulateIndoorStepToEnd = useCallback(() => {
    if (playtestModeRef.current !== 'indoor') return;
    if (phaseRef.current !== 'exploration' && phaseRef.current !== 'closing') return;

    const route = routeStateRef.current;
    if (!route) return;

    const remainingBeats = route.navigationRoute.beats.slice(route.beatIndex);
    for (const beat of remainingBeats) {
      const point =
        beat.segmentCoordinates[beat.segmentCoordinates.length - 1] ??
        route.destination;
      handleLocationUpdate({
        coords: {
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: 0,
          accuracy: 5,
          altitudeAccuracy: 5,
          heading: beat.bearingDegrees,
          speed: 1.25,
        },
        timestamp: Date.now(),
      });
    }

    // The final beat may synchronously register the next short route, which
    // resets indoorRouteProgressRef to zero. Do not overwrite that reset with
    // the completed route's old distance.
  }, [handleLocationUpdate]);

  const simulateIndoorDeviation = useCallback((distanceMeters = 100) => {
    if (playtestModeRef.current !== 'indoor') return;
    if (phaseRef.current !== 'exploration' && phaseRef.current !== 'closing') return;

    const point = currentPointRef.current;
    const route = routeStateRef.current;
    if (!point || !route) return;

    const bearing =
      route.navigationRoute.beats[route.beatIndex]?.bearingDegrees ?? heading;
    const deviated = indoorDeviationPoint(point, bearing, distanceMeters);
    const simulatedLocation: Location.LocationObject = {
      coords: {
        latitude: deviated.latitude,
        longitude: deviated.longitude,
        altitude: 0,
        accuracy: 5,
        altitudeAccuracy: 5,
        heading: bearing,
        speed: 1.25,
      },
      timestamp: Date.now(),
    };
    handleLocationUpdate(simulatedLocation);
    handleLocationUpdate({
      ...simulatedLocation,
      timestamp: simulatedLocation.timestamp + 250,
    });
    setStatusMessage(
      distanceMeters > 420
        ? '室內測試：已遠偏離，下一段應逐步往原探索區彎回，但不要求原路返回。'
        : '室內測試：已模擬偏離，觀察是否從目前位置重新安排。'
    );
  }, [handleLocationUpdate, heading]);

  const simulateIndoorFastForward = useCallback(
    (seconds: number) => {
      if (playtestModeRef.current !== 'indoor') return;
      const nextElapsed = Math.max(0, seconds);
      startedAtRef.current = Date.now() - nextElapsed * 1000;
      setElapsedSeconds(nextElapsed);

      const point = currentPointRef.current;
      if (nextElapsed >= MAX_JOURNEY_SECONDS) {
        setStatusMessage('室內測試：已到 15:00，驗證 Forced Finish。');
        void finishJourney('time-limit');
      } else if (point && phaseRef.current === 'exploration') {
        const enteredClosing = enterClosingIfNeeded(point, nextElapsed);
        if (!enteredClosing && nextElapsed >= CLOSING_START_SECONDS) {
          setStatusMessage(
            `室內測試：${Math.floor(nextElapsed / 60)}:${String(nextElapsed % 60).padStart(2, '0')}，目前 ${discoveriesRef.current} 個發現；未滿 3 個時應維持 Exploration。`
          );
        }
      }
    },
    [enterClosingIfNeeded, finishJourney]
  );

  const simulateIndoorTargetAge = useCallback((seconds = 120) => {
    if (playtestModeRef.current !== 'indoor' || !activeTargetRef.current) return;
    targetStartedAtRef.current = Date.now() - Math.max(1, seconds) * 1000;
    setStatusMessage(`室內測試：目前題目已模擬尋找 ${Math.round(seconds)} 秒；按「找到了」後下一題應依節奏調整難度。`);
  }, []);

  const simulateIndoorFinish = useCallback(() => {
    if (playtestModeRef.current !== 'indoor') return;
    void finishJourney('manual');
  }, [finishJourney]);

  const openCamera = useCallback(() => {
    const requestId = `v2-free-${Date.now()}`;
    cameraRequestIdRef.current = requestId;
    router.push({
      pathname: '/camera',
      params: {
        requestId,
        source: 'free',
        missionCode: 'V2 FREE FRAME',
        missionTitle: '想留就留。這張會留在這趟票裡。',
      },
    });
  }, [router]);

  const consumeCameraResult = useCallback(async () => {
    const result = await readStored(CAMERA_RESULT_KEY, isCameraRouteResult);
    if (!result || result.source !== 'free') return;

    const expectedRequestId = cameraRequestIdRef.current;
    if (!expectedRequestId || result.requestId !== expectedRequestId) {
      // A free-camera result from an older route must never leak into the
      // current V2 Journey.
      await removeStored(CAMERA_RESULT_KEY).catch(() => undefined);
      return;
    }

    const nextPhotos = [...photosRef.current, result.photo];
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    cameraRequestIdRef.current = null;
    await removeStored(CAMERA_RESULT_KEY).catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void consumeCameraResult();

      if (
        playtestModeRef.current === 'live' &&
        (phaseRef.current === 'exploration' || phaseRef.current === 'closing') &&
        AppState.currentState === 'active'
      ) {
        void startWatchers();
      }

      return () => {
        stopWatchers();
      };
    }, [consumeCameraResult, startWatchers, stopWatchers])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        stopWatchers();
        return;
      }

      if (playtestModeRef.current !== 'live') return;
      if (phaseRef.current !== 'exploration' && phaseRef.current !== 'closing') return;
      void startWatchers();
    });

    return () => {
      subscription.remove();
      stopWatchers();
      routeRequestRef.current += 1;
      routePlanningRef.current = false;
      finishRequestRef.current += 1;
      finishInFlightRef.current = false;
      environmentRequestRef.current += 1;
      cameraRequestIdRef.current = null;
    };
  }, [startWatchers, stopWatchers]);

  const openHistory = useCallback(() => {
    setHistoryDetail(null);
    setPhaseSafe('history');
  }, [setPhaseSafe]);

  const showHistoryEntry = useCallback((entry: PassportEntry | null) => {
    setHistoryDetail(entry);
  }, []);

  const openCurrentShare = useCallback(() => {
    if (!shareEntry) return;
    shareReturnPhaseRef.current = 'finish';
    setPhaseSafe('share');
  }, [setPhaseSafe, shareEntry]);

  const openHistoryShare = useCallback((entry: PassportEntry) => {
    setShareEntry(entry);
    shareReturnPhaseRef.current = 'history';
    setPhaseSafe('share');
  }, [setPhaseSafe]);

  const closeShare = useCallback(() => {
    setPhaseSafe(shareReturnPhaseRef.current);
  }, [setPhaseSafe]);

  const performShare = useCallback(async () => {
    if (!shareEntry) return;
    const emojis = shareEntry.emojiTrail?.join(' ') || '—';
    const place = shareEntry.sceneName ?? shareEntry.city;
    const photo = shareEntry.photos?.[0];
    await Share.share({
      title: '我的 Detour',
      message: `DETOUR · ${emojis}\n${place}\n${shareEntry.discoveries} 個發現`,
      ...(photo?.uri ? { url: photo.uri } : {}),
    });
  }, [shareEntry]);

  const goHome = useCallback(() => {
    stopWatchers();
    routeRequestRef.current += 1;
    routePlanningRef.current = false;
    setRouteSafe(null);
    setHistoryDetail(null);
    setShareEntry(null);
    cameraRequestIdRef.current = null;
    finishRequestRef.current += 1;
    finishInFlightRef.current = false;
    environmentRequestRef.current += 1;
    environmentKindsRef.current = [];
    setErrorMessage(null);
    setStatusMessage('');
    setPlaytestModeSafe('live');
    setPhaseSafe('home');
  }, [setPhaseSafe, setPlaytestModeSafe, setRouteSafe, stopWatchers]);

  useEffect(() => {
    passportRef.current = passport;
  }, [passport]);

  useEffect(() => {
    passportLoadedRef.current = passportLoaded;
  }, [passportLoaded]);

  useEffect(() => {
    if (!passportLoaded) void loadPassport();
  }, [loadPassport, passportLoaded]);

  useEffect(() => {
    if (phase !== 'exploration' && phase !== 'closing') return;
    const timer = setInterval(() => {
      if (!startedAtRef.current) return;
      const nextElapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSeconds(nextElapsed);

      const point = currentPointRef.current;
      if (shouldForceV2Finish(nextElapsed)) {
        void finishJourney('time-limit');
        return;
      }

      if (phaseRef.current === 'exploration' && point) {
        enterClosingIfNeeded(point, nextElapsed);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [enterClosingIfNeeded, finishJourney, phase]);

  const currentNavigationBeat = routeState
    ? routeState.navigationRoute.beats[routeState.beatIndex] ?? null
    : null;

  const routeCoordinates = useMemo(
    () => routeState?.navigationRoute.coordinates ?? [],
    [routeState]
  );

  const currentRouteRemainingSeconds = useMemo(() => {
    if (!routeState) return null;

    const trustedPoint = trace[trace.length - 1] ?? currentPoint;
    if (!trustedPoint) return null;

    const remainingMeters = remainingDistanceOnPolyline(
      trustedPoint,
      routeState.navigationRoute.coordinates
    );
    const totalMeters = Math.max(1, routeState.walkingRoute.distanceMeters);
    const totalSeconds = Math.max(1, routeState.walkingRoute.durationSeconds);
    const ratio = Math.max(0, Math.min(1, remainingMeters / totalMeters));
    return Math.max(0, Math.round(totalSeconds * ratio));
  }, [currentPoint, routeState, trace]);

  const walkedDistanceMeters = useMemo(
    () => Math.round(getRouteDistance(trace)),
    [trace]
  );

  const indoorDiagnostics = useMemo(() => {
    if (playtestMode !== 'indoor') return null;

    const anchor = journeyAnchorRef.current;
    const distanceFromAnchorMeters =
      anchor && currentPoint
        ? Math.round(distanceBetween(anchor, currentPoint))
        : 0;
    const routeDistanceMeters = routeState
      ? Math.round(routeState.walkingRoute.distanceMeters)
      : 0;

    const routeStartDistanceFromAnchor =
      anchor && routeState
        ? distanceBetween(anchor, routeState.origin)
        : null;
    const routeEndDistanceFromAnchor =
      anchor && routeState
        ? distanceBetween(anchor, routeState.destination)
        : null;
    const rubberBandActive =
      routeStartDistanceFromAnchor !== null &&
      routeStartDistanceFromAnchor > 420;
    const rubberBandReturning =
      rubberBandActive &&
      routeEndDistanceFromAnchor !== null &&
      routeEndDistanceFromAnchor < routeStartDistanceFromAnchor;

    return {
      distanceFromAnchorMeters,
      routeDistanceMeters,
      routePurpose: routeState?.purpose ?? null,
      rubberBandActive,
      rubberBandReturning,
    };
  }, [currentPoint, playtestMode, routeState]);

  const startOver = useCallback(() => {
    void startJourney(playtestModeRef.current);
  }, [startJourney]);

  return {
    phase,
    playtestMode,
    isIndoorMode: playtestMode === 'indoor',
    passport,
    currentPoint,
    heading,
    lightContext,
    routeState,
    routeCoordinates,
    currentNavigationBeat,
    currentRouteRemainingSeconds,
    walkedDistanceMeters,
    indoorDiagnostics,
    activeTarget,
    emojiTrail,
    photos,
    trace,
    discoveries,
    elapsedSeconds,
    isPlanning,
    statusMessage,
    errorMessage,
    endPlaceLabel,
    ticketSerial,
    historyDetail,
    shareEntry,
    startJourney,
    startIndoorJourney,
    startOver,
    simulateIndoorStep,
    simulateIndoorStepToEnd,
    simulateIndoorDeviation,
    simulateIndoorFastForward,
    simulateIndoorTargetAge,
    simulateIndoorFinish,
    markFound,
    replaceTarget,
    retryCurrentRoute,
    openCamera,
    openHistory,
    showHistoryEntry,
    openCurrentShare,
    openHistoryShare,
    closeShare,
    performShare,
    goHome,
    finishJourney,
  };
}
