import { useEffect } from "react";
import { View } from "react-native";
import { Canvas, Circle, Path } from "@shopify/react-native-skia";
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { C, useReducedMotion } from "./pocket-ui";

export function DirectionBeacon({
  relative,
  routing = false,
}: {
  relative: number | null;
  routing?: boolean;
}) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduce ? 0.45 : 0;
    if (!reduce) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: routing ? 1100 : 1900,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(progress);
  }, [progress, reduce, routing]);

  const outerRadius = useDerivedValue(() => 42 + progress.value * 16);
  const outerOpacity = useDerivedValue(() => 0.28 * (1 - progress.value));
  const innerRadius = useDerivedValue(() => 38 + progress.value * 5);
  const innerOpacity = useDerivedValue(() => 0.16 + progress.value * 0.08);

  return (
    <View
      accessible
      accessibilityLabel={
        relative === null ? "方向正在準備" : "目前的大方向"
      }
      style={{
        width: 126,
        height: 126,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Canvas style={{ position: "absolute", width: 126, height: 126 }}>
        <Circle cx={63} cy={63} r={39} color="#F7E9E2" />
        <Circle
          cx={63}
          cy={63}
          r={innerRadius}
          color={C.orange}
          opacity={innerOpacity}
          style="stroke"
          strokeWidth={2.5}
        />
        <Circle
          cx={63}
          cy={63}
          r={outerRadius}
          color={C.orange}
          opacity={outerOpacity}
          style="stroke"
          strokeWidth={2.5}
        />
      </Canvas>
      <View
        style={{
          width: 86,
          height: 86,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${relative ?? 0}deg` }],
        }}
      >
        <Canvas style={{ width: 86, height: 86 }}>
          <Path
            path="M20 37 L43 14 L66 37 M43 14 L43 70"
            color={routing ? C.muted : C.ink}
            style="stroke"
            strokeWidth={7}
            strokeCap="round"
            strokeJoin="round"
          />
        </Canvas>
      </View>
    </View>
  );
}
