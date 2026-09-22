import { useEffect } from "react";
import { Text, View } from "react-native";
import { Canvas, Circle } from "@shopify/react-native-skia";
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
          duration: routing ? 950 : 1800,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(progress);
  }, [progress, reduce, routing]);

  const pulseRadius = useDerivedValue(() => 43 + progress.value * 13);
  const pulseOpacity = useDerivedValue(() => 0.34 * (1 - progress.value));
  const coreRadius = useDerivedValue(() => 4.5 + progress.value * 1.8);

  return (
    <View
      accessible
      accessibilityLabel={
        relative === null ? "方向正在準備" : "大方向指示"
      }
      style={{ width: 126, height: 126, alignItems: "center", justifyContent: "center" }}
    >
      <Canvas style={{ position: "absolute", width: 126, height: 126 }}>
        <Circle
          cx={63}
          cy={63}
          r={56}
          color={C.line}
          style="stroke"
          strokeWidth={1.5}
        />
        <Circle
          cx={63}
          cy={63}
          r={44}
          color="#ECE7DA"
          style="stroke"
          strokeWidth={2}
        />
        <Circle
          cx={63}
          cy={63}
          r={pulseRadius}
          color={C.orange}
          opacity={pulseOpacity}
          style="stroke"
          strokeWidth={2.5}
        />
        <Circle cx={63} cy={8} r={2.5} color={C.muted} />
        <Circle cx={118} cy={63} r={2.5} color={C.muted} />
        <Circle cx={63} cy={118} r={2.5} color={C.muted} />
        <Circle cx={8} cy={63} r={2.5} color={C.muted} />
        <Circle cx={63} cy={63} r={coreRadius} color={C.orange} />
      </Canvas>
      <View
        style={{
          width: 70,
          height: 70,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${relative ?? 0}deg` }],
        }}
      >
        <Text
          style={{
            color: routing ? C.muted : C.ink,
            fontSize: 58,
            lineHeight: 64,
            fontWeight: "300",
          }}
        >
          {relative === null ? "↗" : "↑"}
        </Text>
      </View>
    </View>
  );
}
