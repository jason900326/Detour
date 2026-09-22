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
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reduce) {
      opacity.setValue(0.65);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.95,
          duration: routing ? 650 : 1100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: routing ? 650 : 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduce, routing]);

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
      <Svg width={126} height={126} style={{ position: "absolute" }}>
        <Path
          d="M18 82 C17 47 36 23 67 27 C99 31 111 58 96 79 C82 99 55 91 48 108"
          fill="none"
          stroke="#E8E2D5"
          strokeWidth={4}
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View style={{ position: "absolute", opacity }}>
        <Svg width={126} height={126}>
          <Path
            d="M18 82 C17 47 36 23 67 27 C99 31 111 58 96 79 C82 99 55 91 48 108"
            fill="none"
            stroke={C.orange}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      <View
        style={{
          width: 88,
          height: 88,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${relative ?? 0}deg` }],
        }}
      >
        <Svg width={88} height={88}>
          <Path
            d="M20 38 L44 14 L68 38 M44 14 L44 72"
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
