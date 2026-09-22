import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { C, useReducedMotion } from "./pocket-ui";

/** A wandering line, not a progress percentage or a promised route. */
export function WanderMotion({ small = false }: { small?: boolean }) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(20, 65);
    p.cubicTo(65, 65, 40, 15, 88, 27);
    p.cubicTo(145, 42, 93, 100, 155, 77);
    p.cubicTo(195, 62, 164, 26, 220, 40);
    return p;
  }, []);
  useEffect(() => {
    progress.value = reduce ? 0.75 : 0;
    if (!reduce)
      progress.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      );
    return () => cancelAnimation(progress);
  }, [progress, reduce]);
  const radius = useDerivedValue(() => 4 + progress.value * 2);
  return (
    <View
      accessible
      accessibilityLabel="一段小探險即將展開"
      style={{
        width: small ? 72 : 240,
        height: small ? 32 : 112,
        overflow: "hidden",
      }}
    >
      <Canvas
        style={{
          width: 240,
          height: 112,
          transform: small
            ? [{ translateX: -84 }, { translateY: -40 }, { scale: 0.3 }]
            : [],
        }}
      >
        <Path
          path={path}
          color={C.line}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
        />
        <Path
          path={path}
          color={C.orange}
          style="stroke"
          strokeWidth={4}
          strokeCap="round"
          end={progress}
        />
        <Circle cx={20} cy={65} r={radius} color={C.orange} />
      </Canvas>
    </View>
  );
}
