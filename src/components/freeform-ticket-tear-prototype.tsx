import { useMemo, useRef, useState } from 'react';
import {
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
  Mask,
  Path,
  Rect,
} from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { INK, SIGNAL } from '../theme/detour-theme';

type Point = { x: number; y: number };
type TearDirection = -1 | 0 | 1;

// ticket-base.png is already a single, full ticket in the repository, so the
// interaction prototype can be tested immediately without adding a new native
// dependency or reusing the old main+stub composition. Once the gesture feels
// right this source can be replaced 1:1 by the supplied final transparent art.
const TICKET_SOURCE = require('../../assets/detour/ticket-base.png');
const ARTWORK_WIDTH = 1122;
const ARTWORK_HEIGHT = 1402;
// Measured from the supplied final transparent ticket artwork. Keeping the
// gesture close to the authored perforation makes the tear feel like paper,
// while still allowing the user's path to wander naturally above/below it.
const TEAR_SEAM_RATIO = 1020 / ARTWORK_HEIGHT;
const TEAR_WANDER_PX = 18;
const SAMPLE_DISTANCE_PX = 5;
const COMPLETION_MS = 260;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ordered(points: Point[]) {
  return [...points].sort((a, b) => a.x - b.x);
}

function pathFromPoints(points: Point[]) {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function lowerRegionPath(points: Point[], bottom: number) {
  const sorted = ordered(points);
  if (sorted.length < 2) return '';
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${pathFromPoints(sorted)} L ${last.x.toFixed(1)} ${bottom.toFixed(1)} L ${first.x.toFixed(1)} ${bottom.toFixed(1)} Z`;
}

function roughness(x: number, sampleIndex: number) {
  // Deterministic micro-jitter: enough to stop the edge looking computer-cut,
  // but small enough that the user's own finger path remains the main shape.
  return (
    Math.sin(x * 0.17) * 0.9 +
    Math.sin(x * 0.41) * 0.45 +
    ((sampleIndex % 4) - 1.5) * 0.22
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
  const [completion, setCompletion] = useState(0);
  const [completing, setCompleting] = useState(false);

  const pointsRef = useRef<Point[]>([]);
  const startRef = useRef<Point | null>(null);
  const directionRef = useRef<TearDirection>(0);
  const progressRef = useRef(0);
  const tickIndexRef = useRef(0);
  const completingRef = useRef(false);

  const reset = () => {
    pointsRef.current = [];
    startRef.current = null;
    directionRef.current = 0;
    progressRef.current = 0;
    tickIndexRef.current = 0;
    completingRef.current = false;
    setPoints([]);
    setProgress(0);
    setCompletion(0);
    setCompleting(false);
  };

  const finishTear = () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const startedAt = Date.now();
    const frame = () => {
      const elapsed = Date.now() - startedAt;
      const ratio = clamp(elapsed / COMPLETION_MS, 0, 1);
      // Ease-out cubic keeps the first snap crisp, then lets the paper coast.
      const eased = 1 - Math.pow(1 - ratio, 3);
      setCompletion(eased);
      if (ratio < 1) {
        requestAnimationFrame(frame);
        return;
      }
      onTorn();
    };
    requestAnimationFrame(frame);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          if (completingRef.current) return false;
          const y = event.nativeEvent.locationY;
          return Math.abs(y - seamY) <= 34;
        },
        // Only a touch that begins on the perforation can claim this responder.
        // This prevents an unrelated drag elsewhere on the ticket from turning
        // into a tear halfway through the gesture.
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (completingRef.current) return;
          const point = {
            x: clamp(event.nativeEvent.locationX, 0, ticketWidth),
            y: clamp(event.nativeEvent.locationY, seamY - TEAR_WANDER_PX, seamY + TEAR_WANDER_PX),
          };
          startRef.current = point;
          pointsRef.current = [point];
          directionRef.current = 0;
          progressRef.current = 0;
          tickIndexRef.current = 0;
          setPoints([point]);
          setProgress(0);
          void Haptics.selectionAsync();
        },
        onPanResponderMove: (_event, gesture) => {
          if (completingRef.current) return;
          const start = startRef.current;
          if (!start) return;

          if (directionRef.current === 0 && Math.abs(gesture.dx) >= 5) {
            directionRef.current = gesture.dx >= 0 ? 1 : -1;
          }
          const direction = directionRef.current;
          if (direction === 0) return;

          const previous = pointsRef.current[pointsRef.current.length - 1] ?? start;
          let x = clamp(start.x + gesture.dx, 0, ticketWidth);
          x = direction === 1 ? Math.max(previous.x, x) : Math.min(previous.x, x);
          if (Math.abs(x - previous.x) < SAMPLE_DISTANCE_PX) return;

          const sampleIndex = pointsRef.current.length;
          const fingerY = start.y + gesture.dy;
          const y = clamp(
            fingerY + roughness(x, sampleIndex),
            seamY - TEAR_WANDER_PX,
            seamY + TEAR_WANDER_PX
          );
          const next = { x, y };
          const nextPoints = [...pointsRef.current, next];
          pointsRef.current = nextPoints;
          setPoints(nextPoints);

          const targetDistance = Math.max(
            70,
            direction === 1 ? ticketWidth - start.x : start.x
          );
          const nextProgress = clamp(Math.abs(x - start.x) / targetDistance, 0, 1);
          progressRef.current = nextProgress;
          setProgress(nextProgress);

          const thresholds = [0.18, 0.38, 0.58, 0.78];
          const nextTick = tickIndexRef.current;
          if (nextTick < thresholds.length && nextProgress >= thresholds[nextTick]) {
            tickIndexRef.current = nextTick + 1;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (completingRef.current) return;
          const enoughTravel = Math.abs(gesture.dx) >= Math.max(58, ticketWidth * 0.24);
          if (progressRef.current >= 0.88 && enoughTravel) {
            const direction = directionRef.current || (gesture.dx >= 0 ? 1 : -1);
            const last = pointsRef.current[pointsRef.current.length - 1] ?? startRef.current;
            if (last) {
              const edgePoint = {
                x: direction === 1 ? ticketWidth : 0,
                y: last.y,
              };
              pointsRef.current = [...pointsRef.current, edgePoint];
              setPoints(pointsRef.current);
            }
            finishTear();
            return;
          }
          void Haptics.selectionAsync();
          reset();
        },
        onPanResponderTerminate: () => {
          if (!completingRef.current) reset();
        },
      }),
    [seamY, ticketWidth]
  );

  const sortedPoints = ordered(points);
  const hasLiveTear = sortedPoints.length >= 2;
  const first = sortedPoints[0];
  const last = sortedPoints[sortedPoints.length - 1];

  const liveRegion = hasLiveTear ? lowerRegionPath(sortedPoints, ticketHeight) : '';
  const liveLine = hasLiveTear ? pathFromPoints(sortedPoints) : '';

  const fullBoundary = hasLiveTear
    ? [
        { x: 0, y: seamY },
        ...(first.x > 0.5 ? [{ x: first.x, y: first.y }] : []),
        ...sortedPoints,
        ...(last.x < ticketWidth - 0.5 ? [{ x: last.x, y: last.y }] : []),
        { x: ticketWidth, y: seamY },
      ]
    : [
        { x: 0, y: seamY },
        { x: ticketWidth, y: seamY },
      ];

  // Remove accidental duplicate neighbors before building the completed clip.
  const dedupedBoundary = fullBoundary.filter((point, index, array) => {
    if (index === 0) return true;
    const previous = array[index - 1];
    return Math.abs(point.x - previous.x) > 0.25 || Math.abs(point.y - previous.y) > 0.25;
  });
  const completeRegion = lowerRegionPath(dedupedBoundary, ticketHeight);
  const completeLine = pathFromPoints(dedupedBoundary);

  const activeRegion = completing ? completeRegion : liveRegion;
  const activeLine = completing ? completeLine : liveLine;
  const hasActiveRegion = activeRegion.length > 0;
  const direction = directionRef.current || 1;
  const pieceDx = direction * (progress * 3 + completion * ticketWidth * 0.56);
  const pieceDy = progress * 6 + completion * 54;
  const pieceOpacity = 1 - completion * 0.48;

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
        <View
          {...responder.panHandlers}
          style={{ width: ticketWidth, height: ticketHeight }}
        >
          <Svg width={ticketWidth} height={ticketHeight} viewBox={`0 0 ${ticketWidth} ${ticketHeight}`}>
            <Defs>
              {hasActiveRegion && (
                <>
                  <Mask id="intact-mask" x={0} y={0} width={ticketWidth} height={ticketHeight}>
                    <Rect x={0} y={0} width={ticketWidth} height={ticketHeight} fill="white" />
                    <Path d={activeRegion} fill="black" />
                  </Mask>
                  <ClipPath id="torn-piece-clip">
                    <Path d={activeRegion} />
                  </ClipPath>
                </>
              )}
            </Defs>

            {!hasActiveRegion ? (
              <SvgImage
                href={TICKET_SOURCE}
                x={0}
                y={0}
                width={ticketWidth}
                height={ticketHeight}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <>
                <SvgImage
                  href={TICKET_SOURCE}
                  x={0}
                  y={0}
                  width={ticketWidth}
                  height={ticketHeight}
                  preserveAspectRatio="xMidYMid meet"
                  mask="url(#intact-mask)"
                />

                <G
                  clipPath="url(#torn-piece-clip)"
                  transform={`translate(${pieceDx.toFixed(2)} ${pieceDy.toFixed(2)})`}
                  opacity={pieceOpacity}
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

                <Path
                  d={activeLine}
                  fill="none"
                  stroke="rgba(68,55,42,0.20)"
                  strokeWidth={2.2}
                  transform="translate(0 1.2)"
                />
                <Path
                  d={activeLine}
                  fill="none"
                  stroke="rgba(255,252,244,0.96)"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </Svg>
        </View>
      </View>

      <View pointerEvents="none" style={styles.hintWrap}>
        <View style={styles.hintRule} />
        <Text style={styles.hint}>從任一側沿齒孔滑過</Text>
        <Text style={styles.subHint}>齒孔會吸住你的手，不用撕成直線</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F1E7',
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
