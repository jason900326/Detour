import { useMemo, useRef, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Path as SkiaPathView,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { INK, SIGNAL } from '../theme/detour-theme';

type Point = { x: number; y: number };
type TearDirection = -1 | 1;

type ActiveDrag = {
  active: boolean;
  anchor: Point;
  touchStartY: number;
};

const TICKET_SOURCE = require('../../assets/detour/ticket-base.png');
const ARTWORK_WIDTH = 1122;
const ARTWORK_HEIGHT = 1402;
const SEAM_RATIO = 1027 / ARTWORK_HEIGHT;
const PAGE = '#F6F1E7';
const EDGE_START_PX = 104;
const RESUME_RADIUS_PX = 72;
const HIT_HEIGHT = 92;
const WANDER_PX = 18;
const SAMPLE_PX = 5;
const FINISH_MS = 560;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ordered(points: Point[]) {
  return [...points].sort((a, b) => a.x - b.x);
}

function fibreJitter(x: number, index: number) {
  return (
    Math.sin(x * 0.22) * 0.7 +
    Math.sin(x * 0.51) * 0.34 +
    ((index % 5) - 2) * 0.12
  );
}

function buildSmoothPath(points: Point[]) {
  const p = ordered(points);
  if (p.length === 0) return null;

  const path = Skia.Path.Make();
  path.moveTo(p[0].x, p[0].y);

  if (p.length === 1) return path;
  if (p.length === 2) {
    path.lineTo(p[1].x, p[1].y);
    return path;
  }

  for (let index = 1; index < p.length - 1; index += 1) {
    const current = p[index];
    const next = p[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path.quadTo(current.x, current.y, midX, midY);
  }

  const last = p[p.length - 1];
  path.lineTo(last.x, last.y);
  return path;
}

function buildLowerRegion(points: Point[], bottom: number) {
  const p = ordered(points);
  if (p.length < 2) return null;

  const path = buildSmoothPath(p);
  if (!path) return null;

  const first = p[0];
  const last = p[p.length - 1];
  path.lineTo(last.x, bottom);
  path.lineTo(first.x, bottom);
  path.close();
  return path;
}

function shiftedPoints(points: Point[], dy: number) {
  return points.map((point) => ({ x: point.x, y: point.y + dy }));
}

export function TearLab() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const ticketImage = useImage(TICKET_SOURCE);

  const maxByWidth = windowWidth - 44;
  const maxByHeight = Math.max(
    220,
    (windowHeight - 286) * (ARTWORK_WIDTH / ARTWORK_HEIGHT)
  );
  const ticketWidth = Math.min(320, maxByWidth, maxByHeight);
  const ticketHeight = ticketWidth * (ARTWORK_HEIGHT / ARTWORK_WIDTH);
  const seamY = ticketHeight * SEAM_RATIO;
  const gestureTop = seamY - HIT_HEIGHT / 2;

  const [points, setPoints] = useState<Point[]>([]);
  const [progress, setProgress] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [completion, setCompletion] = useState(0);
  const [direction, setDirection] = useState<TearDirection>(1);

  const pointsRef = useRef<Point[]>([]);
  const progressRef = useRef(0);
  const directionRef = useRef<TearDirection>(1);
  const tickRef = useRef(0);
  const finishingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const activeDragRef = useRef<ActiveDrag>({
    active: false,
    anchor: { x: 0, y: seamY },
    touchStartY: seamY,
  });

  const reset = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    finishingRef.current = false;
    pointsRef.current = [];
    progressRef.current = 0;
    tickRef.current = 0;
    activeDragRef.current.active = false;
    setPoints([]);
    setProgress(0);
    setFinishing(false);
    setCompletion(0);
  };

  const finish = (tearDirection: TearDirection) => {
    if (finishingRef.current) return;

    const current = ordered(pointsRef.current);
    if (current.length < 2) return;

    const edgeX = tearDirection === 1 ? ticketWidth : 0;
    const tail =
      tearDirection === 1 ? current[current.length - 1] : current[0];
    const finalPoints = ordered([...current, { x: edgeX, y: tail.y }]);

    finishingRef.current = true;
    activeDragRef.current.active = false;
    pointsRef.current = finalPoints;
    progressRef.current = 1;
    setPoints(finalPoints);
    setProgress(1);
    setDirection(tearDirection);
    setFinishing(true);
    setCompletion(0);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(
      () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      62
    );

    const startedAt = Date.now();
    const step = () => {
      const t = clamp((Date.now() - startedAt) / FINISH_MS, 0, 1);
      setCompletion(t);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      frameRef.current = null;
      setTimeout(reset, 360);
    };
    frameRef.current = requestAnimationFrame(step);
  };

  const beginDrag = (x: number, yInStrip: number) => {
    if (finishingRef.current) return;

    const ticketY = clamp(
      gestureTop + yInStrip,
      seamY - WANDER_PX,
      seamY + WANDER_PX
    );
    const current = ordered(pointsRef.current);

    if (current.length >= 2) {
      const tearDirection = directionRef.current;
      const tip =
        tearDirection === 1 ? current[current.length - 1] : current[0];

      if (Math.abs(x - tip.x) > RESUME_RADIUS_PX) {
        activeDragRef.current.active = false;
        return;
      }

      activeDragRef.current = {
        active: true,
        anchor: tip,
        touchStartY: ticketY,
      };
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    const onLeft = x <= EDGE_START_PX;
    const onRight = x >= ticketWidth - EDGE_START_PX;
    if (!onLeft && !onRight) {
      activeDragRef.current.active = false;
      return;
    }

    const tearDirection: TearDirection = onLeft ? 1 : -1;
    const edgeX = tearDirection === 1 ? 0 : ticketWidth;
    const start = ordered([
      { x: edgeX, y: seamY },
      { x: clamp(x, 0, ticketWidth), y: ticketY },
    ]);

    directionRef.current = tearDirection;
    setDirection(tearDirection);
    pointsRef.current = start;
    progressRef.current = Math.abs(x - edgeX) / ticketWidth;
    tickRef.current = 0;
    activeDragRef.current = {
      active: true,
      anchor:
        tearDirection === 1 ? start[start.length - 1] : start[0],
      touchStartY: ticketY,
    };
    setPoints(start);
    setProgress(progressRef.current);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateDrag = (translationX: number, translationY: number) => {
    if (finishingRef.current || !activeDragRef.current.active) return;

    const current = ordered(pointsRef.current);
    if (current.length < 2) return;

    const tearDirection = directionRef.current;
    const anchor = activeDragRef.current.anchor;
    const previous =
      tearDirection === 1 ? current[current.length - 1] : current[0];

    let x = clamp(anchor.x + translationX, 0, ticketWidth);
    x =
      tearDirection === 1
        ? Math.max(previous.x, x)
        : Math.min(previous.x, x);

    if (Math.abs(x - previous.x) < SAMPLE_PX) return;

    const rawY = clamp(
      anchor.y + translationY * 0.68,
      seamY - WANDER_PX,
      seamY + WANDER_PX
    );
    const guidedY = previous.y * 0.58 + rawY * 0.42;
    const y = clamp(
      guidedY + fibreJitter(x, current.length),
      seamY - WANDER_PX,
      seamY + WANDER_PX
    );

    const next = ordered([...current, { x, y }]);
    pointsRef.current = next;
    setPoints(next);

    const nextProgress =
      tearDirection === 1
        ? clamp(x / ticketWidth, 0, 1)
        : clamp((ticketWidth - x) / ticketWidth, 0, 1);
    progressRef.current = nextProgress;
    setProgress(nextProgress);

    const thresholds = [0.14, 0.28, 0.42, 0.56, 0.7, 0.82, 0.91];
    const tick = tickRef.current;
    if (tick < thresholds.length && nextProgress >= thresholds[tick]) {
      tickRef.current = tick + 1;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }

    if (nextProgress >= 0.965) finish(tearDirection);
  };

  const endDrag = () => {
    activeDragRef.current.active = false;
    if (finishingRef.current) return;

    if (progressRef.current >= 0.88) {
      finish(directionRef.current);
      return;
    }

    // A half-torn paper does not magically repair itself. Leave the tear where
    // it is and let the next touch resume from the current tear tip.
    if (pointsRef.current.length >= 2) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const tearGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => beginDrag(event.x, event.y))
        .onUpdate((event) => updateDrag(event.translationX, event.translationY))
        .onEnd(endDrag)
        .onFinalize(() => {
          activeDragRef.current.active = false;
        }),
    [gestureTop, seamY, ticketWidth]
  );

  const livePoints = ordered(points);
  const hasTear = livePoints.length >= 2;

  const regionPath = useMemo(
    () => buildLowerRegion(livePoints, ticketHeight),
    [points, ticketHeight]
  );
  const edgePath = useMemo(() => buildSmoothPath(livePoints), [points]);
  const edgeShadowPath = useMemo(
    () => buildSmoothPath(shiftedPoints(livePoints, 1.25)),
    [points]
  );

  const lastPoint =
    direction === 1
      ? livePoints[livePoints.length - 1]
      : livePoints[0];
  const edgeLean = lastPoint
    ? clamp((lastPoint.y - seamY) / WANDER_PX, -1, 1)
    : 0;

  const finishEase = 1 - Math.pow(1 - completion, 3);
  const gravity = completion * completion;
  const liveGap = 0.9 + progress * 3.2;
  const pieceX = finishing
    ? direction * 22 * finishEase
    : direction * progress * 1.6;
  const pieceY = finishing ? 3 + gravity * 108 : liveGap;
  const pieceRotation = finishing
    ? direction * 0.075 * finishEase
    : edgeLean * 0.012 * progress;
  const pieceOrigin = {
    x: ticketWidth / 2,
    y: seamY + (ticketHeight - seamY) / 2,
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.top}>
          <Text style={styles.brand}>DETOUR</Text>
          <Text style={styles.title}>撕票手感測試</Text>
          <View style={styles.accent} />
        </View>

        <View style={styles.stage}>
          <View style={{ width: ticketWidth, height: ticketHeight }}>
            <Canvas style={StyleSheet.absoluteFill}>
              {ticketImage && !hasTear && (
                <SkiaImage
                  image={ticketImage}
                  x={0}
                  y={0}
                  width={ticketWidth}
                  height={ticketHeight}
                  fit="contain"
                />
              )}

              {ticketImage && hasTear && regionPath && (
                <>
                  <Group clip={regionPath} invertClip>
                    <SkiaImage
                      image={ticketImage}
                      x={0}
                      y={0}
                      width={ticketWidth}
                      height={ticketHeight}
                      fit="contain"
                    />
                  </Group>

                  <Group
                    clip={regionPath}
                    origin={pieceOrigin}
                    transform={[
                      { translateX: pieceX },
                      { translateY: pieceY },
                      { rotate: pieceRotation },
                    ]}
                  >
                    <SkiaImage
                      image={ticketImage}
                      x={0}
                      y={0}
                      width={ticketWidth}
                      height={ticketHeight}
                      fit="contain"
                    />
                  </Group>

                  {edgeShadowPath && (
                    <SkiaPathView
                      path={edgeShadowPath}
                      color="rgba(66,49,34,0.28)"
                      style="stroke"
                      strokeWidth={1.55}
                      strokeCap="round"
                      strokeJoin="round"
                    />
                  )}
                  {edgePath && (
                    <SkiaPathView
                      path={edgePath}
                      color="rgba(255,253,246,0.98)"
                      style="stroke"
                      strokeWidth={1.35}
                      strokeCap="round"
                      strokeJoin="round"
                    />
                  )}
                </>
              )}
            </Canvas>

            {!finishing && (
              <GestureDetector gesture={tearGesture}>
                <View
                  style={[
                    styles.gestureStrip,
                    {
                      top: gestureTop,
                      width: ticketWidth,
                      height: HIT_HEIGHT,
                    },
                  ]}
                />
              </GestureDetector>
            )}
          </View>
        </View>

        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintMain}>沿齒孔撕；放手後可以接著撕</Text>
          <Text style={styles.hintSub}>裂口跟手走，不會強制拉成固定直線</Text>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: PAGE,
  },
  top: {
    paddingTop: 16,
    alignItems: 'center',
  },
  brand: {
    alignSelf: 'flex-start',
    marginLeft: 24,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.4,
    color: INK,
  },
  title: {
    marginTop: 28,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: INK,
  },
  accent: {
    marginTop: 9,
    width: 126,
    height: 6,
    borderRadius: 999,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-1deg' }],
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  gestureStrip: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'transparent',
  },
  hint: {
    alignItems: 'center',
    paddingBottom: 14,
  },
  hintMain: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6F6A62',
  },
  hintSub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#969087',
  },
});
