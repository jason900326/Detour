import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Image,
  ImageShader,
  Line,
  Rect,
  Vertices,
  useImage,
  useTexture,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { SideEvent } from '../lib/journey-engine';
import { INK, MUTED, SIGNAL } from '../theme/detour-theme';

const PAPER_HEIGHT = 188;
const CANVAS_HEIGHT = 204;
const GRID_COLUMNS = 8;
const GRID_ROWS = 5;
const PAPER_BASE = '#F5F1E8';
const PAPER_WARM = 'rgba(150, 132, 101, 0.018)';
const PAPER_COOL = 'rgba(255, 255, 255, 0.055)';
const PAPER_EDGE = 'rgba(117, 101, 74, 0.045)';

type Interaction = 'found' | 'replace' | null;

function hash01(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function buildPaperFibers(width: number) {
  return Array.from({ length: 112 }, (_, index) => {
    const x = hash01(index * 3.17 + 1) * width;
    const y = hash01(index * 5.23 + 2) * PAPER_HEIGHT;
    const length = 3 + hash01(index * 7.41 + 3) * 17;
    const drift = (hash01(index * 4.73 + 9) - 0.5) * 3.2;
    const warm = index % 5 === 0;

    return {
      x1: x,
      y1: y,
      x2: Math.min(width, x + length),
      y2: Math.max(0, Math.min(PAPER_HEIGHT, y + drift)),
      strokeWidth: index % 9 === 0 ? 0.72 : 0.46,
      color: warm
        ? 'rgba(105, 91, 67, 0.042)'
        : 'rgba(255, 255, 252, 0.14)',
    };
  });
}

function buildPaperPulp(width: number) {
  return Array.from({ length: 146 }, (_, index) => {
    const x = hash01(index * 2.71 + 11) * width;
    const y = hash01(index * 4.91 + 17) * PAPER_HEIGHT;
    const radius = 0.28 + hash01(index * 6.31 + 7) * 0.85;
    const warm = index % 6 === 0;

    return {
      x,
      y,
      radius,
      color: warm
        ? 'rgba(110, 96, 75, 0.022)'
        : 'rgba(255, 255, 255, 0.075)',
    };
  });
}

function buildPaperClouds(width: number) {
  return Array.from({ length: 24 }, (_, index) => ({
    x: hash01(index * 8.13 + 4) * width,
    y: hash01(index * 4.37 + 8) * PAPER_HEIGHT,
    radius: 10 + hash01(index * 6.91 + 2) * 30,
    color: index % 3 === 0 ? PAPER_WARM : PAPER_COOL,
  }));
}

function buildMeshIndices() {
  const indices: number[] = [];
  const stride = GRID_COLUMNS + 1;

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const topLeft = row * stride + column;
      const topRight = topLeft + 1;
      const bottomLeft = (row + 1) * stride + column;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, topRight, bottomRight, topLeft, bottomRight, bottomLeft);
    }
  }

  return indices;
}

const MESH_INDICES = buildMeshIndices();
const MESH_VERTEX_COUNT = (GRID_COLUMNS + 1) * (GRID_ROWS + 1);
const SHADOW_COLORS = Array.from(
  { length: MESH_VERTEX_COUNT },
  () => 'rgba(0,0,0,0.075)'
);

export function SideEventPaper({
  event,
  onFound,
  onReplace,
}: {
  event: SideEvent;
  onFound: () => void | Promise<void>;
  onReplace: () => void | Promise<void>;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(276, Math.min(396, screenWidth - 48));
  const paperFibers = useMemo(() => buildPaperFibers(width), [width]);
  const paperPulp = useMemo(() => buildPaperPulp(width), [width]);
  const paperClouds = useMemo(() => buildPaperClouds(width), [width]);
  const paperFiberImage = useImage(
    require('../../assets/detour/paper-fiber.jpg')
  );

  const [displayedEvent, setDisplayedEvent] = useState(event);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const mountedEventIdRef = useRef(event.id);
  const pendingInteractionRef = useRef<Exclude<Interaction, null> | null>(null);
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyX = useRef(new Animated.Value(22)).current;

  const reveal = useSharedValue(0);
  const crumple = useSharedValue(0);

  const paperTexture = useTexture(
    <>
      <Rect
        x={0}
        y={0}
        width={width}
        height={PAPER_HEIGHT}
        color={PAPER_BASE}
      />

      {paperFiberImage ? (
        <Image
          image={paperFiberImage}
          x={0}
          y={0}
          width={width}
          height={PAPER_HEIGHT}
          fit="cover"
          opacity={0.14}
        />
      ) : null}

      {paperClouds.map((cloud, index) => (
        <Circle
          key={`paper-cloud-${index}`}
          cx={cloud.x}
          cy={cloud.y}
          r={cloud.radius}
          color={cloud.color}
        />
      ))}

      {paperPulp.map((dot, index) => (
        <Circle
          key={`paper-pulp-${index}`}
          cx={dot.x}
          cy={dot.y}
          r={dot.radius}
          color={dot.color}
        />
      ))}

      {paperFibers.map((fiber, index) => (
        <Line
          key={`paper-fiber-${index}`}
          p1={vec(fiber.x1, fiber.y1)}
          p2={vec(fiber.x2, fiber.y2)}
          color={fiber.color}
          strokeWidth={fiber.strokeWidth}
        />
      ))}

      <Rect x={0} y={0} width={width} height={1.4} color={PAPER_EDGE} />
      <Rect
        x={0}
        y={PAPER_HEIGHT - 1.6}
        width={width}
        height={1.6}
        color="rgba(104, 89, 67, 0.035)"
      />
    </>,
    { width, height: PAPER_HEIGHT }
  );

  const paperTop = CANVAS_HEIGHT - PAPER_HEIGHT;

  const paperVertices = useDerivedValue(() => {
    const points = [];
    const progress = crumple.value;
    const eased = progress * progress * (3 - 2 * progress);
    const foldStrength = Math.sin(Math.PI * progress);
    const revealOffset = (1 - reveal.value) * 42;
    const centerX = width * 0.52;
    const centerY = paperTop + PAPER_HEIGHT * 0.5;

    for (let row = 0; row <= GRID_ROWS; row += 1) {
      for (let column = 0; column <= GRID_COLUMNS; column += 1) {
        const index = row * (GRID_COLUMNS + 1) + column;
        const nx = column / GRID_COLUMNS;
        const ny = row / GRID_ROWS;
        let baseX = nx * width;
        let baseY = paperTop + ny * PAPER_HEIGHT;

        baseY += (nx - 0.5) * 2.2;
        if (column === 0) {
          baseX += 2.6 + Math.sin((row + 1) * 2.13) * 2.2;
        }
        if (column === GRID_COLUMNS) {
          baseX -= 2.6 + Math.cos((row + 2) * 1.77) * 2;
        }
        if (row === 0) {
          baseY += 2.2 + Math.sin((column + 1) * 1.93) * 1.8;
        }
        if (row === GRID_ROWS) {
          baseY -= 2.2 + Math.cos((column + 2) * 2.21) * 1.8;
        }

        const phase = index * 1.618 + row * 0.73 - column * 0.41;
        const packetX = (nx - 0.5) * 62;
        const packetY = (ny - 0.5) * 34;
        const targetX =
          centerX +
          packetX +
          Math.sin(phase * 2.17) * (7 + ((index * 7) % 7));
        const targetY =
          centerY +
          packetY +
          Math.cos(phase * 1.63) * (5 + ((index * 5) % 5));
        const wrinkleX =
          Math.sin(phase * 4.7 + progress * 5.4) * 10 * foldStrength;
        const wrinkleY =
          Math.cos(phase * 3.9 - progress * 4.1) * 8 * foldStrength;

        points.push(
          vec(
            baseX * (1 - eased) + targetX * eased + wrinkleX + revealOffset,
            baseY * (1 - eased) + targetY * eased + wrinkleY
          )
        );
      }
    }

    return points;
  });

  const shadowVertices = useDerivedValue(() =>
    paperVertices.value.map((point) => vec(point.x + 2.2, point.y + 3.2))
  );

  const textureCoordinates = useMemo(() => {
    const points = [];

    for (let row = 0; row <= GRID_ROWS; row += 1) {
      for (let column = 0; column <= GRID_COLUMNS; column += 1) {
        points.push(
          vec(
            (column / GRID_COLUMNS) * width,
            (row / GRID_ROWS) * PAPER_HEIGHT
          )
        );
      }
    }

    return points;
  }, [width]);

  const showCopy = useCallback(() => {
    copyX.setValue(18);
    copyOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(copyOpacity, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(copyX, {
        toValue: 0,
        duration: 230,
        useNativeDriver: true,
      }),
    ]).start(() => setInteraction(null));
  }, [copyOpacity, copyX]);

  const restoreWithoutChange = useCallback(
    (action: Exclude<Interaction, null>) => {
      if (
        pendingInteractionRef.current !== action ||
        mountedEventIdRef.current !== displayedEvent.id
      ) {
        return;
      }

      pendingInteractionRef.current = null;
      if (action === 'replace') {
        crumple.value = withTiming(0, {
          duration: 330,
          easing: Easing.out(Easing.cubic),
        });
      }
      showCopy();
    },
    [crumple, displayedEvent.id, showCopy]
  );

  const requestReplacement = useCallback(async () => {
    const previousId = mountedEventIdRef.current;
    try {
      await onReplace();
    } finally {
      setTimeout(() => {
        if (mountedEventIdRef.current === previousId) {
          restoreWithoutChange('replace');
        }
      }, 220);
    }
  }, [onReplace, restoreWithoutChange]);

  const requestFound = useCallback(async () => {
    const previousId = mountedEventIdRef.current;
    try {
      await onFound();
    } finally {
      setTimeout(() => {
        if (mountedEventIdRef.current === previousId) {
          restoreWithoutChange('found');
        }
      }, 220);
    }
  }, [onFound, restoreWithoutChange]);

  useEffect(() => {
    reveal.value = withTiming(1, {
      duration: 290,
      easing: Easing.out(Easing.cubic),
    });
    showCopy();
  }, [reveal, showCopy]);

  useEffect(() => {
    if (event.id === mountedEventIdRef.current) return;

    const pending = pendingInteractionRef.current;
    mountedEventIdRef.current = event.id;
    pendingInteractionRef.current = null;
    setDisplayedEvent(event);

    if (pending === 'replace') {
      crumple.value = 1;
      crumple.value = withDelay(
        160,
        withTiming(
          0,
          {
            duration: 400,
            easing: Easing.out(Easing.cubic),
          },
          (finished) => {
            if (finished) runOnJS(showCopy)();
          }
        )
      );
      return;
    }

    reveal.value = 0.82;
    reveal.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    showCopy();
  }, [crumple, event, reveal, showCopy]);

  const found = useCallback(() => {
    if (interaction) return;

    pendingInteractionRef.current = 'found';
    setInteraction('found');
    Animated.timing(copyOpacity, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      void requestFound();
    });
  }, [copyOpacity, interaction, requestFound]);

  const replace = useCallback(() => {
    if (interaction) return;

    pendingInteractionRef.current = 'replace';
    setInteraction('replace');
    Animated.timing(copyOpacity, {
      toValue: 0,
      duration: 90,
      useNativeDriver: true,
    }).start(() => {
      crumple.value = withTiming(
        1,
        {
          duration: 400,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(requestReplacement)();
        }
      );
    });
  }, [copyOpacity, crumple, interaction, requestReplacement]);

  return (
    <View style={[styles.host, { width, height: CANVAS_HEIGHT }]}>
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Vertices
          vertices={shadowVertices}
          colors={SHADOW_COLORS}
          indices={MESH_INDICES}
        />
        <Group>
          <ImageShader image={paperTexture} tx="clamp" ty="clamp" />
          <Vertices
            vertices={paperVertices}
            textures={textureCoordinates}
            indices={MESH_INDICES}
          />
        </Group>
      </Canvas>

      <Animated.View
        pointerEvents={interaction ? 'none' : 'auto'}
        style={[
          styles.copy,
          {
            opacity: copyOpacity,
            transform: [{ translateX: copyX }],
          },
        ]}
      >
        <Text style={styles.kicker}>路上找找看</Text>
        <Text numberOfLines={2} style={styles.title}>
          {displayedEvent.title}
        </Text>
        {displayedEvent.instruction ? (
          <Text numberOfLines={2} style={styles.instruction}>
            {displayedEvent.instruction}
          </Text>
        ) : (
          <View style={styles.instructionSpacer} />
        )}

        <View style={styles.divider} />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="找到了"
            onPress={found}
            style={({ pressed }) => [
              styles.foundButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.foundText}>找到了</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="找不到，換一個"
            onPress={replace}
            style={({ pressed }) => [
              styles.replaceButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.replaceText}>找不到，換一個</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'relative',
    alignSelf: 'center',
    zIndex: 48,
  },
  copy: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 27,
    bottom: 15,
  },
  kicker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: SIGNAL,
  },
  title: {
    marginTop: 7,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: INK,
  },
  instruction: {
    marginTop: 5,
    minHeight: 20,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#625E56',
  },
  instructionSpacer: {
    minHeight: 20,
  },
  divider: {
    marginTop: 'auto',
    height: 1,
    backgroundColor: 'rgba(98, 94, 86, 0.22)',
  },
  actions: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  foundButton: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(98, 94, 86, 0.22)',
  },
  foundText: {
    fontSize: 17,
    fontWeight: '900',
    color: INK,
  },
  replaceButton: {
    flex: 1.25,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  replaceText: {
    fontSize: 14,
    fontWeight: '750',
    color: MUTED,
  },
  pressed: {
    opacity: 0.52,
  },
});
