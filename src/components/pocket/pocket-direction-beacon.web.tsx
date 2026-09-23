import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, useReducedMotion } from "./pocket-ui";

export function DirectionBeacon({
  relative,
  routing = false,
}: {
  relative: number | null;
  routing?: boolean;
}) {
  const reduce = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      progress.setValue(0.45);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: routing ? 1100 : 1900,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduce, routing]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1.16],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0],
  });

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
      <View
        style={{
          position: "absolute",
          width: 78,
          height: 78,
          borderRadius: 39,
          backgroundColor: "#F7E9E2",
          borderWidth: 2,
          borderColor: "#F4623C29",
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: 100,
          height: 100,
          borderRadius: 50,
          borderWidth: 2.5,
          borderColor: C.orange,
          opacity,
          transform: [{ scale }],
        }}
      />
      <View
        style={{
          width: 86,
          height: 86,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${relative ?? 0}deg` }],
        }}
      >
        <Svg width={86} height={86}>
          <Path
            d="M20 37 L43 14 L66 37 M43 14 L43 70"
            fill="none"
            stroke={routing ? C.muted : C.ink}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}
