import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { C, useReducedMotion } from "./pocket-ui";

export function DetourBrand({ large = false, allowFontScaling = true }: { large?: boolean; allowFontScaling?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="Detour"
      style={{ flexDirection: "row", alignItems: "center", gap: large ? 10 : 8 }}
    >
      <Svg width={large ? 45 : 36} height={large ? 45 : 36} viewBox="0 0 40 40">
        <Path
          d="M6 28 C6 12 15 7 23 9 C32 11 35 18 31 25 C27 32 16 32 13 25 C11 20 14 16 20 16"
          fill="none"
          stroke={C.orange}
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect x="18" y="18" width="5" height="5" rx="1.4" fill={C.ink} />
        <Path
          d="M31 5 L32.8 9.2 L37 11 L32.8 12.8 L31 17 L29.2 12.8 L25 11 L29.2 9.2 Z"
          fill={C.orange}
        />
        <Circle cx="6" cy="28" r="3.2" fill={C.ink} />
      </Svg>
      <Text
        allowFontScaling={allowFontScaling}
        style={{
          color: C.ink,
          fontSize: large ? 29 : 23,
          lineHeight: large ? 36 : 29,
          fontWeight: "900",
          letterSpacing: large ? 2.2 : 1.7,
        }}
      >
        DETOUR
      </Text>
    </View>
  );
}

export function HomeMoodStamp() {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: C.orange,
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 7,
        transform: [{ rotate: "-4deg" }],
      }}
    >
      <Text
        style={{
          color: C.white,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: "800",
          letterSpacing: 1.4,
        }}
      >
        隨便晃晃
      </Text>
    </View>
  );
}

export function HomeDoodles() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: -18,
        right: -18,
        bottom: 0,
        opacity: 0.22,
      }}
    >
      <View style={{ position: "absolute", top: 18, right: 4, transform: [{ rotate: "11deg" }] }}>
        <Svg width={54} height={54} viewBox="0 0 54 54">
          <Circle cx="27" cy="27" r="16" fill="none" stroke={C.green} strokeWidth={4} />
          <Path d="M27 12 L30 24 L42 27 L30 30 L27 42 L24 30 L12 27 L24 24 Z" fill={C.green} />
        </Svg>
      </View>

      <View style={{ position: "absolute", top: 112, left: 0, transform: [{ rotate: "-12deg" }] }}>
        <Svg width={62} height={46} viewBox="0 0 62 46">
          <Path
            d="M4 23 C15 9 32 9 46 23 C32 37 15 37 4 23 Z"
            fill="none"
            stroke={C.purple}
            strokeWidth={4}
          />
          <Circle cx="25" cy="23" r="6" fill={C.purple} />
          <Path d="M48 10 L53 4 M50 16 L59 14" stroke={C.purple} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      </View>

      <View style={{ position: "absolute", top: 216, right: -4, transform: [{ rotate: "8deg" }] }}>
        <Svg width={62} height={52} viewBox="0 0 62 52">
          <Rect x="8" y="12" width="42" height="31" rx="8" fill="none" stroke={C.orange} strokeWidth={3.5} />
          <Rect x="17" y="7" width="14" height="8" rx="3" fill={C.orange} />
          <Circle cx="29" cy="27" r="9" fill="none" stroke={C.orange} strokeWidth={3.5} />
        </Svg>
      </View>

      <View style={{ position: "absolute", bottom: 8, left: 12, transform: [{ rotate: "13deg" }] }}>
        <Svg width={52} height={58} viewBox="0 0 52 58">
          <Rect x="7" y="7" width="37" height="44" rx="4" fill="none" stroke={C.green} strokeWidth={3.5} />
          <Line x1="14" y1="20" x2="36" y2="20" stroke={C.green} strokeWidth={3} strokeLinecap="round" />
          <Line x1="14" y1="29" x2="31" y2="29" stroke={C.green} strokeWidth={3} strokeLinecap="round" />
          <Circle cx="36" cy="41" r="4" fill={C.green} />
        </Svg>
      </View>

      <View style={{ position: "absolute", bottom: 44, right: 34, transform: [{ rotate: "-17deg" }] }}>
        <Svg width={54} height={42} viewBox="0 0 54 42">
          <G fill={C.purple}>
            <Path d="M12 29 C8 24 9 17 14 14 C18 12 22 15 22 20 C22 26 17 31 12 29 Z" />
            <Circle cx="9" cy="10" r="3" />
            <Circle cx="16" cy="7" r="3" />
            <Circle cx="23" cy="9" r="3" />
            <Path d="M37 35 C33 30 34 23 39 20 C43 18 47 21 47 26 C47 32 42 37 37 35 Z" />
            <Circle cx="34" cy="16" r="3" />
            <Circle cx="41" cy="13" r="3" />
            <Circle cx="48" cy="15" r="3" />
          </G>
        </Svg>
      </View>
    </View>
  );
}

export function HomeJourneyMotion() {
  const reduce = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      progress.setValue(0.72);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 4200,
          useNativeDriver: true,
        }),
        Animated.delay(650),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduce]);

  const x = progress.interpolate({
    inputRange: [0, 0.18, 0.38, 0.57, 0.77, 1],
    outputRange: [28, 82, 132, 206, 270, 324],
  });
  const y = progress.interpolate({
    inputRange: [0, 0.18, 0.38, 0.57, 0.77, 1],
    outputRange: [177, 108, 153, 74, 126, 46],
  });
  const eyeOpacity = progress.interpolate({
    inputRange: [0, 0.16, 0.24, 0.88, 1],
    outputRange: [0, 0, 1, 1, 0],
  });
  const cameraOpacity = progress.interpolate({
    inputRange: [0, 0.38, 0.48, 0.91, 1],
    outputRange: [0, 0, 1, 1, 0],
  });
  const sparkleOpacity = progress.interpolate({
    inputRange: [0, 0.68, 0.78, 1],
    outputRange: [0, 0, 1, 1],
  });
  const pop = progress.interpolate({
    inputRange: [0, 0.22, 0.28, 0.48, 0.54, 0.78, 0.84, 1],
    outputRange: [0.7, 0.7, 1, 0.7, 1, 0.7, 1, 0.9],
  });

  return (
    <View
      accessible
      accessibilityLabel="一條故意繞開直路的小路，沿途遇見幾個意外"
      style={{ width: "100%", height: 230, marginTop: 2 }}
    >
      <Svg
        width="100%"
        height="230"
        viewBox="0 0 360 230"
        style={{ position: "absolute" }}
      >
        <Path
          d="M28 177 C110 143 235 92 324 46"
          fill="none"
          stroke={C.line}
          strokeWidth={2.2}
          strokeDasharray="6 9"
          strokeLinecap="round"
        />
        <Rect x="164" y="104" width="25" height="25" rx="5" fill={C.paper} stroke={C.line} strokeWidth={2.2} />
        <Line x1="170" y1="110" x2="183" y2="123" stroke={C.muted} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1="183" y1="110" x2="170" y2="123" stroke={C.muted} strokeWidth={2.4} strokeLinecap="round" />

        <Path
          d="M28 177 C57 185 78 135 82 108 C87 76 124 74 132 112 C140 149 165 172 202 128 C226 99 224 63 247 67 C281 73 261 126 286 118 C304 112 306 61 324 46"
          fill="none"
          stroke={C.orange}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="28" cy="177" r="7" fill={C.ink} />
        <Circle cx="28" cy="177" r="12" fill="none" stroke={C.ink} strokeWidth={1.3} opacity={0.2} />
        <Path
          d="M324 31 L327.8 40.2 L337 44 L327.8 47.8 L324 57 L320.2 47.8 L311 44 L320.2 40.2 Z"
          fill={C.orange}
        />
      </Svg>

      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: C.white,
          borderWidth: 4,
          borderColor: C.orange,
          shadowColor: C.orange,
          shadowOpacity: 0.2,
          shadowRadius: 7,
          transform: [{ translateX: x }, { translateY: y }],
        }}
      />

      <Animated.View
        style={{
          position: "absolute",
          left: 63,
          top: 67,
          opacity: eyeOpacity,
          transform: [{ scale: pop }, { rotate: "-7deg" }],
          backgroundColor: C.purple,
          borderRadius: 16,
          padding: 10,
        }}
      >
        <Svg width={36} height={26} viewBox="0 0 36 26">
          <Path d="M2 13 C9 4 26 4 34 13 C26 22 9 22 2 13 Z" fill="none" stroke={C.ink} strokeWidth={2.4} />
          <Circle cx="18" cy="13" r="4" fill={C.ink} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          left: 190,
          top: 41,
          opacity: cameraOpacity,
          transform: [{ scale: pop }, { rotate: "8deg" }],
          backgroundColor: C.green,
          borderRadius: 16,
          padding: 10,
        }}
      >
        <Svg width={36} height={30} viewBox="0 0 36 30">
          <Rect x="2" y="6" width="32" height="22" rx="6" fill="none" stroke={C.ink} strokeWidth={2.4} />
          <Rect x="8" y="2" width="10" height="6" rx="2" fill={C.ink} />
          <Circle cx="18" cy="17" r="6" fill="none" stroke={C.ink} strokeWidth={2.4} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          right: 22,
          top: 88,
          opacity: sparkleOpacity,
          transform: [{ scale: pop }, { rotate: "-10deg" }],
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
        }}
      >
        <Svg width={25} height={25} viewBox="0 0 25 25">
          <Path d="M12.5 1 L15 9.5 L24 12.5 L15 15.5 L12.5 24 L10 15.5 L1 12.5 L10 9.5 Z" fill={C.orange} />
        </Svg>
      </Animated.View>
    </View>
  );
}
