import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { useDetourHomeController } from '../hooks/use-detour-home-controller';

type Controller = ReturnType<typeof useDetourHomeController>;

function lightImpact() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function softImpact() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

export function usePhysicalController(
  controller: Controller,
  shellScale: Animated.Value
): Controller {
  return useMemo(() => {
    const animateShare = async () => {
      await lightImpact();
      await new Promise<void>((resolve) => {
        Animated.sequence([
          Animated.timing(shellScale, {
            toValue: 0.985,
            duration: 85,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shellScale, {
            toValue: 1,
            duration: 125,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
    };

    const next = {
      ...controller,
      transitionTo: ((...args: Parameters<Controller['transitionTo']>) => {
        void Haptics.selectionAsync();
        return controller.transitionTo(...args);
      }) as Controller['transitionTo'],
      goBack: (() => {
        void Haptics.selectionAsync();
        return controller.goBack();
      }) as Controller['goBack'],
      resetDetour: (() => {
        void lightImpact();
        return controller.resetDetour();
      }) as Controller['resetDetour'],
      openPassportEntry: ((...args: Parameters<Controller['openPassportEntry']>) => {
        void lightImpact();
        return controller.openPassportEntry(...args);
      }) as Controller['openPassportEntry'],
      openCamera: ((...args: Parameters<Controller['openCamera']>) => {
        void lightImpact();
        return controller.openCamera(...args);
      }) as Controller['openCamera'],
      replaceActiveSideEvent: ((...args: Parameters<Controller['replaceActiveSideEvent']>) => {
        void Haptics.selectionAsync();
        return controller.replaceActiveSideEvent(...args);
      }) as Controller['replaceActiveSideEvent'],
      replaceFailedDestination: ((...args: Parameters<Controller['replaceFailedDestination']>) => {
        void Haptics.selectionAsync();
        return controller.replaceFailedDestination(...args);
      }) as Controller['replaceFailedDestination'],
      setShowNextBeatMap: ((...args: Parameters<Controller['setShowNextBeatMap']>) => {
        void Haptics.selectionAsync();
        return controller.setShowNextBeatMap(...args);
      }) as Controller['setShowNextBeatMap'],
      setPassportPhotoIndex: ((...args: Parameters<Controller['setPassportPhotoIndex']>) => {
        void Haptics.selectionAsync();
        return controller.setPassportPhotoIndex(...args);
      }) as Controller['setPassportPhotoIndex'],
      shareJourney: (async (...args: Parameters<Controller['shareJourney']>) => {
        await animateShare();
        return controller.shareJourney(...args);
      }) as Controller['shareJourney'],
    };

    return next as Controller;
  }, [controller, shellScale]);
}

export function PrinterPhysicalHaptics({ controller }: { controller: Controller }) {
  const nextTickRef = useRef(0);
  const lastTickAtRef = useRef(0);

  useEffect(() => {
    if (controller.stage !== 'preparing') return;

    nextTickRef.current = 0;
    lastTickAtRef.current = 0;
    void lightImpact();

    const thresholds = [0.16, 0.38, 0.6, 0.8, 0.96];
    const listener = controller.routeProgress.addListener(({ value }) => {
      const nextIndex = nextTickRef.current;
      if (nextIndex >= thresholds.length || value < thresholds[nextIndex]) return;

      nextTickRef.current = nextIndex + 1;
      const now = Date.now();
      if (now - lastTickAtRef.current < 70) return;
      lastTickAtRef.current = now;
      void softImpact();
    });

    return () => controller.routeProgress.removeListener(listener);
  }, [controller.routeProgress, controller.stage]);

  return null;
}

export function useJourneyStageMotion(stage: Controller['stage']) {
  const stageX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    stageX.stopAnimation();

    if (stage === 'arrival') {
      stageX.setValue(8);
      Animated.spring(stageX, {
        toValue: 0,
        speed: 22,
        bounciness: 3,
        useNativeDriver: true,
      }).start();
      return;
    }

    stageX.setValue(0);
  }, [stage, stageX]);

  return stageX;
}
