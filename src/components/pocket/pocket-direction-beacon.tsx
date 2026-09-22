import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import {
  cancelAnimation,
  Easing,
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
  const trail = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(18, 82);
    p.cubicTo(17, 47, 36, 23, 67, 27);
    p.cubicTo(99, 31, 111, 58, 96, 79);
    p.cubicTo(82, 99, 55, 91, 48, 108);
    return p;
  }, []);

  useEffect(() => {
    progress.value = reduce ? 0.68 : 0;
    if (!reduce) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: routing ? 1300 : 2200,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        true,
      );
    }
    return () => cancelAnimation(progress);
  }, [progress, reduce, routing]);

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
        <Path
          path={trail}
          color="#E8E2D5"
          style="stroke"
          strokeWidth={4}
          strokeCap="round"
        />
        <Path
          path={trail}
          color={C.orange}
          style="stroke"
          strokeWidth={5}
          strokeCap="round"
          end={progress}
          opacity={0.9}
        />
      </Canvas>
      <View
        style={{
          width: 88,
          height: 88,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${relative ?? 0}deg` }],
        }}
      >
        <Canvas style={{ width: 88, height: 88 }}>
          <Path
            path="M20 38 L44 14 L68 38 M44 14 L44 72"
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
