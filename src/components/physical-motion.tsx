import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import type { useDetourHomeController } from '../hooks/use-detour-home-controller';
import { styles } from '../styles/home-styles';
import { MUTED } from '../theme/detour-theme';
import { ticketSerial } from '../lib/detour-formatters';
import {
  DETOUR_TICKET_MAIN_HEIGHT,
  DETOUR_TICKET_STUB_HEIGHT,
  DETOUR_TICKET_STUB_SOURCE,
  DETOUR_TICKET_TOTAL_HEIGHT,
  DETOUR_TICKET_WIDTH,
  DetourAccentStroke,
  V45Ticket,
} from './ticket-visuals';

type Controller = ReturnType<typeof useDetourHomeController>;

function lightImpact() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function softImpact() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

/**
 * Adds haptics only to view-owned controls that did not already have them in
 * the controller. Controller actions that already encode meaning (mood pick,
 * completion, skip, etc.) are deliberately left untouched so we never double
 * buzz the same action.
 */
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
        if (controller.photos.length >= controller.rollCapacity) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          void lightImpact();
        }
        return controller.openCamera(...args);
      }) as Controller['openCamera'],
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

/**
 * Haptics tied to the actual printer feed value, not arbitrary timers.
 * Five soft roller bites are enough to feel mechanical without becoming a
 * vibration loop. The controller's existing ready impact remains the final
 * "ticket landed" cue.
 */
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

function TicketStub({
  enabled,
  onTorn,
}: {
  enabled: boolean;
  onTorn: () => void;
}) {
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const tickIndexRef = useRef(0);
  const directionRef = useRef(1);
  const tornRef = useRef(false);

  const requiredDistance = DETOUR_TICKET_WIDTH * 0.58;
  const fastDistance = DETOUR_TICKET_WIDTH * 0.34;
  const tickThresholds = [0.22, 0.48, 0.74];

  const resetStub = () => {
    tickIndexRef.current = 0;
    directionRef.current = 1;
    Animated.parallel([
      Animated.spring(dragX, {
        toValue: 0,
        speed: 24,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.spring(dragY, {
        toValue: 0,
        speed: 24,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (!enabled) return;
    tornRef.current = false;
    tickIndexRef.current = 0;
    directionRef.current = 1;
    dragX.setValue(0);
    dragY.setValue(0);
    opacity.setValue(1);
  }, [dragX, dragY, enabled, opacity]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) => {
          const horizontal = Math.abs(gesture.dx);
          const vertical = Math.abs(gesture.dy);
          return enabled && horizontal > 5 && horizontal > vertical * 1.15;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          if (!enabled || tornRef.current) return;
          tickIndexRef.current = 0;
          void Haptics.selectionAsync();
        },
        onPanResponderMove: (_event, gesture) => {
          if (!enabled || tornRef.current) return;

          const distance = Math.abs(gesture.dx);
          const direction = gesture.dx === 0 ? directionRef.current : Math.sign(gesture.dx);
          directionRef.current = direction || 1;
          const progress = Math.min(1, distance / requiredDistance);

          // The stub does not follow the finger sideways. It only starts to
          // peel away from the seam while the finger travels across the tear
          // line, which reads much more like perforated paper than dragging a
          // loose card around the screen.
          dragX.setValue(directionRef.current * progress * 5);
          dragY.setValue(progress * 7);

          const nextTick = tickIndexRef.current;
          if (nextTick < tickThresholds.length && progress >= tickThresholds[nextTick]) {
            tickIndexRef.current = nextTick + 1;
            void softImpact();
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!enabled || tornRef.current) return;

          const distance = Math.abs(gesture.dx);
          const speed = Math.abs(gesture.vx);
          const shouldTear =
            distance >= requiredDistance || (distance >= fastDistance && speed >= 0.85);

          if (!shouldTear) {
            void Haptics.selectionAsync();
            resetStub();
            return;
          }

          tornRef.current = true;
          const direction = gesture.dx === 0 ? directionRef.current : Math.sign(gesture.dx);
          directionRef.current = direction || 1;

          Animated.parallel([
            Animated.timing(dragX, {
              toValue: directionRef.current * 24,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(dragY, {
              toValue: Math.max(86, DETOUR_TICKET_STUB_HEIGHT * 1.7),
              duration: 180,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 180,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            if (finished) onTorn();
          });
        },
        onPanResponderTerminate: () => {
          if (!enabled || tornRef.current) return;
          resetStub();
        },
      }),
    [dragX, dragY, enabled, fastDistance, onTorn, opacity, requiredDistance]
  );

  const rotate = dragX.interpolate({
    inputRange: [-24, 0, 24],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          motionStyles.stubLayer,
          {
            top: DETOUR_TICKET_MAIN_HEIGHT,
            width: DETOUR_TICKET_WIDTH,
            height: DETOUR_TICKET_STUB_HEIGHT,
            opacity,
            transform: [{ translateX: dragX }, { translateY: dragY }, { rotate }],
          },
        ]}
      >
        <Image
          source={DETOUR_TICKET_STUB_SOURCE}
          style={motionStyles.ticketImage}
          resizeMode="contain"
        />
      </Animated.View>

      <View
        {...responder.panHandlers}
        accessible
        accessibilityLabel="沿齒孔滑開票根，開始旅程"
        style={[
          motionStyles.stubHitArea,
          { top: Math.max(0, DETOUR_TICKET_MAIN_HEIGHT - 22) },
        ]}
      />
    </>
  );
}

/**
 * The ready state reuses the exact same V45Ticket object that was printed.
 * Only the stub artwork is swapped for an animated copy at the seam. Main and
 * stub dimensions are derived from their source PNGs, so there are no guessed
 * offsets, stretch ratios, or device-specific alignment values.
 */
export function ReadyTicketTearOverlay({ controller }: { controller: Controller }) {
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const startLockRef = useRef(false);

  useEffect(() => {
    startLockRef.current = false;
    hintOpacity.stopAnimation();
    hintOpacity.setValue(0);

    if (!controller.ticketReadyUnlocked) return;

    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [controller.ticketReadyUnlocked, hintOpacity]);

  if (controller.stage !== 'ready') return null;

  const serial = ticketSerial(controller.selectedTime, controller.selectedMood);
  const moodId = controller.selectedMood ?? 'wander';
  const moodLabel = controller.mood?.label ?? '—';

  const handleTorn = () => {
    if (startLockRef.current || !controller.ticketReadyUnlocked) return;
    startLockRef.current = true;
    void controller.startDetour();
  };

  return (
    <View style={motionStyles.readyOverlay}>
      <View style={styles.v45PrintingScreen}>
        <View style={styles.v48PrintingTopBar}>
          <Pressable onPress={controller.goBack} hitSlop={16} style={styles.v48PrintingBack}>
            <Text style={styles.v48PrintingBackText}>‹</Text>
          </Pressable>
          <Text style={styles.v45PrintingBrand}>DETOUR</Text>
        </View>

        <View style={[styles.v45PrintingTitleWrap, styles.v48PrintingTitleWrap]}>
          <Text style={styles.v45PrintingTitle}>車票完成</Text>
          <DetourAccentStroke width={180} style={styles.v45PrintingUnderline} />
        </View>

        <View style={styles.v48PrinterAssembly}>
          <View pointerEvents="none" style={styles.v50PrinterBody}>
            <View style={styles.v50PrinterHighlight} />
            <View style={styles.v50PrinterSlotShell}>
              <View style={styles.v50PrinterSlot} />
            </View>
          </View>

          <View style={[styles.v48PaperViewport, motionStyles.readyPaperViewport]}>
            <View style={styles.v48PaperTrack}>
              <View style={motionStyles.ticketGestureStage}>
                <V45Ticket
                  timeLabel={controller.selectedTime ?? '15'}
                  moodId={moodId}
                  moodLabel={moodLabel}
                  serial={serial}
                  stamped
                  stampProgress={controller.ticketStamp}
                  showStubArtwork={false}
                />
                <TicketStub
                  enabled={controller.ticketReadyUnlocked}
                  onTorn={handleTorn}
                />
              </View>
            </View>
          </View>

          <View pointerEvents="none" style={styles.v50PrinterFrontLip}>
            <View style={styles.v50PrinterFrontLipHighlight} />
          </View>
        </View>

        {controller.ticketReadyUnlocked && (
          <Animated.View
            pointerEvents="none"
            style={[motionStyles.hintWrap, { opacity: hintOpacity }]}
          >
            <View style={motionStyles.hintRule} />
            <Text style={motionStyles.hintText}>沿齒孔滑開票根，開始旅程</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export function useJourneyStageMotion(stage: Controller['stage']) {
  const stageX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    stageX.stopAnimation();

    if (stage === 'mission') {
      stageX.setValue(24);
      Animated.timing(stageX, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

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

const motionStyles = StyleSheet.create({
  readyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
  },
  readyPaperViewport: {
    overflow: 'visible',
  },
  ticketGestureStage: {
    width: DETOUR_TICKET_WIDTH,
    height: DETOUR_TICKET_TOTAL_HEIGHT,
    position: 'relative',
  },
  ticketImage: {
    width: '100%',
    height: '100%',
  },
  stubLayer: {
    position: 'absolute',
    left: 0,
    zIndex: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  stubHitArea: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 44,
    zIndex: 5,
  },
  hintWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 37,
    alignItems: 'center',
  },
  hintRule: {
    width: 28,
    height: 1,
    marginBottom: 10,
    backgroundColor: '#C1BCB2',
  },
  hintText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: MUTED,
  },
});
