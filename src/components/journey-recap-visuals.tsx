import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Polyline as SvgPolyline,
  Rect as SvgRect,
} from 'react-native-svg';
import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/detour-formatters';
import { styles } from '../styles/home-styles';

const ROUTE_VIEW_WIDTH = 320;
const ROUTE_VIEW_HEIGHT = 210;
const ROUTE_PADDING = 28;

type RoutePoint = {
  latitude: number;
  longitude: number;
};

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

function JourneyRouteTrace({ entry }: { entry: PassportEntry }) {
  const route = projectedRoute(routeForEntry(entry));

  return (
    <View style={styles.v51RouteTrace}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${ROUTE_VIEW_WIDTH} ${ROUTE_VIEW_HEIGHT}`}
      >
        {[64, 128, 192, 256].map((x) => (
          <SvgLine
            key={`grid-x-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={ROUTE_VIEW_HEIGHT}
            stroke="#D8D1C5"
            strokeWidth={1}
            strokeDasharray="4 8"
          />
        ))}
        {[52, 104, 156].map((y) => (
          <SvgLine
            key={`grid-y-${y}`}
            x1={0}
            y1={y}
            x2={ROUTE_VIEW_WIDTH}
            y2={y}
            stroke="#D8D1C5"
            strokeWidth={1}
            strokeDasharray="4 8"
          />
        ))}

        {route ? (
          <>
            <SvgPolyline
              points={route.points}
              fill="none"
              stroke="#11110F"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <SvgCircle
              cx={route.start.x}
              cy={route.start.y}
              r={8}
              fill="#FF5A35"
              stroke="#F5F1E8"
              strokeWidth={3}
            />
            <SvgRect
              x={route.end.x - 8}
              y={route.end.y - 8}
              width={16}
              height={16}
              rx={2}
              fill="#FF5A35"
              stroke="#F5F1E8"
              strokeWidth={3}
            />
          </>
        ) : (
          <SvgLine
            x1={62}
            y1={145}
            x2={258}
            y2={67}
            stroke="#11110F"
            strokeWidth={7}
            strokeLinecap="round"
          />
        )}
      </Svg>

      <View style={styles.v51RouteTraceLabel}>
        <Text style={styles.v51RouteTraceLabelText}>這趟走過的路</Text>
      </View>
    </View>
  );
}

export function V45SharePoster({
  entry,
  photoUri,
}: {
  entry: PassportEntry;
  photoUri?: string;
}) {
  const distance = (
    (entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000
  ).toFixed(1);

  return (
    <View style={styles.v45Poster}>
      <View style={styles.v45PosterTop}>
        <Text style={styles.v45PosterBrand}>DETOUR</Text>
        <Text style={styles.v45PosterDate}>{formatPassportDate(entry.completedAt)}</Text>
      </View>

      {photoUri ? (
        <View style={styles.v51PosterPhotoStage}>
          <Image
            source={{ uri: photoUri }}
            style={styles.v45PosterPhoto}
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={styles.v51PosterRouteStage}>
          <JourneyRouteTrace entry={entry} />
        </View>
      )}

      <View style={styles.v45PosterCopy}>
        <Text style={styles.v45PosterMood}>{entry.moodLabel}</Text>
        <Text style={styles.v45PosterDestination} numberOfLines={2}>
          {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
        </Text>
        <View style={styles.v45PosterOrangeRule} />
        <View style={styles.v45PosterFacts}>
          <Text style={styles.v45PosterFact}>{entry.minutes} 分鐘</Text>
          <Text style={styles.v45PosterFact}>{distance} 公里</Text>
          <Text style={styles.v45PosterFact}>
            {entry.photoCount ?? entry.photos?.length ?? 0} 張照片
          </Text>
        </View>
      </View>

      <Image
        source={require('../../assets/detour/home-hero-route.png')}
        style={styles.v51PosterHomeRoute}
        resizeMode="contain"
      />
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
  const [photoIndex, setPhotoIndex] = useState(0);
  const completedAt = entry?.completedAt ?? new Date().toISOString();
  const destination = entry?.sceneName ?? fallbackDestination;
  const minutes = entry?.actualDurationMinutes ?? entry?.minutes ?? fallbackMinutes;
  const activeIndex = Math.min(photoIndex, Math.max(0, photos.length - 1));
  const activePhoto = photos[activeIndex];

  return (
    <View style={styles.v51CompleteCard}>
      <View style={styles.v51CompleteTopInfo}>
        <Text style={styles.v51CompleteTopBrand}>DETOUR</Text>
        <Text style={styles.v51CompleteTopMeta}>{entry?.moodLabel ?? '旅程'}</Text>
        <Text style={styles.v51CompleteTopMeta}>{minutes} 分</Text>
        <Text style={styles.v51CompleteTopDate}>{formatPassportDate(completedAt)}</Text>
      </View>

      <View style={styles.v51CompleteMedia}>
        {activePhoto ? (
          <Image
            source={{ uri: activePhoto.uri }}
            style={styles.v51CompleteHeroPhoto}
            resizeMode="contain"
          />
        ) : entry ? (
          <JourneyRouteTrace entry={entry} />
        ) : (
          <View style={styles.v51CompleteMediaFallback}>
            <Text style={styles.v51CompleteMediaFallbackText}>這趟走過的路</Text>
          </View>
        )}
      </View>

      {photos.length > 1 && (
        <View style={styles.v51CompleteThumbRow}>
          {photos.slice(0, 6).map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setPhotoIndex(index)}
              style={styles.v51CompleteThumbPress}
            >
              <Image
                source={{ uri: photo.uri }}
                style={[
                  styles.v51CompleteThumb,
                  index === activeIndex && styles.v51CompleteThumbActive,
                ]}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.v51CompleteCopy}>
        <Text style={styles.v51CompleteKicker}>這趟走到了</Text>
        <Text style={styles.v51CompleteDestination} numberOfLines={2}>
          {destination}
        </Text>
        <Text style={styles.v51CompleteMeta}>
          {photos.length} 張照片 · {minutes} 分鐘
        </Text>
      </View>

      <View style={styles.v51CompleteBand}>
        <Text style={styles.v51CompleteBandText}>旅程完成</Text>
      </View>
    </View>
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
  const activeIndex = Math.min(photoIndex, Math.max(0, photos.length - 1));
  const activePhoto = photos[activeIndex];
  const distanceKm = ((entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(1);

  return (
    <View style={styles.v46ReviewArtwork}>
      <Image
        source={require('../../assets/detour/journey-review-template.png')}
        style={styles.v46ArtworkBase}
        resizeMode="stretch"
      />

      <View style={styles.v46ReviewHeader}>
        <Text style={styles.v46ReviewBrand}>DETOUR</Text>
        <Text style={styles.v46ReviewDate}>{formatPassportDate(entry.completedAt)}</Text>
      </View>

      {activePhoto ? (
        <View style={styles.v51ReviewHeroStage}>
          <Image
            source={{ uri: activePhoto.uri }}
            style={styles.v46ReviewHeroPhoto}
            resizeMode="contain"
          />
        </View>
      ) : null}

      <View style={styles.v46ReviewThumbRow}>
        {Array.from({ length: 3 }).map((_, index) => {
          const photo = photos[index];
          if (!photo) return <View key={`empty-review-${index}`} style={styles.v46ReviewThumbEmpty} />;
          return (
            <Pressable key={photo.id} onPress={() => onPhotoIndex(index)} style={styles.v46ReviewThumbPress}>
              <Image
                source={{ uri: photo.uri }}
                style={[styles.v46ReviewThumb, index === activeIndex && styles.v46ReviewThumbActive]}
                resizeMode="cover"
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.v46ReviewCopyLeft}>
        <Text style={styles.v46ReviewKicker}>{entry.moodLabel}</Text>
        <Text style={styles.v46ReviewDestination} numberOfLines={2}>
          {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
        </Text>
      </View>

      <View style={styles.v46ReviewCopyRight}>
        <Text style={styles.v46ReviewFact}>{entry.actualDurationMinutes ?? entry.minutes} 分鐘</Text>
        <Text style={styles.v46ReviewFact}>{distanceKm} 公里</Text>
        <Text style={styles.v46ReviewFact}>{entry.photoCount ?? photos.length} 張照片</Text>
      </View>
    </View>
  );
}
