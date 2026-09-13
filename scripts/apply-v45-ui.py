from pathlib import Path

PATH = Path('src/app/index.tsx')
text = PATH.read_text(encoding='utf-8')

MARKER = '// DETOUR V45 — ticket / mood / recap visual system'
if MARKER in text:
    print('V45 UI already applied; nothing to do.')
    raise SystemExit(0)


def replace_between(source: str, start: str, end: str, replacement: str) -> str:
    a = source.find(start)
    if a < 0:
        raise RuntimeError(f'start marker not found: {start[:80]}')
    b = source.find(end, a)
    if b < 0:
        raise RuntimeError(f'end marker not found: {end[:80]}')
    return source[:a] + replacement + source[b:]


# Product copy follows the refined visual concepts, while IDs remain unchanged.
old_moods = """const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走', code: 'WANDER' },
  { id: 'food', label: '吃東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜', code: 'QUIET' },
  { id: 'weird', label: '這是哪', code: 'WEIRD' },
  { id: 'color', label: '色色的', code: 'COLOR' },
  { id: 'surprise', label: '命運', code: 'SURPRISE' },
];"""
new_moods = """const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走走', code: 'WANDER' },
  { id: 'food', label: '吃點東西', code: 'FOOD' },
  { id: 'quiet', label: '放鬆一下', code: 'QUIET' },
  { id: 'weird', label: '探索新鮮', code: 'WEIRD' },
  { id: 'color', label: '拍照走走', code: 'COLOR' },
  { id: 'surprise', label: '交給驚喜', code: 'SURPRISE' },
];"""
if old_moods not in text:
    raise RuntimeError('MOODS block changed upstream; refusing a fuzzy edit.')
text = text.replace(old_moods, new_moods, 1)


helpers = r'''

// DETOUR V45 — ticket / mood / recap visual system
function V45Skyline() {
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

function V45MoodIcon({ moodId }: { moodId: MoodId }) {
  if (moodId === 'wander') {
    return (
      <View style={styles.v45MoodIconStage}>
        <View style={styles.v45WalkerBackpack} />
        <View style={styles.v45WalkerHead} />
        <View style={styles.v45WalkerBody} />
        <View style={[styles.v45WalkerLimb, styles.v45WalkerArm]} />
        <View style={[styles.v45WalkerLimb, styles.v45WalkerLegA]} />
        <View style={[styles.v45WalkerLimb, styles.v45WalkerLegB]} />
        <View style={[styles.v45AccentDash, { left: 13, top: 56, transform: [{ rotate: '18deg' }] }]} />
      </View>
    );
  }

  if (moodId === 'food') {
    return (
      <View style={styles.v45MoodIconStage}>
        <View style={styles.v45DrinkCup} />
        <View style={styles.v45DrinkLid} />
        <View style={styles.v45DrinkStraw} />
        <View style={styles.v45BurgerBun} />
        <View style={styles.v45BurgerPatty} />
        <View style={styles.v45BurgerBottom} />
        <View style={[styles.v45AccentDash, { right: 13, top: 27, transform: [{ rotate: '-55deg' }] }]} />
      </View>
    );
  }

  if (moodId === 'quiet') {
    return (
      <View style={styles.v45MoodIconStage}>
        <View style={styles.v45TreeCrownA} />
        <View style={styles.v45TreeCrownB} />
        <View style={styles.v45TreeTrunk} />
        <View style={styles.v45BenchSeat} />
        <View style={styles.v45BenchBack} />
        <View style={[styles.v45BenchLeg, { left: 54 }]} />
        <View style={[styles.v45BenchLeg, { left: 82 }]} />
      </View>
    );
  }

  if (moodId === 'weird') {
    return (
      <View style={styles.v45MoodIconStage}>
        <View style={styles.v45CatBody} />
        <View style={styles.v45CatHead} />
        <View style={[styles.v45CatEar, styles.v45CatEarLeft]} />
        <View style={[styles.v45CatEar, styles.v45CatEarRight]} />
        <View style={styles.v45CatTail} />
        <Text style={styles.v45QuestionMark}>?</Text>
      </View>
    );
  }

  if (moodId === 'color') {
    return (
      <View style={styles.v45MoodIconStage}>
        <View style={styles.v45CameraBody} />
        <View style={styles.v45CameraTop} />
        <View style={styles.v45CameraLensOuter}>
          <View style={styles.v45CameraLensInner} />
        </View>
        <View style={[styles.v45AccentDash, { left: 8, top: 43, transform: [{ rotate: '18deg' }] }]} />
      </View>
    );
  }

  return (
    <View style={styles.v45MoodIconStage}>
      <View style={styles.v45Die}>
        <View style={[styles.v45DiePip, { left: 15, top: 14 }]} />
        <View style={[styles.v45DiePip, { right: 15, top: 14 }]} />
        <View style={[styles.v45DiePip, { left: 28, top: 30 }]} />
        <View style={[styles.v45DiePip, { left: 15, bottom: 14 }]} />
        <View style={[styles.v45DiePip, { right: 15, bottom: 14 }]} />
      </View>
      <View style={[styles.v45AccentDash, { left: 9, top: 42, transform: [{ rotate: '12deg' }] }]} />
    </View>
  );
}

function V45Ticket({
  timeLabel,
  moodLabel,
  serial: _serial,
  stamped = false,
  stampProgress,
}: DetourTicketProps) {
  const stampAnimatedStyle = stampProgress
    ? {
        opacity: stampProgress.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, 0.2, 1],
        }),
        transform: [
          { rotate: '-7deg' },
          {
            scale: stampProgress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1.25, 0.95, 1],
            }),
          },
        ],
      }
    : undefined;

  return (
    <View style={styles.v45TicketPaper}>
      <View style={styles.v45TicketOrangeBand} />
      <Text style={styles.v45TicketBrand}>DETOUR</Text>
      <View style={styles.v45TicketRule} />

      <View style={styles.v45TicketInfoRow}>
        <View style={styles.v45TicketInfoBlock}>
          <Text style={styles.v45TicketLabel}>旅程時間</Text>
          <View style={styles.v45TicketMinutesRow}>
            <Text style={styles.v45TicketMinutes}>{timeLabel}</Text>
            <Text style={styles.v45TicketMinutesUnit}>分鐘</Text>
          </View>
        </View>
        <View style={styles.v45TicketVerticalRule} />
        <View style={styles.v45TicketInfoBlock}>
          <Text style={styles.v45TicketLabel}>此趟心情</Text>
          <Text style={styles.v45TicketMood}>{moodLabel}</Text>
          <View style={styles.v45TicketMoodUnderline} />
        </View>
      </View>

      <View style={styles.v45TicketRule} />
      <View style={styles.v45TicketDestinationRow}>
        <View>
          <Text style={styles.v45TicketLabel}>目的地</Text>
          <Text style={styles.v45TicketUnknown}>● ????</Text>
        </View>
        <View style={styles.v45TicketRouteMini}>
          <View style={styles.v45TicketRouteDot} />
          <View style={styles.v45TicketRouteDashA} />
          <View style={styles.v45TicketRouteDashB} />
          <View style={styles.v45TicketRouteFlagPole} />
          <View style={styles.v45TicketRouteFlag} />
        </View>
      </View>

      <View style={styles.v45TicketRule} />
      <View style={styles.v45BarcodeRow}>
        {DETOUR_TICKET_BARS.concat(DETOUR_TICKET_BARS.slice(0, 9)).map((width, index) => (
          <View
            key={`${width}-${index}`}
            style={[styles.v45BarcodeBar, { width: Math.max(1, width) }]}
          />
        ))}
      </View>

      {stamped && (
        <Animated.View
          style={[
            styles.v45TicketStamp,
            stampAnimatedStyle,
          ]}
        >
          <Text style={styles.v45TicketStampText}>終點保密</Text>
        </Animated.View>
      )}
    </View>
  );
}

function V45SharePoster({
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
'''
anchor = 'export default function HomeScreen() {'
if anchor not in text:
    raise RuntimeError('HomeScreen anchor missing')
text = text.replace(anchor, helpers + '\n' + anchor, 1)


mood_block = r'''{stage === 'mood' && (
          <View style={styles.v45MoodScreen}>
            <View style={styles.v45MoodHeader}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v45BackButton}>
                <Text style={styles.v45BackText}>‹</Text>
              </Pressable>
              <Text style={styles.v45MoodBrand}>DETOUR</Text>
              <View style={styles.v45TimePill}>
                <Text style={styles.v45TimePillIcon}>◷</Text>
                <Text style={styles.v45TimePillText}>{selectedTime} 分</Text>
              </View>
            </View>

            <View style={styles.v45MoodTitleWrap}>
              <Text style={styles.v45MoodTitle}>今天想要哪種心情？</Text>
              <View style={styles.v45MoodUnderline} />
            </View>

            <View style={styles.v45MoodGrid}>
              {MOODS.map((item) => {
                const active = selectedMood === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => chooseMood(item.id)}
                    style={({ pressed }) => [
                      styles.v45MoodCard,
                      active && styles.v45MoodCardActive,
                      pressed && styles.v45MoodCardPressed,
                    ]}
                  >
                    <V45MoodIcon moodId={item.id} />
                    <Text style={styles.v45MoodLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={!selectedMood}
              onPress={continueFromMood}
              style={({ pressed }) => [
                styles.v45MoodCta,
                !selectedMood && styles.v45MoodCtaDisabled,
                pressed && selectedMood && styles.v45MoodCtaPressed,
              ]}
            >
              <View style={styles.v45TicketNotchLeft} />
              <View style={styles.v45TicketNotchRight} />
              <Text style={styles.v45MoodCtaText}>
                {selectedMood ? '出發吧！' : '選一個心情'}
              </Text>
              <View style={styles.v45MoodCtaDivider} />
              <Text style={styles.v45MoodCtaArrow}>→</Text>
            </Pressable>
            <V45Skyline />
          </View>
        )}

        '''
text = replace_between(
    text,
    "{stage === 'mood' && (",
    "{stage === 'preparing' && (",
    mood_block,
)


preparing_block = r'''{stage === 'preparing' && (
          <View style={styles.v45PrintingScreen}>
            <Text style={styles.v45PrintingBrand}>DETOUR</Text>
            <View style={styles.v45PrintingTitleWrap}>
              <Text style={styles.v45PrintingTitle}>
                {ticketBuildError ? '這張票卡住了。' : '正在印製車票…'}
              </Text>
              {!ticketBuildError && <View style={styles.v45PrintingUnderline} />}
            </View>

            <View style={styles.v45PrinterStage}>
              <View style={styles.v45PrinterMachine}>
                <Animated.View
                  style={[
                    styles.v45PrinterPulse,
                    {
                      opacity: printerPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.18, 0.55],
                      }),
                    },
                  ]}
                />
                <View style={styles.v45PrinterSlot} />
              </View>

              <View style={styles.v45PaperMask}>
                <Animated.View
                  style={[
                    styles.v45PaperMotion,
                    {
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-438, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <V45Ticket
                    timeLabel={selectedTime ?? '15'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                  />
                </Animated.View>
              </View>
            </View>

            {ticketBuildError && (
              <View style={styles.v45TicketErrorPanel}>
                <Text style={styles.v45TicketErrorText}>{ticketBuildError}</Text>
                <Pressable
                  onPress={() => {
                    routeProgress.setValue(0.04);
                    setTicketBuildError(null);
                    setTicketBuildStatus('再試一次…');
                    void prepareDetourTicket();
                  }}
                  style={({ pressed }) => [
                    styles.v45TicketRetry,
                    pressed && styles.v45MoodCardPressed,
                  ]}
                >
                  <Text style={styles.v45TicketRetryText}>再試一次</Text>
                  <Text style={styles.v45TicketRetryArrow}>→</Text>
                </Pressable>
              </View>
            )}
            <V45Skyline />
          </View>
        )}

        '''
text = replace_between(
    text,
    "{stage === 'preparing' && (",
    "{stage === 'ready' && (",
    preparing_block,
)

# Ready keeps the existing interaction but uses the same refined ticket artwork.
text = text.replace('<DetourTicket\n', '<V45Ticket\n')


finish_block = r'''{stage === 'finish' && (
          <View style={styles.v45FinishScreen}>
            <View style={styles.v45FinishHeader}>
              <Text style={styles.v45FinishBrand}>DETOUR</Text>
              <Pressable onPress={() => transitionTo('settings')} style={styles.v45FinishMenu}>
                <View style={styles.v45FinishMenuLine} />
                <View style={styles.v45FinishMenuLine} />
                <View style={styles.v45FinishMenuLine} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.v45FinishScroll}
            >
              <View style={styles.v45FinishTitleWrap}>
                <Text style={styles.v45FinishTitle}>旅程完成</Text>
                <View style={styles.v45FinishTitleUnderline} />
              </View>

              <View style={styles.v45PassportCard}>
                <View style={styles.v45PassportCardTop}>
                  <Text style={styles.v45PassportLogo}>DETOUR</Text>
                  <Text style={styles.v45PassportNumber}>
                    {formatPassportDate(lastCompletedEntry?.completedAt ?? new Date().toISOString())}
                  </Text>
                </View>

                {photos.length > 0 ? (
                  <>
                    <View style={styles.v45FinishHeroWrap}>
                      <Image source={{ uri: photos[0].uri }} style={styles.v45FinishHero} resizeMode="cover" />
                      <View style={styles.v45CompleteStamp}>
                        <Text style={styles.v45CompleteStampText}>旅程完成</Text>
                      </View>
                    </View>
                    <View style={styles.v45FinishThumbRow}>
                      {photos.slice(0, 3).map((photo) => (
                        <Image key={photo.id} source={{ uri: photo.uri }} style={styles.v45FinishThumb} resizeMode="cover" />
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.v45FinishNoPhoto}>
                    <View style={styles.v45FinishNoPhotoRoute} />
                    <Text style={styles.v45FinishNoPhotoText}>{selectedScene?.name ?? '這趟的終點'}</Text>
                  </View>
                )}

                <View style={styles.v45FinishInfoRow}>
                  <View style={styles.v45FinishDestination}>
                    <Text style={styles.v45FinishInfoLabel}>目的地</Text>
                    <Text style={styles.v45FinishDestinationText} numberOfLines={2}>
                      {selectedScene?.name ?? lastCompletedEntry?.city ?? 'DETOUR'}
                    </Text>
                  </View>
                  <View style={styles.v45FinishInfoDivider} />
                  <View style={styles.v45FinishFacts}>
                    <Text style={styles.v45FinishInfoLabel}>日期</Text>
                    <Text style={styles.v45FinishFact}>
                      {formatPassportDate(lastCompletedEntry?.completedAt ?? new Date().toISOString())}
                    </Text>
                    <Text style={[styles.v45FinishInfoLabel, { marginTop: 10 }]}>時長</Text>
                    <Text style={styles.v45FinishFact}>{lastCompletedEntry?.minutes ?? selectedMinutes} 分鐘</Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  if (lastCompletedEntry) openPassportEntry(lastCompletedEntry);
                  else transitionTo('passport');
                }}
                style={({ pressed }) => [
                  styles.v45FinishPrimary,
                  pressed && styles.v45MoodCtaPressed,
                ]}
              >
                <Text style={styles.v45FinishPrimaryArrow}>→</Text>
                <Text style={styles.v45FinishPrimaryText}>照片回顧</Text>
              </Pressable>
              <Pressable
                onPress={resetDetour}
                style={({ pressed }) => [
                  styles.v45FinishSecondary,
                  pressed && styles.v45MoodCardPressed,
                ]}
              >
                <Text style={styles.v45FinishSecondaryText}>回到首頁</Text>
              </Pressable>
            </ScrollView>
            <V45Skyline />
          </View>
        )}

        '''
text = replace_between(
    text,
    "{stage === 'finish' && (",
    "{stage === 'passport' && (",
    finish_block,
)


detail_block = r'''{stage === 'passportDetail' && selectedPassportEntry && (
          <View style={styles.v45DetailScreen}>
            <View style={styles.v45DetailTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v45BackButton}>
                <Text style={styles.v45BackText}>‹</Text>
              </Pressable>
              <View style={styles.v45DetailTitleWrap}>
                <Text style={styles.v45DetailTitle}>旅程回顧</Text>
                <View style={styles.v45DetailTitleUnderline} />
              </View>
              <View style={styles.v45DetailTopSpacer} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.v45DetailScroll}
            >
              <View style={styles.v45DetailTicketStrip}>
                <Text style={styles.v45DetailTicketBrand}>DETOUR</Text>
                <View style={styles.v45DetailTicketDivider} />
                <View style={styles.v45DetailTicketCell}>
                  <Text style={styles.v45DetailTicketLabel}>目的地</Text>
                  <Text style={styles.v45DetailTicketValue} numberOfLines={1}>
                    {selectedPassportEntry.sceneName ?? selectedPassportEntry.city}
                  </Text>
                </View>
                <View style={styles.v45DetailTicketDivider} />
                <View style={styles.v45DetailTicketCellSmall}>
                  <Text style={styles.v45DetailTicketLabel}>日期</Text>
                  <Text style={styles.v45DetailTicketValueSmall}>
                    {formatPassportDate(selectedPassportEntry.completedAt)}
                  </Text>
                </View>
                <View style={styles.v45DetailTicketDivider} />
                <View style={styles.v45DetailTicketCellSmall}>
                  <Text style={styles.v45DetailTicketLabel}>總時長</Text>
                  <Text style={styles.v45DetailTicketValueSmall}>
                    {selectedPassportEntry.actualDurationMinutes ?? selectedPassportEntry.minutes} 分鐘
                  </Text>
                </View>
              </View>

              {selectedPassportEntry.photos?.[
                Math.min(
                  passportPhotoIndex,
                  Math.max(0, (selectedPassportEntry.photos?.length ?? 1) - 1)
                )
              ]?.uri ? (
                <View style={styles.v45DetailHeroWrap}>
                  <Image
                    source={{
                      uri: selectedPassportEntry.photos![
                        Math.min(passportPhotoIndex, selectedPassportEntry.photos!.length - 1)
                      ].uri,
                    }}
                    style={styles.v45DetailHero}
                    resizeMode="cover"
                  />
                  <View style={styles.v45DetailPhotoCount}>
                    <Text style={styles.v45DetailPhotoCountText}>
                      {Math.min(passportPhotoIndex + 1, selectedPassportEntry.photos!.length)} / {selectedPassportEntry.photos!.length}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.v45DetailNoPhoto}>
                  <Text style={styles.v45DetailNoPhotoText}>這趟沒有留下照片</Text>
                </View>
              )}

              {selectedPassportEntry.photos && selectedPassportEntry.photos.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.v45DetailThumbRow}
                >
                  {selectedPassportEntry.photos.map((photo, index) => (
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
                  ))}
                </ScrollView>
              )}

              <View style={styles.v45RouteStrip}>
                <View style={styles.v45RouteEndpoint}>
                  <View style={styles.v45RouteCityIcon} />
                  <Text style={styles.v45RouteEndpointLabel}>出發</Text>
                  <Text style={styles.v45RouteEndpointValue} numberOfLines={1}>{selectedPassportEntry.city}</Text>
                </View>
                <View style={styles.v45RouteTrack}>
                  <View style={styles.v45RouteNode} />
                  <View style={styles.v45RouteDashLine} />
                  <View style={styles.v45RouteTree} />
                  <View style={styles.v45RouteDashLineB} />
                  <View style={styles.v45RouteNode} />
                </View>
                <View style={[styles.v45RouteEndpoint, styles.v45RouteEndpointRight]}>
                  <View style={styles.v45RouteFlag} />
                  <Text style={styles.v45RouteEndpointLabel}>抵達</Text>
                  <Text style={styles.v45RouteEndpointValue} numberOfLines={1}>
                    {selectedPassportEntry.sceneName ?? '這趟的終點'}
                  </Text>
                </View>
              </View>

              <View style={styles.v45NoteCard}>
                <Text style={styles.v45NoteTitle}>旅程筆記</Text>
                <Text style={styles.v45NoteBody}>
                  短短的 {selectedPassportEntry.actualDurationMinutes ?? selectedPassportEntry.minutes} 分鐘，走進熟悉又陌生的 {selectedPassportEntry.sceneName ?? selectedPassportEntry.city}。{`\n`}
                  留下 {selectedPassportEntry.photoCount ?? selectedPassportEntry.photos?.length ?? 0} 張照片，也把這次轉彎收進 DETOUR。
                </Text>
              </View>

              <Pressable
                onPress={() => shareJourney(selectedPassportEntry)}
                style={({ pressed }) => [
                  styles.v45ShareButton,
                  pressed && styles.v45MoodCtaPressed,
                ]}
              >
                <Text style={styles.v45ShareIcon}>↗</Text>
                <Text style={styles.v45ShareText}>分享這趟旅程</Text>
              </Pressable>
            </ScrollView>

            <View
              ref={shareTicketRef}
              collapsable={false}
              style={styles.v45SharePosterOffscreen}
            >
              <V45SharePoster
                entry={selectedPassportEntry}
                photoUri={
                  selectedPassportEntry.photos?.[
                    Math.min(passportPhotoIndex, Math.max(0, (selectedPassportEntry.photos?.length ?? 1) - 1))
                  ]?.uri
                }
              />
            </View>
          </View>
        )}'''
text = replace_between(
    text,
    "{stage === 'passportDetail' && selectedPassportEntry && (",
    "\n\n      </Animated.View>",
    detail_block,
)


styles = r'''

  // V45 refined paper / ticket visual system
  v45Skyline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    opacity: 0.3,
  },
  v45SkylineBuilding: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#B7B3A9',
  },
  v45SkylineBridgeDeck: {
    position: 'absolute',
    right: 8,
    bottom: 22,
    width: 122,
    height: 3,
    backgroundColor: '#8F8B82',
    transform: [{ rotate: '-2deg' }],
  },
  v45SkylineBridgeArch: {
    position: 'absolute',
    right: 24,
    bottom: 7,
    width: 92,
    height: 42,
    borderTopWidth: 3,
    borderColor: '#8F8B82',
    borderRadius: 50,
  },

  v45MoodScreen: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    paddingTop: 58,
    paddingHorizontal: 26,
    paddingBottom: 24,
  },
  v45MoodHeader: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v45BackButton: {
    width: 42,
    height: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  v45BackText: {
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '300',
    color: INK,
    marginTop: -6,
  },
  v45MoodBrand: {
    position: 'absolute',
    left: 56,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v45TimePill: {
    minWidth: 104,
    height: 54,
    paddingHorizontal: 17,
    borderRadius: 28,
    backgroundColor: INK,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v45TimePillIcon: {
    fontSize: 21,
    fontWeight: '800',
    color: SIGNAL,
  },
  v45TimePillText: {
    fontSize: 17,
    fontWeight: '800',
    color: BONE,
  },
  v45MoodTitleWrap: {
    marginTop: 35,
    marginBottom: 26,
    alignItems: 'center',
  },
  v45MoodTitle: {
    fontSize: 38,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: -1.6,
    color: INK,
    textAlign: 'center',
  },
  v45MoodUnderline: {
    width: 180,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    marginTop: 7,
    marginLeft: 94,
    transform: [{ rotate: '-3deg' }],
  },
  v45MoodGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 2,
  },
  v45MoodCard: {
    width: '48.2%',
    height: 140,
    borderWidth: 1,
    borderColor: '#D4CEC1',
    borderRadius: 16,
    backgroundColor: 'rgba(250,247,239,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v45MoodCardActive: {
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: '#FFF4EB',
  },
  v45MoodCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.985 }],
  },
  v45MoodLabel: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: INK,
  },
  v45MoodIconStage: {
    width: 112,
    height: 78,
    position: 'relative',
  },
  v45AccentDash: {
    position: 'absolute',
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: SIGNAL,
  },
  v45WalkerBackpack: {
    position: 'absolute', left: 34, top: 25, width: 22, height: 31,
    borderRadius: 7, backgroundColor: SIGNAL, transform: [{ rotate: '8deg' }],
  },
  v45WalkerHead: {
    position: 'absolute', left: 51, top: 3, width: 19, height: 19,
    borderRadius: 10, backgroundColor: INK,
  },
  v45WalkerBody: {
    position: 'absolute', left: 55, top: 21, width: 11, height: 37,
    borderRadius: 6, backgroundColor: INK, transform: [{ rotate: '-10deg' }],
  },
  v45WalkerLimb: {
    position: 'absolute', width: 9, height: 35,
    borderRadius: 5, backgroundColor: INK,
  },
  v45WalkerArm: { left: 70, top: 28, height: 30, transform: [{ rotate: '-55deg' }] },
  v45WalkerLegA: { left: 49, top: 48, height: 33, transform: [{ rotate: '32deg' }] },
  v45WalkerLegB: { left: 68, top: 46, height: 35, transform: [{ rotate: '-24deg' }] },
  v45DrinkCup: {
    position: 'absolute', left: 26, top: 24, width: 27, height: 42,
    borderRadius: 4, backgroundColor: INK,
  },
  v45DrinkLid: {
    position: 'absolute', left: 23, top: 20, width: 33, height: 6,
    borderRadius: 3, backgroundColor: INK,
  },
  v45DrinkStraw: {
    position: 'absolute', left: 43, top: 2, width: 5, height: 24,
    borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '10deg' }],
  },
  v45BurgerBun: {
    position: 'absolute', right: 18, top: 35, width: 43, height: 18,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: INK,
  },
  v45BurgerPatty: {
    position: 'absolute', right: 16, top: 54, width: 47, height: 8,
    borderRadius: 4, backgroundColor: SIGNAL,
  },
  v45BurgerBottom: {
    position: 'absolute', right: 18, top: 63, width: 43, height: 10,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: INK,
  },
  v45TreeCrownA: {
    position: 'absolute', left: 24, top: 15, width: 39, height: 47,
    borderRadius: 24, backgroundColor: INK,
  },
  v45TreeCrownB: {
    position: 'absolute', left: 39, top: 4, width: 34, height: 45,
    borderRadius: 22, backgroundColor: INK,
  },
  v45TreeTrunk: {
    position: 'absolute', left: 50, top: 46, width: 7, height: 29,
    backgroundColor: INK,
  },
  v45BenchSeat: {
    position: 'absolute', right: 15, top: 50, width: 49, height: 8,
    borderRadius: 2, backgroundColor: SIGNAL,
  },
  v45BenchBack: {
    position: 'absolute', right: 15, top: 39, width: 49, height: 7,
    borderRadius: 2, backgroundColor: SIGNAL,
  },
  v45BenchLeg: {
    position: 'absolute', top: 57, width: 5, height: 17, backgroundColor: INK,
  },
  v45CatBody: {
    position: 'absolute', left: 39, top: 35, width: 39, height: 38,
    borderRadius: 20, backgroundColor: INK,
  },
  v45CatHead: {
    position: 'absolute', left: 42, top: 18, width: 31, height: 31,
    borderRadius: 16, backgroundColor: INK,
  },
  v45CatEar: {
    position: 'absolute', top: 10, width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 16,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: INK,
  },
  v45CatEarLeft: { left: 42, transform: [{ rotate: '-18deg' }] },
  v45CatEarRight: { left: 60, transform: [{ rotate: '18deg' }] },
  v45CatTail: {
    position: 'absolute', left: 70, top: 42, width: 33, height: 33,
    borderWidth: 8, borderLeftColor: 'transparent', borderTopColor: 'transparent',
    borderRightColor: INK, borderBottomColor: INK, borderRadius: 20,
    transform: [{ rotate: '-24deg' }],
  },
  v45QuestionMark: {
    position: 'absolute', right: 9, top: -1, fontSize: 37, fontWeight: '900', color: SIGNAL,
  },
  v45CameraBody: {
    position: 'absolute', left: 26, top: 24, width: 68, height: 45,
    borderRadius: 9, backgroundColor: INK,
  },
  v45CameraTop: {
    position: 'absolute', left: 43, top: 16, width: 27, height: 14,
    borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: INK,
  },
  v45CameraLensOuter: {
    position: 'absolute', left: 48, top: 31, width: 30, height: 30,
    borderRadius: 15, backgroundColor: BONE, alignItems: 'center', justifyContent: 'center',
  },
  v45CameraLensInner: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: INK,
  },
  v45Die: {
    position: 'absolute', left: 34, top: 13, width: 55, height: 55,
    borderRadius: 10, backgroundColor: INK, transform: [{ rotate: '14deg' }],
  },
  v45DiePip: {
    position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: BONE,
  },
  v45MoodCta: {
    zIndex: 3,
    height: 68,
    marginTop: 12,
    marginBottom: 58,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    position: 'relative',
  },
  v45MoodCtaDisabled: { backgroundColor: '#E6B19E' },
  v45MoodCtaPressed: { opacity: 0.78, transform: [{ translateY: 2 }] },
  v45MoodCtaText: { fontSize: 28, fontWeight: '900', color: INK },
  v45MoodCtaArrow: { position: 'absolute', right: 22, fontSize: 34, color: INK },
  v45MoodCtaDivider: { position: 'absolute', right: 70, top: 10, bottom: 10, width: 1, backgroundColor: 'rgba(17,17,15,0.34)' },
  v45TicketNotchLeft: { position: 'absolute', left: -10, top: 25, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v45TicketNotchRight: { position: 'absolute', right: -10, top: 25, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },

  v45PrintingScreen: {
    flex: 1, backgroundColor: '#F5F1E8', paddingTop: 70, paddingHorizontal: 30, overflow: 'hidden',
  },
  v45PrintingBrand: {
    fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4, color: INK,
  },
  v45PrintingTitleWrap: { marginTop: 96, alignItems: 'center', zIndex: 4 },
  v45PrintingTitle: {
    fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -1.7, color: INK, textAlign: 'center',
  },
  v45PrintingUnderline: {
    width: 180, height: 7, borderRadius: 4, backgroundColor: SIGNAL, marginTop: 7,
    transform: [{ rotate: '-3deg' }],
  },
  v45PrinterStage: { marginTop: 38, alignItems: 'center', height: 500, zIndex: 2 },
  v45PrinterMachine: {
    width: '100%', height: 92, borderRadius: 18, backgroundColor: '#8E8981',
    paddingHorizontal: 20, justifyContent: 'center', zIndex: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  v45PrinterPulse: {
    ...StyleSheet.absoluteFillObject, borderRadius: 18, backgroundColor: '#C8B7A6',
  },
  v45PrinterSlot: {
    height: 23, borderRadius: 8, backgroundColor: '#11110F', borderWidth: 5, borderColor: '#55504A',
  },
  v45PaperMask: {
    position: 'absolute', top: 64, width: '92%', height: 438, overflow: 'hidden', alignItems: 'center', zIndex: 3,
  },
  v45PaperMotion: { width: '100%', alignItems: 'center' },
  v45TicketPaper: {
    width: '100%', height: 432, backgroundColor: '#FBF8EF', paddingHorizontal: 26, paddingTop: 45, paddingBottom: 22,
    borderRadius: 2, position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6,
  },
  v45TicketOrangeBand: { position: 'absolute', left: 0, right: 0, top: 0, height: 28, backgroundColor: SIGNAL },
  v45TicketBrand: { fontSize: 30, fontWeight: '900', letterSpacing: -1.3, color: INK },
  v45TicketRule: { height: 1, backgroundColor: '#C9C2B5', marginVertical: 16, borderStyle: 'dashed' },
  v45TicketInfoRow: { minHeight: 116, flexDirection: 'row', alignItems: 'stretch' },
  v45TicketInfoBlock: { flex: 1, justifyContent: 'center' },
  v45TicketVerticalRule: { width: 1, marginHorizontal: 16, backgroundColor: '#D1CABC' },
  v45TicketLabel: { fontSize: 16, fontWeight: '800', color: INK },
  v45TicketMinutesRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 5 },
  v45TicketMinutes: { fontSize: 68, lineHeight: 72, fontWeight: '900', color: SIGNAL, letterSpacing: -3 },
  v45TicketMinutesUnit: { fontSize: 18, lineHeight: 28, fontWeight: '900', color: INK, marginLeft: 6, marginBottom: 7 },
  v45TicketMood: { marginTop: 18, fontSize: 25, lineHeight: 30, fontWeight: '900', color: INK },
  v45TicketMoodUnderline: { width: 93, height: 5, borderRadius: 3, backgroundColor: SIGNAL, marginTop: 5, transform: [{ rotate: '-4deg' }] },
  v45TicketDestinationRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45TicketUnknown: { marginTop: 6, fontSize: 27, fontWeight: '900', color: INK },
  v45TicketRouteMini: { width: 130, height: 60, position: 'relative' },
  v45TicketRouteDot: { position: 'absolute', left: 4, top: 28, width: 12, height: 12, borderRadius: 6, backgroundColor: SIGNAL },
  v45TicketRouteDashA: { position: 'absolute', left: 18, top: 31, width: 48, height: 3, backgroundColor: SIGNAL, transform: [{ rotate: '21deg' }] },
  v45TicketRouteDashB: { position: 'absolute', left: 61, top: 30, width: 44, height: 3, backgroundColor: SIGNAL, transform: [{ rotate: '-18deg' }] },
  v45TicketRouteFlagPole: { position: 'absolute', right: 11, top: 14, width: 4, height: 34, backgroundColor: INK },
  v45TicketRouteFlag: { position: 'absolute', right: -2, top: 12, width: 22, height: 14, backgroundColor: SIGNAL, transform: [{ rotate: '5deg' }] },
  v45BarcodeRow: { height: 44, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: 3 },
  v45BarcodeBar: { height: 44, backgroundColor: '#5F5B55' },
  v45TicketStamp: { position: 'absolute', right: 25, top: 50, width: 90, height: 44, borderWidth: 3, borderColor: SIGNAL, borderRadius: 7, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  v45TicketStampText: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v45TicketErrorPanel: { zIndex: 7, marginTop: -15, padding: 18, borderWidth: 1, borderColor: SIGNAL, backgroundColor: '#FFF7F1' },
  v45TicketErrorText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: INK },
  v45TicketRetry: { marginTop: 16, height: 54, backgroundColor: INK, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45TicketRetryText: { fontSize: 18, fontWeight: '800', color: BONE },
  v45TicketRetryArrow: { fontSize: 25, color: SIGNAL },

  v45FinishScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, overflow: 'hidden' },
  v45FinishHeader: { height: 58, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  v45FinishBrand: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v45FinishMenu: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E9E3D8', alignItems: 'center', justifyContent: 'center', gap: 4 },
  v45FinishMenuLine: { width: 21, height: 3, borderRadius: 2, backgroundColor: INK },
  v45FinishScroll: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 110 },
  v45FinishTitleWrap: { alignItems: 'center', marginBottom: 22 },
  v45FinishTitle: { fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v45FinishTitleUnderline: { width: 76, height: 6, borderRadius: 3, backgroundColor: SIGNAL, marginTop: 3, marginLeft: 120, transform: [{ rotate: '-4deg' }] },
  v45PassportCard: { backgroundColor: '#FBF8EF', padding: 18, borderRadius: 13, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 },
  v45PassportCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  v45PassportLogo: { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: INK },
  v45PassportNumber: { fontSize: 13, fontWeight: '700', color: MUTED },
  v45FinishHeroWrap: { position: 'relative' },
  v45FinishHero: { width: '100%', height: 248, borderRadius: 13, backgroundColor: SOFT },
  v45CompleteStamp: { position: 'absolute', right: -3, top: -10, width: 104, height: 104, borderRadius: 52, borderWidth: 5, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }], backgroundColor: 'rgba(245,241,232,0.7)' },
  v45CompleteStampText: { width: 70, textAlign: 'center', fontSize: 17, lineHeight: 21, fontWeight: '900', color: SIGNAL },
  v45FinishThumbRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  v45FinishThumb: { flex: 1, height: 78, borderRadius: 10, backgroundColor: SOFT },
  v45FinishNoPhoto: { height: 246, borderRadius: 13, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center' },
  v45FinishNoPhotoRoute: { width: '62%', height: 6, borderRadius: 3, backgroundColor: SIGNAL, transform: [{ rotate: '-7deg' }] },
  v45FinishNoPhotoText: { marginTop: 25, fontSize: 24, fontWeight: '900', color: INK },
  v45FinishInfoRow: { flexDirection: 'row', marginTop: 17, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#D2CBBD' },
  v45FinishDestination: { flex: 1.1, paddingRight: 14 },
  v45FinishFacts: { flex: 0.9, paddingLeft: 16 },
  v45FinishInfoDivider: { width: 1, backgroundColor: '#D2CBBD' },
  v45FinishInfoLabel: { fontSize: 15, fontWeight: '800', color: MUTED },
  v45FinishDestinationText: { marginTop: 5, fontSize: 29, lineHeight: 34, fontWeight: '900', color: INK },
  v45FinishFact: { marginTop: 3, fontSize: 18, lineHeight: 22, fontWeight: '900', color: INK },
  v45FinishPrimary: { height: 66, marginTop: 22, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 3 },
  v45FinishPrimaryArrow: { fontSize: 30, color: INK },
  v45FinishPrimaryText: { fontSize: 24, fontWeight: '900', color: INK },
  v45FinishSecondary: { height: 52, marginTop: 9, borderWidth: 1, borderColor: '#CBC5B9', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,247,239,0.9)' },
  v45FinishSecondaryText: { fontSize: 18, fontWeight: '800', color: INK },

  v45DetailScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, overflow: 'hidden' },
  v45DetailTop: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45DetailTitleWrap: { flex: 1, alignItems: 'center' },
  v45DetailTitle: { fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v45DetailTitleUnderline: { width: 86, height: 5, borderRadius: 3, backgroundColor: SIGNAL, marginTop: 2, marginLeft: 72, transform: [{ rotate: '-4deg' }] },
  v45DetailTopSpacer: { width: 42 },
  v45DetailScroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 70 },
  v45DetailTicketStrip: { minHeight: 92, borderWidth: 1, borderColor: '#D0CABD', borderRadius: 10, backgroundColor: '#FBF8EF', flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 13, paddingVertical: 12 },
  v45DetailTicketBrand: { width: 82, alignSelf: 'center', fontSize: 20, fontWeight: '900', letterSpacing: -1, color: INK },
  v45DetailTicketDivider: { width: 1, backgroundColor: '#D0CABD', marginHorizontal: 10 },
  v45DetailTicketCell: { flex: 1.1, justifyContent: 'center' },
  v45DetailTicketCellSmall: { flex: 0.9, justifyContent: 'center' },
  v45DetailTicketLabel: { fontSize: 12, fontWeight: '800', color: MUTED },
  v45DetailTicketValue: { marginTop: 4, fontSize: 18, lineHeight: 22, fontWeight: '900', color: INK },
  v45DetailTicketValueSmall: { marginTop: 4, fontSize: 14, lineHeight: 18, fontWeight: '900', color: INK },
  v45DetailHeroWrap: { marginTop: 18, height: 382, borderRadius: 19, overflow: 'hidden', position: 'relative' },
  v45DetailHero: { width: '100%', height: '100%', backgroundColor: SOFT },
  v45DetailPhotoCount: { position: 'absolute', right: 15, bottom: 14, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(17,17,15,0.72)', alignItems: 'center', justifyContent: 'center' },
  v45DetailPhotoCountText: { fontSize: 15, fontWeight: '800', color: BONE },
  v45DetailNoPhoto: { marginTop: 18, height: 300, borderRadius: 19, backgroundColor: '#E9E4D9', alignItems: 'center', justifyContent: 'center' },
  v45DetailNoPhotoText: { fontSize: 22, fontWeight: '800', color: MUTED },
  v45DetailThumbRow: { gap: 9, paddingTop: 10, paddingRight: 20 },
  v45DetailThumb: { width: 65, height: 65, borderRadius: 10, backgroundColor: SOFT, borderWidth: 2, borderColor: 'transparent' },
  v45DetailThumbActive: { borderColor: SIGNAL },
  v45RouteStrip: { marginTop: 24, minHeight: 96, flexDirection: 'row', alignItems: 'center' },
  v45RouteEndpoint: { width: 82, alignItems: 'flex-start' },
  v45RouteEndpointRight: { alignItems: 'flex-end' },
  v45RouteCityIcon: { width: 25, height: 34, backgroundColor: INK, marginBottom: 4 },
  v45RouteFlag: { width: 28, height: 18, backgroundColor: SIGNAL, marginBottom: 8, transform: [{ rotate: '4deg' }] },
  v45RouteEndpointLabel: { fontSize: 12, fontWeight: '700', color: MUTED },
  v45RouteEndpointValue: { marginTop: 2, maxWidth: 90, fontSize: 16, fontWeight: '900', color: INK },
  v45RouteTrack: { flex: 1, height: 64, position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  v45RouteNode: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: SIGNAL, backgroundColor: '#F5F1E8', zIndex: 2 },
  v45RouteDashLine: { width: 48, height: 2, marginHorizontal: 2, backgroundColor: SIGNAL, transform: [{ rotate: '12deg' }] },
  v45RouteDashLineB: { width: 48, height: 2, marginHorizontal: 2, backgroundColor: SIGNAL, transform: [{ rotate: '-12deg' }] },
  v45RouteTree: { width: 18, height: 30, borderRadius: 10, backgroundColor: INK, marginHorizontal: 2 },
  v45NoteCard: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 18, borderWidth: 1, borderColor: '#D0CABD', backgroundColor: '#FBF8EF' },
  v45NoteTitle: { fontSize: 20, fontWeight: '900', color: INK },
  v45NoteBody: { marginTop: 10, fontSize: 17, lineHeight: 27, fontWeight: '600', color: '#4F4B44' },
  v45ShareButton: { height: 68, marginTop: 22, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  v45ShareIcon: { fontSize: 28, color: BONE },
  v45ShareText: { fontSize: 22, fontWeight: '900', color: BONE },
  v45SharePosterOffscreen: { position: 'absolute', left: -5000, top: 0, width: 360, height: 640, backgroundColor: '#F5F1E8' },
  v45Poster: { width: 360, height: 640, backgroundColor: '#F5F1E8', padding: 22 },
  v45PosterTop: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45PosterBrand: { fontSize: 26, fontWeight: '900', letterSpacing: -1.2, color: INK },
  v45PosterDate: { fontSize: 13, fontWeight: '800', color: MUTED },
  v45PosterPhoto: { width: '100%', height: 356, borderRadius: 18, backgroundColor: SOFT },
  v45PosterNoPhoto: { alignItems: 'center', justifyContent: 'center' },
  v45PosterNoPhotoText: { fontSize: 20, fontWeight: '800', color: MUTED },
  v45PosterCopy: { paddingTop: 18 },
  v45PosterMood: { fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.3, color: INK },
  v45PosterDestination: { marginTop: 3, fontSize: 20, lineHeight: 25, fontWeight: '800', color: INK },
  v45PosterOrangeRule: { width: 94, height: 5, borderRadius: 3, marginTop: 10, backgroundColor: SIGNAL, transform: [{ rotate: '-3deg' }] },
  v45PosterFacts: { marginTop: 13, flexDirection: 'row', gap: 18 },
  v45PosterFact: { fontSize: 14, fontWeight: '800', color: MUTED },
  v45PosterRoute: { marginTop: 15, height: 34, flexDirection: 'row', alignItems: 'center' },
  v45PosterRouteStart: { width: 12, height: 12, borderRadius: 6, backgroundColor: SIGNAL },
  v45PosterRouteLineA: { width: 88, height: 3, backgroundColor: INK, transform: [{ rotate: '-7deg' }] },
  v45PosterRouteTurn: { width: 20, height: 20, borderTopWidth: 4, borderRightWidth: 4, borderColor: INK, transform: [{ rotate: '25deg' }] },
  v45PosterRouteLineB: { flex: 1, height: 3, backgroundColor: INK, transform: [{ rotate: '5deg' }] },
  v45PosterRouteEnd: { width: 15, height: 15, backgroundColor: SIGNAL },
'''

style_end = text.rfind('\n});')
if style_end < 0:
    raise RuntimeError('StyleSheet closing marker missing')
text = text[:style_end] + styles + text[style_end:]

PATH.write_text(text, encoding='utf-8')
print('Applied DETOUR V45 visual refinement to src/app/index.tsx')
