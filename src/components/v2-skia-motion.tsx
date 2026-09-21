import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SIGNAL = '#FF5A36';
const PAPER = '#FFFDF7';
const SOFT_SIGNAL = '#FFB29E';

function routePath() {
  const path = Skia.Path.Make();
  path.moveTo(18, 62);
  path.cubicTo(58, 12, 82, 82, 118, 42);
  path.cubicTo(150, 8, 178, 72, 214, 34);
  path.cubicTo(238, 10, 254, 26, 270, 18);
  return path;
}

function closingPath() {
  const path = Skia.Path.Make();
  path.moveTo(14, 48);
  path.cubicTo(42, 14, 62, 70, 88, 42);
  path.cubicTo(106, 22, 122, 38, 136, 30);
  return path;
}

export function V2RouteFormingMotion() {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);
  const path = useMemo(routePath, []);

  useEffect(() => {
    progress.value = 0;
    pulse.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1150,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520 }),
        withTiming(0, { duration: 520 })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, [progress, pulse]);

  const dotRadius = useDerivedValue(() => 4 + pulse.value * 2.5);
  const dotOpacity = useDerivedValue(() => 0.42 + pulse.value * 0.58);

  return (
    <View pointerEvents="none" style={styles.routeWrap}>
      <Canvas style={styles.routeCanvas}>
        <Path
          path={path}
          color={SIGNAL}
          style="stroke"
          strokeWidth={5}
          strokeCap="round"
          end={progress}
        />
        <Circle
          cx={18}
          cy={62}
          r={dotRadius}
          color={SIGNAL}
          opacity={dotOpacity}
        />
        <Circle
          cx={270}
          cy={18}
          r={5}
          color={SIGNAL}
          opacity={dotOpacity}
        />
      </Canvas>
    </View>
  );
}

export function V2DiscoveryBurst({ trigger }: { trigger: number }) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (trigger <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 560,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, trigger]);

  const outerRadius = useDerivedValue(() => 18 + progress.value * 54);
  const innerRadius = useDerivedValue(() => 8 + progress.value * 34);
  const ringOpacity = useDerivedValue(() => 1 - progress.value);
  const centerRadius = useDerivedValue(() => 10 - progress.value * 6);
  const centerOpacity = useDerivedValue(() => Math.max(0, 1 - progress.value * 1.4));

  return (
    <View pointerEvents="none" style={styles.discoveryOverlay}>
      <Canvas style={styles.discoveryCanvas}>
        <Group opacity={ringOpacity}>
          <Circle
            cx={80}
            cy={80}
            r={outerRadius}
            color={SIGNAL}
            style="stroke"
            strokeWidth={4}
          />
          <Circle
            cx={80}
            cy={80}
            r={innerRadius}
            color={SOFT_SIGNAL}
            style="stroke"
            strokeWidth={3}
          />
        </Group>
        <Circle
          cx={80}
          cy={80}
          r={centerRadius}
          color={SIGNAL}
          opacity={centerOpacity}
        />
      </Canvas>
    </View>
  );
}

export function V2ClosingConverge() {
  const progress = useSharedValue(0);
  const path = useMemo(closingPath, []);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const outerRadius = useDerivedValue(() => 58 - progress.value * 28);
  const innerRadius = useDerivedValue(() => 38 - progress.value * 15);
  const ringOpacity = useDerivedValue(() => 0.72 - progress.value * 0.28);

  return (
    <View pointerEvents="none" style={styles.closingMotion}>
      <Canvas style={styles.closingCanvas}>
        <Group opacity={ringOpacity}>
          <Circle
            cx={118}
            cy={38}
            r={outerRadius}
            color={SOFT_SIGNAL}
            style="stroke"
            strokeWidth={2}
          />
          <Circle
            cx={118}
            cy={38}
            r={innerRadius}
            color={SIGNAL}
            style="stroke"
            strokeWidth={3}
          />
        </Group>
        <Path
          path={path}
          color={PAPER}
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
          end={progress}
        />
        <Circle cx={136} cy={30} r={5} color={SIGNAL} />
      </Canvas>
    </View>
  );
}

export function V2FinishMark() {
  const ring = useSharedValue(0);
  const dot = useSharedValue(0);

  useEffect(() => {
    ring.value = 0;
    dot.value = 0;
    ring.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    dot.value = withDelay(
      180,
      withSequence(
        withTiming(1, { duration: 220 }),
        withTiming(0.72, { duration: 260 })
      )
    );
  }, [dot, ring]);

  const outerRadius = useDerivedValue(() => 8 + ring.value * 26);
  const innerRadius = useDerivedValue(() => 4 + ring.value * 14);
  const outerOpacity = useDerivedValue(() => 0.25 + ring.value * 0.75);
  const dotRadius = useDerivedValue(() => 4 + dot.value * 6);

  return (
    <View pointerEvents="none" style={styles.finishWrap}>
      <Canvas style={styles.finishCanvas}>
        <Circle
          cx={42}
          cy={42}
          r={outerRadius}
          color={SIGNAL}
          style="stroke"
          strokeWidth={4}
          opacity={outerOpacity}
        />
        <Circle
          cx={42}
          cy={42}
          r={innerRadius}
          color={SOFT_SIGNAL}
          style="stroke"
          strokeWidth={2}
          opacity={outerOpacity}
        />
        <Circle cx={42} cy={42} r={dotRadius} color={SIGNAL} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  routeWrap: {
    width: 288,
    height: 88,
    marginTop: 18,
    marginBottom: 2,
  },
  routeCanvas: {
    width: 288,
    height: 88,
  },
  discoveryOverlay: {
    position: 'absolute',
    top: 28,
    left: '50%',
    width: 160,
    height: 160,
    marginLeft: -80,
    zIndex: 20,
  },
  discoveryCanvas: {
    width: 160,
    height: 160,
  },
  closingMotion: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 150,
    height: 82,
    opacity: 0.72,
  },
  closingCanvas: {
    width: 150,
    height: 82,
  },
  finishWrap: {
    width: 84,
    height: 84,
    marginBottom: 2,
  },
  finishCanvas: {
    width: 84,
    height: 84,
  },
});
