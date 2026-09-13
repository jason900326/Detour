from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / 'src/app/index.tsx'
BUILD = ROOT / 'src/lib/build-info.ts'

text = INDEX.read_text(encoding='utf-8')


def sub_one(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return updated

# 1) Use the final ticket-base PNG as the single ticket surface for both
# printing and ready states. All changing information stays dynamic.
new_ticket = r'''function V45Ticket({ timeLabel, moodLabel, moodId, serial, stamped = false, stampProgress }: { timeLabel: string; moodLabel: string; moodId: MoodId; serial: string; stamped?: boolean; stampProgress?: Animated.Value; }) {
  const stampScale = stampProgress
    ? stampProgress.interpolate({ inputRange: [0, 1], outputRange: [1.28, 1] })
    : 1;
  const stampOpacity = stampProgress ?? (stamped ? 1 : 0);

  return (
    <View style={styles.v46ArtTicket}>
      <Image
        source={require('../../assets/detour/ticket-base.png')}
        style={styles.v46ArtTicketBase}
        resizeMode="stretch"
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

function V45SharePoster'''
text = sub_one(
    text,
    r"function V45Ticket\(.*?\n\}\n\nfunction V45SharePoster",
    new_ticket,
    'replace V45Ticket',
)

# 2) Artwork-driven cards for journey complete and journey review.
art_components = r'''
function V46CompleteArtwork({
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

function V46ReviewArtwork({
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
'''
marker = '\nexport default function HomeScreen() {'
if text.count(marker) != 1:
    raise SystemExit(f'insert art components: expected 1 HomeScreen marker, got {text.count(marker)}')
text = text.replace(marker, art_components + marker, 1)

# 3) Replace the old programmatic home route drawing with the supplied hero art.
home_replacement = r'''            <Animated.View
              style={[
                styles.v35RouteSketch,
                {
                  opacity: homeEntrance,
                  transform: [
                    {
                      translateY: homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../assets/detour/home-hero-route.png')}
                style={styles.v46HomeHeroRoute}
                resizeMode="contain"
              />
            </Animated.View>
            <Text style={styles.v35HomeQuestion}>'''
text = sub_one(
    text,
    r"            <Animated.View\n              style=\{\[\n                styles\.v35RouteSketch,.*?            </Animated.View>\n            <Text style=\{styles\.v35HomeQuestion\}>",
    home_replacement,
    'replace home hero route',
)

# 4) Replace the CSS printer with the supplied metal artwork. The paper starts
# inside the slit and is layered over the lower face, while a clipped second
# copy of the top lip masks the paper above the opening.
printer_replacement = r'''            <View style={styles.v46ArtPrinterStage}>
              <Image
                source={require('../../assets/detour/printer-front.png')}
                style={styles.v46ArtPrinterImage}
                resizeMode="contain"
              />

              <Animated.View
                style={[
                  styles.v46ArtPaperReveal,
                  {
                    height: routeProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2, 420],
                    }),
                  },
                ]}
              >
                <V45Ticket
                  timeLabel={selectedTime ?? '15'}
                  moodId={selectedMood ?? 'wander'}
                  moodLabel={mood?.label ?? '—'}
                  serial={ticketSerial(selectedTime, selectedMood)}
                />
              </Animated.View>

              <View pointerEvents="none" style={styles.v46ArtPrinterTopMask}>
                <Image
                  source={require('../../assets/detour/printer-front.png')}
                  style={styles.v46ArtPrinterImageMask}
                  resizeMode="contain"
                />
              </View>
            </View>

            {ticketBuildError'''
text = sub_one(
    text,
    r"            <View style=\{styles\.v45PrinterStage\}>.*?            </View>\n\n            \{ticketBuildError",
    printer_replacement,
    'replace printer stage',
)

# 5) Put the supplied completion artwork behind the dynamic trip content.
finish_replacement = r'''              <V46CompleteArtwork
                entry={lastCompletedEntry}
                photos={photos}
                fallbackDestination={selectedScene?.name ?? '這趟的終點'}
                fallbackMinutes={selectedMinutes}
              />

              <Pressable'''
text = sub_one(
    text,
    r"              <View style=\{styles\.v45PassportCard\}>.*?              </View>\n\n              <Pressable",
    finish_replacement,
    'replace finish card',
)

# The new completion artwork already includes its own skyline.
finish_start = text.index("{stage === 'finish' && (")
finish_end = text.index("{stage === 'passport' && (", finish_start)
finish_block = text[finish_start:finish_end]
finish_block = finish_block.replace('\n            <V45Skyline />', '')
text = text[:finish_start] + finish_block + text[finish_end:]

# 6) Replace the top half of journey review with the supplied review artwork.
review_replacement = r'''              <V46ReviewArtwork
                entry={selectedPassportEntry}
                photoIndex={passportPhotoIndex}
                onPhotoIndex={setPassportPhotoIndex}
              />

              {selectedPassportEntry.photos && selectedPassportEntry.photos.length > 3 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.v45DetailThumbRow}
                >
                  {selectedPassportEntry.photos.slice(3).map((photo, offset) => {
                    const index = offset + 3;
                    return (
                      <Pressable key={photo.id} onPress={() => setPassportPhotoIndex(index)}>
                        <Image
                          source={{ uri: photo.uri }}
                          style={[
                            styles.v45DetailThumb,
                            index === passportPhotoIndex && styles.v45DetailThumbActive,
                          ]}
                          resizeMode="cover"
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.v45RouteStrip}>'''
text = sub_one(
    text,
    r"              <View style=\{styles\.v45DetailTicketStrip\}>.*?              <View style=\{styles\.v45RouteStrip\}>",
    review_replacement,
    'replace journey review top',
)

# 7) Add styles for the supplied artwork. Leave legacy styles in place to keep
# this change isolated and easy to revert.
art_styles = r'''
  v46HomeHeroRoute: {
    width: '100%',
    height: '100%',
  },
  v46ArtTicket: {
    width: 310,
    aspectRatio: 1115 / 1411,
    position: 'relative',
  },
  v46ArtTicketBase: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  v46ArtTicketHeader: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: '16.5%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  v46ArtTicketBrand: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v46ArtTicketSerial: {
    paddingBottom: 3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#77736B',
  },
  v46ArtTicketLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: INK,
  },
  v46ArtTicketTimeBlock: {
    position: 'absolute',
    left: '10%',
    top: '32.5%',
    width: '37%',
  },
  v46ArtTicketTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  v46ArtTicketMinutes: {
    fontSize: 47,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -2.7,
    color: SIGNAL,
  },
  v46ArtTicketMinutesUnit: {
    marginLeft: 4,
    marginBottom: 5,
    fontSize: 16,
    fontWeight: '900',
    color: INK,
  },
  v46ArtTicketMoodBlock: {
    position: 'absolute',
    right: '7.5%',
    top: '32.5%',
    width: '39%',
  },
  v46ArtTicketMoodRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  v46ArtTicketMoodText: {
    flex: 1,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    color: INK,
  },
  v46ArtTicketDestinationBlock: {
    position: 'absolute',
    left: '10%',
    top: '56.2%',
    width: '39%',
  },
  v46ArtTicketUnknownRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  v46ArtTicketPin: {
    width: 24,
    height: 30,
    borderRadius: 13,
    backgroundColor: SIGNAL,
    alignItems: 'center',
    paddingTop: 7,
  },
  v46ArtTicketPinCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBF8EF',
  },
  v46ArtTicketUnknown: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: 2,
    color: INK,
  },
  v46ArtTicketMiniRoute: {
    position: 'absolute',
    right: '8%',
    top: '57%',
    width: '37%',
    height: 56,
  },
  v46ArtMiniStart: {
    position: 'absolute',
    left: 2,
    bottom: 10,
    width: 13,
    height: 22,
    borderRadius: 2,
    backgroundColor: INK,
  },
  v46ArtMiniDash: {
    position: 'absolute',
    width: 45,
    borderTopWidth: 3,
    borderStyle: 'dashed',
    borderColor: SIGNAL,
  },
  v46ArtMiniTree: {
    position: 'absolute',
    left: 58,
    top: 13,
    width: 15,
    height: 27,
    borderRadius: 8,
    backgroundColor: INK,
  },
  v46ArtMiniFlagPole: {
    position: 'absolute',
    right: 9,
    top: 7,
    width: 3,
    height: 34,
    backgroundColor: INK,
  },
  v46ArtMiniFlag: {
    position: 'absolute',
    right: -2,
    top: 7,
    width: 14,
    height: 11,
    backgroundColor: SIGNAL,
  },
  v46ArtBarcode: {
    position: 'absolute',
    left: '21%',
    right: '21%',
    bottom: '6.8%',
    height: 39,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 2,
  },
  v46ArtBarcodeBar: {
    height: '100%',
    backgroundColor: INK,
  },
  v46ArtSecretStamp: {
    position: 'absolute',
    right: '7%',
    top: '44%',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(251,248,239,0.86)',
  },
  v46ArtSecretStampText: {
    fontSize: 17,
    fontWeight: '900',
    color: SIGNAL,
  },
  v46ArtPrinterStage: {
    width: '100%',
    height: 505,
    marginTop: 30,
    alignItems: 'center',
    position: 'relative',
  },
  v46ArtPrinterImage: {
    position: 'absolute',
    top: 0,
    width: '100%',
    aspectRatio: 2048 / 682,
    zIndex: 1,
  },
  v46ArtPaperReveal: {
    position: 'absolute',
    top: 61,
    width: 310,
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
  },
  v46ArtPrinterTopMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    overflow: 'hidden',
    zIndex: 3,
  },
  v46ArtPrinterImageMask: {
    position: 'absolute',
    top: 0,
    width: '100%',
    aspectRatio: 2048 / 682,
  },
  v46ArtworkBase: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  v46CompleteArtwork: {
    width: '100%',
    aspectRatio: 942 / 1670,
    position: 'relative',
    marginBottom: 24,
  },
  v46CompleteHeroPhoto: {
    position: 'absolute',
    left: '5.1%',
    top: '15.2%',
    width: '89.8%',
    height: '41.1%',
    borderRadius: 10,
  },
  v46CompleteTopInfo: {
    position: 'absolute',
    left: '4.8%',
    right: '4.8%',
    top: '3.8%',
    height: '8.2%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  v46CompleteTopCell: {
    flex: 1,
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: INK,
    borderRightWidth: 1,
    borderRightColor: '#B8B0A4',
  },
  v46CompleteTopCellLast: {
    borderRightWidth: 0,
  },
  v46CompleteThumbRow: {
    position: 'absolute',
    left: '3.2%',
    right: '3.2%',
    top: '58.2%',
    height: '9.8%',
    flexDirection: 'row',
    gap: 3,
  },
  v46CompleteThumb: {
    flex: 1,
    height: '100%',
    borderRadius: 8,
  },
  v46CompleteThumbEmpty: {
    flex: 1,
    height: '100%',
  },
  v46CompleteCopy: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '70.1%',
  },
  v46CompleteKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: MUTED,
  },
  v46CompleteDestination: {
    marginTop: 5,
    width: '62%',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    color: INK,
  },
  v46CompleteMeta: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
  },
  v46CompleteOrangeBand: {
    position: 'absolute',
    left: '7%',
    bottom: '9.4%',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#FFF8EE',
  },
  v46ReviewArtwork: {
    width: '100%',
    aspectRatio: 1122 / 1402,
    position: 'relative',
    marginBottom: 22,
  },
  v46ReviewHeader: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: '5.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v46ReviewBrand: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 3,
    color: INK,
  },
  v46ReviewDate: {
    fontSize: 11,
    fontWeight: '800',
    color: MUTED,
  },
  v46ReviewHeroPhoto: {
    position: 'absolute',
    left: '10.2%',
    top: '17.1%',
    width: '79.2%',
    height: '38.4%',
    borderRadius: 12,
  },
  v46ReviewThumbRow: {
    position: 'absolute',
    left: '10.2%',
    right: '10.2%',
    top: '57.1%',
    height: '12.4%',
    flexDirection: 'row',
    gap: 6,
  },
  v46ReviewThumbPress: {
    flex: 1,
    height: '100%',
  },
  v46ReviewThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  v46ReviewThumbActive: {
    borderColor: SIGNAL,
  },
  v46ReviewThumbEmpty: {
    flex: 1,
  },
  v46ReviewCopyLeft: {
    position: 'absolute',
    left: '12.2%',
    top: '76.7%',
    width: '35%',
  },
  v46ReviewCopyRight: {
    position: 'absolute',
    left: '58.5%',
    top: '76.7%',
    width: '29%',
  },
  v46ReviewKicker: {
    fontSize: 12,
    fontWeight: '900',
    color: SIGNAL,
  },
  v46ReviewDestination: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: INK,
  },
  v46ReviewFact: {
    marginBottom: 7,
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },
'''
insert_at = text.rfind('\n});')
if insert_at < 0:
    raise SystemExit('style insertion point not found')
text = text[:insert_at] + art_styles + text[insert_at:]

INDEX.write_text(text, encoding='utf-8')

build = BUILD.read_text(encoding='utf-8')
build = re.sub(
    r"// v[^\n]+\nexport const DETOUR_BUILD_VERSION = '[^']+';",
    "// v0.46.0: wire final Detour artwork into Home, Mood, ticket, journey review, and journey complete.\nexport const DETOUR_BUILD_VERSION = '0.46.0';",
    build,
    count=1,
)
BUILD.write_text(build, encoding='utf-8')

print('Applied final Detour artwork integration.')
