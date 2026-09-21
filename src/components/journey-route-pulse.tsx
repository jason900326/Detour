import { Canvas, Circle, Path, Skia, useClock, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

import { SIGNAL } from '../theme/detour-theme';

const ROUTE_PATH = Skia.Path.MakeFromSVGString(
  'M 8 40 C 19 40 24 14 39 18 C 55 22 60 44 73 42 C 86 40 92 22 105 24'
)!;

const ROUTE_POINTS = [
  { x: 8, y: 40 },
  { x: 25, y: 28 },
  { x: 40, y: 18 },
  { x: 58, y: 34 },
  { x: 73, y: 42 },
  { x: 88, y: 32 },
  { x: 105, y: 24 },
] as const;

export function JourneyRoutePulse({ progress = 0 }: { progress?: number }) {
  const clock = useClock();
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const movingDotTransform = useDerivedValue(() => {
    const loopProgress = (clock.value % 3200) / 3200;
    const routeProgress = (loopProgress * 0.82 + clampedProgress * 0.18) % 1;
    const scaledProgress = routeProgress * (ROUTE_POINTS.length - 1);
    const segmentIndex = Math.min(
      ROUTE_POINTS.length - 2,
      Math.floor(scaledProgress)
    );
    const segmentProgress = scaledProgress - segmentIndex;
    const start = ROUTE_POINTS[segmentIndex];
    const end = ROUTE_POINTS[segmentIndex + 1];

    return [
      {
        translateX:
          start.x + (end.x - start.x) * segmentProgress - ROUTE_POINTS[0].x,
      },
      {
        translateY:
          start.y + (end.y - start.y) * segmentProgress - ROUTE_POINTS[0].y,
      },
    ];
  });

  const movingDotRadius = useDerivedValue(
    () => 3.6 + Math.sin(clock.value / 210) * 0.9
  );

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={styles.wrap}
    >
      <Canvas style={styles.canvas}>
        <Path
          path={ROUTE_PATH}
          style="stroke"
          color="#3A3833"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
        />
        <Circle c={vec(40, 18)} r={3.2} color="#6B675F" />
        <Circle c={vec(73, 42)} r={3.2} color="#6B675F" />
        <Circle
          c={vec(8, 40)}
          r={4.5}
          color={SIGNAL}
          style="stroke"
          strokeWidth={2}
        />
        <Circle
          c={vec(105, 24)}
          r={4.5}
          color="#EDE7D9"
          style="stroke"
          strokeWidth={2}
        />
        <Circle
          c={vec(8, 40)}
          r={movingDotRadius}
          color={SIGNAL}
          transform={movingDotTransform}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 112,
    height: 56,
    marginLeft: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D2B28',
    backgroundColor: '#0F0F0E',
    overflow: 'hidden',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
});
