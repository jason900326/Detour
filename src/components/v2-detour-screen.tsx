import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import MapView, { Circle, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import type { PassportEntry } from '../lib/app-model';
import type { NavigationTurn } from '../lib/navigation-engine';
import type { V2Phase } from '../hooks/use-v2-detour-controller';
import { useV2DetourController } from '../hooks/use-v2-detour-controller';
import {
  V2ClosingConverge,
  V2DiscoveryBurst,
  V2FinishMark,
  V2HomeWanderMotion,
  V2RouteFormingMotion,
} from './v2-skia-motion';

const COLORS = {
  ink: '#16130F',
  bone: '#F4F0E7',
  paper: '#FFFDF7',
  signal: '#FF5A36',
  muted: '#81796F',
  line: '#D8D0C3',
  paleSignal: '#FFE3D9',
  map: '#E4E8E0',
};

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

function useSwipeBack(
  onBack: () => void,
  enabled = true,
  translateX?: Animated.Value
) {
  const onBackRef = useRef(onBack);
  const enabledRef = useRef(enabled);
  const committingRef = useRef(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    onBackRef.current = onBack;
    enabledRef.current = enabled;
  }, [onBack, enabled]);

  const responder = useMemo(() => {
    const reset = () => {
      if (!translateX) return;
      Animated.spring(translateX, {
        toValue: 0,
        speed: 24,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
    };
    return PanResponder.create({
      // Only claim a deliberate one-finger edge swipe, not map panning or scrolling.
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        enabledRef.current &&
        !committingRef.current &&
        gesture.numberActiveTouches === 1 &&
        gesture.x0 <= 28 &&
        gesture.dx > 12 &&
        gesture.dx > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => translateX?.stopAnimation(),
      onPanResponderMove: (_, gesture) => {
        translateX?.setValue(Math.max(0, Math.min(width, gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldGoBack = enabledRef.current &&
          Math.abs(gesture.dy) < 80 &&
          (gesture.dx > Math.min(100, width * 0.25) ||
            (gesture.dx > 35 && gesture.vx > 0.5));
        if (!shouldGoBack) { reset(); return; }
        if (!translateX) { onBackRef.current(); return; }
        committingRef.current = true;
        Animated.timing(translateX, {
          toValue: width,
          duration: 160,
          useNativeDriver: true,
        }).start(({ finished }) => {
          committingRef.current = false;
          if (finished) onBackRef.current();
        });
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => false,
    });
  }, [translateX, width]);

  return enabled ? responder.panHandlers : {};
}

function elapsedLabel(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function distanceLabel(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(meters))} m`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '剛剛';
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function navigationCopy(turn: NavigationTurn | undefined, closing: boolean) {
  if (turn === 'left') return '下一個路口左轉';
  if (turn === 'right') return '下一個路口右轉';
  if (turn === 'slight-left') return '往左前方續走';
  if (turn === 'slight-right') return '往右前方續走';
  if (turn === 'arrive') return closing ? '最後一小段。' : '';
  return closing ? '往這邊走一小段。' : '';
}

function isDirectionDecision(turn: NavigationTurn | undefined) {
  return (
    turn === 'left' ||
    turn === 'right' ||
    turn === 'slight-left' ||
    turn === 'slight-right'
  );
}

function directionGlyph(turn: NavigationTurn | undefined, closing: boolean) {
  if (turn === 'left') return '←';
  if (turn === 'right') return '→';
  if (turn === 'slight-left') return '↖';
  if (turn === 'slight-right') return '↗';
  if (turn === 'arrive') return '•';
  return closing ? '↟' : '↑';
}

function routeRegion(point: { latitude: number; longitude: number } | null) {
  if (!point) return null;
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.0028,
    longitudeDelta: 0.0028,
  };
}

function routePreviewRegion(
  coordinates: { latitude: number; longitude: number }[]
) {
  if (coordinates.length === 0) return null;
  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.002, (maxLatitude - minLatitude) * 1.45),
    longitudeDelta: Math.max(0.002, (maxLongitude - minLongitude) * 1.45),
  };
}

function buildShareRoutePath(
  coordinates: { latitude: number; longitude: number }[],
  width = 300,
  height = 92,
  padding = 12
) {
  if (coordinates.length < 2) return null;

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(0.000001, maxLatitude - minLatitude);
  const longitudeRange = Math.max(0.000001, maxLongitude - minLongitude);

  const points = coordinates.map((point) => ({
    x:
      padding +
      ((point.longitude - minLongitude) / longitudeRange) *
        (width - padding * 2),
    y:
      padding +
      ((maxLatitude - point.latitude) / latitudeRange) *
        (height - padding * 2),
  }));

  const path = points
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');

  return {
    path,
    start: points[0],
    end: points[points.length - 1],
  };
}

function ShareRouteGraphic({
  coordinates,
}: {
  coordinates: { latitude: number; longitude: number }[];
}) {
  const route = useMemo(() => buildShareRoutePath(coordinates), [coordinates]);

  return (
    <View style={styles.shareCardRoute}>
      <Text style={styles.shareCardRouteLabel}>THIS DETOUR</Text>
      <View style={styles.shareCardRouteGraphic}>
        {route ? (
          <Svg width="100%" height="100%" viewBox="0 0 300 92">
            <SvgPath
              d={route.path}
              stroke={COLORS.signal}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <SvgCircle
              cx={route.start.x}
              cy={route.start.y}
              r={5}
              fill={COLORS.ink}
            />
            <SvgCircle
              cx={route.end.x}
              cy={route.end.y}
              r={7}
              fill={COLORS.signal}
            />
          </Svg>
        ) : (
          <View style={styles.shareCardRouteEmpty}>
            <View style={styles.shareCardRouteDash} />
            <View style={styles.shareCardRouteDot} />
          </View>
        )}
      </View>
    </View>
  );
}

function V2Ticket({
  serial,
  emojiTrail,
  compact = false,
}: {
  serial?: string;
  emojiTrail: string[];
  compact?: boolean;
}) {
  const trailScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (emojiTrail.length === 0) return;
    trailScale.setValue(0.78);
    Animated.spring(trailScale, {
      toValue: 1,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [emojiTrail.length, trailScale]);

  return (
    <View style={[styles.ticket, compact && styles.ticketCompact]}>
      <View style={styles.ticketTop}>
        <Text style={styles.ticketBrand}>DETOUR</Text>
        <Text style={styles.ticketSerial}>{serial ?? 'DETOUR'}</Text>
      </View>
      <View style={styles.ticketRule} />
      {!compact && (
        <>
          <Text style={styles.ticketEyebrow}>這趟留下的東西</Text>
          <Animated.Text style={[styles.ticketTitle, { transform: [{ scale: trailScale }] }]}>
            {emojiTrail.length > 0 ? emojiTrail.join(' ') : '還沒有'}
          </Animated.Text>
        </>
      )}
      {compact && (
        <Animated.Text style={[styles.ticketCompactEmoji, { transform: [{ scale: trailScale }] }]}>
          {emojiTrail.join(' ') || '—'}
        </Animated.Text>
      )}
      <View style={styles.ticketFooter}>
        <Text style={styles.ticketFooterText}>約 10 分鐘 · 自由探索</Text>
        <Text style={styles.ticketDots}>· · · · · · ·</Text>
      </View>
    </View>
  );
}

function JourneyMap({
  point,
  coordinates,
  caption = '只看下一小段',
  overlay,
  height = 300,
}: {
  point: { latitude: number; longitude: number } | null;
  coordinates: { latitude: number; longitude: number }[];
  caption?: string;
  overlay?: ReactNode;
  height?: number;
}) {
  const region = useMemo(() => routeRegion(point), [point]);
  if (!point || !region) return null;

  return (
    <View style={[styles.mapFrame, { height }]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        region={region}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={COLORS.signal}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
        <Circle
          center={point}
          radius={12}
          strokeColor={COLORS.paper}
          strokeWidth={3}
          fillColor="#3C75E8"
        />
      </MapView>
      <View pointerEvents="none" style={styles.mapCaption}>
        <Text style={styles.mapCaptionText}>{caption}</Text>
      </View>
      {overlay}
    </View>
  );
}

function RoutePreview({
  coordinates,
  label = '這趟走過的路',
}: {
  coordinates: { latitude: number; longitude: number }[];
  label?: string;
}) {
  const region = useMemo(() => routePreviewRegion(coordinates), [coordinates]);
  if (!region || coordinates.length < 2) return null;

  return (
    <View style={styles.routePreviewWrap}>
      <Text style={styles.routePreviewLabel}>{label}</Text>
      <View style={styles.routePreviewFrame}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          region={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
        >
          <Polyline
            coordinates={coordinates}
            strokeColor={COLORS.signal}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        </MapView>
      </View>
    </View>
  );
}

function HomePanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const { height } = useWindowDimensions();
  const compact = height < 720;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.homeHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="DETOUR 首頁"
          onPress={controller.goHome}
          onLongPress={controller.startIndoorJourney}
          delayLongPress={700}
          style={styles.logoButton}
        >
          <Text style={styles.homeBrand}>DETOUR</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.homeCenter, compact && styles.homeCenterCompact]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.streetPoster}>
          <Text style={styles.homeTitle}>不知道要幹嘛？</Text>
          <Text style={styles.homeDuration}>約 10 分鐘的小探險</Text>
        </View>

        <View style={[styles.homeWorld, compact && styles.homeWorldCompact]}>
          <V2HomeWanderMotion />
          <View style={styles.homeStartDot} />
          <View style={styles.homeUnknownToken}>
            <Text style={styles.homeUnknownText}>???</Text>
          </View>
        </View>

        <View style={styles.homeActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="繞一下？"
            onPress={() => void controller.startJourney()}
            style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
          >
            <Text style={styles.playButtonText}>繞一下？</Text>
            <View style={styles.playButtonIcon}>
              <Text style={styles.playButtonArrow}>↗</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="我的票根"
            onPress={controller.openHistory}
            style={({ pressed }) => [styles.playButton, styles.passportButton, pressed && styles.playButtonPressed]}
          >
            <Text style={[styles.playButtonText, styles.passportButtonText]}>我的票根</Text>
            <View style={[styles.playButtonIcon, styles.passportButtonIcon]}>
              <Text style={styles.playButtonArrow}>↗</Text>
            </View>
          </Pressable>
        </View>

        {controller.errorMessage && <Text style={styles.errorText}>{controller.errorMessage}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function StartingPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const launch = useRef(new Animated.Value(0)).current;
  const swipeBackHandlers = useSwipeBack(controller.goHome);

  useEffect(() => {
    launch.setValue(0);
    Animated.timing(launch, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [launch]);

  return (
    <SafeAreaView style={styles.safe} {...swipeBackHandlers}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.startingHeader}>
        <Pressable onPress={controller.goHome} style={styles.logoButton}>
          <Text style={styles.brand}>DETOUR</Text>
        </Pressable>
        <Text style={styles.smallLabel}>GO</Text>
      </View>
      <Animated.View
        style={[
          styles.startingContent,
          {
            opacity: launch,
            transform: [
              {
                scale: launch.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.94, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.launchArrow}>
          <Text style={styles.launchArrowText}>↗</Text>
        </View>
        <V2RouteFormingMotion />
        <Text style={styles.startingTitle}>出發。</Text>
        <Text style={styles.startingCopy}>第一個方向出現後，就照著走。</Text>
        {controller.errorMessage && (
          <View style={styles.inlineError}>
            <Text style={styles.errorText}>{controller.errorMessage}</Text>
            <Pressable
              onPress={controller.isIndoorMode ? controller.startIndoorJourney : () => void controller.startJourney()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>再試一次</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function IndoorPlaytestControls({
  controller,
}: {
  controller: ReturnType<typeof useV2DetourController>;
}) {
  if (!controller.isIndoorMode) return null;

  return (
    <View style={styles.indoorControls}>
      <View style={styles.indoorControlsHeader}>
        <Text style={styles.indoorControlsTitle}>室內測試控制</Text>
        <Text style={styles.indoorControlsCopy}>不讀 GPS、不呼叫路線服務</Text>
      </View>
      <Text style={styles.indoorStateLine}>
        {controller.phase === 'closing' ? 'Closing' : 'Exploration'} · {controller.discoveries} 個發現 · {elapsedLabel(controller.elapsedSeconds)}
      </Text>
      <Text style={styles.indoorTargetLine}>
        題目難度：{controller.activeTarget?.difficulty ?? '—'}
      </Text>
      {controller.indoorDiagnostics && (
        <>
          <Text style={styles.indoorDiagnosticLine}>
            距起點 {controller.indoorDiagnostics.distanceFromAnchorMeters}m · 本段 {controller.indoorDiagnostics.routeDistanceMeters}m
          </Text>
          {controller.indoorDiagnostics.rubberBandActive && (
            <Text
              style={[
                styles.indoorRubberBandLine,
                controller.indoorDiagnostics.rubberBandReturning
                  ? styles.indoorRubberBandPass
                  : styles.indoorRubberBandWarning,
              ]}
            >
              橡皮筋：{controller.indoorDiagnostics.rubberBandReturning ? '正在往探索區收回 ✓' : '這段沒有往回收，需要檢查'}
            </Text>
          )}
        </>
      )}
      <View style={styles.indoorButtonRow}>
        <Pressable
          disabled={controller.isPlanning}
          onPress={() => controller.simulateIndoorStep(35)}
          style={({ pressed }) => [
            styles.indoorButton,
            styles.indoorButtonPrimary,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonPrimaryText}>走 35m</Text>
        </Pressable>
        <Pressable
          disabled={controller.isPlanning}
          onPress={controller.simulateIndoorStepToEnd}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>走到這段結尾</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          disabled={controller.isPlanning}
          onPress={() => controller.simulateIndoorDeviation(100)}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>偏離 100m</Text>
        </Pressable>
        <Pressable
          disabled={controller.isPlanning}
          onPress={() => controller.simulateIndoorDeviation(500)}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>遠偏離 500m</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(5 * 60)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 5:00</Text>
        </Pressable>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(8 * 60 + 30)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 8:30</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(10 * 60)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 10:00</Text>
        </Pressable>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(15 * 60)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 15:00</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          disabled={!controller.activeTarget}
          onPress={() => controller.simulateIndoorTargetAge(120)}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || !controller.activeTarget) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>這題已找 2 分鐘</Text>
        </Pressable>
        <Pressable
          onPress={controller.simulateIndoorFinish}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>直接完成 UI</Text>
        </Pressable>
        <Pressable
          onPress={controller.goHome}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>結束測試</Text>
        </Pressable>
      </View>
    </View>
  );
}

function JourneyPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const closing = controller.phase === 'closing';
  const beat = controller.currentNavigationBeat;
  const targetMotion = useRef(new Animated.Value(1)).current;
  const backOffset = useRef(new Animated.Value(0)).current;
  const swipeBackHandlers = useSwipeBack(controller.goHome, true, backOffset);
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const mapHeight = Math.max(200, Math.min(340, availableHeight - (closing ? 370 : 280) * Math.max(1, fontScale)));

  useEffect(() => {
    targetMotion.setValue(0);
    Animated.spring(targetMotion, {
      toValue: 1,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [controller.activeTarget?.id, targetMotion]);

  const closingMinutes =
    closing && controller.currentRouteRemainingSeconds != null
      ? Math.max(1, Math.ceil(controller.currentRouteRemainingSeconds / 60))
      : null;

  return (
    <AnimatedSafeAreaView
      style={[styles.safe, { transform: [{ translateX: backOffset }] }]}
      onAccessibilityEscape={controller.goHome}
      {...swipeBackHandlers}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.journeyHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回首頁"
          onPress={controller.goHome}
          style={({ pressed }) => [styles.journeyBackButton, pressed && styles.buttonPressed]}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
            <SvgPath d="M15 5 L8 12 L15 19" stroke={COLORS.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Pressable>
        <View style={styles.journeyMeta}>
          <Text style={styles.elapsed}>{elapsedLabel(controller.elapsedSeconds)}</Text>
          <View style={styles.discoveryTrail} accessibilityLabel={`已找到 ${controller.discoveries} 個`}>
            {Array.from({ length: 4 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.discoveryDot,
                  index < Math.min(4, controller.discoveries) && styles.discoveryDotFound,
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.journeyScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <JourneyMap
          height={mapHeight}
          point={controller.currentPoint}
          coordinates={controller.routeCoordinates}
          caption={closing ? '最後一小段' : '只看下一段'}
          overlay={
            <View pointerEvents="none" style={styles.mapNavigationOverlay}>
              <View style={styles.mapDirectionDial}>
                <View style={styles.mapDirectionDialInner}>
                  <Text style={styles.mapDirectionGlyph}>{directionGlyph(beat?.turn, closing)}</Text>
                </View>
                <View style={styles.mapDirectionTick} />
              </View>
              <View style={styles.mapNavigationCopy}>
                {(closing || isDirectionDecision(beat?.turn)) ? (
                  <Text style={styles.navigationHintText}>{navigationCopy(beat?.turn, closing)}</Text>
                ) : (
                  <Text style={styles.navigationIdle}>繼續直走</Text>
                )}
                <Text style={styles.navigationSubHint}>
                  {controller.isPlanning
                    ? closing
                      ? '再走一小段，到了會告訴你'
                      : '先照這個方向走'
                    : !closing && !isDirectionDecision(beat?.turn)
                      ? '抬頭看看，下一個變化我會提醒你'
                      : ' '}
                </Text>
              </View>
            </View>
          }
        />

        <View style={styles.journeyContent}>
          <V2DiscoveryBurst trigger={controller.discoveries} />

          {closing ? (
            <View style={styles.closingCard}>
              <V2ClosingConverge />
              <Text style={styles.closingTitle}>最後一段。</Text>
              <Text style={styles.closingCopy}>再走一小段，到了就揭曉。</Text>
              {controller.activeTarget && (
                <View style={styles.closingTarget}>
                  <View style={styles.closingTargetCopy}>
                    <Text style={styles.closingTargetKicker}>最後順便找找看</Text>
                    <Text style={styles.closingTargetTitle}>
                      {controller.activeTarget.emoji}  {controller.activeTarget.title}
                    </Text>
                  </View>
                  <View style={styles.closingTargetActions}>
                    <Pressable onPress={controller.replaceTarget} style={styles.closingReplaceButton}>
                      <Text style={styles.closingReplaceText}>換一個</Text>
                    </Pressable>
                    <Pressable onPress={() => void controller.markFound()} style={styles.closingFoundButton}>
                      <Text style={styles.closingFoundText}>找到了</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={styles.closingPromise}>
                <Text style={styles.closingPromiseText}>
                  {closingMinutes ? `約 ${closingMinutes} 分鐘 · 不用趕` : '快到了 · 不用趕'}
                </Text>
              </View>
            </View>
          ) : controller.activeTarget ? (
            <Animated.View
              style={[
                styles.targetSignWrap,
                {
                  opacity: targetMotion,
                  transform: [
                    {
                      translateX: targetMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: [28, 0],
                      }),
                    },
                    {
                      rotate: targetMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['3deg', '-1deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.targetSign}>
                <Text style={styles.targetEmoji}>{controller.activeTarget.emoji}</Text>
                <Text style={styles.targetSignTitle}>{controller.activeTarget.title}</Text>
              </View>
              <View style={styles.targetActions}>
                <Pressable onPress={controller.replaceTarget} style={styles.replaceButton}>
                  <Text style={styles.replaceButtonText}>換一個</Text>
                </Pressable>
                <Pressable onPress={() => void controller.markFound()} style={styles.foundButton}>
                  <Text style={styles.foundButtonText}>找到了</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <View style={styles.waitingCard}>
              <Text style={styles.waitingTitle}>先走著。</Text>
              <Text style={styles.waitingCopy}>下一個發現會在路上出現。</Text>
            </View>
          )}

          <IndoorPlaytestControls controller={controller} />

          <View style={styles.journeyBottomRow}>
            <View style={styles.cameraCluster}>
              <Pressable
                accessibilityLabel="想留就拍"
                onPress={controller.openCamera}
                style={({ pressed }) => [styles.cameraButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.cameraButtonIcon}>＋</Text>
                <Text style={styles.cameraButtonText}>想留就拍</Text>
              </Pressable>
              {controller.photos.length > 0 && (
                <Image
                  source={{ uri: controller.photos[controller.photos.length - 1].uri }}
                  style={styles.livePhotoThumb}
                />
              )}
            </View>
          </View>

          {controller.errorMessage && (
            <View style={styles.journeyError}>
              <Text style={styles.errorText}>{controller.errorMessage}</Text>
              <Pressable onPress={() => void controller.retryCurrentRoute()}>
                <Text style={styles.retryLink}>重新安排</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </AnimatedSafeAreaView>
  );
}

function FinishPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const swipeBackHandlers = useSwipeBack(controller.goHome);

  return (
    <SafeAreaView style={styles.safe} {...swipeBackHandlers}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.finishScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.finishHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回首頁"
            onPress={controller.goHome}
            style={styles.logoButton}
          >
            <Text style={styles.homeBrand}>DETOUR</Text>
          </Pressable>
          <V2FinishMark />
          <Text style={styles.smallLabel}>DETOUR COMPLETE</Text>
          <Text style={styles.finishTitle}>這趟停在</Text>
          <Text style={styles.finishPlace}>{controller.endPlaceLabel ?? '附近的停留點'}</Text>
          <Text style={styles.finishCopy}>{controller.statusMessage || '這趟路留在票上了。'}</Text>
        </View>

        <V2Ticket serial={controller.ticketSerial} emojiTrail={controller.emojiTrail} />

        <View style={styles.finishStats}>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatValue}>{elapsedLabel(controller.elapsedSeconds)}</Text>
            <Text style={styles.finishStatLabel}>時間</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatValue}>{controller.discoveries}</Text>
            <Text style={styles.finishStatLabel}>發現</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatValue}>{distanceLabel(controller.walkedDistanceMeters)}</Text>
            <Text style={styles.finishStatLabel}>走過</Text>
          </View>
        </View>
        <Text style={styles.finishPhotoMeta}>{controller.photos.length} 張照片留在這趟</Text>

        {controller.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {controller.photos.map((photo) => (
              <Image key={photo.id} source={{ uri: photo.uri }} style={styles.finishPhoto} />
            ))}
          </ScrollView>
        )}

        <RoutePreview coordinates={controller.trace} />

        <View style={styles.finishActions}>
          <Pressable onPress={controller.openCurrentShare} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>分享這趟</Text>
          </Pressable>
          <Pressable onPress={() => void controller.startOver()} style={styles.startAgainButton}>
            <Text style={styles.startAgainText}>{controller.isIndoorMode ? '再測一次' : '再繞一下'}</Text>
          </Pressable>
          <Pressable onPress={controller.openHistory} style={styles.historyLinkButton}>
            <Text style={styles.historyLinkText}>看紀錄</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HistoryEntryCard({
  entry,
  onPress,
}: {
  entry: PassportEntry;
  onPress: () => void;
}) {
  const photo = entry.photos?.[0];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.historyCard, pressed && styles.buttonPressed]}>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.historyPhoto} /> : <View style={styles.historyPhotoPlaceholder} />}
      <View style={styles.historyCardCopy}>
        <Text style={styles.historyEmoji}>{entry.emojiTrail?.join(' ') || '—'}</Text>
        <Text style={styles.historyDate}>{dateLabel(entry.completedAt)} · {entry.city}</Text>
        <Text style={styles.historyHint}>{entry.discoveries} 個發現</Text>
      </View>
    </Pressable>
  );
}

function HistoryPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const handleHistoryBack = () => {
    if (controller.historyDetail) {
      controller.showHistoryEntry(null);
      return;
    }
    controller.goHome();
  };
  const swipeBackHandlers = useSwipeBack(handleHistoryBack);

  if (controller.historyDetail) {
    const entry = controller.historyDetail;
    const coverPhoto = entry.photos?.[0];
    return (
      <SafeAreaView style={styles.safe} {...swipeBackHandlers}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.historyDetailScroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => controller.showHistoryEntry(null)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← 所有紀錄</Text>
          </Pressable>

          <View style={styles.historyDetailHeading}>
            <View>
              <Text style={styles.smallLabel}>JOURNEY HISTORY</Text>
              <Text style={styles.historyDetailDate}>{dateLabel(entry.completedAt)}</Text>
            </View>
            <Text style={styles.historyDetailArea}>{entry.city}</Text>
          </View>

          {coverPhoto ? (
            <Image source={{ uri: coverPhoto.uri }} style={styles.historyDetailHero} />
          ) : (
            <View style={styles.historyDetailNoPhoto}>
              <Text style={styles.historyDetailNoPhotoEmoji}>{entry.emojiTrail?.join(' ') || '—'}</Text>
            </View>
          )}

          <View style={styles.historyArchiveCard}>
            <Text style={styles.historyArchiveLabel}>這趟留下的票</Text>
            <V2Ticket serial={entry.ticketSerial} emojiTrail={entry.emojiTrail ?? []} compact />
          </View>

          {entry.photos && entry.photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyPhotoStrip}>
              {entry.photos.slice(1).map((photo) => (
                <Image key={photo.id} source={{ uri: photo.uri }} style={styles.historyDetailThumb} />
              ))}
            </ScrollView>
          )}

          <RoutePreview coordinates={entry.route ?? []} label="當時走過的路" />

          <View style={styles.historyEndCard}>
            <Text style={styles.historyArchiveLabel}>這趟停在</Text>
            <Text style={styles.historyEndPlace}>{entry.sceneName ?? '這一帶'}</Text>
          </View>

          <View style={styles.historyStatsCard}>
            <View>
              <Text style={styles.historyStatsValue}>{entry.discoveries}</Text>
              <Text style={styles.historyStatsLabel}>發現</Text>
            </View>
            <View>
              <Text style={styles.historyStatsValue}>{entry.photoCount ?? 0}</Text>
              <Text style={styles.historyStatsLabel}>照片</Text>
            </View>
            <View>
              <Text style={styles.historyStatsValue}>
                {Math.max(1, Math.round(entry.actualDurationMinutes ?? entry.minutes))}
              </Text>
              <Text style={styles.historyStatsLabel}>分鐘</Text>
            </View>
          </View>

          <Pressable onPress={() => controller.openHistoryShare(entry)} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>分享這趟</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} {...swipeBackHandlers}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.historyHeader}>
        <Pressable onPress={controller.goHome} style={styles.backLink}>
          <Text style={styles.backLinkText}>← 回首頁</Text>
        </Pressable>
        <Text style={styles.smallLabel}>JOURNEY HISTORY</Text>
        <Text style={styles.historyTitle}>留下來的路</Text>
      </View>
      <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
        {controller.passport.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryEmoji}>—</Text>
            <Text style={styles.emptyHistoryTitle}>還沒有票。</Text>
            <Text style={styles.emptyHistoryCopy}>出去繞一下，第一張票會從你現在的位置開始。</Text>
          </View>
        ) : (
          controller.passport.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} onPress={() => controller.showHistoryEntry(entry)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SharePanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const entry = controller.shareEntry;
  const swipeBackHandlers = useSwipeBack(controller.closeShare);
  const shareCardRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe} {...swipeBackHandlers}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.shareEmpty}>
          <Text style={styles.finishTitle}>這趟還沒有可分享的內容。</Text>
          <Pressable onPress={controller.closeShare} style={styles.historyLinkButton}>
            <Text style={styles.historyLinkText}>返回</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const photo = entry.photos?.[0];
  const emojis = entry.emojiTrail ?? [];
  const place = entry.sceneName ?? entry.city;
  const durationMinutes = Math.max(
    1,
    Math.round(entry.actualDurationMinutes ?? entry.minutes)
  );

  const shareRenderedCard = async () => {
    if (isExporting || !shareCardRef.current) return;
    setIsExporting(true);
    setShareError(null);

    try {
      const imageUri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await controller.performShare(imageUri);
    } catch {
      try {
        await controller.performShare();
        setShareError('分享卡產生失敗，已改用一般分享。');
      } catch {
        setShareError('目前無法分享，請再試一次。');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.shareSafe} {...swipeBackHandlers}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shareHeader}>
        <Pressable onPress={controller.closeShare} style={styles.shareBackButton}>
          <Text style={styles.shareBackText}>← 返回</Text>
        </Pressable>
        <Text style={styles.shareHeaderLabel}>SHARE DETOUR</Text>
      </View>

      <ScrollView contentContainerStyle={styles.shareScroll} showsVerticalScrollIndicator={false}>
        <View
          ref={shareCardRef}
          collapsable={false}
          style={[
            styles.shareCaptureCard,
            photo ? styles.shareCaptureCardPhoto : styles.shareCaptureCardTicket,
          ]}
        >
          <View style={styles.shareCardTop}>
            <Text style={styles.shareCardBrand}>DETOUR</Text>
            <Text style={styles.shareCardSerial}>
              {entry.ticketSerial ?? 'DETOUR'}
            </Text>
          </View>

          {photo ? (
            <>
              <Image source={{ uri: photo.uri }} style={styles.shareCardHeroPhoto} />
              <View style={styles.shareCardIdentity}>
                <Text style={styles.shareCardEmoji}>{emojis.join(' ') || '—'}</Text>
                <Text style={styles.shareCardPlace}>{place}</Text>
              </View>
            </>
          ) : (
            <View style={styles.shareCardTicketMain}>
              <Text style={styles.shareCardTicketKicker}>這趟留下的東西</Text>
              <Text style={styles.shareCardTicketEmoji}>
                {emojis.join(' ') || '—'}
              </Text>
              <View style={styles.shareCardTicketRule} />
              <Text style={styles.shareCardTicketPlace}>{place}</Text>
            </View>
          )}

          <ShareRouteGraphic coordinates={entry.route ?? []} />

          <View style={styles.shareCardBottom}>
            <Text style={styles.shareCardMeta}>{entry.discoveries} 個發現</Text>
            <Text style={styles.shareCardMeta}>{durationMinutes} 分鐘</Text>
            <Text style={styles.shareCardMeta}>{entry.city}</Text>
          </View>
        </View>

        <Text style={styles.sharePreviewHint}>
          你現在看到的這張卡，就是實際分享出去的圖片。
        </Text>

        {shareError && <Text style={styles.shareError}>{shareError}</Text>}

        <Pressable
          disabled={isExporting}
          onPress={() => void shareRenderedCard()}
          style={({ pressed }) => [
            styles.sharePrimaryButton,
            (pressed || isExporting) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.sharePrimaryText}>
            {isExporting ? '正在產生分享圖…' : '分享這張 Detour'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function V2DetourScreen() {
  const controller = useV2DetourController();
  const panelByPhase: Record<V2Phase, ReactNode> = {
    home: <HomePanel controller={controller} />,
    starting: <StartingPanel controller={controller} />,
    exploration: <JourneyPanel controller={controller} />,
    closing: <JourneyPanel controller={controller} />,
    finish: <FinishPanel controller={controller} />,
    history: <HistoryPanel controller={controller} />,
    share: <SharePanel controller={controller} />,
  };
  return panelByPhase[controller.phase];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bone },
  brand: { color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: 2.4 },
  homeBrand: { color: COLORS.ink, fontSize: 44, lineHeight: 50, fontWeight: '900', letterSpacing: 3 },
  logoButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  smallLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  homeHeader: { paddingHorizontal: 24, paddingTop: 0, paddingBottom: 0 },
  homeCenter: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16 },
  streetPoster: { paddingTop: 0 },
  homeCenterCompact: { paddingTop: 6 },
  homeWorldCompact: { height: 112 },
  homeDuration: { marginTop: 6, color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  homeTitle: { color: COLORS.ink, fontSize: 36, lineHeight: 44, fontWeight: '900', letterSpacing: -1.6 },
  homeWorld: { height: 128, marginTop: 0, marginBottom: 8, justifyContent: 'center' },
  homeStartDot: { position: 'absolute', left: 4, bottom: 48, width: 13, height: 13, borderRadius: 99, backgroundColor: COLORS.ink, borderWidth: 3, borderColor: COLORS.bone },
  homeUnknownToken: { position: 'absolute', right: 4, top: 4, minWidth: 88, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1.5, borderColor: COLORS.signal, alignItems: 'center', transform: [{ rotate: '4deg' }], shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  homeUnknownText: { marginTop: 2, color: COLORS.signal, fontSize: 25, fontWeight: '900', letterSpacing: 3 },
  homeActions: { alignItems: 'stretch', gap: 12 },
  playButton: { width: '100%', minHeight: 62, paddingLeft: 22, paddingRight: 7, borderRadius: 31, borderWidth: 2, borderColor: COLORS.signal, backgroundColor: COLORS.signal, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playButtonPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  playButtonText: { color: COLORS.paper, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  playButtonIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center' },
  playButtonArrow: { color: COLORS.signal, fontSize: 28, fontWeight: '900' },
  passportButton: { backgroundColor: COLORS.bone },
  passportButtonText: { color: COLORS.signal },
  passportButtonIcon: { backgroundColor: COLORS.bone },
  buttonPressed: { opacity: 0.72 },
  settingsOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'flex-end', backgroundColor: 'rgba(22,19,15,0.36)' },
  settingsSheet: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: COLORS.paper },
  settingsSheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsEyebrow: { color: COLORS.signal, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  settingsTitle: { marginTop: 4, color: COLORS.ink, fontSize: 28, fontWeight: '900' },
  settingsClose: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.bone, alignItems: 'center', justifyContent: 'center' },
  settingsCloseText: { color: COLORS.ink, fontSize: 26, lineHeight: 29, fontWeight: '700' },
  settingsRule: { height: 1, marginTop: 18, marginBottom: 6, backgroundColor: COLORS.line },
  settingRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEE8DE' },
  settingName: { color: COLORS.ink, fontSize: 14, fontWeight: '900' },
  settingValue: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },
  settingsTestButton: { marginTop: 18, minHeight: 54, paddingHorizontal: 16, borderRadius: 16, backgroundColor: COLORS.paleSignal, borderWidth: 1, borderColor: '#FFC8B8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTestText: { color: COLORS.ink, fontSize: 14, fontWeight: '900' },
  settingsTestArrow: { color: COLORS.signal, fontSize: 22, fontWeight: '900' },
  errorText: { marginTop: 10, color: '#B13D2C', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  startingHeader: { paddingHorizontal: 22, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startingContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  launchArrow: { width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.signal, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }], shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  launchArrowText: { color: COLORS.paper, fontSize: 55, lineHeight: 62, fontWeight: '900' },
  ticket: { width: '100%', maxWidth: 350, minHeight: 212, padding: 22, borderRadius: 4, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  ticketCompact: { minHeight: 0, padding: 16 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketBrand: { color: COLORS.ink, fontSize: 15, fontWeight: '900', letterSpacing: 2.2 },
  ticketSerial: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ticketRule: { height: 1, backgroundColor: COLORS.line, marginTop: 15, marginBottom: 20 },
  ticketEyebrow: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  ticketTitle: { marginTop: 12, color: COLORS.ink, fontSize: 30, lineHeight: 40, letterSpacing: 3 },
  ticketCompactEmoji: { color: COLORS.ink, fontSize: 22, letterSpacing: 3 },
  ticketFooter: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketFooterText: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  ticketDots: { color: COLORS.line, fontSize: 12, letterSpacing: 2 },
  startingTitle: { marginTop: 28, color: COLORS.ink, fontSize: 26, fontWeight: '900' },
  startingCopy: { marginTop: 10, color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  loadingDot: { width: 8, height: 8, marginTop: 18, borderRadius: 99, backgroundColor: COLORS.signal },
  inlineError: { alignItems: 'center', maxWidth: 320 },
  retryButton: { marginTop: 14, borderWidth: 1, borderColor: COLORS.signal, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: COLORS.signal, fontSize: 13, fontWeight: '800' },
  journeyHeader: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  journeyBackButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  journeyState: { marginTop: 3, color: COLORS.signal, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  journeyMeta: { minWidth: 88, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, alignItems: 'flex-end' },
  elapsed: { color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  discoveryTrail: { marginTop: 6, flexDirection: 'row', gap: 5 },
  discoveryDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: COLORS.line },
  discoveryDotFound: { width: 14, backgroundColor: COLORS.signal },
  navigationIdle: { color: COLORS.ink, fontSize: 38, lineHeight: 44, fontWeight: '900', letterSpacing: -1.3 },
  mapFrame: { height: 300, marginHorizontal: 18, overflow: 'hidden', borderRadius: 30, backgroundColor: COLORS.map, borderWidth: 1, borderColor: COLORS.line },
  mapCaption: { position: 'absolute', left: 14, top: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(255,253,247,0.90)' },
  mapCaptionText: { color: COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  mapNavigationOverlay: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 104, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(255,253,247,0.96)', borderWidth: 1, borderColor: 'rgba(216,208,195,0.78)', flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  mapDirectionDial: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.bone, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  mapDirectionDialInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.signal, alignItems: 'center', justifyContent: 'center' },
  mapDirectionGlyph: { color: COLORS.paper, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  mapDirectionTick: { position: 'absolute', top: -3, width: 4, height: 12, borderRadius: 99, backgroundColor: COLORS.ink },
  mapNavigationCopy: { flex: 1, minWidth: 0 },
  journeyScroll: { flexGrow: 1, paddingBottom: 8 },
  journeyContent: { paddingHorizontal: 20, paddingTop: 4 },
  navigationHintText: { color: COLORS.ink, fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.1 },
  navigationSubHint: { marginTop: 4, color: COLORS.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  targetSignWrap: { marginTop: 8, alignItems: 'center' },
  targetSign: { width: '100%', minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: COLORS.paper, borderWidth: 1.5, borderColor: COLORS.signal },
  targetEmoji: { fontSize: 28, lineHeight: 34 },
  targetSignTitle: { flex: 1, color: COLORS.ink, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
  targetActions: { width: '100%', marginTop: 8, flexDirection: 'row', gap: 8 },
  replaceButton: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  replaceButtonText: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },
  foundButton: { flex: 1.4, minHeight: 44, borderRadius: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.signal },
  foundButtonText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  closingCard: { marginTop: 8, padding: 14, borderRadius: 20, backgroundColor: COLORS.paleSignal, borderWidth: 1, borderColor: '#FFC8B8' },
  closingTitle: { marginTop: 4, color: COLORS.ink, fontSize: 24, fontWeight: '900' },
  closingCopy: { marginTop: 4, color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  closingTarget: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FFC8B8' },
  closingTargetCopy: { gap: 4 },
  closingTargetKicker: { color: COLORS.signal, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  closingTargetTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '900', lineHeight: 22 },
  closingTargetActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  closingReplaceButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E7B9AA', paddingVertical: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper },
  closingReplaceText: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },
  closingFoundButton: { flex: 1.3, minHeight: 44, borderRadius: 12, backgroundColor: COLORS.signal, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  closingFoundText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  closingPromise: { marginTop: 10, alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: COLORS.paper },
  closingPromiseText: { color: COLORS.signal, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  waitingCard: { marginTop: 12, padding: 22, borderRadius: 24, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  waitingTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  waitingCopy: { marginTop: 7, color: COLORS.muted, fontSize: 13 },
  indoorControls: { marginTop: 10, padding: 10, borderRadius: 16, backgroundColor: '#EAE3D7', borderWidth: 1, borderColor: COLORS.line },
  indoorControlsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  indoorControlsTitle: { color: COLORS.ink, fontSize: 11, fontWeight: '900' },
  indoorControlsCopy: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  indoorStateLine: { marginTop: 6, color: COLORS.signal, fontSize: 10, fontWeight: '900' },
  indoorTargetLine: { marginTop: 3, color: COLORS.muted, fontSize: 9, fontWeight: '800' },
  indoorDiagnosticLine: { marginTop: 3, color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  indoorRubberBandLine: { marginTop: 3, fontSize: 9, fontWeight: '900' },
  indoorRubberBandPass: { color: '#4E7657' },
  indoorRubberBandWarning: { color: '#B13D2C' },
  indoorButtonRow: { marginTop: 8, flexDirection: 'row', gap: 7 },
  indoorButton: { flex: 1, minHeight: 32, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center' },
  indoorButtonPrimary: { backgroundColor: COLORS.signal, borderColor: COLORS.signal },
  indoorButtonText: { color: COLORS.ink, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  indoorButtonPrimaryText: { color: COLORS.paper, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  journeyBottomRow: { marginTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' },
  cameraCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cameraButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  cameraButtonIcon: { width: 22, height: 22, borderRadius: 8, overflow: 'hidden', color: COLORS.paper, backgroundColor: COLORS.signal, fontSize: 16, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  cameraButtonText: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  livePhotoThumb: { width: 40, height: 40, borderRadius: 11, backgroundColor: COLORS.line, borderWidth: 2, borderColor: COLORS.paper },
  journeyError: { alignItems: 'center', paddingBottom: 8 },
  retryLink: { marginTop: 5, color: COLORS.signal, fontSize: 12, fontWeight: '900' },
  finishScroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 34 },
  finishHeader: { alignItems: 'center', marginBottom: 24, gap: 2 },
  finishTitle: { marginTop: 12, color: COLORS.ink, fontSize: 25, fontWeight: '900' },
  finishPlace: { marginTop: 4, color: COLORS.signal, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  finishCopy: { marginTop: 10, color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  finishStats: { marginTop: 16, paddingVertical: 15, paddingHorizontal: 8, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around' },
  finishStat: { minWidth: 72, alignItems: 'center' },
  finishStatValue: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  finishStatLabel: { marginTop: 4, color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  finishPhotoMeta: { marginTop: 9, color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  photoRow: { gap: 10, paddingTop: 18, paddingBottom: 4 },
  finishPhoto: { width: 118, height: 118, borderRadius: 14, backgroundColor: COLORS.line },
  routePreviewWrap: { marginTop: 20 },
  routePreviewLabel: { marginBottom: 8, color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  routePreviewFrame: { height: 150, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.map },
  finishActions: { marginTop: 24, gap: 10 },
  shareButton: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.ink },
  shareButtonText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  startAgainButton: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.signal },
  startAgainText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  historyLinkButton: { alignItems: 'center', paddingVertical: 12 },
  historyLinkText: { color: COLORS.signal, fontSize: 13, fontWeight: '900' },
  historyHeader: { paddingHorizontal: 22, paddingTop: 10 },
  backLink: { paddingVertical: 8, alignSelf: 'flex-start' },
  backLinkText: { color: COLORS.signal, fontSize: 13, fontWeight: '900' },
  historyTitle: { marginTop: 10, color: COLORS.ink, fontSize: 32, fontWeight: '900' },
  historyList: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30, gap: 12 },
  historyCard: { minHeight: 104, flexDirection: 'row', overflow: 'hidden', borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  historyPhoto: { width: 104, height: 104, backgroundColor: COLORS.line },
  historyPhotoPlaceholder: { width: 104, height: 104, backgroundColor: COLORS.paleSignal },
  historyCardCopy: { flex: 1, padding: 15, justifyContent: 'center' },
  historyEmoji: { color: COLORS.ink, fontSize: 21, letterSpacing: 2 },
  historyDate: { marginTop: 8, color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  historyHint: { marginTop: 4, color: COLORS.signal, fontSize: 11, fontWeight: '900' },
  emptyHistory: { alignItems: 'center', paddingTop: 110 },
  emptyHistoryEmoji: { color: COLORS.signal, fontSize: 38, fontWeight: '900' },
  emptyHistoryTitle: { marginTop: 18, color: COLORS.ink, fontSize: 22, fontWeight: '900' },
  emptyHistoryCopy: { marginTop: 8, color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  historyDetailMeta: { marginTop: 18, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  historyDetailScroll: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34 },
  historyDetailHeading: { marginTop: 8, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  historyDetailDate: { marginTop: 6, color: COLORS.ink, fontSize: 30, fontWeight: '900' },
  historyDetailArea: { flexShrink: 1, color: COLORS.signal, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  historyDetailHero: { width: '100%', aspectRatio: 1.35, borderRadius: 22, backgroundColor: COLORS.line },
  historyDetailNoPhoto: { minHeight: 150, borderRadius: 22, backgroundColor: COLORS.paleSignal, alignItems: 'center', justifyContent: 'center' },
  historyDetailNoPhotoEmoji: { color: COLORS.ink, fontSize: 34, letterSpacing: 4 },
  historyArchiveCard: { marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: '#EDE7DC', borderWidth: 1, borderColor: COLORS.line },
  historyArchiveLabel: { marginBottom: 10, color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  historyPhotoStrip: { gap: 9, paddingTop: 14 },
  historyDetailThumb: { width: 82, height: 82, borderRadius: 12, backgroundColor: COLORS.line },
  historyEndCard: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  historyEndPlace: { marginTop: 5, color: COLORS.signal, fontSize: 18, fontWeight: '900' },
  historyStatsCard: { marginTop: 12, marginBottom: 16, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around' },
  historyStatsValue: { color: COLORS.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  historyStatsLabel: { marginTop: 3, color: COLORS.muted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  shareSafe: { flex: 1, backgroundColor: COLORS.ink },
  shareHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shareBackButton: { paddingVertical: 8, paddingRight: 12 },
  shareBackText: { color: COLORS.paper, fontSize: 13, fontWeight: '900' },
  shareHeaderLabel: { color: '#BDB5A8', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  shareScroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34 },
  shareCaptureCard: { width: '100%', aspectRatio: 0.8, borderRadius: 24, overflow: 'hidden', padding: 18 },
  shareCaptureCardPhoto: { backgroundColor: COLORS.ink },
  shareCaptureCardTicket: { backgroundColor: COLORS.paper },
  shareCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  shareCardBrand: { color: COLORS.signal, fontSize: 13, fontWeight: '900', letterSpacing: 2.6 },
  shareCardSerial: { color: '#8E8579', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  shareCardHeroPhoto: { width: '100%', flex: 1, minHeight: 190, borderRadius: 18, backgroundColor: '#2D2924' },
  shareCardIdentity: { paddingTop: 13 },
  shareCardEmoji: { color: COLORS.paper, fontSize: 27, lineHeight: 36, letterSpacing: 3 },
  shareCardPlace: { marginTop: 3, color: '#C7BFB3', fontSize: 12, fontWeight: '700' },
  shareCardTicketMain: { flex: 1, minHeight: 220, justifyContent: 'center', paddingHorizontal: 8 },
  shareCardTicketKicker: { color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  shareCardTicketEmoji: { marginTop: 18, color: COLORS.ink, fontSize: 38, lineHeight: 52, letterSpacing: 5 },
  shareCardTicketRule: { height: 1, marginTop: 22, backgroundColor: COLORS.line },
  shareCardTicketPlace: { marginTop: 14, color: COLORS.signal, fontSize: 16, fontWeight: '900' },
  shareCardRoute: { marginTop: 12 },
  shareCardRouteLabel: { color: '#8E8579', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  shareCardRouteGraphic: { height: 72, marginTop: 4, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(129,121,111,0.10)' },
  shareCardRouteEmpty: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  shareCardRouteDash: { flex: 1, height: 4, borderRadius: 99, backgroundColor: COLORS.signal, opacity: 0.55 },
  shareCardRouteDot: { width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: COLORS.signal },
  shareCardBottom: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(142,133,121,0.24)', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  shareCardMeta: { flexShrink: 1, color: '#8E8579', fontSize: 9, fontWeight: '800' },
  sharePreviewHint: { marginTop: 13, color: '#BDB5A8', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  shareError: { marginTop: 10, color: '#FFB29E', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  sharePrimaryButton: { marginTop: 18, borderRadius: 18, paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.signal },
  sharePrimaryText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  shareEmpty: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
});
