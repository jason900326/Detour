import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, PanResponder, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type TicketTearBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  seamY: number;
};

type TicketTearContextValue = {
  enabled: boolean;
  dragX: Animated.Value;
  dragY: Animated.Value;
  opacity: Animated.Value;
  setTicketBounds: (bounds: TicketTearBounds | null) => void;
};

const fallbackDragX = new Animated.Value(0);
const fallbackDragY = new Animated.Value(0);
const fallbackOpacity = new Animated.Value(1);

const TicketTearContext = createContext<TicketTearContextValue>({
  enabled: false,
  dragX: fallbackDragX,
  dragY: fallbackDragY,
  opacity: fallbackOpacity,
  setTicketBounds: () => {},
});

export function TicketTearProvider({
  enabled,
  onTorn,
  children,
}: {
  enabled: boolean;
  onTorn: () => void;
  children: ReactNode;
}) {
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [ticketBounds, setTicketBounds] = useState<TicketTearBounds | null>(null);

  useEffect(() => {
    dragX.stopAnimation();
    dragY.stopAnimation();
    opacity.stopAnimation();
    dragX.setValue(0);
    dragY.setValue(0);
    opacity.setValue(1);

    if (!enabled) setTicketBounds(null);
  }, [dragX, dragY, enabled, opacity]);

  const value = useMemo(
    () => ({ enabled, dragX, dragY, opacity, setTicketBounds }),
    [dragX, dragY, enabled, opacity]
  );

  return (
    <TicketTearContext.Provider value={value}>
      {children}
      <TicketTearGestureSurface
        enabled={enabled}
        bounds={ticketBounds}
        dragX={dragX}
        dragY={dragY}
        opacity={opacity}
        onTorn={onTorn}
      />
    </TicketTearContext.Provider>
  );
}

function TicketTearGestureSurface({
  enabled,
  bounds,
  dragX,
  dragY,
  opacity,
  onTorn,
}: {
  enabled: boolean;
  bounds: TicketTearBounds | null;
  dragX: Animated.Value;
  dragY: Animated.Value;
  opacity: Animated.Value;
  onTorn: () => void;
}) {
  const tickIndexRef = useRef(0);
  const directionRef = useRef(1);
  const tornRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      tornRef.current = false;
      tickIndexRef.current = 0;
      directionRef.current = 1;
    }
  }, [enabled]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) => {
          if (!enabled || !bounds || tornRef.current) return false;
          const horizontal = Math.abs(gesture.dx);
          const vertical = Math.abs(gesture.dy);
          return horizontal > 5 && horizontal > vertical * 1.15;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          if (!enabled || !bounds || tornRef.current) return;
          tickIndexRef.current = 0;
          void Haptics.selectionAsync();
        },
        onPanResponderMove: (_event, gesture) => {
          if (!enabled || !bounds || tornRef.current) return;

          const requiredDistance = bounds.width * 0.58;
          const distance = Math.abs(gesture.dx);
          const direction = gesture.dx === 0 ? directionRef.current : Math.sign(gesture.dx);
          directionRef.current = direction || 1;
          const progress = Math.min(1, distance / requiredDistance);

          // While the finger crosses the perforation, the strip only lifts a
          // few points. The actual tear-away happens after the threshold.
          dragX.setValue(directionRef.current * progress * 6);
          dragY.setValue(progress * 4);

          const thresholds = [0.22, 0.48, 0.74];
          const nextTick = tickIndexRef.current;
          if (nextTick < thresholds.length && progress >= thresholds[nextTick]) {
            tickIndexRef.current = nextTick + 1;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!enabled || !bounds || tornRef.current) return;

          const distance = Math.abs(gesture.dx);
          const speed = Math.abs(gesture.vx);
          const requiredDistance = bounds.width * 0.58;
          const fastDistance = bounds.width * 0.34;
          const shouldTear =
            distance >= requiredDistance || (distance >= fastDistance && speed >= 0.85);

          if (!shouldTear) {
            tickIndexRef.current = 0;
            void Haptics.selectionAsync();
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
            return;
          }

          tornRef.current = true;
          const direction = gesture.dx === 0 ? directionRef.current : Math.sign(gesture.dx);
          directionRef.current = direction || 1;

          // Pull the perforated strip mostly sideways. A small drop and rotate
          // sell the paper release without making it travel through the lower
          // destination/barcode area.
          Animated.parallel([
            Animated.timing(dragX, {
              toValue: directionRef.current * 44,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(dragY, {
              toValue: 18,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            if (finished) onTorn();
          });
        },
        onPanResponderTerminate: () => {
          if (!enabled || tornRef.current) return;
          tickIndexRef.current = 0;
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
        },
      }),
    [bounds, dragX, dragY, enabled, onTorn, opacity]
  );

  if (!enabled || !bounds) return null;

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityLabel="沿齒孔滑開票根，開始旅程"
      style={{
        position: 'absolute',
        left: bounds.x + 10,
        top: Math.max(0, bounds.seamY - 28),
        width: Math.max(1, bounds.width - 20),
        height: 56,
        zIndex: 200,
        elevation: 200,
      }}
    />
  );
}

export function useTicketTear() {
  return useContext(TicketTearContext);
}
