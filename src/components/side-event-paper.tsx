import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Circle, Group, RoundedRect } from '@shopify/react-native-skia';
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
const CANVAS_HEIGHT = 198;
const PAPER = '#F1EDE3';
const PAPER_LIGHT = '#FBF8F0';
const PAPER_SHADOW = 'rgba(0,0,0,0.24)';
const PAPER_FOLD_DARK = '#D5CFC2';
const PAPER_FOLD_LIGHT = '#FFFDF8';

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
  const width = Math.max(240, Math.min(420, screenWidth - 48));
  const [displayedEvent, setDisplayedEvent] = useState(event);
  const [expanded, setExpanded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replacementWaitingRef = useRef(false);
  const mountedEventIdRef = useRef(event.id);

  const reveal = useSharedValue(0);
  const open = useSharedValue(0);
  const crumple = useSharedValue(0);

  const naturalHeight = useDerivedValue(
    () => COLLAPSED_HEIGHT + (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * open.value
  );
  const paperWidth = useDerivedValue(
    () => width * (1 - crumple.value * 0.72)
  );
  const paperHeight = useDerivedValue(
    () => naturalHeight.value * (1 - crumple.value * 0.68)
  );
  const paperX = useDerivedValue(
    () =>
      (width - paperWidth.value) / 2 +
      (1 - reveal.value) * 38
  );
  const paperY = useDerivedValue(() => {
    const naturalY = CANVAS_HEIGHT - naturalHeight.value;
    return naturalY + (naturalHeight.value - paperHeight.value) / 2;
  });
  const paperRadius = useDerivedValue(
    () => 5 + crumple.value * 24
  );
  const paperOpacity = useDerivedValue(() => reveal.value);
  const wadOpacity = useDerivedValue(
    () => Math.max(0, (crumple.value - 0.18) / 0.82)
  );
  const wadCenterY = useDerivedValue(
    () => paperY.value + paperHeight.value / 2
  );
  const wadRadius = useDerivedValue(
    () => Math.max(5, Math.min(paperWidth.value, paperHeight.value) * 0.42)
  );

  const revealContent = useCallback(() => {
    setContentVisible(true);
  }, []);

  const finishReplaceAnimation = useCallback(() => {
    replacementWaitingRef.current = false;
    setReplacing(false);
    setContentVisible(true);
  }, []);

  const unfoldReplacement = useCallback(() => {
    crumple.value = 1;
    crumple.value = withDelay(
      90,
      withTiming(
        0,
        {
          duration: 230,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(finishReplaceAnimation)();
        }
      )
    );
  }, [crumple, finishReplaceAnimation]);

  useEffect(() => {
    if (event.id === mountedEventIdRef.current) return;
    mountedEventIdRef.current = event.id;
    setDisplayedEvent(event);

    if (replacementWaitingRef.current) {
      unfoldReplacement();
      return;
    }

    setExpanded(false);
    setContentVisible(false);
    open.value = 0;
    crumple.value = 0;
    reveal.value = 0;
    reveal.value = withTiming(
      1,
      {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(revealContent)();
      }
    );
  }, [
    crumple,
    event,
    open,
    reveal,
    revealContent,
    unfoldReplacement,
  ]);

  useEffect(() => {
    reveal.value = 0;
    open.value = 0;
    crumple.value = 0;
    reveal.value = withTiming(
      1,
      {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(revealContent)();
      }
    );
  }, [crumple, open, reveal, revealContent]);

  const expandPaper = useCallback(() => {
    if (expanded || replacing) return;
    open.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    setExpanded(true);
  }, [expanded, open, replacing]);

  const collapsePaper = useCallback(() => {
    if (!expanded || replacing) return;
    setExpanded(false);
    open.value = withTiming(0, {
      duration: 190,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [expanded, open, replacing]);

  const requestReplacement = useCallback(async () => {
    replacementWaitingRef.current = true;
    try {
      await onReplace();
    } finally {
      // In the unlikely case the pool returns the same event id, still unfold
      // instead of leaving the paper stuck as a ball.
      setTimeout(() => {
        if (replacementWaitingRef.current) {
          unfoldReplacement();
        }
      }, 70);
    }
  }, [onReplace, unfoldReplacement]);

  const replace = useCallback(() => {
    if (replacing) return;
    setReplacing(true);
    setContentVisible(false);
    crumple.value = withTiming(
      1,
      {
        duration: 190,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(requestReplacement)();
      }
    );
  }, [crumple, replacing, requestReplacement]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
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
        <Group opacity={paperOpacity}>
          <RoundedRect
            x={useDerivedValue(() => paperX.value + 5)}
            y={useDerivedValue(() => paperY.value + 7)}
            width={paperWidth}
            height={paperHeight}
            r={paperRadius}
            color={PAPER_SHADOW}
          />
          <RoundedRect
            x={paperX}
            y={paperY}
            width={paperWidth}
            height={paperHeight}
            r={paperRadius}
            color={PAPER}
          />
          <RoundedRect
            x={useDerivedValue(() => paperX.value + 2)}
            y={useDerivedValue(() => paperY.value + 2)}
            width={useDerivedValue(() => Math.max(1, paperWidth.value - 4))}
            height={useDerivedValue(() => Math.max(1, paperHeight.value - 4))}
            r={paperRadius}
            color={PAPER_LIGHT}
            opacity={0.34}
          />
        </Group>

        <Group opacity={wadOpacity}>
          <Circle
            cx={useDerivedValue(() => width / 2 - wadRadius.value * 0.22)}
            cy={useDerivedValue(() => wadCenterY.value - wadRadius.value * 0.08)}
            r={useDerivedValue(() => wadRadius.value * 0.78)}
            color={PAPER_FOLD_DARK}
          />
          <Circle
            cx={useDerivedValue(() => width / 2 + wadRadius.value * 0.18)}
            cy={useDerivedValue(() => wadCenterY.value + wadRadius.value * 0.12)}
            r={useDerivedValue(() => wadRadius.value * 0.72)}
            color={PAPER_FOLD_LIGHT}
          />
          <Circle
            cx={useDerivedValue(() => width / 2)}
            cy={wadCenterY}
            r={useDerivedValue(() => wadRadius.value * 0.58)}
            color={PAPER}
          />
        </Group>
      </Canvas>

      {contentVisible && !replacing && (
        expanded ? (
          <View style={styles.expandedContent}>
            <Pressable
              onPress={collapsePaper}
              hitSlop={12}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>

            <Text style={styles.title}>{displayedEvent.title}</Text>
            {displayedEvent.instruction ? (
              <Text style={styles.instruction}>{displayedEvent.instruction}</Text>
            ) : null}

            <Pressable
              onPress={replace}
              disabled={replacing}
              style={styles.replaceButton}
            >
              <Text style={styles.replaceText}>找不到，換一個</Text>
              <Text style={styles.replaceArrow}>→</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={expandPaper} style={styles.compactContent}>
            <Text numberOfLines={1} style={styles.compactText}>
              {displayedEvent.title}
            </Text>
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
    alignSelf: 'center',
    zIndex: 48,
  },
  compactContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: COLLAPSED_HEIGHT,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: -0.25,
    color: INK,
  },
  expandMark: {
    width: 28,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '500',
    color: MUTED,
  },
  expandedContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: EXPANDED_HEIGHT,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '500',
    color: MUTED,
  },
  title: {
    paddingRight: 34,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.55,
    color: INK,
  },
  instruction: {
    marginTop: 8,
    paddingRight: 20,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '650',
    color: '#625E56',
  },
  replaceButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    minHeight: 38,
    borderTopWidth: 1,
    borderTopColor: '#C9C2B4',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replaceText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: MUTED,
  },
  replaceArrow: {
    fontSize: 19,
    lineHeight: 20,
    color: INK,
  },
});
