import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path as SvgPath } from 'react-native-svg';

import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';
import { INK, SIGNAL } from '../theme/detour-theme';
import { V45MoodIcon } from './mood-visuals';
import { useTicketTear } from './ticket-tear-context';

let ticketArtworkDecoded = false;

const DETOUR_TICKET_BARS = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3];
const DETOUR_TICKET_EDGE = Array.from({ length: 8 }, (_, index) => 30 + index * 50);

export const DETOUR_TICKET_WIDTH = 260;
export const DETOUR_TICKET_BASE_SOURCE = require('../../assets/detour/ticket-base.png');

const TICKET_ARTWORK_WIDTH = 1122;
const TICKET_ARTWORK_HEIGHT = 1402;
const TICKET_TEAR_Y = 1027;
const TICKET_SCALE = DETOUR_TICKET_WIDTH / TICKET_ARTWORK_WIDTH;
const artPx = (value: number) => value * TICKET_SCALE;

export const DETOUR_TICKET_HEIGHT =
  DETOUR_TICKET_WIDTH * (TICKET_ARTWORK_HEIGHT / TICKET_ARTWORK_WIDTH);
export const DETOUR_TICKET_TEAR_SEAM_RATIO =
  TICKET_TEAR_Y / TICKET_ARTWORK_HEIGHT;

const TICKET_INTERACTION_SCALE = DETOUR_TICKET_WIDTH / 310;
const TEAR_EDGE_START_PX = 104 * TICKET_INTERACTION_SCALE;
const TEAR_HIT_HEIGHT = 92 * TICKET_INTERACTION_SCALE;
const TEAR_WANDER_PX = 18 * TICKET_INTERACTION_SCALE;
const TEAR_SAMPLE_PX = 5 * TICKET_INTERACTION_SCALE;
const TEAR_AUTOFINISH_PROGRESS = 0.5;
const TEAR_EXTENSION_MS = 190;
const TEAR_DROP_MS = 430;

type TearPoint = { x: number; y: number };
type TearDirection = -1 | 1;
type ActiveDrag = {
  active: boolean;
  anchor: TearPoint;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ordered(points: TearPoint[]) {
  return [...points].sort((a, b) => a.x - b.x);
}

function fibreJitter(x: number, index: number) {
  return (
    Math.sin(x * 0.22) * 0.7 +
    Math.sin(x * 0.51) * 0.34 +
    ((index % 5) - 2) * 0.12
  );
}

function buildSmoothPath(points: TearPoint[]) {
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

function buildLowerRegion(points: TearPoint[], bottom: number) {
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

function shiftedPoints(points: TearPoint[], dy: number) {
  return points.map((point) => ({ x: point.x, y: point.y + dy }));
}

export type DetourTicketProps = {
  timeLabel: string;
  moodLabel: string;
  serial: string;
  stamped?: boolean;
  stampProgress?: Animated.Value;
};

export function DetourTicket({
  timeLabel,
  moodLabel,
  serial,
  stamped = false,
  stampProgress,
}: DetourTicketProps) {
  const stampStyle = stampProgress
    ? {
        opacity: stampProgress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0.18, 1],
        }),
        transform: [
          { rotate: '-7deg' },
          {
            translateY: stampProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [-28, 3, 0],
            }),
          },
          {
            scale: stampProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [1.32, 0.94, 1],
            }),
          },
        ],
      }
    : {
        opacity: stamped ? 1 : 0,
        transform: [{ rotate: '-7deg' }],
      };

  return (
    <View style={styles.v44TicketPaper}>
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`left-${top}`} style={[styles.v44TicketEdgeCut, styles.v44TicketEdgeLeft, { top }]} />
      ))}
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`right-${top}`} style={[styles.v44TicketEdgeCut, styles.v44TicketEdgeRight, { top }]} />
      ))}

      <View style={styles.v44TicketHeader}>
        <Text style={styles.v44TicketBrand}>DETOUR</Text>
        <Text style={styles.v44TicketSerial}>{serial}</Text>
      </View>

      <View style={styles.v44TicketRule} />

      <View style={styles.v44TicketTimeBlock}>
        <Text style={styles.v44TicketLabel}>時間</Text>
        <View style={styles.v44TicketTimeRow}>
          <Text style={styles.v44TicketTime}>{timeLabel}</Text>
          <Text style={styles.v44TicketTimeUnit}>分鐘</Text>
        </View>
      </View>

      <View style={styles.v44TicketMoodBlock}>
        <View style={styles.v44TicketMoodCopy}>
          <Text style={styles.v44TicketLabel}>心情</Text>
          <Text style={styles.v44TicketMood}>{moodLabel}</Text>
        </View>

        {stamped && (
          <Animated.View style={[styles.v44TicketStamp, stampStyle]}>
            <Text style={styles.v44TicketStampText}>終點保密</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.v44TicketDash} />

      <View style={styles.v44TicketFooter}>
        <View style={styles.v44TicketBarcode}>
          {DETOUR_TICKET_BARS.map((width, index) => (
            <View key={`${width}-${index}`} style={[styles.v44TicketBar, { width }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function DetourAccentStroke({
  width,
  style,
}: {
  width: number;
  style?: any;
}) {
  const height = 18;
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <SvgPath
          d={`M 5 12 Q ${Math.round(width * 0.52)} 4 ${width - 5} 8`}
          fill="none"
          stroke={SIGNAL}
          strokeWidth={7}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// DETOUR V45 — ticket / mood / recap visual system

type V45TicketProps = {
  timeLabel: string;
  moodLabel: string;
  moodId: MoodId;
  serial: string;
  stamped?: boolean;
  stampProgress?: Animated.Value;
  artworkVisible?: boolean;
  showBarcode?: boolean;
  showStubArtwork?: boolean;
  renderWidth?: number;
};

export function V45Ticket({
  timeLabel,
  moodLabel,
  moodId,
  serial,
  stamped = false,
  stampProgress,
  artworkVisible = true,
  showBarcode = false,
  renderWidth = DETOUR_TICKET_WIDTH,
}: V45TicketProps) {
  const [artworkReady, setArtworkReady] = useState(
    artworkVisible ? ticketArtworkDecoded : true
  );
  const [tearPoints, setTearPoints] = useState<TearPoint[]>([]);
  const [tearProgress, setTearProgress] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [completion, setCompletion] = useState(0);
  const [direction, setDirection] = useState<TearDirection>(1);

  const feedJitter = useRef(new Animated.Value(0)).current;
  const tearPointsRef = useRef<TearPoint[]>([]);
  const tearProgressRef = useRef(0);
  const directionRef = useRef<TearDirection>(1);
  const tickRef = useRef(0);
  const finishingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const activeDragRef = useRef<ActiveDrag>({
    active: false,
    anchor: { x: 0, y: DETOUR_TICKET_HEIGHT * DETOUR_TICKET_TEAR_SEAM_RATIO },
  });

  const ticketImage = useImage(DETOUR_TICKET_BASE_SOURCE);
  const { enabled: tearEnabled, onTorn } = useTicketTear();
  const seamY = DETOUR_TICKET_HEIGHT * DETOUR_TICKET_TEAR_SEAM_RATIO;
  const gestureTop = seamY - TEAR_HIT_HEIGHT / 2;

  const markArtworkReady = () => {
    ticketArtworkDecoded = true;
    setArtworkReady(true);
  };

  const clearTear = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    finishingRef.current = false;
    tearPointsRef.current = [];
    tearProgressRef.current = 0;
    directionRef.current = 1;
    tickRef.current = 0;
    activeDragRef.current.active = false;
    setTearPoints([]);
    setTearProgress(0);
    setFinishing(false);
    setCompletion(0);
    setDirection(1);
  };

  useEffect(() => {
    if (!artworkVisible) setArtworkReady(true);
  }, [artworkVisible]);

  useEffect(() => {
    if (!tearEnabled) clearTear();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [tearEnabled]);

  useEffect(() => {
    feedJitter.stopAnimation();
    feedJitter.setValue(0);

    if (stamped) return;

    const feedLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(feedJitter, {
          toValue: 1,
          duration: 54,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(feedJitter, {
          toValue: 2,
          duration: 48,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(feedJitter, {
          toValue: 3,
          duration: 62,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(feedJitter, {
          toValue: 0,
          duration: 88,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(330),
      ])
    );

    feedLoop.start();

    return () => {
      feedLoop.stop();
      feedJitter.setValue(0);
    };
  }, [feedJitter, stamped]);

  const finishTear = (tearDirection: TearDirection) => {
    if (finishingRef.current) return;

    const basePoints = ordered(tearPointsRef.current);
    if (basePoints.length < 2) return;

    const edgeX = tearDirection === 1 ? DETOUR_TICKET_WIDTH : 0;
    const tail =
      tearDirection === 1
        ? basePoints[basePoints.length - 1]
        : basePoints[0];

    finishingRef.current = true;
    activeDragRef.current.active = false;
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
      const elapsed = Date.now() - startedAt;

      if (elapsed < TEAR_EXTENSION_MS) {
        const raw = clamp(elapsed / TEAR_EXTENSION_MS, 0, 1);
        const eased = 1 - Math.pow(1 - raw, 3);
        const endpoint = {
          x: tail.x + (edgeX - tail.x) * eased,
          y: tail.y,
        };
        const extended = ordered([...basePoints, endpoint]);
        tearPointsRef.current = extended;
        tearProgressRef.current =
          tearDirection === 1
            ? endpoint.x / DETOUR_TICKET_WIDTH
            : (DETOUR_TICKET_WIDTH - endpoint.x) / DETOUR_TICKET_WIDTH;
        setTearPoints(extended);
        setTearProgress(tearProgressRef.current);
        frameRef.current = requestAnimationFrame(step);
        return;
      }

      const fullPoints = ordered([...basePoints, { x: edgeX, y: tail.y }]);
      if (tearProgressRef.current < 1) {
        tearPointsRef.current = fullPoints;
        tearProgressRef.current = 1;
        setTearPoints(fullPoints);
        setTearProgress(1);
      }

      const dropRaw = clamp(
        (elapsed - TEAR_EXTENSION_MS) / TEAR_DROP_MS,
        0,
        1
      );
      setCompletion(dropRaw);

      if (dropRaw < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }

      frameRef.current = null;
      onTorn();
    };

    frameRef.current = requestAnimationFrame(step);
  };

  const beginDrag = (x: number, yInStrip: number) => {
    if (!tearEnabled || finishingRef.current) return;

    const ticketY = clamp(
      gestureTop + yInStrip,
      seamY - TEAR_WANDER_PX,
      seamY + TEAR_WANDER_PX
    );
    const current = ordered(tearPointsRef.current);

    // Once a tear exists, any new touch in the perforation strip resumes from
    // the current tear tip. The user never has to hunt for the exact endpoint.
    if (current.length >= 2) {
      const tearDirection = directionRef.current;
      const tip =
        tearDirection === 1 ? current[current.length - 1] : current[0];
      activeDragRef.current = { active: true, anchor: tip };
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    const onLeft = x <= TEAR_EDGE_START_PX;
    const onRight = x >= DETOUR_TICKET_WIDTH - TEAR_EDGE_START_PX;
    if (!onLeft && !onRight) {
      activeDragRef.current.active = false;
      return;
    }

    const tearDirection: TearDirection = onLeft ? 1 : -1;
    const edgeX = tearDirection === 1 ? 0 : DETOUR_TICKET_WIDTH;
    const start = ordered([
      { x: edgeX, y: seamY },
      { x: clamp(x, 0, DETOUR_TICKET_WIDTH), y: ticketY },
    ]);

    directionRef.current = tearDirection;
    tearPointsRef.current = start;
    tearProgressRef.current = Math.abs(x - edgeX) / DETOUR_TICKET_WIDTH;
    tickRef.current = 0;
    activeDragRef.current = {
      active: true,
      anchor: tearDirection === 1 ? start[start.length - 1] : start[0],
    };
    setDirection(tearDirection);
    setTearPoints(start);
    setTearProgress(tearProgressRef.current);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateDrag = (translationX: number, translationY: number) => {
    if (
      !tearEnabled ||
      finishingRef.current ||
      !activeDragRef.current.active
    ) {
      return;
    }

    const current = ordered(tearPointsRef.current);
    if (current.length < 2) return;

    const tearDirection = directionRef.current;
    const anchor = activeDragRef.current.anchor;
    const previous =
      tearDirection === 1 ? current[current.length - 1] : current[0];

    let x = clamp(anchor.x + translationX, 0, DETOUR_TICKET_WIDTH);
    x =
      tearDirection === 1
        ? Math.max(previous.x, x)
        : Math.min(previous.x, x);

    if (Math.abs(x - previous.x) < TEAR_SAMPLE_PX) return;

    const rawY = clamp(
      anchor.y + translationY * 0.68,
      seamY - TEAR_WANDER_PX,
      seamY + TEAR_WANDER_PX
    );
    const guidedY = previous.y * 0.58 + rawY * 0.42;
    const y = clamp(
      guidedY + fibreJitter(x, current.length),
      seamY - TEAR_WANDER_PX,
      seamY + TEAR_WANDER_PX
    );

    const next = ordered([...current, { x, y }]);
    tearPointsRef.current = next;
    setTearPoints(next);

    const nextProgress =
      tearDirection === 1
        ? clamp(x / DETOUR_TICKET_WIDTH, 0, 1)
        : clamp((DETOUR_TICKET_WIDTH - x) / DETOUR_TICKET_WIDTH, 0, 1);
    tearProgressRef.current = nextProgress;
    setTearProgress(nextProgress);

    const thresholds = [0.12, 0.24, 0.36, 0.48];
    const tick = tickRef.current;
    if (tick < thresholds.length && nextProgress >= thresholds[tick]) {
      tickRef.current = tick + 1;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }

    // The user's job ends at the centre line. Once the tear crosses 50%, Skia
    // completes the remaining perforations and then lets the stub fall away.
    if (nextProgress >= TEAR_AUTOFINISH_PROGRESS) {
      finishTear(tearDirection);
    }
  };

  const endDrag = () => {
    activeDragRef.current.active = false;
    if (finishingRef.current) return;

    if (tearPointsRef.current.length >= 2) {
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
    [tearEnabled, gestureTop, seamY]
  );

  const livePoints = ordered(tearPoints);
  const hasTear = livePoints.length >= 2;
  const regionPath = useMemo(
    () => buildLowerRegion(livePoints, DETOUR_TICKET_HEIGHT),
    [tearPoints]
  );
  const edgePath = useMemo(() => buildSmoothPath(livePoints), [tearPoints]);
  const edgeShadowPath = useMemo(
    () => buildSmoothPath(shiftedPoints(livePoints, 1.25)),
    [tearPoints]
  );

  const lastPoint =
    direction === 1
      ? livePoints[livePoints.length - 1]
      : livePoints[0];
  const edgeLean = lastPoint
    ? clamp((lastPoint.y - seamY) / TEAR_WANDER_PX, -1, 1)
    : 0;

  const finishEase = 1 - Math.pow(1 - completion, 3);
  const gravity = completion * completion;
  const liveGap = 0.9 + tearProgress * 3.2;
  const pieceX = finishing
    ? direction * 22 * finishEase
    : direction * tearProgress * 1.6;
  const pieceY = finishing ? 3 + gravity * 108 : liveGap;
  const pieceRotation = finishing
    ? direction * 0.075 * finishEase
    : edgeLean * 0.012 * tearProgress;
  const pieceOrigin = {
    x: DETOUR_TICKET_WIDTH / 2,
    y: seamY + (DETOUR_TICKET_HEIGHT - seamY) / 2,
  };

  const stampScale = stampProgress
    ? stampProgress.interpolate({ inputRange: [0, 1], outputRange: [1.28, 1] })
    : 1;
  const stampOpacity = stampProgress ?? (stamped ? 1 : 0);
  const safeRenderWidth = Math.max(1, renderWidth);
  const renderScale = safeRenderWidth / DETOUR_TICKET_WIDTH;
  const renderedHeight = DETOUR_TICKET_HEIGHT * renderScale;

  const feedStyle = {
    transform: [
      {
        translateX: feedJitter.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [0, -0.9, 0.65, -0.3],
        }),
      },
      {
        translateY: feedJitter.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: [0, 0.55, 0.08, 0.34],
        }),
      },
      {
        rotate: feedJitter.interpolate({
          inputRange: [0, 1, 2, 3],
          outputRange: ['0deg', '-0.08deg', '0.06deg', '-0.03deg'],
        }),
      },
    ],
  };

  const skiaArtworkReady = artworkVisible && tearEnabled && !!ticketImage;

  return (
    <Animated.View
      style={[
        { width: safeRenderWidth, height: renderedHeight, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
        artworkVisible && !artworkReady && !ticketImage && styles.v49TicketArtworkPending,
        feedStyle,
      ]}
    >
      <View
        style={[
          styles.v46ArtTicket,
          { width: DETOUR_TICKET_WIDTH, height: DETOUR_TICKET_HEIGHT, transform: [{ scale: renderScale }] },
        ]}
      >
      {artworkVisible && !skiaArtworkReady && (
        <Image
          source={DETOUR_TICKET_BASE_SOURCE}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={markArtworkReady}
          onLoadEnd={markArtworkReady}
        />
      )}

      {skiaArtworkReady && (
        <Canvas style={StyleSheet.absoluteFill}>
          {!hasTear && (
            <SkiaImage
              image={ticketImage}
              x={0}
              y={0}
              width={DETOUR_TICKET_WIDTH}
              height={DETOUR_TICKET_HEIGHT}
              fit="contain"
            />
          )}

          {hasTear && regionPath && (
            <>
              <Group clip={regionPath} invertClip>
                <SkiaImage
                  image={ticketImage}
                  x={0}
                  y={0}
                  width={DETOUR_TICKET_WIDTH}
                  height={DETOUR_TICKET_HEIGHT}
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
                  width={DETOUR_TICKET_WIDTH}
                  height={DETOUR_TICKET_HEIGHT}
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
      )}

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            ticketOverlayStyles.header,
            {
              left: artPx(110),
              right: artPx(112),
              top: artPx(205),
            },
          ]}
        >
          <Text style={styles.v46ArtTicketBrand}>DETOUR</Text>
          <Text style={styles.v46ArtTicketSerial}>{serial}</Text>
        </View>

        <View
          style={[
            ticketOverlayStyles.block,
            {
              left: artPx(112),
              top: artPx(402),
              width: artPx(392),
            },
          ]}
        >
          <Text style={styles.v46ArtTicketLabel}>旅程時間</Text>
          <View style={styles.v46ArtTicketTimeRow}>
            <Text style={styles.v46ArtTicketMinutes}>{timeLabel}</Text>
            <Text style={styles.v46ArtTicketMinutesUnit}>分鐘</Text>
          </View>
        </View>

        <View
          style={[
            ticketOverlayStyles.block,
            {
              left: artPx(612),
              top: artPx(402),
              width: artPx(382),
            },
          ]}
        >
          <Text style={styles.v46ArtTicketLabel}>此趟心情</Text>
          <View style={styles.v46ArtTicketMoodRow}>
            <V45MoodIcon moodId={moodId} size={30} />
            <Text style={styles.v46ArtTicketMoodText}>{moodLabel}</Text>
          </View>
        </View>

        <View
          style={[
            ticketOverlayStyles.block,
            {
              left: artPx(112),
              top: artPx(720),
              width: artPx(392),
            },
          ]}
        >
          <Text style={styles.v46ArtTicketLabel}>目的地</Text>
          <View style={styles.v46ArtTicketUnknownRow}>
            <View style={styles.v46ArtTicketPin}>
              <View style={styles.v46ArtTicketPinCore} />
            </View>
            <Text style={styles.v46ArtTicketUnknown}>???</Text>
          </View>
        </View>

        <View
          style={[
            ticketOverlayStyles.route,
            {
              left: artPx(620),
              top: artPx(725),
              width: artPx(360),
              height: artPx(210),
            },
          ]}
        >
          <View style={styles.v46ArtMiniStart} />
          <View style={[styles.v46ArtMiniDash, { left: 13, top: 23, transform: [{ rotate: '12deg' }] }]} />
          <View style={styles.v46ArtMiniTree} />
          <View style={[styles.v46ArtMiniDash, { left: 59, top: 18, transform: [{ rotate: '-17deg' }] }]} />
          <View style={styles.v46ArtMiniFlagPole} />
          <View style={styles.v46ArtMiniFlag} />
        </View>

        {showBarcode && (
          <View
            style={[
              ticketOverlayStyles.barcode,
              {
                left: artPx(790),
                top: artPx(292),
                width: artPx(205),
              },
            ]}
          >
            {Array.from({ length: 29 }).map((_, index) => (
              <View
                key={`art-barcode-${index}`}
                style={[
                  styles.v46ArtBarcodeBar,
                  { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },
                ]}
              />
            ))}
          </View>
        )}

        {stamped && (
          <Animated.View
            style={[
              ticketOverlayStyles.secretStamp,
              {
                left: artPx(655),
                top: artPx(535),
                opacity: stampOpacity,
                transform: [{ rotate: '-8deg' }, { scale: stampScale }],
              },
            ]}
          >
            <Text style={styles.v46ArtSecretStampText}>終點保密</Text>
          </Animated.View>
        )}
      </View>

      {tearEnabled && !finishing && (
        <GestureDetector gesture={tearGesture}>
          <View
            accessible
            accessibilityLabel="沿齒孔撕過中線，開始旅程"
            style={[
              ticketOverlayStyles.gestureStrip,
              {
                top: gestureTop,
                width: DETOUR_TICKET_WIDTH,
                height: TEAR_HIT_HEIGHT,
              },
            ]}
          />
        </GestureDetector>
      )}
      </View>
    </Animated.View>
  );
}

const ticketOverlayStyles = StyleSheet.create({
  header: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  block: {
    position: 'absolute',
  },
  route: {
    position: 'absolute',
  },
  barcode: {
    position: 'absolute',
    height: 26,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 2,
  },
  secretStamp: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(251,245,233,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  gestureStrip: {
    position: 'absolute',
    left: 0,
    zIndex: 40,
    backgroundColor: 'transparent',
  },
});
