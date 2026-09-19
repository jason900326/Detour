import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import * as Haptics from 'expo-haptics';

import type { GeoPoint } from '../lib/journey-engine';
import type { NavigationRoute } from '../lib/navigation-engine';
import type { Stage } from '../lib/app-model';
import { getDistanceInMeters } from '../lib/geo-utils';

type Args = {
  navigationRouteRef: MutableRefObject<NavigationRoute | null>;
  navigationBeatIndexRef: MutableRefObject<number>;
  beatRemainingMetersRef: MutableRefObject<number>;
  checkpointLockedRef: MutableRefObject<boolean>;
  setLatitude: (value: number) => void;
  setLongitude: (value: number) => void;
  setNavigationBeatIndex: (index: number) => void;
  setBeatRemainingMeters: (meters: number) => void;
  setShowNextBeatMap: (show: boolean) => void;
  setActiveTrace: Dispatch<SetStateAction<GeoPoint[]>>;
  setQuestPulse: (value: 'side' | 'final' | null) => void;
  transitionTo: (next: Stage, beforeEnter?: () => void) => void;
};

/**
 * Owns navigation beat advancement and the final-beat arrival transition.
 * GPS sampling and reroute decisions stay in the home controller.
 */
export function useNavigationBeatController(args: Args) {
  const setBeat = useCallback(
    (index: number) => {
      const route = args.navigationRouteRef.current;
      if (!route) return false;

      const beat = route.beats[index];
      if (!beat) return false;

      args.setNavigationBeatIndex(index);
      args.navigationBeatIndexRef.current = index;
      args.setBeatRemainingMeters(beat.segmentDistanceMeters);
      args.beatRemainingMetersRef.current = beat.segmentDistanceMeters;
      args.setShowNextBeatMap(false);
      return true;
    },
    [args]
  );

  const reachCurrentNavigationBeat = useCallback(async () => {
    if (args.checkpointLockedRef.current) return;

    const route = args.navigationRouteRef.current;
    if (!route) return;

    const beatIndex = args.navigationBeatIndexRef.current;
    const beat = route.beats[beatIndex];
    if (!beat) return;

    args.checkpointLockedRef.current = true;
    args.setLatitude(beat.point.latitude);
    args.setLongitude(beat.point.longitude);
    args.setBeatRemainingMeters(0);
    args.beatRemainingMetersRef.current = 0;

    args.setActiveTrace((trace) => {
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
      args.setQuestPulse('final');
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 720));
      args.setQuestPulse(null);
      args.checkpointLockedRef.current = false;
      args.transitionTo('arrival');
      return;
    }

    await Haptics.selectionAsync();
    setBeat(beatIndex + 1);
    args.checkpointLockedRef.current = false;
  }, [args, setBeat]);

  return {
    setBeat,
    reachCurrentNavigationBeat,
  };
}
