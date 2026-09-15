import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
const NOTE_KEY_PREFIX = '@detour/journey-note/v1/';

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
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['1.4deg', '0deg'],
  });

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          { rotate },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.985, 1],
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
      <View style={styles.v54RouteMissing}>
        <Text style={styles.v54RouteMissingTitle}>這趟沒有留下完整路徑</Text>
        <Text style={styles.v54RouteMissingBody}>照片和旅程紀錄仍然會保留。</Text>
      </View>
    );
  }

  return (
    <View style={styles.v54RouteTrace}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${ROUTE_VIEW_WIDTH} ${ROUTE_VIEW_HEIGHT}`}>
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
          stroke="#FBF7EE"
          strokeWidth={3}
        />
        <SvgRect
          x={route.end.x - 7}
          y={route.end.y - 7}
          width={14}
          height={14}
          rx={2}
          fill="#FF5A35"
          stroke="#FBF7EE"
          strokeWidth={3}
        />
      </Svg>

      {showLabel && (
        <View style={styles.v54RouteTraceLabel}>
          <Text style={styles.v54RouteTraceLabelText}>這趟走過的路</Text>
        </View>
      )}
    </View>
  );
}

function ZoomablePhoto({ uri }: { uri: string }) {
  return (
    <ScrollView
      key={uri}
      style={styles.v54ZoomScroll}
      contentContainerStyle={styles.v54ZoomContent}
      minimumZoomScale={1}
      maximumZoomScale={4}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.v54ZoomCanvas}>
        <Image source={{ uri }} style={styles.v54HeroPhoto} resizeMode="contain" />
      </View>
    </ScrollView>
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
    <View style={styles.v54TripFacts}>
      {facts.map((fact, index) => (
        <View key={fact} style={styles.v54TripFactCell}>
          {index > 0 && <View style={styles.v54TripFactDivider} />}
          <Text style={styles.v54TripFactText}>{fact}</Text>
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
    <View style={styles.v54FilmStrip}>
      <View style={styles.v54FilmPhotos}>
        {photos.slice(0, 6).map((photo, index) => (
          <Pressable
            key={photo.id}
            onPress={() => onPhotoIndex(index)}
            style={styles.v54FilmPress}
          >
            <Image
              source={{ uri: photo.uri }}
              style={[
                styles.v54FilmPhoto,
                index === activeIndex && styles.v54FilmPhotoActive,
              ]}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function JourneyNoteEditor({ entry }: { entry: PassportEntry }) {
  const storageKey = `${NOTE_KEY_PREFIX}${entry.id}`;
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setNote('');

    void AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (!active) return;
        setNote(value ?? '');
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(() => {
      void AsyncStorage.setItem(storageKey, note);
    }, 350);
    return () => clearTimeout(handle);
  }, [loaded, note, storageKey]);

  return (
    <View style={styles.v54NoteSection}>
      <View style={styles.v54NoteHeader}>
        <Text style={styles.v54NoteTitle}>旅程筆記</Text>
        <Text style={styles.v54NoteSaved}>{loaded ? '自動保存' : '讀取中'}</Text>
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        style={styles.v54NoteInput}
        placeholder="留一句給這趟旅程。"
        placeholderTextColor="#A8A196"
        multiline
        maxLength={280}
        textAlignVertical="top"
      />
      {note.length > 0 && <Text style={styles.v54NoteCount}>{note.length} / 280</Text>}
    </View>
  );
}

function orderedSharePhotos(entry: PassportEntry, selectedUri?: string) {
  const photos = entry.photos ?? [];
  if (!selectedUri) return photos.slice(0, 6);
  const selected = photos.find((photo) => photo.uri === selectedUri);
  if (!selected) return photos.slice(0, 6);
  return [selected, ...photos.filter((photo) => photo.id !== selected.id)].slice(0, 6);
}

function SharePhotoCollage({ photos }: { photos: SessionPhoto[] }) {
  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <PlacedPhoto>
        <Image
          source={{ uri: photos[0].uri }}
          style={styles.v54PosterSinglePhoto}
          resizeMode="contain"
        />
      </PlacedPhoto>
    );
  }

  const columns = photos.length <= 3 ? photos.length : photos.length === 4 ? 2 : 3;
  const rows = Math.ceil(photos.length / columns);
  const width = `${100 / columns}%` as const;
  const height = `${100 / rows}%` as const;

  return (
    <View style={styles.v54PosterCollage}>
      {photos.map((photo, index) => (
        <View key={photo.id} style={[styles.v54PosterTile, { width, height }]}> 
          <PlacedPhoto delay={index * 55}>
            <Image source={{ uri: photo.uri }} style={styles.v54PosterTilePhoto} resizeMode="cover" />
          </PlacedPhoto>
        </View>
      ))}
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
  const distance = ((entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(1);
  const minutes = entry.actualDurationMinutes ?? entry.minutes;
  const sharePhotos = useMemo(() => orderedSharePhotos(entry, photoUri), [entry, photoUri]);

  return (
    <View style={styles.v45Poster}>
      <View style={styles.v45PosterTop}>
        <Text style={styles.v45PosterBrand}>DETOUR</Text>
        <Text style={styles.v45PosterDate}>{formatPassportDate(entry.completedAt)}</Text>
      </View>

      {sharePhotos.length > 0 ? (
        <View style={styles.v54PosterPhotoStage}>
          <SharePhotoCollage photos={sharePhotos} />
        </View>
      ) : (
        <View style={styles.v54PosterRouteStage}>
          <JourneyRouteTrace entry={entry} showLabel />
        </View>
      )}

      <View style={styles.v45PosterCopy}>
        <Text style={styles.v45PosterMood}>{entry.moodLabel}</Text>
        <Text style={styles.v45PosterDestination} numberOfLines={2}>
          {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
        </Text>
        <View style={styles.v54PosterFacts}>
          <Text style={styles.v54PosterFact}>{minutes} 分鐘</Text>
          <Text style={styles.v54PosterFact}>{distance} 公里</Text>
          <Text style={styles.v54PosterFact}>{entry.photoCount ?? entry.photos?.length ?? 0} 張照片</Text>
        </View>
      </View>

      <Image
        source={require('../../assets/detour/home-hero-route.png')}
        style={styles.v54PosterHomeRoute}
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
    <View style={styles.v54TicketWrap}>
      <View style={styles.v54TicketPaper}>
        <View style={styles.v54TicketHeader}>
          <Text style={styles.v54TicketBrand}>DETOUR</Text>
          <Text style={styles.v54TicketStatus}>完成票</Text>
          <Text style={styles.v54TicketDate}>{formatPassportDate(completedAt)}</Text>
        </View>

        <View style={styles.v54Perforation} />

        <View style={[styles.v54HeroStage, !activePhoto && styles.v54HeroStageRoute]}>
          {activePhoto ? (
            <PlacedPhoto key={activePhoto.id}>
              <ZoomablePhoto uri={activePhoto.uri} />
            </PlacedPhoto>
          ) : entry ? (
            <JourneyRouteTrace entry={entry} showLabel />
          ) : (
            <View style={styles.v54RouteMissing}>
              <Text style={styles.v54RouteMissingTitle}>這趟已經完成</Text>
              <Text style={styles.v54RouteMissingBody}>旅程紀錄正在整理。</Text>
            </View>
          )}
          <View pointerEvents="none" style={styles.v54CompleteStamp}>
            <Text style={styles.v54CompleteStampTop}>完成</Text>
            <Text style={styles.v54CompleteStampBottom}>{String(photos.length).padStart(2, '0')}</Text>
          </View>
        </View>

        <PhotoStrip photos={photos} activeIndex={activeIndex} onPhotoIndex={setPhotoIndex} />

        <View style={styles.v54TicketCopy}>
          <Text style={styles.v54MoodTicket}>{entry?.moodLabel ?? '旅程'}</Text>
          <Text style={styles.v54Destination} numberOfLines={2}>{destination}</Text>
          <TripFacts minutes={minutes} distanceKm={distanceKm} photoCount={photos.length} />
          <Image
            source={require('../../assets/detour/home-hero-route.png')}
            style={styles.v54TicketRouteMark}
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
  const distanceKm = ((entry.distanceMeters ?? entry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(1);

  return (
    <View style={styles.v54TicketPaper}>
      <View style={styles.v54TicketHeader}>
        <Text style={styles.v54TicketBrand}>DETOUR</Text>
        <Text style={styles.v54TicketStatus}>收藏票根</Text>
        <Text style={styles.v54TicketDate}>
          {String(activeIndex + 1).padStart(2, '0')} / {String(Math.max(photos.length, 1)).padStart(2, '0')}
        </Text>
      </View>

      <View style={styles.v54Perforation} />

      <View style={[styles.v54HeroStage, !activePhoto && styles.v54HeroStageRoute]}>
        {activePhoto ? (
          <PlacedPhoto key={activePhoto.id}>
            <ZoomablePhoto uri={activePhoto.uri} />
          </PlacedPhoto>
        ) : (
          <JourneyRouteTrace entry={entry} showLabel />
        )}
        <View pointerEvents="none" style={styles.v54DateTag}>
          <Text style={styles.v54DateTagText}>{formatPassportDate(entry.completedAt)}</Text>
        </View>
      </View>

      <PhotoStrip photos={photos} activeIndex={activeIndex} onPhotoIndex={onPhotoIndex} />

      <View style={styles.v54TicketCopy}>
        <Text style={styles.v54MoodTicket}>{entry.moodLabel}</Text>
        <Text style={styles.v54Destination} numberOfLines={2}>
          {entry.sceneName ?? `${entry.city}的一趟 DETOUR`}
        </Text>
        <TripFacts minutes={minutes} distanceKm={distanceKm} photoCount={entry.photoCount ?? photos.length} />
      </View>

      <View style={styles.v54PerforationInset} />

      <View style={styles.v54RouteSection}>
        <View style={styles.v54RouteSectionTop}>
          <View>
            <Text style={styles.v54RouteSectionKicker}>路線 · {distanceKm} 公里</Text>
            <Text style={styles.v54RouteSectionTitle}>這趟走過的路</Text>
          </View>
        </View>
        <View style={styles.v54RouteStage}>
          <JourneyRouteTrace entry={entry} />
        </View>
      </View>

      <View style={styles.v54PerforationInset} />
      <JourneyNoteEditor entry={entry} />
    </View>
  );
}
