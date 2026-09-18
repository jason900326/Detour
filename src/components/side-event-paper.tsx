import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
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
  Paragraph,
  Rect,
  Skia,
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
import { INK, MUTED } from '../theme/detour-theme';

const PAPER_HEIGHT = 62;
const CANVAS_HEIGHT = 82;
const GRID_COLUMNS = 8;
const GRID_ROWS = 4;
const PAPER_BASE = '#F5F1E8';
const PAPER_WARM = 'rgba(150, 132, 101, 0.018)';
const PAPER_COOL = 'rgba(255, 255, 255, 0.055)';
const PAPER_EDGE = 'rgba(117, 101, 74, 0.045)';

function hash01(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function buildPaperFibers(width: number) {
  return Array.from({ length: 92 }, (_, index) => {
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
  return Array.from({ length: 118 }, (_, index) => {
    const x = hash01(index * 2.71 + 11) * width;
    const y = hash01(index * 4.91 + 17) * PAPER_HEIGHT;
    const r = 0.28 + hash01(index * 6.31 + 7) * 0.85;
    const warm = index % 6 === 0;

    return {
      x,
      y,
      r,
      color: warm
        ? 'rgba(110, 96, 75, 0.022)'
        : 'rgba(255, 255, 255, 0.075)',
    };
  });
}

function buildPaperClouds(width: number) {
  return Array.from({ length: 18 }, (_, index) => {
    const x = hash01(index * 8.13 + 4) * width;
    const y = hash01(index * 4.37 + 8) * PAPER_HEIGHT;
    const r = 10 + hash01(index * 6.91 + 2) * 30;

    return {
      x,
      y,
      r,
      color:
        index % 3 === 0
          ? PAPER_WARM
          : PAPER_COOL,
    };
  });
}

function buildParagraph(
  text: string,
  options: {
    size: number;
    color: string;
    weight: number;
    maxLines?: number;
    ellipsis?: string;
  }
) {
  const fontFamilies =
    Platform.OS === 'ios' ? ['PingFang TC', 'Helvetica'] : ['sans-serif'];
  const paragraphStyle = options.ellipsis
    ? {
        maxLines: options.maxLines ?? 1,
        ellipsis: options.ellipsis,
      }
    : options.maxLines !== undefined
      ? { maxLines: options.maxLines }
      : {};

  return Skia.ParagraphBuilder.Make(paragraphStyle)
    .pushStyle({
      color: Skia.Color(options.color),
      fontFamilies,
      fontSize: options.size,
      fontStyle: { weight: options.weight },
      heightMultiplier: 1.25,
    })
    .addText(text)
    .pop()
    .build();
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

      indices.push(
        topLeft,
        topRight,
        bottomRight,
        topLeft,
        bottomRight,
        bottomLeft
      );
    }
  }

  return indices;
}

const MESH_INDICES = buildMeshIndices();
const MESH_VERTEX_COUNT = (GRID_COLUMNS + 1) * (GRID_ROWS + 1);
const SHADOW_COLORS = Array.from(
  { length: MESH_VERTEX_COUNT },
  () => 'rgba(0,0,0,0.052)'
);

export function SideEventPaper({
  event,
  onReplace,
}: {
  event: SideEvent;
  onReplace: () => void | Promise<void>;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(248, Math.min(396, screenWidth - 54));
  const paperFibers = useMemo(() => buildPaperFibers(width), [width]);
  const paperPulp = useMemo(() => buildPaperPulp(width), [width]);
  const paperClouds = useMemo(() => buildPaperClouds(width), [width]);
  const paperFiberImage = useImage(
    require('../../assets/detour/paper-fiber.jpg')
  );
  const [displayedEvent, setDisplayedEvent] = useState(event);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [copyHidden, setCopyHidden] = useState(false);

  const replacementWaitingRef = useRef(false);
  const startCrumpleAfterHideRef = useRef(false);
  const revealCopyAfterUnfoldRef = useRef(false);
  const mountedEventIdRef = useRef(event.id);

  const reveal = useSharedValue(0);
  const crumple = useSharedValue(0);
  const inkReveal = useSharedValue(1);

  const titleParagraph = useMemo(
    () =>
      buildParagraph(displayedEvent.title, {
        size: 18,
        color: INK,
        weight: 700,
        maxLines: 1,
        ellipsis: '…',
      }),
    [displayedEvent.title]
  );

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
          opacity={0.16}
        />
      ) : null}

      {paperClouds.map((cloud, index) => (
        <Circle
          key={`paper-cloud-${index}`}
          cx={cloud.x}
          cy={cloud.y}
          r={cloud.r}
          color={cloud.color}
        />
      ))}

      {paperPulp.map((dot, index) => (
        <Circle
          key={`paper-pulp-${index}`}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
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

      <Rect
        x={0}
        y={0}
        width={width}
        height={1.4}
        color={PAPER_EDGE}
      />
      <Rect
        x={0}
        y={PAPER_HEIGHT - 1.6}
        width={width}
        height={1.6}
        color="rgba(104, 89, 67, 0.035)"
      />
      <Rect
        x={0}
        y={0}
        width={1.2}
        height={PAPER_HEIGHT}
        color="rgba(112, 96, 72, 0.028)"
      />
      <Rect
        x={width - 1.2}
        y={0}
        width={1.2}
        height={PAPER_HEIGHT}
        color="rgba(255, 255, 255, 0.08)"
      />
    </>,
    { width, height: PAPER_HEIGHT }
  );

  const paperTop = CANVAS_HEIGHT - PAPER_HEIGHT;
  const inkOffsetX = useDerivedValue(() => (1 - reveal.value) * 42);
  const titleX = useDerivedValue(() => 20 + inkOffsetX.value);
  const titleY = paperTop + 19;
  const inkOpacity = useDerivedValue(
    () => Math.max(0, Math.min(1, reveal.value * inkReveal.value))
  );

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

        // The strip always returns to the same long shape. During replacement
        // its vertices fold into a small, slightly horizontal wad rather than
        // expanding into a second card state.
        const packetX = (nx - 0.5) * 58;
        const packetY = (ny - 0.5) * 25;
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
    paperVertices.value.map((point) => vec(point.x + 1.8, point.y + 2.6))
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

  const revealControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  const finishReplaceAnimation = useCallback(() => {
    replacementWaitingRef.current = false;
    setReplacing(false);
    setControlsVisible(true);
  }, []);

  const prepareCopyReveal = useCallback(() => {
    revealCopyAfterUnfoldRef.current = true;
    setCopyHidden(false);
  }, []);

  const unfoldReplacement = useCallback(() => {
    crumple.value = 1;
    crumple.value = withDelay(
      200,
      withTiming(
        0,
        {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(prepareCopyReveal)();
        }
      )
    );
  }, [crumple, prepareCopyReveal]);

  useEffect(() => {
    if (
      copyHidden ||
      !replacing ||
      !revealCopyAfterUnfoldRef.current
    ) {
      return;
    }

    revealCopyAfterUnfoldRef.current = false;
    const frame = requestAnimationFrame(() => {
      inkReveal.value = withTiming(
        1,
        {
          duration: 135,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(finishReplaceAnimation)();
        }
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [
    copyHidden,
    finishReplaceAnimation,
    inkReveal,
    replacing,
  ]);

  useEffect(() => {
    if (event.id === mountedEventIdRef.current) return;

    mountedEventIdRef.current = event.id;
    setDisplayedEvent(event);

    if (replacementWaitingRef.current) {
      unfoldReplacement();
      return;
    }

    setControlsVisible(false);
    setCopyHidden(false);
    startCrumpleAfterHideRef.current = false;
    revealCopyAfterUnfoldRef.current = false;
    crumple.value = 0;
    inkReveal.value = 1;
    reveal.value = 0;
    reveal.value = withTiming(
      1,
      {
        duration: 290,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(revealControls)();
      }
    );
  }, [
    crumple,
    event,
    inkReveal,
    reveal,
    revealControls,
    unfoldReplacement,
  ]);

  useEffect(() => {
    reveal.value = 0;
    crumple.value = 0;
    inkReveal.value = 1;
    setCopyHidden(false);
    startCrumpleAfterHideRef.current = false;
    revealCopyAfterUnfoldRef.current = false;

    reveal.value = withTiming(
      1,
      {
        duration: 290,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(revealControls)();
      }
    );
  }, [crumple, inkReveal, reveal, revealControls]);

  const requestReplacement = useCallback(async () => {
    const previousId = mountedEventIdRef.current;
    replacementWaitingRef.current = true;

    try {
      await onReplace();
    } finally {
      setTimeout(() => {
        if (
          replacementWaitingRef.current &&
          mountedEventIdRef.current === previousId
        ) {
          unfoldReplacement();
        }
      }, 115);
    }
  }, [onReplace, unfoldReplacement]);

  useEffect(() => {
    if (
      !replacing ||
      !copyHidden ||
      !startCrumpleAfterHideRef.current
    ) {
      return;
    }

    startCrumpleAfterHideRef.current = false;

    const frame = requestAnimationFrame(() => {
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

    return () => cancelAnimationFrame(frame);
  }, [
    copyHidden,
    crumple,
    replacing,
    requestReplacement,
  ]);

  const replace = useCallback(() => {
    if (replacing) return;

    startCrumpleAfterHideRef.current = true;
    setReplacing(true);
    setControlsVisible(false);
    setCopyHidden(true);
    inkReveal.value = 0;
  }, [inkReveal, replacing]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          width,
          height: CANVAS_HEIGHT,
        },
      ]}
    >
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

        {!copyHidden ? (
          <Group opacity={inkOpacity}>
            <Paragraph
              paragraph={titleParagraph}
              x={titleX}
              y={titleY}
              width={Math.max(1, width - 82)}
            />
          </Group>
        ) : null}
      </Canvas>

      {!replacing && controlsVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="換一個找找看任務"
          onPress={replace}
          hitSlop={10}
          style={styles.replaceButton}
        >
          <Text style={styles.replaceIcon}>↻</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'relative',
    alignSelf: 'center',
    zIndex: 48,
  },
  replaceButton: {
    position: 'absolute',
    right: 8,
    bottom: 0,
    width: 54,
    height: PAPER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceIcon: {
    width: 34,
    textAlign: 'center',
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '600',
    color: MUTED,
  },
});
