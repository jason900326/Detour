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
import { DetourAccentStroke, V45Ticket } from './ticket-visuals';

type Controller = ReturnType<typeof useDetourHomeController>;

const TICKET_BACK = require('../../assets/detour/ticket-back.png');
const TICKET_MAIN = require('../../assets/detour/ticket-main.png');
const TICKET_STUB = require('../../assets/detour/ticket-stub.png');

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

function StubBarcode() {
  return (
    <View pointerEvents="none" style={styles.v46ArtBarcode}>
      {Array.from({ length: 29 }).map((_, index) => (
        <View
          key={`tear-barcode-${index}`}
          style={[
            styles.v46ArtBarcodeBar,
            { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },
          ]}
        />
      ))}
    </View>
  );
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
  const tensionFiredRef = useRef(false);
  const tornRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    tornRef.current = false;
    tensionFiredRef.current = false;
    dragX.setValue(0);
    dragY.setValue(0);
    opacity.setValue(1);
  }, [dragX, dragY, enabled, opacity]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          enabled && gesture.dy > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.72,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          if (!enabled || tornRef.current) return;
          tensionFiredRef.current = false;
          void Haptics.selectionAsync();
        },
        onPanResponderMove: (_event, gesture) => {
          if (!enabled || tornRef.current) return;

          const positiveY = Math.max(0, gesture.dy);
          const resistedY = positiveY <= 28
            ? positiveY * 0.48
            : 13.4 + (positiveY - 28) * 0.72;
          const resistedX = Math.max(-18, Math.min(18, gesture.dx * 0.2));

          dragX.setValue(resistedX);
          dragY.setValue(resistedY);

          if (positiveY >= 30 && !tensionFiredRef.current) {
            tensionFiredRef.current = true;
            void softImpact();
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!enabled || tornRef.current) return;

          const shouldTear =
            gesture.dy >= 88 || (gesture.dy >= 58 && gesture.vy >= 0.62);

          if (!shouldTear) {
            tensionFiredRef.current = false;
            void Haptics.selectionAsync();
            Animated.parallel([
              Animated.spring(dragX, {
                toValue: 0,
                speed: 24,
                bounciness: 5,
                useNativeDriver: true,
              }),
              Animated.spring(dragY, {
                toValue: 0,
                speed: 24,
                bounciness: 5,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          tornRef.current = true;
          // startDetour starts with the existing medium impact, so that single
          // impact becomes the actual perforation snap instead of double buzz.
          onTorn();

          const releaseX = Math.max(-34, Math.min(34, gesture.dx * 0.42));
          Animated.parallel([
            Animated.timing(dragX, {
              toValue: releaseX,
              duration: 270,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(dragY, {
              toValue: 184,
              duration: 270,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 250,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          if (!enabled || tornRef.current) return;
          tensionFiredRef.current = false;
          Animated.parallel([
            Animated.spring(dragX, {
              toValue: 0,
              speed: 24,
              bounciness: 5,
              useNativeDriver: true,
            }),
            Animated.spring(dragY, {
              toValue: 0,
              speed: 24,
              bounciness: 5,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [dragX, dragY, enabled, onTorn, opacity]
  );

  const rotate = dragY.interpolate({
    inputRange: [0, 28, 90, 184],
    outputRange: ['0deg', '0.5deg', '2.6deg', '8deg'],
    extrapolate: 'clamp',
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          motionStyles.ticketLayer,
          motionStyles.stubLayer,
          {
            opacity,
            transform: [{ translateX: dragX }, { translateY: dragY }, { rotate }],
          },
        ]}
      >
        <Image source={TICKET_STUB} style={motionStyles.ticketImage} resizeMode="stretch" />
        <StubBarcode />
      </Animated.View>

      <View
        {...responder.panHandlers}
        accessible
        accessibilityLabel="撕下票根，開始旅程"
        style={motionStyles.stubHitArea}
      />
    </>
  );
}

/**
 * Ready state uses the user's final three-layer PNG set. The back layer stays
 * still, the main body stays attached, and only the transparent stub layer is
 * draggable. All three PNGs share the same canvas, so the perforation remains
 * pixel-aligned while the stub moves away.
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
                <View pointerEvents="none" style={[motionStyles.ticketLayer, motionStyles.backLayer]}>
                  <Image source={TICKET_BACK} style={motionStyles.ticketImage} resizeMode="stretch" />
                </View>

                <View pointerEvents="none" style={[motionStyles.ticketLayer, motionStyles.mainLayer]}>
                  <Image source={TICKET_MAIN} style={motionStyles.ticketImage} resizeMode="stretch" />
                </View>

                <View pointerEvents="none" style={motionStyles.contentLayer}>
                  <V45Ticket
                    timeLabel={controller.selectedTime ?? '15'}
                    moodId={moodId}
                    moodLabel={moodLabel}
                    serial={serial}
                    stamped
                    stampProgress={controller.ticketStamp}
                    artworkVisible={false}
                    showBarcode={false}
                  />
                </View>

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
            <Text style={motionStyles.hintText}>撕下票根，開始旅程</Text>
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
    width: 310,
    aspectRatio: 1115 / 1411,
    position: 'relative',
  },
  ticketLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 310,
    aspectRatio: 1115 / 1411,
  },
  ticketImage: {
    width: '100%',
    height: '100%',
  },
  backLayer: {
    zIndex: 1,
  },
  mainLayer: {
    zIndex: 2,
  },
  contentLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 310,
    aspectRatio: 1115 / 1411,
    zIndex: 3,
  },
  stubLayer: {
    zIndex: 4,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 1, height: 6 },
    elevation: 7,
  },
  stubHitArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 106,
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
