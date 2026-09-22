import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C, useReducedMotion } from "./pocket-ui";

// The native version uses Skia. Browser previews do not need a CanvasKit download.
export function WanderMotion({ small = false }: { small?: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      return;
    }
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [opacity, reduce]);
  return (
    <Animated.View style={{ opacity }} accessibilityLabel="一段小探險即將展開">
      <Svg
        width={small ? 72 : 240}
        height={small ? 32 : 112}
        viewBox="0 0 240 112"
      >
        <Path
          d="M20 65 C65 65 40 15 88 27 C145 42 93 100 155 77 C195 62 164 26 220 40"
          stroke={C.orange}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={20} cy={65} r={5} fill={C.orange} />
      </Svg>
    </Animated.View>
  );
}
