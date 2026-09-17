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
  Group,
  ImageShader,
  Paragraph,
  Rect,
  Skia,
  Vertices,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SideEvent } from '../lib/journey-engine';
import { INK, MUTED } from '../theme/detour-theme';

const COLLAPSED_HEIGHT = 62;
const EXPANDED_HEIGHT = 184;
const CANVAS_HEIGHT = 202;
const GRID_COLUMNS = 7;
const GRID_ROWS = 5;
const PAPER_BASE = '#F8F5EC';
const PAPER_WARM = 'rgba(218, 207, 184, 0.10)';
const PAPER_COOL = 'rgba(255, 255, 255, 0.24)';
const PAPER_LINE = '#D3CCBF';

function hash01(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function buildPaperFibers(width: number) {
  return Array.from({ length: 58 }, (_, index) => {
    const x = hash01(index * 3 + 1) * width;
    const y = hash01(index * 5 + 2) * EXPANDED_HEIGHT;
    const fiberWidth = 5 + hash01(index * 7 + 3) * 23;
    const fiberHeight = index % 6 === 0 ? 1.05 : 0.55;
    const warm = index % 3 === 0;
    return {
      x,
      y,
      width: fiberWidth,
      height: fiberHeight,
      color: warm
        ? 'rgba(125, 111, 86, 0.055)'
        : 'rgba(255, 255, 255, 0.30)',
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
      indices.push(topLeft, topRight, bottomRight, topLeft, bottomRight, bottomLeft);
    }
  }

  return indices;
}

const MESH_INDICES = buildMeshIndices();
const MESH_VERTEX_COUNT = (GRID_COLUMNS + 1) * (GRID_ROWS + 1);
const SHADOW_COLORS = Array.from(
  { length: MESH_VERTEX_COUNT },
  () => 'rgba(0,0,0,0.11)'
);

export function SideEventPaper({
  event,
  onReplace,
  devMode = false,
}: {
  event: SideEvent;
  onReplace: () => void | Promise<void>;
  devMode?: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = Math.max(248, Math.min(396, screenWidth - 54));
  const paperFibers = useMemo(() => buildPaperFibers(width), [width]);
  const [displayedEvent, setDisplayedEvent] = useState(event);
  const [expanded, setExpanded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replacementWaitingRef = useRef(false);
  const mountedEventIdRef = useRef(event.id);

  const reveal = useSharedValue(0);
  const open = useSharedValue(0);
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
  const instructionParagraph = useMemo(
    () =>
      buildParagraph(displayedEvent.instruction || '', {
        size: 14,
        color: '#625E56',
        weight: 500,
        maxLines: 2,
      }),
    [displayedEvent.instruction]
  );
  const replaceParagraph = useMemo(
    () =>
      buildParagraph('找不到，換一個', {
        size: 14,
        color: '#716C63',
        weight: 650,
        maxLines: 1,
      }),
    []
  );
  const replaceArrowParagraph = useMemo(
    () =>
      buildParagraph('→', {
        size: 19,
        color: INK,
        weight: 500,
        maxLines: 1,
      }),
    []
  );

  const paperTexture = useTexture(
    <>
      <Rect
        x={0}
        y={0}
        width={width}
        height={EXPANDED_HEIGHT}
        color={PAPER_BASE}
      />
      <Rect
        x={0}
        y={22}
        width={width}
        height={44}
        color={PAPER_COOL}
      />
      <Rect
        x={0}
        y={96}
        width={width}
        height={58}
        color={PAPER_WARM}
      />
      {paperFibers.map((fiber, index) => (
        <Rect
          key={`paper-fiber-${index}`}
          x={fiber.x}
          y={fiber.y}
          width={fiber.width}
          height={fiber.height}
          color={fiber.color}
        />
      ))}
    </>,
    { width, height: EXPANDED_HEIGHT }
  );

  const naturalHeight = useDerivedValue(
    () => COLLAPSED_HEIGHT + (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * open.value
  );
  const paperTop = useDerivedValue(() => CANVAS_HEIGHT - naturalHeight.value);
  const inkOffsetX = useDerivedValue(() => (1 - reveal.value) * 42);
  const titleX = useDerivedValue(() => 20 + inkOffsetX.value);
  const titleY = useDerivedValue(() => paperTop.value + 19);
  const instructionX = useDerivedValue(() => 20 + inkOffsetX.value);
  const instructionY = useDerivedValue(() => paperTop.value + 64);
  const separatorX = useDerivedValue(() => 20 + inkOffsetX.value);
  const separatorY = useDerivedValue(() => paperTop.value + 136);
  const replaceX = useDerivedValue(() => 20 + inkOffsetX.value);
  const replaceY = useDerivedValue(() => paperTop.value + 148);
  const replaceArrowX = useDerivedValue(
    () => Math.max(20, width - 43) + inkOffsetX.value
  );
  const replaceArrowY = useDerivedValue(() => paperTop.value + 146);

  const inkOpacity = useDerivedValue(
    () => Math.max(0, Math.min(1, reveal.value * inkReveal.value))
  );
  const detailOpacity = useDerivedValue(() => inkOpacity.value * open.value);

  const paperVertices = useDerivedValue(() => {
    const points = [];
    const height = naturalHeight.value;
    const top = CANVAS_HEIGHT - height;
    const progress = crumple.value;
    const eased = progress * progress * (3 - 2 * progress);
    const foldStrength = Math.sin(Math.PI * progress);
    const revealOffset = (1 - reveal.value) * 42;
    const centerX = width * 0.52;
    const centerY = CANVAS_HEIGHT - EXPANDED_HEIGHT * 0.46;

    for (let row = 0; row <= GRID_ROWS; row += 1) {
      for (let column = 0; column <= GRID_COLUMNS; column += 1) {
        const index = row * (GRID_COLUMNS + 1) + column;
        const nx = column / GRID_COLUMNS;
        const ny = row / GRID_ROWS;
        let baseX = nx * width;
        let baseY = top + ny * height;

        baseY += (nx - 0.5) * 2.2;
        if (column === 0) {
          baseX += 2.6 + Math.sin((row + 1) * 2.13) * 2.2;
        }
        if (column === GRID_COLUMNS) {
          baseX -= 2.6 + Math.cos((row + 2) * 1.77) * 2.0;
        }
        if (row === 0) {
          baseY += 2.2 + Math.sin((column + 1) * 1.93) * 1.8;
        }
        if (row === GRID_ROWS) {
          baseY -= 2.2 + Math.cos((column + 2) * 2.21) * 1.8;
        }

        const phase = index * 1.618 + row * 0.73 - column * 0.41;
        const packetX = (nx - 0.5) * 70;
        const packetY = (ny - 0.5) * 30;
        const targetX =
          centerX + packetX + Math.sin(phase * 2.17) * (8 + ((index * 7) % 8));
        const targetY =
          centerY + packetY + Math.cos(phase * 1.63) * (6 + ((index * 5) % 6));
        const wrinkleX =
          Math.sin(phase * 4.7 + progress * 5.4) * 11 * foldStrength;
        const wrinkleY =
          Math.cos(phase * 3.9 - progress * 4.1) * 9 * foldStrength;

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
    paperVertices.value.map((point) => vec(point.x + 3, point.y + 4))
  );

  const textureCoordinates = useDerivedValue(() => {
    const points = [];
    const height = naturalHeight.value;

    for (let row = 0; row <= GRID_ROWS; row += 1) {
      for (let column = 0; column <= GRID_COLUMNS; column += 1) {
        points.push(
          vec(
            (column / GRID_COLUMNS) * width,
            (row / GRID_ROWS) * height
          )
        );
      }
    }

    return points;
  });

  const revealControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  const finishReplaceAnimation = useCallback(() => {
    replacementWaitingRef.current = false;
    setReplacing(false);
    setControlsVisible(true);
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
          if (!finished) return;

          inkReveal.value = withTiming(
            1,
            {
              duration: 135,
              easing: Easing.out(Easing.cubic),
            },
            (inkFinished) => {
              if (inkFinished) runOnJS(finishReplaceAnimation)();
            }
          );
        }
      )
    );
  }, [crumple, finishReplaceAnimation, inkReveal]);

  useEffect(() => {
    if (event.id === mountedEventIdRef.current) return;
    mountedEventIdRef.current = event.id;
    setDisplayedEvent(event);

    if (replacementWaitingRef.current) {
      unfoldReplacement();
      return;
    }

    setExpanded(false);
    setControlsVisible(false);
    open.value = 0;
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
    open,
    reveal,
    revealControls,
    unfoldReplacement,
  ]);

  useEffect(() => {
    reveal.value = 0;
    open.value = 0;
    crumple.value = 0;
    inkReveal.value = 1;
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
  }, [crumple, inkReveal, open, reveal, revealControls]);

  const expandPaper = useCallback(() => {
    if (expanded || replacing) return;
    setControlsVisible(false);
    setExpanded(true);
    open.value = withTiming(
      1,
      {
        duration: 235,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(revealControls)();
      }
    );
  }, [expanded, open, replacing, revealControls]);

  const collapsePaper = useCallback(() => {
    if (!expanded || replacing) return;
    setControlsVisible(false);
    setExpanded(false);
    open.value = withTiming(
      0,
      {
        duration: 205,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(revealControls)();
      }
    );
  }, [expanded, open, replacing, revealControls]);

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

  const replace = useCallback(() => {
    if (replacing) return;
    setReplacing(true);
    setControlsVisible(false);
    inkReveal.value = 0;
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
  }, [crumple, inkReveal, replacing, requestReplacement]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          left: (screenWidth - width) / 2,
          width,
          height: CANVAS_HEIGHT,
          bottom: Math.max(
            devMode ? 214 : 136,
            insets.bottom + (devMode ? 184 : 108)
          ),
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

        {!replacing ? (
          <>
            <Group opacity={inkOpacity}>
              <Paragraph
                paragraph={titleParagraph}
                x={titleX}
                y={titleY}
                width={Math.max(1, width - 62)}
              />
            </Group>

            <Group opacity={detailOpacity}>
              {displayedEvent.instruction ? (
                <Paragraph
                  paragraph={instructionParagraph}
                  x={instructionX}
                  y={instructionY}
                  width={Math.max(1, width - 40)}
                />
              ) : null}
              <Rect
                x={separatorX}
                y={separatorY}
                width={Math.max(1, width - 40)}
                height={1}
                color={PAPER_LINE}
              />
              <Paragraph
                paragraph={replaceParagraph}
                x={replaceX}
                y={replaceY}
                width={Math.max(1, width - 76)}
              />
              <Paragraph
                paragraph={replaceArrowParagraph}
                x={replaceArrowX}
                y={replaceArrowY}
                width={30}
              />
            </Group>
          </>
        ) : null}
      </Canvas>

      {!replacing && controlsVisible && (
        expanded ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="收起找找看提示"
              onPress={collapsePaper}
              hitSlop={12}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="找不到，換一個"
              onPress={replace}
              style={styles.replaceHitArea}
            />
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayedEvent.title}，點兩下查看完整提示`}
            onPress={expandPaper}
            style={styles.compactHitArea}
          >
            <Text style={styles.expandMark}>＋</Text>
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    zIndex: 48,
  },
  compactHitArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: COLLAPSED_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 17,
  },
  expandMark: {
    width: 28,
    textAlign: 'center',
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '500',
    color: MUTED,
  },
  closeButton: {
    position: 'absolute',
    top: CANVAS_HEIGHT - EXPANDED_HEIGHT + 9,
    right: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '500',
    color: MUTED,
  },
  replaceHitArea: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 7,
    height: 51,
  },
});
