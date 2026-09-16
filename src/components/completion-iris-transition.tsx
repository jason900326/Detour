import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Canvas, Circle } from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { INK } from '../theme/detour-theme';

export type CompletionIrisPhase = 'idle' | 'closing' | 'opening';

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
          duration: 280,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(onClosed)();
        }
      );
      return;
    }

    holeRadius.value = 0;
    holeRadius.value = withTiming(
      maxRadius,
      {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(onOpened)();
      }
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
