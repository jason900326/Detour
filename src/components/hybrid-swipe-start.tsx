import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Path as SkiaPath,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const TRACK_HEIGHT = 76;
const KNOB_RADIUS = 25;
const TRACK_PADDING = 13;

function clampProgress(value: number) {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

export function HybridSwipeStart(props: { onStart: () => void }) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  const knobX = useDerivedValue(() => {
    const travel = Math.max(0, width - TRACK_PADDING * 2 - KNOB_RADIUS * 2);
    return TRACK_PADDING + KNOB_RADIUS + travel * progress.value;
  }, [width]);

  const knobScale = useDerivedValue(
    () => 1 + Math.sin(progress.value * Math.PI) * 0.05
  );
  const haloOpacity = useDerivedValue(
    () => 0.12 + progress.value * 0.22
  );
  const trailOpacity = useDerivedValue(
    () => 0.25 + progress.value * 0.75
  );

  const routePath = useMemo(() => {
    if (width <= 0) return null;

    const path = Skia.Path.Make();
    const startX = TRACK_PADDING + KNOB_RADIUS;
    const endX = Math.max(startX, width - TRACK_PADDING - KNOB_RADIUS);
    const midX = (startX + endX) / 2;

    path.moveTo(startX, TRACK_HEIGHT / 2);
    path.cubicTo(
      midX - 42,
      TRACK_HEIGHT / 2 - 9,
      midX + 26,
      TRACK_HEIGHT / 2 + 11,
      endX,
      TRACK_HEIGHT / 2
    );
    return path;
  }, [width]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(false)
        .onBegin(() => {
          progress.value = 0;
        })
        .onUpdate((event) => {
          const travel = Math.max(
            1,
            width - TRACK_PADDING * 2 - KNOB_RADIUS * 2
          );
          progress.value = clampProgress(event.translationX / travel);
        })
        .onEnd((event) => {
          const committed =
            progress.value >= 0.4 || event.velocityX >= 720;

          if (!committed) {
            progress.value = withSpring(0, {
              damping: 17,
              stiffness: 210,
              mass: 0.72,
            });
            return;
          }

          progress.value = withTiming(
            1,
            { duration: 240 },
            (finished) => {
              if (finished) runOnJS(props.onStart)();
            }
          );
        }),
    [props.onStart, progress, width]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.shell}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect
            x={0}
            y={0}
            width={width}
            height={TRACK_HEIGHT}
            color="#29282D"
          />
          <Circle
            cx={0}
            cy={TRACK_HEIGHT / 2}
            r={TRACK_HEIGHT / 2}
            color="#29282D"
          />
          <Circle
            cx={width}
            cy={TRACK_HEIGHT / 2}
            r={TRACK_HEIGHT / 2}
            color="#29282D"
          />

          {routePath && (
            <SkiaPath
              path={routePath}
              color="#D9A85D"
              style="stroke"
              strokeWidth={2.4}
              strokeCap="round"
              opacity={trailOpacity}
            />
          )}

          <Circle
            cx={knobX}
            cy={TRACK_HEIGHT / 2}
            r={KNOB_RADIUS * knobScale}
            color="#F5F0E8"
          />
          <Circle
            cx={knobX}
            cy={TRACK_HEIGHT / 2}
            r={KNOB_RADIUS * 1.45}
            color="#F5F0E8"
            opacity={haloOpacity}
          />
        </Canvas>

        <View pointerEvents="none" style={styles.copyLayer}>
          <Text style={styles.label}>滑一下，讓 DETOUR 開始</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: TRACK_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  copyLayer: {
    alignItems: 'center',
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    color: '#D7D1C8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
