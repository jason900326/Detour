import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Polyline as SvgPolyline,
  Rect as SvgRect,
} from 'react-native-svg';
import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/detour-formatters';
import { styles } from '../styles/home-styles';

const ROUTE_VIEW_WIDTH = 320;
const ROUTE_VIEW_HEIGHT = 210;
const ROUTE_PADDING = 26;

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

function JourneyRouteTrace({
  entry,
  showLabel = false,
}: {
  entry: PassportEntry;
  showLabel?: boolean;
}) {
  const route = projectedRoute(routeForEntry(entry));

  if (!route) {
    return (
      <View style={styles.v52RouteMissing}>
        <Text style={styles.v52RouteMissingTitle}>這趟沒有留下完整路徑</Text>
        <Text style={styles.v52RouteMissingBody}>照片和旅程紀錄仍然會保留。</Text>
      </View>
    );
  }

  return (
    <View style={styles.v52RouteTrace}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${ROUTE_VIEW_WIDTH} ${ROUTE_VIEW_HEIGHT}`}
      >
        <SvgPolyline
          points={route.points}
          fill="none"
          stroke="#11110F"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <SvgCircle
          cx={route.start.x}
          cy={route.start.y}
          r={7}
          fill="#FF5A35"
          stroke="#F5F1E8"
          strokeWidth={3}
        />
        <SvgRect
          x={route.end.x - 7}
          y={route.end.y - 7}
          width={14}
          height={14}
          rx={2}
          fill="#FF5A35"
          stroke="#F5F1E8"
          strokeWidth={3}
        />
      </Svg>

      {showLabel && (
        <View style={styles.v52RouteTraceLabel}>
          <Text style={styles.v52RouteTraceLabelText}>這趟走過的路</Text>
        </View>
      )}
    </View>
  );
}

function TripFacts({
  minutes,
  distanceKm,
  photoCount,
}: {
  minutes: number;
  distanceKm?: string;
  photoCount: number;
}) {
  const facts = [
    `${minutes} 分鐘`,
    ...(distanceKm !== undefined ? [`${distanceKm} 公里`] : []),
    `${photoCount} 張照片`,
  ];

  return (
    <View style={styles.v53TripFacts}>
      {facts.map((fact, index) => (
        <View key={fact} style={styles.v53TripFactCell}>
          {index > 0 && <View style={styles.v53TripFactDivider} />}
          <Text style={styles.v53TripFactText}>{fact}</Text>
        </View>
      ))}
    </View>
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
    <View style={styles.v53FilmStrip}>
      <View style={styles.v53FilmHole} />
      <View style={styles.v53FilmPhotos}>
        {photos.slice(0, 6).map((photo, index) => (
          <Pressable
            key={photo.id}
            onPress={() => onPhotoIndex(index)}
            style={styles.v53FilmPress}
          >
            <Image
              source={{ uri: photo.uri }}
              style={[
                styles.v53FilmPhoto,
                index === activeIndex && styles.v53FilmPhotoActive,
              ]}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.v53FilmHole} />
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
          <JourneyRouteTrace entry={entry} showLabel />
        </View>
      )}

      <View style={styles.v45PosterCopy}>
        <Text style={styles.v45PosterMood}>{entry.moodLabel}</Text>
        <Text style={styles.v45PosterDestination} numberOfLines={2}>
          {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
        </Text>
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
  const distanceKm = entry
    ? ((entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(1)
    : undefined;

  return (
    <View style={styles.v53CompleteArtifactWrap}>
      <View pointerEvents="none" style={styles.v53CompleteOffsetCard} />
      <View style={styles.v53CompleteArtifact}>
        <View style={styles.v53ArtifactRail}>
          <Text style={styles.v53ArtifactRailBrand}>DETOUR</Text>
          <Text style={styles.v53ArtifactRailLabel}>完成票</Text>
          <Text style={styles.v53ArtifactRailDate}>{formatPassportDate(completedAt)}</Text>
        </View>

        <View style={[styles.v53HeroStage, !activePhoto && styles.v53HeroStageRoute]}>
          {activePhoto ? (
            <Image
              source={{ uri: activePhoto.uri }}
              style={styles.v53HeroPhoto}
              resizeMode="contain"
            />
          ) : entry ? (
            <JourneyRouteTrace entry={entry} showLabel />
          ) : (
            <View style={styles.v52RouteMissing}>
              <Text style={styles.v52RouteMissingTitle}>這趟已經完成</Text>
              <Text style={styles.v52RouteMissingBody}>旅程紀錄正在整理。</Text>
            </View>
          )}
          <View style={styles.v53CompleteStamp}>
            <Text style={styles.v53CompleteStampTop}>完成</Text>
            <Text style={styles.v53CompleteStampBottom}>{String(photos.length).padStart(2, '0')}</Text>
          </View>
        </View>

        <PhotoStrip
          photos={photos}
          activeIndex={activeIndex}
          onPhotoIndex={setPhotoIndex}
        />

        <View style={styles.v53CompleteCopy}>
          <Text style={styles.v53MoodTicket}>{entry?.moodLabel ?? '旅程'}</Text>
          <Text style={styles.v53Destination} numberOfLines={2}>{destination}</Text>
          <TripFacts minutes={minutes} distanceKm={distanceKm} photoCount={photos.length} />
          <Image
            source={require('../../assets/detour/home-hero-route.png')}
            style={styles.v53CompleteRouteMark}
            resizeMode="contain"
          />
        </View>
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
  const minutes = entry.actualDurationMinutes ?? entry.minutes;
  const distanceKm = (
    (entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000
  ).toFixed(1);

  return (
    <View style={styles.v53ReviewArtifact}>
      <View style={styles.v53ArchiveRail}>
        <Text style={styles.v53ArchiveRailText}>DETOUR · 收藏</Text>
        <Text style={styles.v53ArchiveRailMeta}>{String(activeIndex + 1).padStart(2, '0')} / {String(Math.max(photos.length, 1)).padStart(2, '0')}</Text>
      </View>

      <View style={[styles.v53HeroStage, !activePhoto && styles.v53HeroStageRoute]}>
        {activePhoto ? (
          <Image
            source={{ uri: activePhoto.uri }}
            style={styles.v53HeroPhoto}
            resizeMode="contain"
          />
        ) : (
          <JourneyRouteTrace entry={entry} showLabel />
        )}
        <View style={styles.v53ArchiveDateTag}>
          <Text style={styles.v53ArchiveDateText}>{formatPassportDate(entry.completedAt)}</Text>
        </View>
      </View>

      <PhotoStrip
        photos={photos}
        activeIndex={activeIndex}
        onPhotoIndex={onPhotoIndex}
      />

      <View style={styles.v53ReviewCopy}>
        <Text style={styles.v53MoodTicket}>{entry.moodLabel}</Text>
        <Text style={styles.v53Destination} numberOfLines={2}>
          {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
        </Text>
        <TripFacts
          minutes={minutes}
          distanceKm={distanceKm}
          photoCount={entry.photoCount ?? photos.length}
        />
      </View>

      <View style={styles.v53RouteSection}>
        <View style={styles.v53RouteSectionTop}>
          <View>
            <Text style={styles.v53RouteSectionKicker}>路線 · {distanceKm} 公里</Text>
            <Text style={styles.v53RouteSectionTitle}>這趟走過的路</Text>
          </View>
          <View style={styles.v53RouteSectionFlag} />
        </View>
        <View style={styles.v53RouteStage}>
          <JourneyRouteTrace entry={entry} />
        </View>
      </View>
    </View>
  );
}
