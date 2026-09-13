import { Image, Pressable, Text, View } from 'react-native';
import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/detour-formatters';
import { styles } from '../styles/home-styles';

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
        <Image source={{ uri: photoUri }} style={styles.v45PosterPhoto} resizeMode="cover" />
      ) : (
        <View style={[styles.v45PosterPhoto, styles.v45PosterNoPhoto]}>
          <Text style={styles.v45PosterNoPhotoText}>這趟沒有留下照片</Text>
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
          <Text style={styles.v45PosterFact}>{entry.photoCount ?? entry.photos?.length ?? 0} 張照片</Text>
        </View>
      </View>

      <View style={styles.v45PosterRoute}>
        <View style={styles.v45PosterRouteStart} />
        <View style={styles.v45PosterRouteLineA} />
        <View style={styles.v45PosterRouteTurn} />
        <View style={styles.v45PosterRouteLineB} />
        <View style={styles.v45PosterRouteEnd} />
      </View>
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
  const completedAt = entry?.completedAt ?? new Date().toISOString();
  const destination = entry?.sceneName ?? fallbackDestination;
  const minutes = entry?.actualDurationMinutes ?? entry?.minutes ?? fallbackMinutes;

  return (
    <View style={styles.v46CompleteArtwork}>
      <Image
        source={require('../../assets/detour/journey-complete-template.png')}
        style={styles.v46ArtworkBase}
        resizeMode="stretch"
      />

      {photos[0] && (
        <Image source={{ uri: photos[0].uri }} style={styles.v46CompleteHeroPhoto} resizeMode="cover" />
      )}

      <View style={styles.v46CompleteTopInfo}>
        <Text style={styles.v46CompleteTopCell}>DETOUR</Text>
        <Text style={styles.v46CompleteTopCell}>{entry?.moodLabel ?? '旅程'}</Text>
        <Text style={styles.v46CompleteTopCell}>{minutes} 分</Text>
        <Text style={[styles.v46CompleteTopCell, styles.v46CompleteTopCellLast]}>{formatPassportDate(completedAt)}</Text>
      </View>

      <View style={styles.v46CompleteThumbRow}>
        {Array.from({ length: 6 }).map((_, index) =>
          photos[index] ? (
            <Image key={photos[index].id} source={{ uri: photos[index].uri }} style={styles.v46CompleteThumb} resizeMode="cover" />
          ) : (
            <View key={`empty-complete-${index}`} style={styles.v46CompleteThumbEmpty} />
          )
        )}
      </View>

      <View style={styles.v46CompleteCopy}>
        <Text style={styles.v46CompleteKicker}>這趟走到了</Text>
        <Text style={styles.v46CompleteDestination} numberOfLines={2}>{destination}</Text>
        <Text style={styles.v46CompleteMeta}>{photos.length} 張照片 · {minutes} 分鐘</Text>
      </View>

      <Text style={styles.v46CompleteOrangeBand}>旅程完成</Text>
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

      {activePhoto && (
        <Image source={{ uri: activePhoto.uri }} style={styles.v46ReviewHeroPhoto} resizeMode="cover" />
      )}

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
