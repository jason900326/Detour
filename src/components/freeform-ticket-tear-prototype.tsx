import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
} from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { INK, SIGNAL } from '../theme/detour-theme';

type Point = { x: number; y: number };
type TearDirection = -1 | 1;

const TICKET_SOURCE = require('../../assets/detour/ticket-base.png');
const ARTWORK_WIDTH = 1122;
const ARTWORK_HEIGHT = 1402;
const TEAR_SEAM_RATIO = 1020 / ARTWORK_HEIGHT;
const TEAR_WANDER_PX = 14;
const SAMPLE_DISTANCE_PX = 4;
const START_EDGE_PX = 48;
const SCREEN_PAPER = '#F6F1E7';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ordered(points: Point[]) {
  return [...points].sort((a, b) => a.x - b.x);
}

function smoothPathFromPoints(points: Point[]) {
  const sorted = ordered(points);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) {
    return `M ${sorted[0].x.toFixed(1)} ${sorted[0].y.toFixed(1)}`;
  }
  if (sorted.length === 2) {
    return `M ${sorted[0].x.toFixed(1)} ${sorted[0].y.toFixed(1)} L ${sorted[1].x.toFixed(1)} ${sorted[1].y.toFixed(1)}`;
  }

  let path = `M ${sorted[0].x.toFixed(1)} ${sorted[0].y.toFixed(1)}`;
  for (let index = 1; index < sorted.length - 1; index += 1) {
    const point = sorted[index];
    const next = sorted[index + 1];
    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    path += ` Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = sorted[sorted.length - 1];
  path += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return path;
}

function lowerRegionPath(points: Point[], bottom: number) {
  const sorted = ordered(points);
  if (sorted.length < 2) return '';
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${smoothPathFromPoints(sorted)} L ${last.x.toFixed(1)} ${bottom.toFixed(1)} L ${first.x.toFixed(1)} ${bottom.toFixed(1)} Z`;
}

function roughness(x: number, sampleIndex: number) {
  // Keep a little paper-fibre irregularity without turning finger jitter into
  // a saw-tooth edge. The user's path remains the dominant shape.
  return (
    Math.sin(x * 0.21) * 0.72 +
    Math.sin(x * 0.47) * 0.36 +
    ((sampleIndex % 5) - 2) * 0.14
  );
}

export function FreeformTicketTearPrototype({
  onBack,
  onTorn,
}: {
  onBack: () => void;
  onTorn: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const ticketWidth = Math.min(350, windowWidth - 30);
  const ticketHeight = ticketWidth * (ARTWORK_HEIGHT / ARTWORK_WIDTH);
  const seamY = ticketHeight * TEAR_SEAM_RATIO;

  const [points, setPoints] = useState<Point[]>([]);
  const [progress, setProgress] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completeRegion, setCompleteRegion] = useState('');
  const [completeLine, setCompleteLine] = useState('');
  const [completionDirection, setCompletionDirection] = useState<TearDirection>(1);

  const pointsRef = useRef<Point[]>([]);
  const directionRef = useRef<TearDirection>(1);
  const progressRef = useRef(0);
  const tickIndexRef = useRef(0);
  const completingRef = useRef(false);

  const stubX = useRef(new Animated.Value(0)).current;
  const stubY = useRef(new Animated.Value(0)).current;
  const stubTurn = useRef(new Animated.Value(0)).current;
  const ticketNudgeX = useRef(new Animated.Value(0)).current;
  const ticketNudgeY = useRef(new Animated.Value(0)).current;

  const reset = () => {
    pointsRef.current = [];
    progressRef.current = 0;
    tickIndexRef.current = 0;
    completingRef.current = false;
    stubX.setValue(0);
    stubY.setValue(0);
    stubTurn.setValue(0);
    ticketNudgeX.setValue(0);
    ticketNudgeY.setValue(0);
    setPoints([]);
    setProgress(0);
    setCompleting(false);
    setCompleteRegion('');
    setCompleteLine('');
  };

  const finishTear = (direction: TearDirection) => {
    if (completingRef.current) return;

    const current = ordered(pointsRef.current);
    if (current.length < 2) return;

    const farEdge = direction === 1 ? ticketWidth : 0;
    const tail = direction === 1 ? current[current.length - 1] : current[0];
    const completedPoints = ordered([
      ...current,
      { x: farEdge, y: tail.y },
    ]);
    const region = lowerRegionPath(completedPoints, ticketHeight);
    const line = smoothPathFromPoints(completedPoints);

    completingRef.current = true;
    setCompleting(true);
    setCompletionDirection(direction);
    setCompleteRegion(region);
    setCompleteLine(line);
    setProgress(1);

    // A perforated paper edge feels much closer to Rigid/Heavy than to Soft.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    stubX.setValue(0);
    stubY.setValue(0);
    stubTurn.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(ticketNudgeX, {
          toValue: -direction * 2.5,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(ticketNudgeX, {
          toValue: 0,
          speed: 28,
          bounciness: 2,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(ticketNudgeY, {
          toValue: -1.5,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(ticketNudgeY, {
          toValue: 0,
          speed: 28,
          bounciness: 2,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(stubX, {
        toValue: direction * 18,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(stubY, {
        toValue: 96,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(stubTurn, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onTorn();
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          if (completingRef.current) return false;
          const { locationX: x, locationY: y } = event.nativeEvent;
          const onSeam = Math.abs(y - seamY) <= 34;
          const onEdge = x <= START_EDGE_PX || x >= ticketWidth - START_EDGE_PX;
          return onSeam && onEdge;
        },
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (completingRef.current) return;
          const { locationX, locationY } = event.nativeEvent;
          const direction: TearDirection = locationX <= ticketWidth / 2 ? 1 : -1;
          const x = direction === 1 ? 0 : ticketWidth;
          const y = clamp(
            locationY,
            seamY - TEAR_WANDER_PX,
            seamY + TEAR_WANDER_PX
          );

          directionRef.current = direction;
          pointsRef.current = [{ x, y }];
          progressRef.current = 0;
          tickIndexRef.current = 0;
          setPoints([{ x, y }]);
          setProgress(0);

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        },
        onPanResponderMove: (_event, gesture) => {
          if (completingRef.current) return;
          const current = pointsRef.current;
          const first = current[0];
          if (!first) return;

          const direction = directionRef.current;
          const previous = current[current.length - 1] ?? first;
          let x = clamp(first.x + gesture.dx, 0, ticketWidth);
          x = direction === 1 ? Math.max(previous.x, x) : Math.min(previous.x, x);
          if (Math.abs(x - previous.x) < SAMPLE_DISTANCE_PX) return;

          const rawY = clamp(
            first.y + gesture.dy,
            seamY - TEAR_WANDER_PX,
            seamY + TEAR_WANDER_PX
          );
          // Finger motion is intentionally damped. The perforation guides the
          // tear, but does not flatten it into a pre-authored straight line.
          const guidedY = previous.y * 0.68 + rawY * 0.32;
          const sampleIndex = current.length;
          const y = clamp(
            guidedY + roughness(x, sampleIndex),
            seamY - TEAR_WANDER_PX,
            seamY + TEAR_WANDER_PX
          );

          const nextPoints = [...current, { x, y }];
          pointsRef.current = nextPoints;
          setPoints(nextPoints);

          const nextProgress = clamp(Math.abs(x - first.x) / ticketWidth, 0, 1);
          progressRef.current = nextProgress;
          setProgress(nextProgress);

          // Crisp tooth-by-tooth taps. Rigid is deliberately stronger than the
          // previous Soft feedback, which was almost imperceptible on device.
          const thresholds = [0.12, 0.24, 0.36, 0.48, 0.60, 0.72, 0.84];
          const nextTick = tickIndexRef.current;
          if (nextTick < thresholds.length && nextProgress >= thresholds[nextTick]) {
            tickIndexRef.current = nextTick + 1;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
          }

          if (nextProgress >= 0.965) {
            finishTear(direction);
          }
        },
        onPanResponderRelease: () => {
          if (completingRef.current) return;
          if (progressRef.current >= 0.88) {
            finishTear(directionRef.current);
            return;
          }
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          reset();
        },
        onPanResponderTerminate: () => {
          if (!completingRef.current) reset();
        },
      }),
    [seamY, ticketWidth]
  );

  const livePoints = ordered(points);
  const hasLiveTear = !completing && livePoints.length >= 2;
  const liveRegion = hasLiveTear ? lowerRegionPath(livePoints, ticketHeight) : '';
  const liveLine = hasLiveTear ? smoothPathFromPoints(livePoints) : '';
  const liveGap = 1.3 + progress * 1.9;

  const finalRegion = completing ? completeRegion : '';
  const finalLine = completing ? completeLine : '';
  const eraseRegion = completing ? finalRegion : liveRegion;
  const edgeLine = completing ? finalLine : liveLine;

  const finalRotation = stubTurn.interpolate({
    inputRange: [0, 1],
    outputRange: [
      '0deg',
      completionDirection === 1 ? '4deg' : '-4deg',
    ],
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={16} style={styles.backButton}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.brand}>DETOUR</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.headingWrap}>
        <Text style={styles.title}>車票完成</Text>
        <View style={styles.accent} />
      </View>

      <View style={styles.ticketStage}>
        <Animated.View
          {...responder.panHandlers}
          style={{
            width: ticketWidth,
            height: ticketHeight,
            transform: [
              { translateX: ticketNudgeX },
              { translateY: ticketNudgeY },
            ],
          }}
        >
          {/* Keep the real raster ticket mounted at all times. The previous SVG
              mask caused iOS to drop the whole raster as soon as the gesture
              started. We now erase only the torn region above this stable base. */}
          <Image
            source={TICKET_SOURCE}
            resizeMode="contain"
            style={StyleSheet.absoluteFill}
          />

          {(hasLiveTear || completing) && (
            <Svg
              pointerEvents="none"
              width={ticketWidth}
              height={ticketHeight}
              viewBox={`0 0 ${ticketWidth} ${ticketHeight}`}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                {hasLiveTear && (
                  <ClipPath id="live-torn-piece-clip">
                    <Path d={liveRegion} />
                  </ClipPath>
                )}
              </Defs>

              {/* Paint only the separated paper region with the page colour.
                  This replaces the unstable raster mask without ever hiding the
                  untouched part of the ticket. */}
              {!!eraseRegion && <Path d={eraseRegion} fill={SCREEN_PAPER} />}

              {hasLiveTear && (
                <G
                  clipPath="url(#live-torn-piece-clip)"
                  transform={`translate(0 ${liveGap.toFixed(2)})`}
                >
                  <SvgImage
                    href={TICKET_SOURCE}
                    x={0}
                    y={0}
                    width={ticketWidth}
                    height={ticketHeight}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </G>
              )}

              {!!edgeLine && (
                <>
                  <Path
                    d={edgeLine}
                    fill="none"
                    stroke="rgba(67,52,39,0.24)"
                    strokeWidth={1.5}
                    transform="translate(0 1.25)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d={edgeLine}
                    fill="none"
                    stroke="rgba(255,253,247,0.98)"
                    strokeWidth={1.35}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </Svg>
          )}

          {completing && !!finalRegion && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    { translateX: stubX },
                    { translateY: stubY },
                    { rotate: finalRotation },
                  ],
                },
              ]}
            >
              <Svg
                width={ticketWidth}
                height={ticketHeight}
                viewBox={`0 0 ${ticketWidth} ${ticketHeight}`}
              >
                <Defs>
                  <ClipPath id="final-stub-clip">
                    <Path d={finalRegion} />
                  </ClipPath>
                </Defs>
                <G clipPath="url(#final-stub-clip)">
                  <SvgImage
                    href={TICKET_SOURCE}
                    x={0}
                    y={0}
                    width={ticketWidth}
                    height={ticketHeight}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </G>
              </Svg>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      <View pointerEvents="none" style={styles.hintWrap}>
        <View style={styles.hintRule} />
        <Text style={styles.hint}>從票券左右任一側開始撕</Text>
        <Text style={styles.subHint}>不用走直線，齒孔會把裂口拉回附近</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_PAPER,
  },
  topBar: {
    height: 72,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 48,
    justifyContent: 'center',
  },
  back: {
    marginTop: -3,
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '500',
    color: INK,
  },
  brand: {
    flex: 1,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  headingWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 37,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: INK,
  },
  accent: {
    marginTop: 12,
    width: 160,
    height: 7,
    borderRadius: 999,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-1deg' }],
  },
  ticketStage: {
    flex: 1,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintWrap: {
    paddingBottom: 10,
    alignItems: 'center',
  },
  hintRule: {
    width: 28,
    height: 1,
    marginBottom: 9,
    backgroundColor: '#C1BCB2',
  },
  hint: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.25,
    color: '#6F6A62',
  },
  subHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: '#969087',
  },
});