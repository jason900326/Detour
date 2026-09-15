import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { INK, SIGNAL } from '../theme/detour-theme';

type Point = { x: number; y: number };
type TearDirection = -1 | 1;

const TICKET_SOURCE = require('../../assets/detour/ticket-base.png');
const ARTWORK_WIDTH = 1122;
const ARTWORK_HEIGHT = 1402;
const SEAM_RATIO = 1028 / ARTWORK_HEIGHT;
const PAGE = '#F6F1E7';
const EDGE_START_PX = 88;
const SEAM_HIT_PX = 42;
const WANDER_PX = 16;
const SAMPLE_PX = 4;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ordered(points: Point[]) {
  return [...points].sort((a, b) => a.x - b.x);
}

function smoothPath(points: Point[]) {
  const p = ordered(points);
  if (!p.length) return '';
  if (p.length === 1) return `M ${p[0].x} ${p[0].y}`;

  let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i += 1) {
    const a = p[i];
    const b = p[i + 1];
    d += ` Q ${a.x.toFixed(1)} ${a.y.toFixed(1)} ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}`;
  }
  const last = p[p.length - 1];
  return `${d} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
}

function lowerRegion(points: Point[], bottom: number) {
  const p = ordered(points);
  if (p.length < 2) return '';
  const first = p[0];
  const last = p[p.length - 1];
  return `${smoothPath(p)} L ${last.x.toFixed(1)} ${bottom.toFixed(1)} L ${first.x.toFixed(1)} ${bottom.toFixed(1)} Z`;
}

function fibreJitter(x: number, index: number) {
  return Math.sin(x * 0.29) * 0.7 + Math.sin(x * 0.53) * 0.3 + ((index % 4) - 1.5) * 0.16;
}

export function TearLab() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxByWidth = windowWidth - 48;
  const maxByHeight = Math.max(210, (windowHeight - 300) * (ARTWORK_WIDTH / ARTWORK_HEIGHT));
  const ticketWidth = Math.min(310, maxByWidth, maxByHeight);
  const ticketHeight = ticketWidth * (ARTWORK_HEIGHT / ARTWORK_WIDTH);
  const seamY = ticketHeight * SEAM_RATIO;

  const [points, setPoints] = useState<Point[]>([]);
  const [progress, setProgress] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishedRegion, setFinishedRegion] = useState('');

  const pointsRef = useRef<Point[]>([]);
  const directionRef = useRef<TearDirection>(1);
  const progressRef = useRef(0);
  const tickRef = useRef(0);
  const finishingRef = useRef(false);

  const stubX = useRef(new Animated.Value(0)).current;
  const stubY = useRef(new Animated.Value(0)).current;
  const stubR = useRef(new Animated.Value(0)).current;
  const bodyX = useRef(new Animated.Value(0)).current;

  const reset = () => {
    finishingRef.current = false;
    pointsRef.current = [];
    progressRef.current = 0;
    tickRef.current = 0;
    stubX.setValue(0);
    stubY.setValue(0);
    stubR.setValue(0);
    bodyX.setValue(0);
    setPoints([]);
    setProgress(0);
    setFinishing(false);
    setFinishedRegion('');
  };

  const finish = (direction: TearDirection) => {
    if (finishingRef.current) return;
    const current = ordered(pointsRef.current);
    if (current.length < 2) return;

    const edgeX = direction === 1 ? ticketWidth : 0;
    const tail = direction === 1 ? current[current.length - 1] : current[0];
    const finalPoints = ordered([...current, { x: edgeX, y: tail.y }]);

    finishingRef.current = true;
    setFinishing(true);
    setFinishedRegion(lowerRegion(finalPoints, ticketHeight));
    setPoints(finalPoints);
    setProgress(1);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 55);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(bodyX, {
          toValue: -direction * 2.2,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.spring(bodyX, {
          toValue: 0,
          speed: 30,
          bounciness: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(stubX, {
        toValue: direction * 22,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.timing(stubY, {
        toValue: 82,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.timing(stubR, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(reset, 450);
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          if (finishingRef.current) return false;
          const { locationX: x, locationY: y } = event.nativeEvent;
          return (
            Math.abs(y - seamY) <= SEAM_HIT_PX &&
            (x <= EDGE_START_PX || x >= ticketWidth - EDGE_START_PX)
          );
        },
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const direction: TearDirection = locationX <= ticketWidth / 2 ? 1 : -1;
          const edgeX = direction === 1 ? 0 : ticketWidth;
          const y = clamp(locationY, seamY - WANDER_PX, seamY + WANDER_PX);
          const touchX = clamp(locationX, 0, ticketWidth);
          const startPoints = ordered([
            { x: edgeX, y: seamY },
            { x: touchX, y },
          ]);

          directionRef.current = direction;
          pointsRef.current = startPoints;
          progressRef.current = Math.abs(touchX - edgeX) / ticketWidth;
          tickRef.current = 0;
          setPoints(startPoints);
          setProgress(progressRef.current);

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
        onPanResponderMove: (_event, gesture) => {
          if (finishingRef.current) return;
          const current = pointsRef.current;
          if (current.length < 2) return;

          const direction = directionRef.current;
          const anchor = direction === 1 ? current[0] : current[current.length - 1];
          const previous = direction === 1 ? current[current.length - 1] : current[0];
          let x = clamp((direction === 1 ? current[1].x : current[current.length - 2].x) + gesture.dx, 0, ticketWidth);
          x = direction === 1 ? Math.max(previous.x, x) : Math.min(previous.x, x);
          if (Math.abs(x - previous.x) < SAMPLE_PX) return;

          const rawY = clamp(
            (direction === 1 ? current[1].y : current[current.length - 2].y) + gesture.dy,
            seamY - WANDER_PX,
            seamY + WANDER_PX
          );
          const guidedY = previous.y * 0.7 + rawY * 0.3;
          const y = clamp(
            guidedY + fibreJitter(x, current.length),
            seamY - WANDER_PX,
            seamY + WANDER_PX
          );

          const next = ordered([...current, { x, y }]);
          pointsRef.current = next;
          setPoints(next);

          const nextProgress = clamp(Math.abs(x - anchor.x) / ticketWidth, 0, 1);
          progressRef.current = nextProgress;
          setProgress(nextProgress);

          const thresholds = [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84];
          const tick = tickRef.current;
          if (tick < thresholds.length && nextProgress >= thresholds[tick]) {
            tickRef.current = tick + 1;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
          }

          if (nextProgress >= 0.96) finish(direction);
        },
        onPanResponderRelease: () => {
          if (finishingRef.current) return;
          if (progressRef.current >= 0.86) {
            finish(directionRef.current);
            return;
          }
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          reset();
        },
        onPanResponderTerminate: reset,
      }),
    [seamY, ticketWidth]
  );

  const livePoints = ordered(points);
  const region = finishing ? finishedRegion : lowerRegion(livePoints, ticketHeight);
  const line = livePoints.length >= 2 ? smoothPath(livePoints) : '';
  const hasTear = !!region && !!line;
  const liveGap = 1.2 + progress * 3.6;
  const liveSide = directionRef.current * progress * 2.5;
  const rotation = stubR.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', directionRef.current === 1 ? '4deg' : '-4deg'],
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.top}>
        <Text style={styles.brand}>DETOUR</Text>
        <Text style={styles.title}>撕票手感測試</Text>
        <View style={styles.accent} />
      </View>

      <View style={styles.stage}>
        <Animated.View
          {...responder.panHandlers}
          style={{
            width: ticketWidth,
            height: ticketHeight,
            transform: [{ translateX: bodyX }],
          }}
        >
          <Image source={TICKET_SOURCE} resizeMode="contain" style={StyleSheet.absoluteFill} />

          {hasTear && (
            <Svg
              pointerEvents="none"
              width={ticketWidth}
              height={ticketHeight}
              viewBox={`0 0 ${ticketWidth} ${ticketHeight}`}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <ClipPath id="tear-lab-clip">
                  <Path d={region} />
                </ClipPath>
              </Defs>

              <Path d={region} fill={PAGE} />

              {!finishing && (
                <G
                  clipPath="url(#tear-lab-clip)"
                  transform={`translate(${liveSide.toFixed(2)} ${liveGap.toFixed(2)})`}
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

              <Path
                d={line}
                fill="none"
                stroke="rgba(70,55,40,0.30)"
                strokeWidth={1.5}
                transform="translate(0 1.1)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={line}
                fill="none"
                stroke="rgba(255,253,247,0.98)"
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}

          {finishing && !!finishedRegion && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    { translateX: stubX },
                    { translateY: stubY },
                    { rotate: rotation },
                  ],
                },
              ]}
            >
              <Svg width={ticketWidth} height={ticketHeight} viewBox={`0 0 ${ticketWidth} ${ticketHeight}`}>
                <Defs>
                  <ClipPath id="tear-lab-final-clip">
                    <Path d={finishedRegion} />
                  </ClipPath>
                </Defs>
                <G clipPath="url(#tear-lab-final-clip)">
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

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintMain}>從左右任一側的齒孔開始滑</Text>
        <Text style={styles.hintSub}>這一頁只測撕裂，不接出票流程</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
