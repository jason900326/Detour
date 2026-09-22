import { useRef, type ReactNode } from "react";
import { Animated, PanResponder } from "react-native";

/** Only secondary screens receive a back action; a live journey has none. */
export function EdgeBack({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack?: () => void;
}) {
  const action = useRef(onBack);
  action.current = onBack;
  const x = useRef(new Animated.Value(0)).current;
  const gesture = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        !!action.current && g.x0 < 28 && g.dx > 14 && Math.abs(g.dy) < g.dx / 2,
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 90 || (g.dx > 35 && g.vx > 0.5)) action.current?.();
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateX: x }] }}
      {...gesture.panHandlers}
    >
      {children}
    </Animated.View>
  );
}
