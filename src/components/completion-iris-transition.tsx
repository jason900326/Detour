import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Canvas, Circle } from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { INK } from '../theme/detour-theme';

export type CompletionIrisPhase = 'idle' | 'closing' | 'opening';

const IRIS_CLOSE_DURATION_MS = 300;
const IRIS_CLOSED_HOLD_MS = 130;
const IRIS_OPEN_DURATION_MS = 400;

export function CompletionIrisTransition({
  width,
  height,
  phase,
  onClosed,
  onOpened,
}: {
  width: number;
  height: number;
  phase: CompletionIrisPhase;
  onClosed: () => void;
  onOpened: () => void;
}) {
  const maxRadius = Math.hypot(width, height) / 2 + 12;
  const holeRadius = useSharedValue(maxRadius);
  const ringRadius = useDerivedValue(() => maxRadius + holeRadius.value);

  useEffect(() => {
    if (phase === 'idle') {
      holeRadius.value = maxRadius;
      return;
    }

    if (phase === 'closing') {
      holeRadius.value = maxRadius;
      holeRadius.value = withTiming(
        0,
        {
          duration: IRIS_CLOSE_DURATION_MS,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(onClosed)();
        }
      );
      return;
    }

    holeRadius.value = 0;
    holeRadius.value = withDelay(
      IRIS_CLOSED_HOLD_MS,
      withTiming(
        maxRadius,
        {
          duration: IRIS_OPEN_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(onOpened)();
        }
      )
    );
  }, [holeRadius, maxRadius, onClosed, onOpened, phase]);

  if (phase === 'idle') return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle
          cx={width / 2}
          cy={height / 2}
          r={ringRadius}
          color={INK}
          style="stroke"
          strokeWidth={maxRadius * 2 + 8}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
  },
});
