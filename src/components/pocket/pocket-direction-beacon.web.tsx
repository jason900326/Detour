import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { C, useReducedMotion } from "./pocket-ui";

export function DirectionBeacon({
  relative,
  routing = false,
}: {
  relative: number | null;
  routing?: boolean;
}) {
  const reduce = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (reduce) {
      opacity.setValue(0.25);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: routing ? 500 : 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.18,
          duration: routing ? 500 : 900,
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
        relative === null ? "方向正在準備" : "大方向指示"
      }
      style={{ width: 126, height: 126, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={126} height={126} style={{ position: "absolute" }}>
        <Circle cx={63} cy={63} r={56} fill="none" stroke={C.line} strokeWidth={1.5} />
        <Circle cx={63} cy={63} r={44} fill="none" stroke="#ECE7DA" strokeWidth={2} />
        <Circle cx={63} cy={8} r={2.5} fill={C.muted} />
        <Circle cx={118} cy={63} r={2.5} fill={C.muted} />
        <Circle cx={63} cy={118} r={2.5} fill={C.muted} />
        <Circle cx={8} cy={63} r={2.5} fill={C.muted} />
      </Svg>
      <Animated.View
        style={{
          position: "absolute",
          width: 94,
          height: 94,
          borderRadius: 47,
          borderWidth: 2,
          borderColor: C.orange,
          opacity,
        }}
      />
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
      <View
        style={{
          position: "absolute",
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: C.orange,
        }}
      />
    </View>
  );
}
