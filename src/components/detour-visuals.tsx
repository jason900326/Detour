import { useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';

import MoodWanderIcon from '../../assets/mood/wander.svg';
import MoodFoodIcon from '../../assets/mood/food.svg';
import MoodQuietIcon from '../../assets/mood/quiet.svg';
import MoodWeirdIcon from '../../assets/mood/weird.svg';
import MoodColorIcon from '../../assets/mood/color.svg';
import MoodSurpriseIcon from '../../assets/mood/surprise.svg';

import type { MoodId } from '../lib/journey-engine';
import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/home-helpers';
import { styles } from '../styles/home-styles';
import { SIGNAL } from '../theme/detour-theme';

let ticketArtworkDecoded = false;

type MoodGlyphProps = {
  moodId: MoodId;
  active: boolean;
};

export function MoodGlyph({ moodId, active }: MoodGlyphProps) {
  const rootStyle = [
    styles.v44MoodGlyph,
    active && styles.v44MoodGlyphActive,
  ];

  if (moodId === 'wander') {
    return (
      <View style={rootStyle}>
        <View style={styles.v44WanderStem} />
        <View style={styles.v44WanderBranchLeft} />
        <View style={styles.v44WanderBranchRight} />
        <View style={styles.v44WanderOrigin} />
        <View style={styles.v44WanderChoice} />
      </View>
    );
  }

  if (moodId === 'food') {
    return (
      <View style={rootStyle}>
        <View style={styles.v44FoodPlate} />
        <View style={styles.v44FoodForkHandle} />
        <View style={styles.v44FoodForkTineA} />
        <View style={styles.v44FoodForkTineB} />
        <View style={styles.v44FoodForkTineC} />
        <View style={styles.v44FoodKnife} />
      </View>
    );
  }

  if (moodId === 'quiet') {
    return (
      <View style={rootStyle}>
        <View style={[styles.v44QuietBar, styles.v44QuietBarA]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarB]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarC]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarD]} />
        <View style={[styles.v44QuietBar, styles.v44QuietBarE]} />
        <View style={styles.v44QuietSlash} />
      </View>
    );
  }

  if (moodId === 'weird') {
    return (
      <View style={rootStyle}>
        <View style={[styles.v44WeirdTile, styles.v44WeirdTileA]} />
        <View style={[styles.v44WeirdTile, styles.v44WeirdTileB]} />
        <View style={[styles.v44WeirdTile, styles.v44WeirdTileC]} />
        <View style={styles.v44WeirdOddTile} />
      </View>
    );
  }

  if (moodId === 'color') {
    return (
      <View style={rootStyle}>
        <View style={[styles.v44ColorSwatch, styles.v44ColorSwatchBack]} />
        <View style={[styles.v44ColorSwatch, styles.v44ColorSwatchSignal]} />
        <View style={[styles.v44ColorSwatch, styles.v44ColorSwatchFront]} />
      </View>
    );
  }

  return (
    <View style={rootStyle}>
      <View style={styles.v44FateDie}>
        <View style={[styles.v44FatePip, styles.v44FatePipA]} />
        <View style={[styles.v44FatePip, styles.v44FatePipB]} />
        <View style={[styles.v44FatePip, styles.v44FatePipC]} />
      </View>
      <View style={styles.v44FateSignal} />
    </View>
  );
}

const DETOUR_TICKET_BARS = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3];
const DETOUR_TICKET_EDGE = Array.from({ length: 8 }, (_, index) => 30 + index * 50);

export type DetourTicketProps = {
  timeLabel: string;
  moodLabel: string;
  serial: string;
  stamped?: boolean;
  stampProgress?: Animated.Value;
};

export function DetourTicket({
  timeLabel,
  moodLabel,
  serial,
  stamped = false,
  stampProgress,
}: DetourTicketProps) {
  const stampStyle = stampProgress
    ? {
        opacity: stampProgress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0.18, 1],
        }),
        transform: [
          { rotate: '-7deg' },
          {
            translateY: stampProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [-28, 3, 0],
            }),
          },
          {
            scale: stampProgress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [1.32, 0.94, 1],
            }),
          },
        ],
      }
    : {
        opacity: stamped ? 1 : 0,
        transform: [{ rotate: '-7deg' }],
      };

  return (
    <View style={styles.v44TicketPaper}>
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`left-${top}`} style={[styles.v44TicketEdgeCut, styles.v44TicketEdgeLeft, { top }]} />
      ))}
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`right-${top}`} style={[styles.v44TicketEdgeCut, styles.v44TicketEdgeRight, { top }]} />
      ))}

      <View style={styles.v44TicketHeader}>
        <Text style={styles.v44TicketBrand}>DETOUR</Text>
        <Text style={styles.v44TicketSerial}>{serial}</Text>
      </View>

      <View style={styles.v44TicketRule} />

      <View style={styles.v44TicketTimeBlock}>
        <Text style={styles.v44TicketLabel}>時間</Text>
        <View style={styles.v44TicketTimeRow}>
          <Text style={styles.v44TicketTime}>{timeLabel}</Text>
          <Text style={styles.v44TicketTimeUnit}>分鐘</Text>
        </View>
      </View>

      <View style={styles.v44TicketMoodBlock}>
        <View style={styles.v44TicketMoodCopy}>
          <Text style={styles.v44TicketLabel}>心情</Text>
          <Text style={styles.v44TicketMood}>{moodLabel}</Text>
        </View>

        {stamped && (
          <Animated.View style={[styles.v44TicketStamp, stampStyle]}>
            <Text style={styles.v44TicketStampText}>終點保密</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.v44TicketDash} />

      <View style={styles.v44TicketFooter}>
        <View style={styles.v44TicketBarcode}>
          {DETOUR_TICKET_BARS.map((width, index) => (
            <View key={`${width}-${index}`} style={[styles.v44TicketBar, { width }]} />
          ))}
        </View>
      </View>
    </View>
  );
}




export function DetourAccentStroke({
  width,
  style,
}: {
  width: number;
  style?: any;
}) {
  const height = 18;
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <SvgPath
          d={`M 5 12 Q ${Math.round(width * 0.52)} 4 ${width - 5} 8`}
          fill="none"
          stroke={SIGNAL}
          strokeWidth={7}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// DETOUR V45 — ticket / mood / recap visual system
export function V45Skyline() {
  const buildings = [
    { left: 0, width: 34, height: 38 },
    { left: 28, width: 25, height: 62 },
    { left: 58, width: 42, height: 29 },
    { left: 104, width: 22, height: 49 },
    { left: 132, width: 55, height: 35 },
    { left: 194, width: 31, height: 58 },
    { left: 232, width: 44, height: 42 },
    { left: 286, width: 24, height: 66 },
    { left: 318, width: 58, height: 31 },
  ];

  return (
    <View pointerEvents="none" style={styles.v45Skyline}>
      {buildings.map((building, index) => (
        <View
          key={`${building.left}-${index}`}
          style={[
            styles.v45SkylineBuilding,
            {
              left: building.left,
              width: building.width,
              height: building.height,
            },
          ]}
        />
      ))}
      <View style={styles.v45SkylineBridgeDeck} />
      <View style={styles.v45SkylineBridgeArch} />
    </View>
  );
}

export function V45MoodIcon({ moodId, size = 76 }: { moodId: MoodId; size?: number }) {
  const commonProps = { width: size, height: size };
  if (moodId === 'wander') return <MoodWanderIcon {...commonProps} />;
  if (moodId === 'food') return <MoodFoodIcon {...commonProps} />;
  if (moodId === 'quiet') return <MoodQuietIcon {...commonProps} />;
  if (moodId === 'weird') return <MoodWeirdIcon {...commonProps} />;
  if (moodId === 'color') return <MoodColorIcon {...commonProps} />;
  return <MoodSurpriseIcon {...commonProps} />;
}

export function V45Ticket({ timeLabel, moodLabel, moodId, serial, stamped = false, stampProgress }: { timeLabel: string; moodLabel: string; moodId: MoodId; serial: string; stamped?: boolean; stampProgress?: Animated.Value; }) {
  const [artworkReady, setArtworkReady] = useState(ticketArtworkDecoded);
  const markArtworkReady = () => {
    ticketArtworkDecoded = true;
    setArtworkReady(true);
  };

  const stampScale = stampProgress
    ? stampProgress.interpolate({ inputRange: [0, 1], outputRange: [1.28, 1] })
    : 1;
  const stampOpacity = stampProgress ?? (stamped ? 1 : 0);

  return (
    <View style={[styles.v46ArtTicket, !artworkReady && styles.v49TicketArtworkPending]}>
      <Image
        source={require('../../assets/detour/ticket-base.png')}
        style={styles.v46ArtTicketBase}
        resizeMode="stretch"
        onLoad={markArtworkReady}
        onLoadEnd={markArtworkReady}
      />

      <View style={styles.v46ArtTicketHeader}>
        <Text style={styles.v46ArtTicketBrand}>DETOUR</Text>
        <Text style={styles.v46ArtTicketSerial}>{serial}</Text>
      </View>

      <View style={styles.v46ArtTicketTimeBlock}>
        <Text style={styles.v46ArtTicketLabel}>旅程時間</Text>
        <View style={styles.v46ArtTicketTimeRow}>
          <Text style={styles.v46ArtTicketMinutes}>{timeLabel}</Text>
          <Text style={styles.v46ArtTicketMinutesUnit}>分鐘</Text>
        </View>
      </View>

      <View style={styles.v46ArtTicketMoodBlock}>
        <Text style={styles.v46ArtTicketLabel}>此趟心情</Text>
        <View style={styles.v46ArtTicketMoodRow}>
          <V45MoodIcon moodId={moodId} size={43} />
          <Text style={styles.v46ArtTicketMoodText}>{moodLabel}</Text>
        </View>
      </View>

      <View style={styles.v46ArtTicketDestinationBlock}>
        <Text style={styles.v46ArtTicketLabel}>目的地</Text>
        <View style={styles.v46ArtTicketUnknownRow}>
          <View style={styles.v46ArtTicketPin}>
            <View style={styles.v46ArtTicketPinCore} />
          </View>
          <Text style={styles.v46ArtTicketUnknown}>???</Text>
        </View>
      </View>

      <View style={styles.v46ArtTicketMiniRoute}>
        <View style={styles.v46ArtMiniStart} />
        <View style={[styles.v46ArtMiniDash, { left: 15, top: 28, transform: [{ rotate: '12deg' }] }]} />
        <View style={styles.v46ArtMiniTree} />
        <View style={[styles.v46ArtMiniDash, { left: 70, top: 22, transform: [{ rotate: '-17deg' }] }]} />
        <View style={styles.v46ArtMiniFlagPole} />
        <View style={styles.v46ArtMiniFlag} />
      </View>

      <View style={styles.v46ArtBarcode}>
        {Array.from({ length: 29 }).map((_, index) => (
          <View
            key={`art-barcode-${index}`}
            style={[
              styles.v46ArtBarcodeBar,
              { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },
            ]}
          />
        ))}
      </View>

      {stamped && (
        <Animated.View
          style={[
            styles.v46ArtSecretStamp,
            {
              opacity: stampOpacity,
              transform: [{ rotate: '-8deg' }, { scale: stampScale }],
            },
          ]}
        >
          <Text style={styles.v46ArtSecretStampText}>終點保密</Text>
        </Animated.View>
      )}
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
