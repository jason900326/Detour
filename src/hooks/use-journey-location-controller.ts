import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import type { Stage } from '../lib/app-model';
import type { GeoPoint } from '../lib/journey-engine';
import type { NavigationRoute } from '../lib/navigation-engine';
import { getDistanceInMeters } from '../lib/geo-utils';
import { measureMovementSample } from '../lib/location-trace-logic';
import { evaluateReroute } from '../lib/reroute-logic';
import {
  distanceToPolyline,
  remainingDistanceOnPolyline,
} from '../lib/navigation-engine';

type Args = {
  stageRef: MutableRefObject<Stage>;
  lastTracePointRef: MutableRefObject<GeoPoint | null>;
  lastMovementSampleAtRef: MutableRefObject<number | null>;
  effectiveMovingSecondsRef: MutableRefObject<number>;
  traveledMetersRef: MutableRefObject<number>;
  navigationRouteRef: MutableRefObject<NavigationRoute | null>;
  navigationBeatIndexRef: MutableRefObject<number>;
  beatRemainingMetersRef: MutableRefObject<number>;
  offRouteCountRef: MutableRefObject<number>;
  rerouteInFlightRef: MutableRefObject<boolean>;
  setLatitude: (value: number) => void;
  setLongitude: (value: number) => void;
  setDeviceHeading: (value: number) => void;
  setActiveTrace: Dispatch<SetStateAction<GeoPoint[]>>;
  setTraveledMeters: (value: number) => void;
  setBeatRemainingMeters: (value: number) => void;
  rerouteFromCurrentPosition: (currentPoint: GeoPoint) => Promise<void>;
  maybeTriggerSideEvent: (currentPoint: GeoPoint) => void;
  reachCurrentNavigationBeat: () => Promise<void>;
};

/**
 * Owns the position/heading callback boundary. Route policy and side-event
 * selection remain injected so this hook does not own product decisions.
 */
export function useJourneyLocationController(args: Args) {
  const turnReminderBeatIdRef = useRef<string | null>(null);

  const handleHeadingUpdate = useCallback(
    (heading: Location.LocationHeadingObject) => {
      const value =
        heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
      if (Number.isFinite(value)) args.setDeviceHeading(value);
    },
    [args]
  );

  const handleLocationUpdate = useCallback(
    (newLocation: Location.LocationObject) => {
      const nextPoint: GeoPoint = {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
      };
      const sampleAt = newLocation.timestamp || Date.now();
      const previousSampleAt = args.lastMovementSampleAtRef.current;
      args.lastMovementSampleAtRef.current = sampleAt;

      args.setLatitude(nextPoint.latitude);
      args.setLongitude(nextPoint.longitude);

      const previous = args.lastTracePointRef.current;
      args.lastTracePointRef.current = nextPoint;

      if (!previous) {
        args.setActiveTrace((trace) => [...trace, nextPoint]);
        return;
      }

      const movement = measureMovementSample({
        previous,
        next: nextPoint,
        previousSampleAt,
        sampleAt,
        distanceMeters: (from, to) =>
          getDistanceInMeters(
            from.latitude,
            from.longitude,
            to.latitude,
            to.longitude
          ),
      });

      if (!movement) return;
      args.effectiveMovingSecondsRef.current += movement.sampleSeconds;

      args.setActiveTrace((trace) =>
        trace.length >= 700 ? trace : [...trace, nextPoint]
      );

      if (args.stageRef.current !== 'journey') return;

      const nextTraveled =
        args.traveledMetersRef.current + movement.movedMeters;
      args.traveledMetersRef.current = nextTraveled;
      args.setTraveledMeters(nextTraveled);

      const route = args.navigationRouteRef.current;
      const beat = route?.beats[args.navigationBeatIndexRef.current] ?? null;
      if (!route || !beat) return;

      const remainingOnBeat = remainingDistanceOnPolyline(
        nextPoint,
        beat.segmentCoordinates
      );
      args.setBeatRemainingMeters(remainingOnBeat);
      args.beatRemainingMetersRef.current = remainingOnBeat;

      const shouldRemindForTurn =
        ['left', 'right', 'slight-left', 'slight-right', 'arrive'].includes(
          beat.turn
        ) &&
        remainingOnBeat > 12 &&
        remainingOnBeat <= 30 &&
        turnReminderBeatIdRef.current !== beat.id;

      if (shouldRemindForTurn) {
        turnReminderBeatIdRef.current = beat.id;
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning
        );
      }

      const rerouteCheck = evaluateReroute({
        offRouteDistanceMeters: distanceToPolyline(nextPoint, route.coordinates),
        gpsAccuracyMeters: newLocation.coords.accuracy ?? 0,
        offRouteCount: args.offRouteCountRef.current,
        rerouteInFlight: args.rerouteInFlightRef.current,
      });
      args.offRouteCountRef.current = rerouteCheck.nextOffRouteCount;

      if (rerouteCheck.shouldReroute) {
        args.offRouteCountRef.current = 0;
        void args.rerouteFromCurrentPosition(nextPoint);
        return;
      }

      args.maybeTriggerSideEvent(nextPoint);

      if (remainingOnBeat <= 12) {
        void args.reachCurrentNavigationBeat();
      }
    },
    [args]
  );

  return {
    handleHeadingUpdate,
    handleLocationUpdate,
  };
}
