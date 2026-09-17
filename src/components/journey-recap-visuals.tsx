import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Polyline as SvgPolyline,
  Rect as SvgRect,
} from 'react-native-svg';

import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/detour-formatters';
import { styles } from '../styles/home-styles';

const ROUTE_VIEW_WIDTH = 320;
const ROUTE_VIEW_HEIGHT = 150;
const ROUTE_PADDING = 20;
const BARCODE_WIDTHS = [2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2];

type RoutePoint = {
  latitude: number;
  longitude: number;
};

function PlacedPhoto({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function routeForEntry(entry: PassportEntry | null) {
  if (!entry) return [] as RoutePoint[];
  if (Array.isArray(entry.route) && entry.route.length >= 2) return entry.route;
  if (Array.isArray(entry.plannedRoute) && entry.plannedRoute.length >= 2) {
    return entry.plannedRoute;
  }
  return [] as RoutePoint[];
}

function projectedRoute(points: RoutePoint[]) {
  if (points.length < 2) return null;

  const sampleStep = Math.max(1, Math.floor(points.length / 120));
  const sampled = points.filter((_, index) => index % sampleStep === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);

  const meanLatitude =
    sampled.reduce((sum, point) => sum + point.latitude, 0) / sampled.length;
  const longitudeScale = Math.max(
    0.2,
    Math.cos((meanLatitude * Math.PI) / 180)
  );

  const projected = sampled.map((point) => ({
    x: point.longitude * longitudeScale,
    y: point.latitude,
  }));

  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const spanX = Math.max(0.000001, maxX - minX);
  const spanY = Math.max(0.000001, maxY - minY);
  const drawableWidth = ROUTE_VIEW_WIDTH - ROUTE_PADDING * 2;
  const drawableHeight = ROUTE_VIEW_HEIGHT - ROUTE_PADDING * 2;
  const scale = Math.min(drawableWidth / spanX, drawableHeight / spanY);
  const usedWidth = spanX * scale;
  const usedHeight = spanY * scale;
  const offsetX = (ROUTE_VIEW_WIDTH - usedWidth) / 2;
  const offsetY = (ROUTE_VIEW_HEIGHT - usedHeight) / 2;

  const normalized = projected.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (maxY - point.y) * scale,
  }));

  return {
    points: normalized.map((point) => `${point.x},${point.y}`).join(' '),
    start: normalized[0],
    end: normalized[normalized.length - 1],
  };
}

function RouteGraphic({
  entry,
  compact = false,
}: {
  entry: PassportEntry;
  compact?: boolean;
}) {
  const route = projectedRoute(routeForEntry(entry));

  if (!route) {
    return (
      <View style={compact ? styles.v56RouteMissingCompact : styles.v56RouteMissing}>
        <Text style={compact ? styles.v56RouteMissingCompactText : styles.v56RouteMissingText}>
          尚未留下完整路徑
        </Text>
      </View>
    );
  }

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${ROUTE_VIEW_WIDTH} ${ROUTE_VIEW_HEIGHT}`}
    >
      <SvgPolyline
        points={route.points}
        fill="none"
        stroke="#11110F"
        strokeWidth={compact ? 7 : 6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgRect
        x={route.start.x - 7}
        y={route.start.y - 7}
        width={14}
        height={14}
        rx={2}
        fill="#FF5A35"
        stroke="#FBF7EE"
        strokeWidth={3}
      />
      <SvgCircle
        cx={route.end.x}
        cy={route.end.y}
        r={7}
        fill="#FF5A35"
        stroke="#FBF7EE"
        strokeWidth={3}
      />
    </Svg>
  );
}

function ZoomablePhoto({ uri }: { uri: string }) {
  return (
    <ScrollView
      key={uri}
      style={styles.v56ZoomScroll}
      contentContainerStyle={styles.v56ZoomContent}
      minimumZoomScale={1}
      maximumZoomScale={4}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Image source={{ uri }} style={styles.v56HeroPhoto} resizeMode="cover" />
    </ScrollView>
  );
}

function PhotoStrip({
  photos,
  activeIndex,
  onPhotoIndex,
}: {
  photos: SessionPhoto[];
  activeIndex: number;
  onPhotoIndex: (index: number) => void;
}) {
  if (photos.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.v56ThumbScroller}
      contentContainerStyle={styles.v56ThumbContent}
    >
      {photos.map((photo, index) => (
        <Pressable
          key={photo.id}
          onPress={() => onPhotoIndex(index)}
          style={styles.v56ThumbPress}
        >
          <Image
            source={{ uri: photo.uri }}
            style={[
              styles.v56ThumbPhoto,
              index === activeIndex && styles.v56ThumbPhotoActive,
            ]}
            resizeMode="cover"
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SummaryFacts({
  minutes,
  distanceKm,
  discoveries,
}: {
  minutes: number;
  distanceKm?: string;
  discoveries: number;
}) {
  const facts = [
    `${minutes} 分鐘`,
    distanceKm !== undefined ? `${distanceKm} 公里` : '— 公里',
    `${discoveries} 個發現`,
  ];

  return (
    <View style={styles.v56SummaryFacts}>
      {facts.map((fact, index) => (
        <View key={fact} style={styles.v56SummaryFactCell}>
          {index > 0 && <View style={styles.v56SummaryFactDivider} />}
          <Text style={styles.v56SummaryFactText}>{fact}</Text>
        </View>
      ))}
    </View>
  );
}

function JourneySummaryCard({
  entry,
  photos,
  fallbackDestination,
  fallbackMinutes,
  activePhotoIndex = 0,
  onPhotoIndex,
  showPhotoStrip = false,
}: {
  entry: PassportEntry | null;
  photos: SessionPhoto[];
  fallbackDestination: string;
  fallbackMinutes: number;
  activePhotoIndex?: number;
  onPhotoIndex?: (index: number) => void;
  showPhotoStrip?: boolean;
}) {
  const completedAt = entry?.completedAt ?? new Date().toISOString();
  const destination = entry?.sceneName ?? fallbackDestination;
  const minutes = entry?.actualDurationMinutes ?? entry?.minutes ?? fallbackMinutes;
  const distanceKm = entry
    ? ((entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(1)
    : undefined;
  const discoveries = entry?.discoveries ?? 0;
  const safeIndex = Math.min(activePhotoIndex, Math.max(0, photos.length - 1));
  const activePhoto = photos[safeIndex];

  return (
    <View style={styles.v56SummaryCard}>
      <View style={styles.v56SummaryHeader}>
        <Text style={styles.v56SummaryBrand}>DETOUR</Text>
        <Text style={styles.v56SummaryStatus}>完成票</Text>
        <Text style={styles.v56SummaryDate}>{formatPassportDate(completedAt)}</Text>
      </View>

      <View style={styles.v56SummaryRule} />

      <View style={styles.v56SummaryHero}>
        {activePhoto ? (
          <PlacedPhoto key={activePhoto.id}>
            <ZoomablePhoto uri={activePhoto.uri} />
          </PlacedPhoto>
        ) : entry ? (
          <RouteGraphic entry={entry} />
        ) : (
          <View style={styles.v56RouteMissing}>
            <Text style={styles.v56RouteMissingText}>旅程紀錄正在整理</Text>
          </View>
        )}
      </View>

      {showPhotoStrip && onPhotoIndex ? (
        <PhotoStrip
          photos={photos}
          activeIndex={safeIndex}
          onPhotoIndex={onPhotoIndex}
        />
      ) : null}

      <View style={styles.v56SummaryCopy}>
        <Text style={styles.v56SummaryMood}>{entry?.moodLabel ?? '旅程'}</Text>
        <Text style={styles.v56SummaryDestination} numberOfLines={2}>
          {destination}
        </Text>
        <SummaryFacts
          minutes={minutes}
          distanceKm={distanceKm}
          discoveries={discoveries}
        />
      </View>

      <View style={styles.v56SummaryRoutePanel}>
        <Text style={styles.v56SummaryRouteLabel}>這趟走過的路</Text>
        <View style={styles.v56SummaryRouteGraphic}>
          {entry ? (
            <RouteGraphic entry={entry} compact />
          ) : (
            <View style={styles.v56RouteMissingCompact} />
          )}
        </View>
      </View>
    </View>
  );
}

function Barcode() {
  return (
    <View style={styles.v56Barcode}>
      {BARCODE_WIDTHS.map((size, index) => (
        <View
          key={`${size}-${index}`}
          style={[styles.v56BarcodeBar, { height: size }]}
        />
      ))}
    </View>
  );
}

export function JourneyHistoryTicket({
  entry,
  featured = false,
}: {
  entry: PassportEntry;
  featured?: boolean;
}) {
  const distanceKm = (
    (entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000
  ).toFixed(1);
  const minutes = entry.actualDurationMinutes ?? entry.minutes;
  const photoCount = entry.photoCount ?? entry.photos?.length ?? 0;

  return (
    <View style={[styles.v56HistoryTicket, featured && styles.v56HistoryTicketFeatured]}>
      <View style={styles.v56HistoryTicketMain}>
        <View style={styles.v56HistoryTopRow}>
          <Text style={styles.v56HistoryMood}>{entry.moodLabel}</Text>
          <Text style={styles.v56HistoryDate}>{formatPassportDate(entry.completedAt)}</Text>
        </View>

        <View style={styles.v56HistoryMiddleRow}>
          <View style={styles.v56HistoryDestinationWrap}>
            <Text style={styles.v56HistoryDestination} numberOfLines={2}>
              {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
            </Text>
          </View>
          <View style={styles.v56HistoryRoute}>
            <RouteGraphic entry={entry} compact />
          </View>
        </View>

        <View style={styles.v56HistoryFacts}>
          <Text style={styles.v56HistoryFact}>{minutes} 分鐘</Text>
          <View style={styles.v56HistoryFactDivider} />
          <Text style={styles.v56HistoryFact}>{distanceKm} 公里</Text>
          <View style={styles.v56HistoryFactDivider} />
          <Text style={styles.v56HistoryFact}>{photoCount} 張照片</Text>
        </View>
      </View>

      <View style={styles.v56HistoryStub}>
        <Barcode />
      </View>
      <View style={styles.v56HistoryNotchTop} />
      <View style={styles.v56HistoryNotchBottom} />
    </View>
  );
}

export function V46CompleteArtwork({
  entry,
  photos,
  fallbackDestination,
  fallbackMinutes,
}: {
  entry: PassportEntry | null;
  photos: SessionPhoto[];
  fallbackDestination: string;
  fallbackMinutes: number;
}) {
  return (
    <JourneySummaryCard
      entry={entry}
      photos={photos}
      fallbackDestination={fallbackDestination}
      fallbackMinutes={fallbackMinutes}
    />
  );
}

export function V46ReviewArtwork({
  entry,
  photoIndex,
  onPhotoIndex,
}: {
  entry: PassportEntry;
  photoIndex: number;
  onPhotoIndex: (index: number) => void;
}) {
  const photos = entry.photos ?? [];

  return (
    <JourneySummaryCard
      entry={entry}
      photos={photos}
      fallbackDestination={entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
      fallbackMinutes={entry.actualDurationMinutes ?? entry.minutes}
      activePhotoIndex={photoIndex}
      onPhotoIndex={onPhotoIndex}
      showPhotoStrip
    />
  );
}

export function V45SharePoster({
  entry,
  photoUri,
}: {
  entry: PassportEntry;
  photoUri?: string;
}) {
  const photos = useMemo(() => {
    const source = entry.photos ?? [];
    if (!photoUri) return source;
    const selected = source.find((photo) => photo.uri === photoUri);
    if (!selected) return source;
    return [selected, ...source.filter((photo) => photo.id !== selected.id)];
  }, [entry.photos, photoUri]);

  return (
    <View style={styles.v56SharePoster}>
      <Text style={styles.v56ShareBrand}>DETOUR<Text style={styles.v56ShareBrandDot}>.</Text></Text>
      <Text style={styles.v56ShareMoodTitle}>{entry.moodLabel}</Text>
      <View style={styles.v56ShareAccent} />
      <View style={styles.v56ShareCardWrap}>
        <JourneySummaryCard
          entry={entry}
          photos={photos}
          fallbackDestination={entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
          fallbackMinutes={entry.actualDurationMinutes ?? entry.minutes}
        />
      </View>
    </View>
  );
}
