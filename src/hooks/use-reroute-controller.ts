import { useCallback, useRef, type MutableRefObject } from 'react';
import * as Haptics from 'expo-haptics';

import type {
  GeoPoint,
  JourneyPlan,
  LightContext,
} from '../lib/journey-engine';
import {
  buildNavigationRouteFromPolyline,
  type NavigationRoute,
} from '../lib/navigation-engine';
import type { SceneCandidate } from '../lib/scene-engine';
import {
  fetchWalkingRoute,
  type WalkingRoute,
} from '../lib/routing-engine';

type Args = {
  devMode: boolean;
  routeContext: LightContext;
  planRef: MutableRefObject<JourneyPlan | null>;
  selectedSceneRef: MutableRefObject<SceneCandidate | null>;
  offRouteCountRef: MutableRefObject<number>;
  rerouteCountRef: MutableRefObject<number>;
  navigationRouteRef: MutableRefObject<NavigationRoute | null>;
  navigationBeatIndexRef: MutableRefObject<number>;
  beatRemainingMetersRef: MutableRefObject<number>;
  setIsRerouting: (value: boolean) => void;
  setRerouteFailed: (value: boolean) => void;
  setWalkingRoute: (route: WalkingRoute) => void;
  setNavigationRoute: (route: NavigationRoute) => void;
  setNavigationBeatIndex: (index: number) => void;
  setBeatRemainingMeters: (meters: number) => void;
  setShowNextBeatMap: (show: boolean) => void;
  setRerouteCount: (count: number) => void;
};

/**
 * Owns the reroute request and state transition. The controller still owns
 * when a reroute is requested; this hook owns what a request does.
 */
export function useRerouteController(args: Args) {
  const rerouteInFlightRef = useRef(false);

  const rerouteFromCurrentPosition = useCallback(
    async (currentPoint: GeoPoint) => {
      if (rerouteInFlightRef.current || args.devMode) return;

      const scene = args.selectedSceneRef.current;
      if (!scene || !args.planRef.current) return;

      rerouteInFlightRef.current = true;
      args.setIsRerouting(true);
      args.setRerouteFailed(false);

      try {
        const nextWalkingRoute = await fetchWalkingRoute(
          currentPoint,
          scene.point,
          undefined,
          { context: args.routeContext }
        );
        const nextNavigationRoute = buildNavigationRouteFromPolyline({
          coordinates: nextWalkingRoute.coordinates,
          totalDistanceMeters: nextWalkingRoute.distanceMeters,
          durationSeconds: nextWalkingRoute.durationSeconds,
        });

        if (nextNavigationRoute.beats.length < 1) {
          throw new Error('No reroute beats');
        }

        args.setWalkingRoute(nextWalkingRoute);
        args.setNavigationRoute(nextNavigationRoute);
        args.navigationRouteRef.current = nextNavigationRoute;
        args.setNavigationBeatIndex(0);
        args.navigationBeatIndexRef.current = 0;

        const firstDistance =
          nextNavigationRoute.beats[0]?.segmentDistanceMeters ?? 0;
        args.setBeatRemainingMeters(firstDistance);
        args.beatRemainingMetersRef.current = firstDistance;
        args.setShowNextBeatMap(false);
        args.offRouteCountRef.current = 0;

        const nextCount = args.rerouteCountRef.current + 1;
        args.rerouteCountRef.current = nextCount;
        args.setRerouteCount(nextCount);

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {
        args.setRerouteFailed(true);
        args.offRouteCountRef.current = 0;
      } finally {
        args.setIsRerouting(false);
        rerouteInFlightRef.current = false;
      }
    },
    [args]
  );

  return {
    rerouteInFlightRef,
    rerouteFromCurrentPosition,
  };
}
