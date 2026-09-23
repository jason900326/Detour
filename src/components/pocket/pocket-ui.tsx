import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { distance, type PocketJourney, type Point } from "../../lib/pocket-engine";
export const PHOTO_ASPECT = 4 / 5;
export const C = {
  paper: "#F7F4EC",
  ink: "#242921",
  muted: "#797D70",
  orange: "#F4623C",
  purple: "#E6DDF3",
  green: "#DDE8CA",
  line: "#D9D9CD",
  white: "#FFFDF8",
};
export const mono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => sub.remove();
  }, []);
  return reduce;
}
export function Enter({
  children,
  delay = 0,
  stamp = false,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  stamp?: boolean;
  style?: ViewStyle;
}) {
  const value = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();
  useEffect(() => {
    const a = Animated.spring(value, {
      toValue: 1,
      delay: reduce ? 0 : delay,
      damping: stamp ? 11 : 19,
      stiffness: stamp ? 240 : 150,
      mass: 0.8,
      useNativeDriver: true,
    });
    if (reduce) value.setValue(1);
    else a.start();
    return () => a.stop();
  }, [reduce, value, delay, stamp]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [stamp ? -8 : 22, 0],
              }),
            },
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: [stamp ? 1.6 : 0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  small = false,
  centered = false,
  hideArrow = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  small?: boolean;
  centered?: boolean;
  hideArrow?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      damping: 13,
      stiffness: 330,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(0.96)}
        onPressOut={() => animate(1)}
        style={[
          s.button,
          secondary && s.secondary,
          small && s.small,
          centered && { justifyContent: "center" },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text
          style={[
            s.buttonText,
            secondary && { color: C.orange },
            small && { fontSize: 15 },
          ]}
        >
          {label}
        </Text>
        {!small && !hideArrow && (
          <Text style={[s.buttonArrow, secondary && { color: C.orange }]}>
            ↗
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
export function DottedLine() {
  return <View style={s.dotted} />;
}
export function Barcode({ wide = false }: { wide?: boolean }) {
  const count = wide ? 55 : 41;
  return (
    <View
      style={[
        s.barcode,
        wide && {
          width: "100%",
          justifyContent: "space-between",
          gap: 0,
        },
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: [2, 1, 3, 1, 2, 4, 1][i % 7],
            height: i % 6 === 0 ? 25 : 21,
            backgroundColor: C.ink,
            opacity: 0.72,
          }}
        />
      ))}
    </View>
  );
}

function trailGeometry(points: Point[]) {
  const sampled =
    points.length <= 10
      ? points
      : Array.from({ length: 10 }, (_, i) => {
          const index = Math.round((i / 9) * (points.length - 1));
          return points[index];
        });
  const xs = sampled.map(
    (p) => p.longitude * Math.cos((sampled[0].latitude * Math.PI) / 180),
  );
  const ys = sampled.map((p) => p.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.00005);
  const spanY = Math.max(maxY - minY, 0.00005);
  const span = Math.max(spanX, spanY);
  const coords = sampled.map((_, i) => ({
    x: 22 + ((xs[i] - minX) / span) * 196,
    y: 16 + ((maxY - ys[i]) / span) * 68,
  }));
  let path = `M ${coords[0].x} ${coords[0].y}`;
  if (coords.length === 2) {
    path += ` L ${coords[1].x} ${coords[1].y}`;
  } else {
    for (let i = 1; i < coords.length - 1; i++) {
      const next = coords[i + 1];
      const midX = (coords[i].x + next.x) / 2;
      const midY = (coords[i].y + next.y) / 2;
      path += ` Q ${coords[i].x} ${coords[i].y} ${midX} ${midY}`;
    }
    const last = coords[coords.length - 1];
    path += ` L ${last.x} ${last.y}`;
  }
  return { path, start: coords[0], end: coords[coords.length - 1] };
}

export function Trail({
  points,
  color = C.orange,
  height = 100,
  framed = false,
}: {
  points: Point[];
  color?: string;
  height?: number;
  framed?: boolean;
}) {
  if (points.length < 2) return null;
  const traveled = points.slice(1).reduce(
    (total, point, index) => total + distance(points[index], point),
    0,
  );
  if (traveled < 35) return null;
  const geometry = trailGeometry(points);
  return (
    <View
      style={
        framed
          ? {
              backgroundColor: C.white,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#E8E2D7",
              paddingHorizontal: 8,
              paddingVertical: 4,
            }
          : undefined
      }
    >
      <Svg height={height} width="100%" viewBox="0 0 240 100">
        {framed && (
          <>
            <Path
              d="M18 25 H222 M18 50 H222 M18 75 H222"
              stroke={C.line}
              strokeWidth={1}
              strokeDasharray="3 7"
              opacity={0.42}
            />
            <Path
              d="M60 10 V90 M120 10 V90 M180 10 V90"
              stroke={C.line}
              strokeWidth={1}
              strokeDasharray="3 7"
              opacity={0.32}
            />
          </>
        )}
        <Path
          d={geometry.path}
          stroke="#E8E2D5"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d={geometry.path}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle
          cx={geometry.start.x}
          cy={geometry.start.y}
          r={5}
          fill={C.white}
          stroke={color}
          strokeWidth={2.5}
        />
        <Circle cx={geometry.end.x} cy={geometry.end.y} r={5.5} fill={color} />
      </Svg>
    </View>
  );
}

export function Ticket({
  journey,
  compact = false,
  receipt = false,
}: {
  journey: PocketJourney;
  compact?: boolean;
  receipt?: boolean;
}) {
  const stampSize = receipt ? 30 : compact ? 33 : 44;
  return (
    <View
      style={[
        s.ticket,
        compact && { padding: 20 },
        receipt && { padding: 18 },
      ]}
    >
      <View style={s.row}>
        <Text style={s.brand}>DETOUR</Text>
        <Text style={s.serial}>№ {journey.id.slice(-5)}</Text>
      </View>
      <DottedLine />
      <View
        style={{
          minHeight: receipt ? 48 : compact ? 54 : 84,
          justifyContent: "center",
        }}
      >
        {journey.found.length ? (
          <View
            style={[
              s.stamps,
              receipt && {
                flexWrap: "nowrap",
                justifyContent: "space-between",
                gap: 6,
                paddingVertical: 5,
              },
            ]}
          >
            {journey.found.map((f, i) => (
              <Enter key={`${f.id}-${i}`} stamp>
                <Text
                  accessibilityLabel={f.title}
                  style={{
                    fontSize: stampSize,
                    transform: [{ rotate: `${i % 2 ? 4 : -4}deg` }],
                  }}
                >
                  {f.emoji}
                </Text>
              </Enter>
            ))}
          </View>
        ) : (
          <Text style={s.emptyTicket}>
            {journey.phase === "finished"
              ? "這趟沒有留下發現。"
              : "第一個發現，會留在這裡。"}
          </Text>
        )}
      </View>
      <View style={s.row}>
        <Text style={s.muted}>
          {new Date(journey.startedAt).toLocaleDateString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
          })}{" "}
          ·{" "}
          {journey.demo
            ? "試玩票"
            : journey.phase === "finished"
              ? "這一趟的小發現"
              : "正在收集路上的意外"}
        </Text>
        <Text style={s.serial}>
          {String(journey.found.length).padStart(2, "0")} 枚
        </Text>
      </View>
      {!compact && (
        <>
          <DottedLine />
          <Barcode wide={receipt} />
        </>
      )}
      <View style={[s.notch, { left: -9 }]} />
      <View style={[s.notch, { right: -9 }]} />
    </View>
  );
}

export function HomeTicket() {
  return (
    <View style={s.heroArt}>
      <View style={s.shadowPaper} />
      <View style={s.purplePaper}>
        <Text style={{ fontSize: 28, transform: [{ rotate: "15deg" }] }}>
          👀
        </Text>
        <Text style={s.noteScript}>今天，走點不一樣的。</Text>
      </View>
      <View style={s.heroTicket}>
        <View style={s.row}>
          <Text style={s.brand}>DETOUR ↗</Text>
          <Text style={s.serial}>一人份的小探險</Text>
        </View>
        <DottedLine />
        <View style={s.row}>
          <View>
            <Text style={s.heroTicketTitle}>一點時間，</Text>
            <Text style={s.heroTicketTitle}>一點意外。</Text>
          </View>
          <View style={s.timeSeal}>
            <Text
              style={{
                fontSize: 37,
                fontWeight: "900",
                color: C.orange,
                fontFamily: mono,
              }}
            >
              10
            </Text>
            <Text style={{ fontSize: 11, fontWeight: "700", color: C.orange }}>
              分鐘左右
            </Text>
          </View>
        </View>
        <Svg width="100%" height={55} viewBox="0 0 290 83">
          <Path
            d="M12 61 C50 61 48 17 88 26 S117 79 158 56 S189 11 227 27 L269 27 M258 16 L270 27 L258 38"
            stroke={C.orange}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={61} r={5} fill={C.ink} />
        </Svg>
        <DottedLine />
        <View style={s.row}>
          <Barcode />
          <Text style={s.serial}>出門就開始</Text>
        </View>
        <View
          style={[s.notch, { left: -9, top: 53, backgroundColor: C.paper }]}
        />
        <View
          style={[s.notch, { right: -9, top: 53, backgroundColor: C.paper }]}
        />
      </View>
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  page: {
    paddingHorizontal: 25,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 16,
  },
  brand: { fontWeight: "900", fontSize: 18, letterSpacing: 1.6, color: C.ink },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 43,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -1.5,
    color: C.ink,
  },
  body: { fontSize: 16, lineHeight: 25, color: C.muted },
  muted: { fontSize: 12, lineHeight: 18, color: C.muted },
  serial: { fontFamily: mono, fontSize: 11, color: C.muted },
  button: {
    minHeight: 65,
    borderRadius: 22,
    backgroundColor: C.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 25,
    gap: 12,
  },
  buttonText: { fontSize: 19, fontWeight: "800", color: C.white },
  buttonArrow: { fontSize: 29, color: C.white },
  secondary: {
    backgroundColor: C.paper,
    borderWidth: 1.5,
    borderColor: C.orange,
  },
  small: { minHeight: 45, borderRadius: 16, paddingHorizontal: 16 },
  dotted: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: C.line,
    marginVertical: 17,
  },
  barcode: { flexDirection: "row", alignItems: "center", gap: 2, height: 25 },
  ticket: {
    backgroundColor: C.white,
    borderRadius: 5,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E6E2D7",
    shadowColor: "#383B29",
    shadowOpacity: 0.06,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  stamps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
    paddingVertical: 10,
  },
  notch: {
    position: "absolute",
    top: 57,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.paper,
  },
  emptyTicket: { fontSize: 14, color: "#98998E", textAlign: "center" },
  heroArt: {
    height: 282,
    marginTop: 20,
    marginBottom: 8,
    justifyContent: "center",
  },
  heroTicket: {
    backgroundColor: C.white,
    borderRadius: 5,
    padding: 21,
    transform: [{ rotate: "-5deg" }],
    borderWidth: 1,
    borderColor: "#E4E0D5",
    shadowColor: "#4C4327",
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
  },
  heroTicketTitle: {
    fontSize: 28,
    lineHeight: 37,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -1,
  },
  shadowPaper: {
    position: "absolute",
    left: 14,
    right: 4,
    top: 29,
    bottom: 6,
    backgroundColor: "#E4E4D8",
    transform: [{ rotate: "2deg" }],
    borderRadius: 6,
  },
  purplePaper: {
    position: "absolute",
    right: -1,
    top: -14,
    backgroundColor: C.purple,
    width: 195,
    height: 86,
    padding: 12,
    transform: [{ rotate: "8deg" }],
    borderRadius: 3,
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
  },
  noteScript: {
    fontSize: 11,
    fontWeight: "600",
    color: "#60586E",
    paddingTop: 8,
  },
  timeSeal: {
    width: 83,
    height: 83,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "9deg" }],
  },
  navBar: {
    flexDirection: "row",
    marginTop: 21,
    paddingTop: 17,
    borderTopWidth: 1,
    borderColor: C.line,
    justifyContent: "space-around",
  },
  navItem: {
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 17,
  },
  navText: { fontSize: 14, fontWeight: "700", color: C.muted },
  pill: {
    backgroundColor: C.green,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  pillText: { fontSize: 12, color: "#526340", fontWeight: "700" },
  paper: {
    backgroundColor: C.purple,
    borderRadius: 9,
    padding: 18,
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 16,
    shadowColor: "#51455C",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  tape: {
    position: "absolute",
    top: -9,
    width: 74,
    height: 22,
    backgroundColor: "#D2CCBABB",
    transform: [{ rotate: "-4deg" }],
  },
  paperTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    textAlign: "center",
    color: C.ink,
    marginTop: 8,
  },
  paperHint: {
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    color: "#726B7D",
    marginTop: 7,
    maxWidth: 270,
  },
  direction: {
    backgroundColor: "#ECEEE4",
    padding: 17,
    borderRadius: 20,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginVertical: 18,
  },
  directionTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: C.ink,
  },
  directionSub: { fontSize: 12, lineHeight: 19, color: C.muted, marginTop: 4 },
  link: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  linkText: { fontSize: 14, color: C.muted, fontWeight: "600" },
  error: {
    backgroundColor: "#F9E5D9",
    borderRadius: 14,
    padding: 15,
    marginVertical: 12,
  },
  errorText: { color: "#964B32", fontSize: 14, lineHeight: 22 },
  camera: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: C.ink,
    marginTop: 26,
    marginBottom: 14,
  },
  photo: {
    width: "100%",
    aspectRatio: PHOTO_ASPECT,
    borderRadius: 12,
    backgroundColor: C.line,
  },
  historyCard: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  empty: { paddingVertical: 65, alignItems: "center", gap: 20 },
});
