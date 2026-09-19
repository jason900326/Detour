import { useCallback, type MutableRefObject } from 'react';
import * as Haptics from 'expo-haptics';

import type { Stage } from '../lib/app-model';
import type {
  GeoPoint,
  JourneyPlan,
  MoodId,
  SideEvent,
  SideEventGaze,
} from '../lib/journey-engine';
import { pickSideEvent } from '../lib/journey-engine';
import type { NavigationRoute } from '../lib/navigation-engine';
import { remainingDistanceOnPolyline } from '../lib/navigation-engine';

type Args = {
  selectedMood: MoodId | null;
  stageRef: MutableRefObject<Stage>;
  planRef: MutableRefObject<JourneyPlan | null>;
  lastMovementSampleAtRef: MutableRefObject<number | null>;
  navigationRouteRef: MutableRefObject<NavigationRoute | null>;
  navigationBeatIndexRef: MutableRefObject<number>;
  beatRemainingMetersRef: MutableRefObject<number>;
  effectiveMovingSecondsRef: MutableRefObject<number>;
  activeSideEventRef: MutableRefObject<SideEvent | null>;
  sideEventSlotRef: MutableRefObject<number>;
  sideEventsShownRef: MutableRefObject<number>;
  sideEventReplacementsRef: MutableRefObject<number>;
  sideEventSeenIdsRef: MutableRefObject<Set<string>>;
  previousSideEventGazeRef: MutableRefObject<SideEventGaze | null>;
  setActiveSideEvent: (event: SideEvent | null) => void;
  setSideEventPhotoConfirmed: (confirmed: boolean) => void;
  setSideEventSlot: (slot: number) => void;
  setSideEventsShown: (count: number) => void;
  setSideEventReplacements: (count: number) => void;
};

type PresentOptions = {
  advanceSlot?: boolean;
  countAsReplacement?: boolean;
};

/**
 * Owns side-event cadence and the single active-event lifecycle. Navigation
 * supplies location timing; camera results still update photo confirmation.
 */
export function useSideEventController(args: Args) {
  const presentSideEvent = useCallback(
    (options?: PresentOptions) => {
      const currentPlan = args.planRef.current;
      if (!currentPlan || args.selectedMood === 'color') return null;

      const next = pickSideEvent({
        seenIds: args.sideEventSeenIdsRef.current,
        previousGaze: args.previousSideEventGazeRef.current,
      });

      if (!next) return null;

      args.sideEventSeenIdsRef.current.add(next.id);
      args.previousSideEventGazeRef.current = next.gaze;
      args.activeSideEventRef.current = next;
      args.setActiveSideEvent(next);
      args.setSideEventPhotoConfirmed(false);

      const nextShown = args.sideEventsShownRef.current + 1;
      args.sideEventsShownRef.current = nextShown;
      args.setSideEventsShown(nextShown);

      if (options?.advanceSlot) {
        const nextSlot = args.sideEventSlotRef.current + 1;
        args.sideEventSlotRef.current = nextSlot;
        args.setSideEventSlot(nextSlot);
      }

      if (options?.countAsReplacement) {
        const nextCount = args.sideEventReplacementsRef.current + 1;
        args.sideEventReplacementsRef.current = nextCount;
        args.setSideEventReplacements(nextCount);
      }

      return next;
    },
    [args]
  );

  const clearActiveSideEvent = useCallback(() => {
    args.activeSideEventRef.current = null;
    args.setActiveSideEvent(null);
    args.setSideEventPhotoConfirmed(false);
  }, [args]);

  const acknowledgeActiveSideEvent = useCallback(async () => {
    if (!args.activeSideEventRef.current) return;
    clearActiveSideEvent();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [args, clearActiveSideEvent]);

  const replaceActiveSideEvent = useCallback(async () => {
    const next = presentSideEvent({ countAsReplacement: true });
    if (next) await Haptics.selectionAsync();
  }, [presentSideEvent]);

  const maybeTriggerSideEvent = useCallback(
    (currentPoint: GeoPoint) => {
      const currentPlan = args.planRef.current;
      const route = args.navigationRouteRef.current;

      if (
        !currentPlan ||
        !route ||
        args.stageRef.current !== 'journey' ||
        args.selectedMood === 'color'
      ) {
        return;
      }

      if (args.activeSideEventRef.current) return;

      const slot = args.sideEventSlotRef.current;
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
      const movingSeconds = args.effectiveMovingSecondsRef.current;
      const due =
        progress >= window.targetProgress ||
        movingSeconds >= window.targetMovingSeconds;

      if (!due || remainingRoute < 55) return;

      const beat = route.beats[args.navigationBeatIndexRef.current];
      const remainingBeat = args.beatRemainingMetersRef.current;
      const nearNavigationDecision =
        beat &&
        beat.turn !== 'continue' &&
        beat.turn !== 'start' &&
        remainingBeat > 0 &&
        remainingBeat < 32;

      if (nearNavigationDecision) return;

      presentSideEvent({ advanceSlot: true });
    },
    [args, presentSideEvent]
  );

  const resetSideEventRuntime = useCallback(() => {
    args.setActiveSideEvent(null);
    args.activeSideEventRef.current = null;
    args.setSideEventPhotoConfirmed(false);
    args.setSideEventSlot(0);
    args.sideEventSlotRef.current = 0;
    args.setSideEventsShown(0);
    args.sideEventsShownRef.current = 0;
    args.setSideEventReplacements(0);
    args.sideEventReplacementsRef.current = 0;
    args.sideEventSeenIdsRef.current = new Set();
    args.previousSideEventGazeRef.current = null;
    args.effectiveMovingSecondsRef.current = 0;
    args.lastMovementSampleAtRef.current = null;
  }, [args]);

  return {
    acknowledgeActiveSideEvent,
    maybeTriggerSideEvent,
    replaceActiveSideEvent,
    resetSideEventRuntime,
  };
}
