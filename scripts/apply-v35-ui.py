from pathlib import Path

ROOT = Path('.')


def rep(text: str, old: str, new: str, label: str, required: bool = True) -> str:
    count = text.count(old)
    if count == 0 and not required:
        print(f'[skip] {label}')
        return text
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


def between(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'{label}: start marker missing')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'{label}: end marker missing')
    return text[:start] + replacement + text[end:]


# ------------------------------------------------------------
# Main UI
# ------------------------------------------------------------
p = ROOT / 'src/app/index.tsx'
s = p.read_text(encoding='utf-8')

# Slider support.
s = rep(
    s,
    "  Modal,\n  Pressable,",
    "  Modal,\n  PanResponder,\n  Pressable,",
    'PanResponder import',
)

s = rep(
    s,
    "const TIMES = ['15', '30', '60', '90+'];",
    """const TIME_MIN = 5;\nconst TIME_MAX = 60;\nconst TIME_STEP = 5;\nconst TIME_STEPS = Array.from(\n  { length: (TIME_MAX - TIME_MIN) / TIME_STEP + 1 },\n  (_, index) => TIME_MIN + index * TIME_STEP\n);""",
    'time constants',
)

s = rep(
    s,
    """const MOODS: Array<{ id: MoodId; label: string; code: string }> = [\n  { id: 'wander', label: '隨便走走', code: 'WANDER' },\n  { id: 'food', label: '吃點東西', code: 'FOOD' },\n  { id: 'quiet', label: '想安靜一下', code: 'QUIET' },\n  { id: 'weird', label: '奇怪一點', code: 'WEIRD' },\n  { id: 'surprise', label: '隨機帶我走', code: 'SURPRISE' },\n];""",
    """const MOODS: Array<{ id: MoodId; label: string; code: string }> = [\n  { id: 'wander', label: '隨便走走', code: 'WANDER' },\n  { id: 'food', label: '吃點東西', code: 'FOOD' },\n  { id: 'quiet', label: '放鬆一下', code: 'QUIET' },\n  { id: 'weird', label: '探索新鮮', code: 'WEIRD' },\n  { id: 'photo', label: '拍照走走', code: 'PHOTO' },\n  { id: 'surprise', label: '交給驚喜', code: 'SURPRISE' },\n];""",
    'mood list',
)

s = rep(
    s,
    """function moodSymbol(moodId: MoodId) {\n  if (moodId === 'wander') return '↝';\n  if (moodId === 'food') return '◍';\n  if (moodId === 'quiet') return '○';\n  if (moodId === 'weird') return '✦';\n  return '◇';\n}""",
    """function moodSymbol(moodId: MoodId) {\n  if (moodId === 'wander') return '↗';\n  if (moodId === 'food') return '●';\n  if (moodId === 'quiet') return '⌒';\n  if (moodId === 'weird') return '?';\n  if (moodId === 'photo') return '◎';\n  return '◆';\n}""",
    'mood symbols',
)

s = rep(
    s,
    """  if (moodId === 'weird') {\n    return '挑一條平常不會選的路。';\n  }\n\n  return '完全交給 DETOUR。';""",
    """  if (moodId === 'weird') {\n    return '去找平常會錯過的小東西。';\n  }\n\n  if (moodId === 'photo') {\n    return '一路保留值得拍下來的畫面。';\n  }\n\n  return '今天的方向完全交給 DETOUR。';""",
    'mood hint',
)

s = rep(
    s,
    "  const [selectedTime, setSelectedTime] = useState<string | null>(null);",
    """  const [selectedTime, setSelectedTime] = useState<string | null>('15');\n  const [timeSliderWidth, setTimeSliderWidth] = useState(1);""",
    'time state',
)

s = rep(
    s,
    """  const [selectedPassportId, setSelectedPassportId] =\n    useState<string | null>(null);""",
    """  const [selectedPassportId, setSelectedPassportId] =\n    useState<string | null>(null);\n  const [passportPhotoIndex, setPassportPhotoIndex] = useState(0);""",
    'passport photo state',
)

anchor = """  const selectedMinutes = parseMinutes(selectedTime);\n  const rollCapacity = getFilmRollCapacity(selectedMinutes || 15);\n  const previewProfile = getJourneyProfile(selectedMinutes || 15);\n"""
insert = anchor + """\n  const timeProgress =\n    (Math.max(TIME_MIN, selectedMinutes || 15) - TIME_MIN) /\n    (TIME_MAX - TIME_MIN);\n\n  const timeSliderResponder = useMemo(\n    () =>\n      PanResponder.create({\n        onStartShouldSetPanResponder: () => true,\n        onMoveShouldSetPanResponder: () => true,\n        onPanResponderGrant: (event) => {\n          const x = event.nativeEvent.locationX;\n          const ratio = Math.max(0, Math.min(1, x / timeSliderWidth));\n          const nextMinutes =\n            TIME_MIN +\n            Math.round((ratio * (TIME_MAX - TIME_MIN)) / TIME_STEP) * TIME_STEP;\n          const value = String(nextMinutes);\n          if (value !== selectedTime) {\n            setSelectedTime(value);\n            void Haptics.selectionAsync();\n          }\n        },\n        onPanResponderMove: (event) => {\n          const x = event.nativeEvent.locationX;\n          const ratio = Math.max(0, Math.min(1, x / timeSliderWidth));\n          const nextMinutes =\n            TIME_MIN +\n            Math.round((ratio * (TIME_MAX - TIME_MIN)) / TIME_STEP) * TIME_STEP;\n          const value = String(nextMinutes);\n          if (value !== selectedTime) {\n            setSelectedTime(value);\n            void Haptics.selectionAsync();\n          }\n        },\n      }),\n    [timeSliderWidth, selectedTime]\n  );\n"""
s = rep(s, anchor, insert, 'time responder')

s = rep(
    s,
    """  const darkStage =\n    stage === 'camera' ||\n    stage === 'developing';""",
    """  const darkStage =\n    stage === 'camera' ||\n    stage === 'developing' ||\n    stage === 'journey';""",
    'dark journey',
)

# Keep 15 minutes selected when returning home.
s = s.replace("    setSelectedTime(null);", "    setSelectedTime('15');", 1)

s = rep(
    s,
    """  function openPassportEntry(entry: PassportEntry) {\n    setSelectedPassportId(entry.id);\n    transitionTo('passportDetail');\n  }""",
    """  function openPassportEntry(entry: PassportEntry) {\n    setSelectedPassportId(entry.id);\n    setPassportPhotoIndex(0);\n    transitionTo('passportDetail');\n  }\n\n  async function shareJourney(entry: PassportEntry) {\n    const message = [\n      `DETOUR · ${entry.city}`,\n      `${formatPassportDate(entry.completedAt)} · ${entry.minutes} 分鐘`,\n      entry.sceneName ? `終點：${entry.sceneName}` : null,\n      `${entry.photoCount ?? 0} 張照片 · ${entry.discoveries} 個任務`,\n    ]\n      .filter(Boolean)\n      .join('\\n');\n\n    const firstPhoto = entry.photos?.[0]?.uri;\n\n    await Share.share({\n      title: '分享這趟 DETOUR',\n      message,\n      ...(firstPhoto ? { url: firstPhoto } : {}),\n    });\n  }""",
    'passport open/share',
)

home = r"""        {stage === 'time' && (
          <View style={styles.v35HomeScreen}>
            <View style={styles.v35TopBar}>
              <View>
                <Text style={styles.v35Brand}>DETOUR</Text>
                <View style={styles.v35BrandSlash} />
              </View>
              <Pressable
                onPress={() => transitionTo('settings')}
                accessibilityLabel="打開設定"
                style={({ pressed }) => [styles.v35MenuButton, pressed && styles.v35Pressed]}
              >
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLineShort} />
              </Pressable>
            </View>
            <View style={styles.v35RouteSketch}>
              <View style={[styles.v35CityBlock, { left: '4%', height: 46 }]} />
              <View style={[styles.v35CityBlock, { left: '10%', height: 29, width: 18 }]} />
              <View style={[styles.v35RouteDash, { left: '9%', top: 74, width: 90, transform: [{ rotate: '-22deg' }] }]} />
              <View style={[styles.v35RouteDash, { left: '28%', top: 93, width: 110, transform: [{ rotate: '16deg' }] }]} />
              <View style={[styles.v35RouteDash, { left: '53%', top: 68, width: 105, transform: [{ rotate: '-34deg' }] }]} />
              <View style={[styles.v35RouteDash, { right: '6%', top: 91, width: 95, transform: [{ rotate: '22deg' }] }]} />
              <View style={[styles.v35MapPin, { left: '7%', top: 72 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={[styles.v35MapPin, { left: '38%', top: 103 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={[styles.v35MapPin, { left: '58%', top: 34 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={[styles.v35MapPin, { right: '7%', top: 91 }]}><View style={styles.v35MapPinCore} /></View>
              <View style={styles.v35SketchBench}><View style={styles.v35BenchSeat} /><View style={styles.v35BenchLeg} /><View style={[styles.v35BenchLeg, styles.v35BenchLegRight]} /></View>
              <View style={styles.v35SketchFlag}><View style={styles.v35FlagPole} /><View style={styles.v35FlagCloth} /></View>
            </View>
            <Text style={styles.v35HomeQuestion}>今天有多少時間，{`\n`}可以拿來偏離一下？</Text>
            <View style={styles.v35Underline} />
            <View style={styles.v35MinuteReadout}>
              <Text style={styles.v35MinuteNumber}>{selectedMinutes || 15}</Text>
              <Text style={styles.v35MinuteUnit}>MIN</Text>
            </View>
            <View
              style={styles.v35SliderWrap}
              onLayout={(event) => setTimeSliderWidth(Math.max(1, event.nativeEvent.layout.width))}
              {...timeSliderResponder.panHandlers}
            >
              <View style={styles.v35SliderRail} />
              <View style={[styles.v35SliderFill, { width: `${timeProgress * 100}%` }]} />
              {TIME_STEPS.map((minute) => {
                const progress = (minute - TIME_MIN) / (TIME_MAX - TIME_MIN);
                const showLabel = [5, 15, 30, 45, 60].includes(minute);
                return (
                  <View key={minute} pointerEvents="none" style={[styles.v35TickWrap, { left: `${progress * 100}%` }]}>
                    <View style={[styles.v35Tick, minute <= (selectedMinutes || 15) && styles.v35TickActive]} />
                    {showLabel && <Text style={styles.v35TickLabel}>{minute}</Text>}
                  </View>
                );
              })}
              <View style={[styles.v35SliderThumb, { left: `${timeProgress * 100}%` }]}><View style={styles.v35SliderThumbCore} /></View>
            </View>
            <Pressable onPress={continueFromTime} style={({ pressed }) => [styles.v35TicketButton, pressed && styles.v35TicketButtonPressed]}>
              <View style={styles.v35TicketNotchLeft} />
              <View style={styles.v35TicketNotchRight} />
              <Text style={styles.v35TicketArrow}>→</Text>
              <Text style={styles.v35TicketText}>開始 {selectedMinutes || 15} 分鐘的旅程</Text>
              <View style={styles.v35TicketDivider} />
              <Text style={styles.v35TicketMark}>▰</Text>
            </Pressable>
            <Pressable onPress={() => transitionTo('passport')} style={({ pressed }) => [styles.v35CompletedButton, pressed && styles.v35Pressed]}>
              <Text style={styles.v35CompletedText}>已完成的旅程</Text>
              <View style={styles.v35CompletedCount}><Text style={styles.v35CompletedCountText}>{passport.length}</Text></View>
              <Text style={styles.v35CompletedArrow}>→</Text>
            </Pressable>
          </View>
        )}
"""
s = between(s, "        {stage === 'time' && (", "\n        {stage === 'mood' && (", home, 'home stage')

mood_block = r"""        {stage === 'mood' && (
          <View style={styles.v35MoodScreen}>
            <View style={styles.v35MoodTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v35BackButton}><Text style={styles.v35BackArrow}>‹</Text></Pressable>
              <Text style={styles.v35MoodBrand}>DETOUR</Text>
              <View style={styles.v35TimePill}><Text style={styles.v35TimePillIcon}>◷</Text><Text style={styles.v35TimePillText}>{selectedTime} MIN</Text></View>
            </View>
            <Text style={styles.v35MoodTitle}>今天想要哪種心情？</Text>
            <View style={styles.v35UnderlineMood} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v35MoodScroll}>
              <View style={styles.v35MoodGrid}>
                {MOODS.map((item) => {
                  const active = selectedMood === item.id;
                  return (
                    <Pressable key={item.id} onPress={() => chooseMood(item.id)} style={({ pressed }) => [styles.v35MoodCard, active && styles.v35MoodCardActive, pressed && styles.v35Pressed]}>
                      <View style={styles.v35MoodArt}>
                        <Text style={[styles.v35MoodSymbol, active && styles.v35MoodSymbolActive]}>{moodSymbol(item.id)}</Text>
                        <View style={[styles.v35MoodAccent, active && styles.v35MoodAccentActive]} />
                      </View>
                      <Text style={styles.v35MoodCardLabel}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable disabled={!selectedMood} onPress={continueFromMood} style={({ pressed }) => [styles.v35MoodPrimary, !selectedMood && styles.v35MoodPrimaryDisabled, pressed && selectedMood && styles.v35TicketButtonPressed]}>
              <View style={styles.v35TicketNotchLeft} /><View style={styles.v35TicketNotchRight} />
              <Text style={styles.v35MoodPrimaryText}>{selectedMood ? '出發吧！' : '先選一種心情'}</Text>
              <View style={styles.v35MoodPrimaryDivider} /><Text style={styles.v35MoodPrimaryArrow}>→</Text>
            </Pressable>
          </View>
        )}
"""
s = between(s, "        {stage === 'mood' && (", "\n        {stage === 'color' && (", mood_block, 'mood stage')

preparing = r"""        {stage === 'preparing' && (
          <View style={styles.v35PreparingScreen}>
            <Text style={styles.v35PreparingBrand}>DETOUR</Text>
            <Text style={styles.v35PreparingTitle}>正在印製車票…</Text><View style={styles.v35PreparingUnderline} />
            <View style={styles.v35Printer}>
              <View style={styles.v35PrinterTop} /><View style={styles.v35PrinterSlot} />
              <Animated.View style={[styles.v35PrintingTicket, { transform: [{ translateY: routeProgress.interpolate({ inputRange: [0, 1], outputRange: [-95, 12] }) }] }]}>
                <View style={styles.v35PrintOrangeBand} /><Text style={styles.v35PrintBrand}>DETOUR</Text><View style={styles.v35PrintDash} />
                <View style={styles.v35PrintFacts}>
                  <View><Text style={styles.v35PrintLabel}>旅程時間</Text><Text style={styles.v35PrintMinute}>{selectedTime}<Text style={styles.v35PrintMinuteUnit}> 分鐘</Text></Text></View>
                  <View style={styles.v35PrintDivider} />
                  <View style={styles.v35PrintMoodBlock}><Text style={styles.v35PrintLabel}>此趟心情</Text><Text style={styles.v35PrintMood}>{mood?.label ?? '—'}</Text></View>
                </View>
                <View style={styles.v35PrintDash} /><Text style={styles.v35PrintDestination}>目的地　● ???</Text>
                <View style={styles.v35PrintBarcode}>{[2,1,3,1,2,4,1,3,2,1,4,2,1,3,2,1,4,1].map((w,i)=>(<View key={i} style={[styles.v35PrintBar,{width:w}]} />))}</View>
              </Animated.View>
            </View>
            <Text style={styles.v35PreparingStatus}>{ticketBuildStatus}</Text>
          </View>
        )}
"""
s = between(s, "        {stage === 'preparing' && (", "\n        {stage === 'ready' && (", preparing, 'preparing stage')

journey = r"""        {stage === 'journey' &&
          plan &&
          navigationRoute &&
          currentNavigationBeat && (
            <View style={styles.v35JourneyScreen}>
              <View style={styles.v35JourneyTop}>
                <Pressable onPress={goBack} hitSlop={16} style={styles.v35JourneyBack}><Text style={styles.v35JourneyBackText}>←</Text></Pressable>
                <Text style={styles.v35JourneyBrand}>DETOUR</Text>
                <View style={styles.v35JourneyProgress}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const progress = navigationRoute.beats.length <= 1 ? 0 : navigationBeatIndex / (navigationRoute.beats.length - 1);
                    const current = Math.min(4, Math.round(progress * 4));
                    return (<View key={index} style={styles.v35JourneyProgressItem}><View style={[styles.v35JourneyProgressDot, index < current && styles.v35JourneyProgressDone, index === current && styles.v35JourneyProgressCurrent]} />{index < 4 && <View style={[styles.v35JourneyProgressLine, index < current && styles.v35JourneyProgressLineDone]} />}</View>);
                  })}<Text style={styles.v35JourneyFlag}>⚑</Text>
                </View>
              </View>
              {showNextBeatMap && latitude !== null && longitude !== null ? (
                <View style={styles.v35JourneyMapWrap}>
                  <MapView style={styles.v35JourneyMap} initialRegion={{ latitude: (latitude + currentNavigationBeat.point.latitude) / 2, longitude: (longitude + currentNavigationBeat.point.longitude) / 2, latitudeDelta: 0.0022, longitudeDelta: 0.0022 }} showsUserLocation showsMyLocationButton={false} showsCompass={false} pitchEnabled={false} rotateEnabled={false}>
                    <Polyline coordinates={nextBeatSegment} strokeColor={SIGNAL} strokeWidth={5} lineCap="round" /><Circle center={currentNavigationBeat.point} radius={10} strokeColor={BONE} strokeWidth={1} fillColor={SIGNAL} />
                  </MapView>
                  <Pressable onPress={() => setShowNextBeatMap(false)} style={styles.v35JourneyMapClose}><Text style={styles.v35JourneyMapCloseText}>×</Text></Pressable>
                </View>
              ) : (
                <View style={styles.v35JourneyHero}>
                  <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35Compass, pressed && styles.v35JourneyPressed]}><View style={styles.v35CompassTicks} /><View style={{ transform: [{ rotate: `${arrowRotation}deg` }] }}><Text style={styles.v35CompassArrow}>↑</Text></View></Pressable>
                  <Text style={styles.v35JourneyDistance}>{Math.round(nextBeatMeters)}<Text style={styles.v35JourneyDistanceUnit}> m</Text></Text>
                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>
                  {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}
                </View>
              )}
              {questPulse && <View pointerEvents="none" style={styles.v35QuestPulse}><Text style={styles.v35QuestPulseText}>{questPulse === 'side' ? '路上任務出現' : '抵達終點'}</Text></View>}
              <View style={styles.v35JourneyBottom}>
                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>
                <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>→</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>繼續前進</Text></Pressable>
                {devMode && <Pressable onPress={simulateWalk} style={styles.v35DevAdvance}><Text style={styles.v35DevAdvanceText}>室內測試 · 模擬前進</Text></Pressable>}
              </View>
            </View>
          )}

"""
s = between(s, "        {stage === 'journey' &&", "        {stage === 'mission' &&", journey, 'journey stage')

finish = r"""        {stage === 'finish' && (
          <View style={styles.v35FinishScreen}>
            <View style={styles.v35FinishTop}><Text style={styles.v35FinishBrand}>DETOUR</Text><Pressable onPress={() => transitionTo('settings')} style={styles.v35FinishMenu}><View style={styles.v35MenuLine} /><View style={styles.v35MenuLine} /><View style={styles.v35MenuLineShort} /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v35FinishScroll}>
              <Text style={styles.v35FinishTitle}>旅程完成</Text>
              <View style={styles.v35Postcard}>
                <View style={styles.v35PostcardTop}><Text style={styles.v35PostcardBrand}>DETOUR</Text><View style={styles.v35FinishStamp}><Text style={styles.v35FinishStampText}>旅程完成</Text><Text style={styles.v35FinishStampPlane}>✦</Text></View></View>
                {photos.length > 0 ? (<><Image source={{ uri: photos[0].uri }} style={styles.v35PostcardHeroPhoto} resizeMode="cover" /><View style={styles.v35PostcardThumbRow}>{photos.slice(0, 3).map((photo) => (<Image key={photo.id} source={{ uri: photo.uri }} style={styles.v35PostcardThumb} resizeMode="cover" />))}</View></>) : (<View style={styles.v35PostcardNoPhoto}><View style={styles.v35PostcardRouteLine} /><View style={styles.v35PostcardRoutePin} /><Text style={styles.v35PostcardNoPhotoText}>{selectedScene?.name ?? '這趟的終點'}</Text></View>)}
                <View style={styles.v35PostcardMetaRow}><View style={styles.v35PostcardPlace}><Text style={styles.v35PostcardPlaceIcon}>●</Text><Text style={styles.v35PostcardPlaceText}>{selectedScene?.name ?? lastCompletedEntry?.city ?? 'DETOUR'}</Text></View><View style={styles.v35PostcardMetaDivider} /><View style={styles.v35PostcardFacts}><Text style={styles.v35PostcardFact}>{formatPassportDate(lastCompletedEntry?.completedAt ?? new Date().toISOString())}</Text><Text style={styles.v35PostcardFact}>{lastCompletedEntry?.minutes ?? selectedMinutes} 分鐘</Text></View></View>
              </View>
              <Pressable onPress={() => { if (lastCompletedEntry) openPassportEntry(lastCompletedEntry); else transitionTo('passport'); }} style={({ pressed }) => [styles.v35FinishPrimary, pressed && styles.v35TicketButtonPressed]}><Text style={styles.v35FinishPrimaryArrow}>→</Text><Text style={styles.v35FinishPrimaryText}>照片回顧</Text></Pressable>
              <Pressable onPress={resetDetour} style={({ pressed }) => [styles.v35FinishSecondary, pressed && styles.v35Pressed]}><Text style={styles.v35FinishSecondaryText}>回到首頁</Text></Pressable>
              <View style={styles.v35FeedbackPanel}>
                <Text style={styles.v35FeedbackTitle}>這趟值得嗎？</Text>
                <View style={styles.playtestRatingRow}>{([{ id: 'replay' as PlaytestRating, label: '會再玩' }, { id: 'okay' as PlaytestRating, label: '還行' }, { id: 'not-worth-it' as PlaytestRating, label: '不值得' }]).map((item) => { const active = playtestRating === item.id; return (<Pressable key={item.id} onPress={() => rateCompletedDetour(item.id)} style={[styles.playtestRatingButton, active && styles.playtestRatingButtonActive]}><Text style={[styles.playtestRatingText, active && styles.playtestRatingTextActive]}>{item.label}</Text></Pressable>); })}</View>
              </View>
            </ScrollView>
          </View>
        )}

"""
s = between(s, "        {stage === 'finish' && (", "        {stage === 'passport' && (", finish, 'finish stage')

s = s.replace('<Text style={styles.brand}>PASSPORT</Text>', '<Text style={styles.brand}>已完成的旅程</Text>', 1)
s = s.replace('<Text style={styles.passportSectionTitle}>RECENT DETOURS</Text>', '<Text style={styles.passportSectionTitle}>旅程紀錄</Text>', 1)
s = s.replace('{entry.discoveries} MISSIONS', '{entry.discoveries} 個任務')
s = s.replace('{entry.photoCount ?? 0} PHOTOS', '{entry.photoCount ?? 0} 張照片')
s = s.replace('<Text style={styles.passportOpenText}>OPEN POSTCARD</Text>', '<Text style={styles.passportOpenText}>打開旅程</Text>')

s = rep(s, """              <Text style={styles.brand}>POSTCARD {selectedPassportNumber}</Text>\n              <Text style={styles.meta}>\n                {selectedPassportEntry.contextCode ?? '—'}\n              </Text>""", """              <Text style={styles.v35ReviewHeaderTitle}>旅程回顧</Text>\n              <Text style={styles.meta}></Text>""", 'review header')
photo_start = s.find("              {selectedPassportEntry.photos &&", s.find("{stage === 'passportDetail'"))
photo_end = s.find("              {((selectedPassportEntry.plannedRoute", photo_start)
if photo_start < 0 or photo_end < 0: raise RuntimeError('review photo section markers missing')
photo_block = r"""              {selectedPassportEntry.photos &&
              selectedPassportEntry.photos.length > 0 ? (
                <View style={styles.v35ReviewPhotoSection}>
                  <Image source={{ uri: selectedPassportEntry.photos[Math.min(passportPhotoIndex, selectedPassportEntry.photos.length - 1)].uri }} style={styles.v35ReviewHeroPhoto} resizeMode="cover" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.v35ReviewThumbStrip}>
                    {selectedPassportEntry.photos.map((photo, index) => (<Pressable key={photo.id} onPress={() => setPassportPhotoIndex(index)}><Image source={{ uri: photo.uri }} style={[styles.v35ReviewThumb, index === passportPhotoIndex && styles.v35ReviewThumbActive]} resizeMode="cover" /></Pressable>))}
                  </ScrollView>
                </View>
              ) : (<View style={styles.v35ReviewEmptyPhoto}><Text style={styles.v35ReviewEmptyTitle}>這趟沒有留下照片。</Text></View>)}

"""
s = s[:photo_start] + photo_block + s[photo_end:]
pd_start = s.find("{stage === 'passportDetail'")
scroll_close = s.find("            </ScrollView>\n          </View>\n        )}", pd_start)
if scroll_close < 0: raise RuntimeError('passport detail scroll close missing')
share_button = r"""              <Pressable onPress={() => shareJourney(selectedPassportEntry)} style={({ pressed }) => [styles.v35ReviewShare, pressed && styles.v35TicketButtonPressed]}>
                <Text style={styles.v35ReviewShareIcon}>↥</Text><Text style={styles.v35ReviewShareText}>分享這趟旅程</Text>
              </Pressable>

"""
s = s[:scroll_close] + share_button + s[scroll_close:]

style_close = s.rfind('\n});')
if style_close < 0: raise RuntimeError('StyleSheet close missing')
styles = r'''

  v35Pressed: { opacity: 0.72 },
  v35HomeScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, paddingHorizontal: 24, paddingBottom: 28 },
  v35TopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v35Brand: { fontSize: 42, lineHeight: 44, fontWeight: '900', letterSpacing: -2.7, color: INK },
  v35BrandSlash: { width: 21, height: 10, marginLeft: 124, marginTop: -5, backgroundColor: SIGNAL, transform: [{ rotate: '-8deg' }] },
  v35MenuButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EAE5DB', alignItems: 'center', justifyContent: 'center', gap: 5 },
  v35MenuLine: { width: 23, height: 3, borderRadius: 2, backgroundColor: INK },
  v35MenuLineShort: { width: 16, height: 3, borderRadius: 2, backgroundColor: INK },
  v35RouteSketch: { height: 145, marginTop: 10, position: 'relative', overflow: 'hidden' },
  v35CityBlock: { position: 'absolute', bottom: 18, width: 26, backgroundColor: '#DCD8CF', opacity: 0.76 },
  v35RouteDash: { position: 'absolute', height: 3, borderStyle: 'dashed', borderTopWidth: 3, borderTopColor: SIGNAL },
  v35MapPin: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v35MapPinCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: BONE },
  v35SketchBench: { position: 'absolute', right: '26%', top: 52, width: 44, height: 30 },
  v35BenchSeat: { position: 'absolute', left: 0, right: 0, top: 8, height: 7, borderRadius: 2, backgroundColor: INK },
  v35BenchLeg: { position: 'absolute', left: 4, bottom: 0, width: 4, height: 15, backgroundColor: INK },
  v35BenchLegRight: { left: undefined, right: 2 },
  v35SketchFlag: { position: 'absolute', right: '6%', top: 47, width: 34, height: 42 },
  v35FlagPole: { position: 'absolute', left: 4, top: 0, width: 4, height: 42, backgroundColor: INK, transform: [{ rotate: '5deg' }] },
  v35FlagCloth: { position: 'absolute', left: 9, top: 3, width: 25, height: 17, backgroundColor: SIGNAL, transform: [{ rotate: '7deg' }] },
  v35HomeQuestion: { marginTop: 4, fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -2.2, color: INK, textAlign: 'center' },
  v35Underline: { alignSelf: 'center', width: 126, height: 7, marginTop: 4, marginLeft: 112, backgroundColor: SIGNAL, borderRadius: 4, transform: [{ rotate: '-5deg' }] },
  v35MinuteReadout: { marginTop: 25, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  v35MinuteNumber: { fontSize: 78, lineHeight: 82, fontWeight: '900', letterSpacing: -4, color: SIGNAL },
  v35MinuteUnit: { marginBottom: 11, fontSize: 17, fontWeight: '900', color: INK },
  v35SliderWrap: { height: 62, marginTop: 11, marginHorizontal: 8, position: 'relative' },
  v35SliderRail: { position: 'absolute', left: 0, right: 0, top: 10, height: 9, borderRadius: 5, backgroundColor: '#D8D4CB' },
  v35SliderFill: { position: 'absolute', left: 0, top: 10, height: 9, borderRadius: 5, backgroundColor: SIGNAL },
  v35TickWrap: { position: 'absolute', top: 5, width: 1, alignItems: 'center' },
  v35Tick: { width: 9, height: 9, marginLeft: -4, borderRadius: 5, backgroundColor: '#BEB9AF' },
  v35TickActive: { backgroundColor: SIGNAL },
  v35TickLabel: { width: 28, marginTop: 12, marginLeft: -14, textAlign: 'center', fontSize: 11, fontWeight: '700', color: INK },
  v35SliderThumb: { position: 'absolute', top: 0, width: 42, height: 42, marginLeft: -21, borderRadius: 21, backgroundColor: BONE, borderWidth: 2, borderColor: '#E9E4DA', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  v35SliderThumbCore: { width: 26, height: 26, borderRadius: 13, backgroundColor: SIGNAL },
  v35TicketButton: { marginTop: 16, minHeight: 78, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, position: 'relative', overflow: 'hidden' },
  v35TicketButtonPressed: { transform: [{ scale: 0.988 }], opacity: 0.88 },
  v35TicketNotchLeft: { position: 'absolute', left: -10, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v35TicketNotchRight: { position: 'absolute', right: -10, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v35TicketArrow: { fontSize: 36, color: INK },
  v35TicketText: { flex: 1, marginLeft: 15, fontSize: 21, fontWeight: '900', letterSpacing: -0.8, color: INK, textAlign: 'center' },
  v35TicketDivider: { width: 1, height: 52, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(17,17,15,0.6)', marginHorizontal: 16 },
  v35TicketMark: { fontSize: 24, color: '#9D331B', transform: [{ rotate: '18deg' }] },
  v35CompletedButton: { marginTop: 11, minHeight: 54, borderWidth: 1, borderColor: '#CFC9BD', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.18)' },
  v35CompletedText: { fontSize: 16, fontWeight: '800', color: INK },
  v35CompletedCount: { marginLeft: 10, minWidth: 25, height: 25, paddingHorizontal: 7, borderRadius: 13, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  v35CompletedCountText: { fontSize: 10, fontWeight: '800', color: BONE },
  v35CompletedArrow: { marginLeft: 'auto', fontSize: 23, color: SIGNAL },
  v35MoodScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 57, paddingHorizontal: 24, paddingBottom: 24 },
  v35MoodTop: { flexDirection: 'row', alignItems: 'center' },
  v35BackButton: { width: 38, height: 44, justifyContent: 'center' },
  v35BackArrow: { fontSize: 48, lineHeight: 48, fontWeight: '300', color: INK },
  v35MoodBrand: { marginLeft: 18, fontSize: 35, fontWeight: '900', letterSpacing: -2, color: INK },
  v35TimePill: { marginLeft: 'auto', minHeight: 48, borderRadius: 24, backgroundColor: INK, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  v35TimePillIcon: { fontSize: 18, fontWeight: '800', color: SIGNAL },
  v35TimePillText: { fontSize: 14, fontWeight: '900', color: BONE },
  v35MoodTitle: { marginTop: 55, fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -2.2, color: INK, textAlign: 'center' },
  v35UnderlineMood: { alignSelf: 'flex-end', marginRight: 43, marginTop: 2, width: 114, height: 6, borderRadius: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-4deg' }] },
  v35MoodScroll: { paddingTop: 34, paddingBottom: 18 },
  v35MoodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  v35MoodCard: { width: '48.6%', minHeight: 148, borderWidth: 1, borderColor: '#D6D0C5', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  v35MoodCardActive: { borderWidth: 2, borderColor: SIGNAL, backgroundColor: '#F8EFE6' },
  v35MoodArt: { width: 90, height: 72, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  v35MoodSymbol: { fontSize: 54, lineHeight: 60, fontWeight: '900', color: INK },
  v35MoodSymbolActive: { color: INK },
  v35MoodAccent: { position: 'absolute', right: 4, bottom: 8, width: 25, height: 6, borderRadius: 3, backgroundColor: '#BFBAB1', transform: [{ rotate: '-18deg' }] },
  v35MoodAccentActive: { backgroundColor: SIGNAL },
  v35MoodCardLabel: { marginTop: 3, fontSize: 20, fontWeight: '900', color: INK },
  v35MoodPrimary: { minHeight: 72, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  v35MoodPrimaryDisabled: { opacity: 0.42 },
  v35MoodPrimaryText: { fontSize: 29, fontWeight: '900', color: INK },
  v35MoodPrimaryDivider: { position: 'absolute', right: 72, top: 10, bottom: 10, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(17,17,15,0.52)' },
  v35MoodPrimaryArrow: { position: 'absolute', right: 23, fontSize: 31, color: INK },
  v35PreparingScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 62, paddingHorizontal: 24, alignItems: 'center' },
  v35PreparingBrand: { alignSelf: 'flex-start', fontSize: 39, fontWeight: '900', letterSpacing: -2.5, color: INK },
  v35PreparingTitle: { marginTop: 78, fontSize: 44, lineHeight: 49, fontWeight: '900', letterSpacing: -2, color: INK, textAlign: 'center' },
  v35PreparingUnderline: { marginTop: 2, width: 165, height: 7, borderRadius: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-4deg' }] },
  v35Printer: { marginTop: 36, width: '94%', height: 410, position: 'relative', alignItems: 'center', overflow: 'hidden' },
  v35PrinterTop: { position: 'absolute', top: 0, width: '94%', height: 88, borderRadius: 16, backgroundColor: '#A9A49A', borderWidth: 1, borderColor: '#8E887F' },
  v35PrinterSlot: { position: 'absolute', top: 32, width: '83%', height: 24, borderRadius: 10, backgroundColor: '#171614', zIndex: 4 },
  v35PrintingTicket: { position: 'absolute', top: 54, width: '78%', minHeight: 330, backgroundColor: '#F6F1E8', padding: 20, borderWidth: 1, borderColor: '#D2CBC0', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  v35PrintOrangeBand: { height: 26, marginHorizontal: -20, marginTop: -20, marginBottom: 16, backgroundColor: SIGNAL },
  v35PrintBrand: { fontSize: 28, fontWeight: '900', letterSpacing: -1.7, color: INK },
  v35PrintDash: { height: 1, marginVertical: 14, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#BDB7AD' },
  v35PrintFacts: { flexDirection: 'row', alignItems: 'center' },
  v35PrintLabel: { fontSize: 11, fontWeight: '900', color: INK },
  v35PrintMinute: { marginTop: 3, fontSize: 46, lineHeight: 50, fontWeight: '900', letterSpacing: -2, color: SIGNAL },
  v35PrintMinuteUnit: { fontSize: 14, color: INK },
  v35PrintDivider: { width: 1, height: 72, marginHorizontal: 18, backgroundColor: '#C5BFB5' },
  v35PrintMoodBlock: { flex: 1 },
  v35PrintMood: { marginTop: 11, fontSize: 21, lineHeight: 26, fontWeight: '900', color: INK },
  v35PrintDestination: { fontSize: 19, fontWeight: '900', color: INK },
  v35PrintBarcode: { marginTop: 27, height: 42, flexDirection: 'row', gap: 3, justifyContent: 'center', alignItems: 'stretch' },
  v35PrintBar: { backgroundColor: INK },
  v35PreparingStatus: { marginTop: 8, fontSize: 12, fontWeight: '700', color: MUTED, textAlign: 'center' },
  v35JourneyScreen: { flex: 1, backgroundColor: '#090909', paddingTop: 57, paddingHorizontal: 24, paddingBottom: 25 },
  v35JourneyTop: { flexDirection: 'row', alignItems: 'center' },
  v35JourneyBack: { width: 44, height: 44, justifyContent: 'center' },
  v35JourneyBackText: { fontSize: 38, color: BONE },
  v35JourneyBrand: { marginLeft: 10, fontSize: 34, fontWeight: '900', letterSpacing: -2, color: BONE },
  v35JourneyProgress: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  v35JourneyProgressItem: { flexDirection: 'row', alignItems: 'center' },
  v35JourneyProgressDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#6F6F6C', backgroundColor: '#090909' },
  v35JourneyProgressCurrent: { width: 17, height: 17, borderRadius: 9, borderColor: SIGNAL, borderWidth: 4 },
  v35JourneyProgressDone: { borderColor: SIGNAL, backgroundColor: SIGNAL },
  v35JourneyProgressLine: { width: 16, height: 1, marginHorizontal: 4, backgroundColor: '#66645F' },
  v35JourneyProgressLineDone: { backgroundColor: SIGNAL },
  v35JourneyFlag: { marginLeft: 7, fontSize: 18, color: '#8E8C86' },
  v35JourneyHero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 35 },
  v35Compass: { width: 245, height: 245, borderRadius: 123, borderWidth: 18, borderColor: '#272727', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0E0E' },
  v35CompassTicks: { position: 'absolute', top: 25, bottom: 25, left: '50%', width: 5, marginLeft: -2.5, borderTopWidth: 18, borderBottomWidth: 18, borderColor: '#6D6B66' },
  v35CompassArrow: { fontSize: 150, lineHeight: 160, fontWeight: '900', color: SIGNAL },
  v35JourneyDistance: { marginTop: 22, fontSize: 76, lineHeight: 80, fontWeight: '900', letterSpacing: -4, color: SIGNAL },
  v35JourneyDistanceUnit: { fontSize: 30, color: BONE },
  v35JourneyInstruction: { marginTop: 12, fontSize: 29, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4, color: BONE, textAlign: 'center' },
  v35JourneyStatus: { marginTop: 12, fontSize: 12, color: '#A29E95' },
  v35JourneyMapWrap: { flex: 1, marginTop: 28, marginBottom: 24, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#2B2B2B' },
  v35JourneyMap: { flex: 1 },
  v35JourneyMapClose: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(9,9,9,0.82)', alignItems: 'center', justifyContent: 'center' },
  v35JourneyMapCloseText: { fontSize: 24, color: BONE },
  v35QuestPulse: { position: 'absolute', left: 24, right: 24, top: 125, minHeight: 44, borderRadius: 22, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v35QuestPulseText: { fontSize: 13, fontWeight: '900', color: INK },
  v35JourneyBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  v35JourneyCamera: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: '#3A3936', alignItems: 'center', justifyContent: 'center' },
  v35JourneyCameraText: { fontSize: 31, color: BONE },
  v35JourneyPrimary: { flex: 1, minHeight: 68, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, position: 'relative' },
  v35JourneyPrimaryPressed: { opacity: 0.8 },
  v35JourneyPrimaryArrow: { fontSize: 34, color: BONE },
  v35JourneyPrimaryDivider: { width: 1, height: 38, marginHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.35)' },
  v35JourneyPrimaryText: { flex: 1, fontSize: 24, fontWeight: '900', color: BONE, textAlign: 'center' },
  v35JourneyPressed: { opacity: 0.75 },
  v35DevAdvance: { position: 'absolute', right: 0, bottom: 76, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#2A2926', borderRadius: 13 },
  v35DevAdvanceText: { fontSize: 9, color: '#A9A59B' },
  v35FinishScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58 },
  v35FinishTop: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v35FinishBrand: { fontSize: 40, fontWeight: '900', letterSpacing: -2.5, color: INK },
  v35FinishMenu: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E9E4D9', alignItems: 'center', justifyContent: 'center', gap: 4 },
  v35FinishScroll: { paddingHorizontal: 24, paddingBottom: 50 },
  v35FinishTitle: { marginTop: 40, fontSize: 44, fontWeight: '900', letterSpacing: -2.4, color: INK, textAlign: 'center' },
  v35Postcard: { marginTop: 27, backgroundColor: '#F7F2E9', borderWidth: 1, borderColor: '#E0D9CD', padding: 16, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  v35PostcardTop: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#BDB7AD', marginBottom: 14 },
  v35PostcardBrand: { fontSize: 25, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v35FinishStamp: { width: 82, height: 82, marginTop: 25, borderWidth: 3, borderColor: SIGNAL, borderRadius: 41, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-9deg' }], backgroundColor: 'rgba(245,241,232,0.88)', zIndex: 4 },
  v35FinishStampText: { fontSize: 14, fontWeight: '900', color: SIGNAL },
  v35FinishStampPlane: { marginTop: 4, fontSize: 16, color: SIGNAL },
  v35PostcardHeroPhoto: { width: '100%', height: 236, borderRadius: 13 },
  v35PostcardThumbRow: { marginTop: 8, flexDirection: 'row', gap: 7 },
  v35PostcardThumb: { flex: 1, height: 78, borderRadius: 8 },
  v35PostcardNoPhoto: { height: 225, backgroundColor: '#E7E2D8', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  v35PostcardRouteLine: { position: 'absolute', width: 220, height: 2, backgroundColor: SIGNAL, transform: [{ rotate: '-13deg' }] },
  v35PostcardRoutePin: { width: 22, height: 22, borderRadius: 11, borderWidth: 5, borderColor: SIGNAL, backgroundColor: BONE },
  v35PostcardNoPhotoText: { marginTop: 58, fontSize: 18, fontWeight: '900', color: INK },
  v35PostcardMetaRow: { marginTop: 17, minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  v35PostcardPlace: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  v35PostcardPlaceIcon: { fontSize: 22, color: SIGNAL },
  v35PostcardPlaceText: { flex: 1, fontSize: 22, lineHeight: 27, fontWeight: '900', color: INK },
  v35PostcardMetaDivider: { width: 1, height: 58, marginHorizontal: 14, backgroundColor: '#C9C2B6' },
  v35PostcardFacts: { width: 110, gap: 5 },
  v35PostcardFact: { fontSize: 14, fontWeight: '800', color: INK },
  v35FinishPrimary: { marginTop: 28, minHeight: 68, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  v35FinishPrimaryArrow: { fontSize: 32, color: INK },
  v35FinishPrimaryText: { fontSize: 25, fontWeight: '900', color: INK },
  v35FinishSecondary: { marginTop: 10, minHeight: 56, borderWidth: 1, borderColor: '#CBC5BA', alignItems: 'center', justifyContent: 'center' },
  v35FinishSecondaryText: { fontSize: 16, fontWeight: '800', color: INK },
  v35FeedbackPanel: { marginTop: 30, paddingTop: 21, borderTopWidth: 1, borderColor: '#D3CDC2' },
  v35FeedbackTitle: { marginBottom: 12, fontSize: 15, fontWeight: '900', color: INK },
  v35ReviewHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 29, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v35ReviewPhotoSection: { marginTop: 20 },
  v35ReviewHeroPhoto: { width: '100%', height: 360, borderRadius: 18 },
  v35ReviewThumbStrip: { marginTop: 12, gap: 8, paddingBottom: 4 },
  v35ReviewThumb: { width: 76, height: 76, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  v35ReviewThumbActive: { borderColor: SIGNAL },
  v35ReviewEmptyPhoto: { marginTop: 20, minHeight: 170, borderWidth: 1, borderColor: '#D2CBC0', alignItems: 'center', justifyContent: 'center' },
  v35ReviewEmptyTitle: { fontSize: 16, fontWeight: '800', color: MUTED },
  v35ReviewShare: { marginTop: 26, minHeight: 66, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  v35ReviewShareIcon: { fontSize: 28, color: BONE },
  v35ReviewShareText: { fontSize: 21, fontWeight: '900', color: BONE },
'''
s = s[:style_close] + styles + s[style_close:]
p.write_text(s, encoding='utf-8')
print('patched src/app/index.tsx')

p = ROOT / 'src/lib/journey-engine.ts'
s = p.read_text(encoding='utf-8')
s = rep(s, "  | 'weird'\n  | 'surprise';", "  | 'weird'\n  | 'photo'\n  | 'surprise';", 'photo mood type')
start = s.find('export function getJourneyProfile(minutes: number): JourneyProfile {')
end = s.find('\nfunction withIds(', start)
if start < 0 or end < 0: raise RuntimeError('journey profile markers missing')
profile = r'''export function getJourneyProfile(minutes: number): JourneyProfile {
  const safeMinutes = clamp(Math.round(minutes / 5) * 5, 5, 60);
  let targetDistanceMeters: number;
  let sideMissionCount: number;
  if (safeMinutes <= 5) { targetDistanceMeters = 220; sideMissionCount = 1; }
  else if (safeMinutes <= 10) { targetDistanceMeters = 420; sideMissionCount = 2; }
  else if (safeMinutes <= 15) { targetDistanceMeters = 680; sideMissionCount = 3; }
  else if (safeMinutes <= 30) { targetDistanceMeters = Math.round(680 + (safeMinutes - 15) * 28); sideMissionCount = 4; }
  else if (safeMinutes <= 45) { targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22); sideMissionCount = 5; }
  else { targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18); sideMissionCount = 6; }
  const milestones = Array.from({ length: sideMissionCount }, (_, index) => Number((((index + 1) / (sideMissionCount + 1)) * 0.9).toFixed(2)));
  return { minutes: safeMinutes, targetDistanceMeters, sideMissionCount, milestones };
}
'''
s = s[:start] + profile + s[end:]
p.write_text(s, encoding='utf-8')
print('patched src/lib/journey-engine.ts')

p = ROOT / 'src/lib/playtest-analytics.ts'
s = p.read_text(encoding='utf-8')
for old in ["'0.32.0'", "'0.33.0'", "'0.34.0'"]:
    if old in s:
        s = s.replace(old, "'0.35.0'", 1)
        break
p.write_text(s, encoding='utf-8')
print('patched src/lib/playtest-analytics.ts')

p = ROOT / 'src/app/camera.tsx'
s = p.read_text(encoding='utf-8')
if 'pinchSurface' not in s:
    s = rep(s, """import {\n  Alert,\n  Pressable,""", """import {\n  Alert,\n  Platform,\n  Pressable,""", 'camera Platform import')
    s = rep(s, "import { CameraView, useCameraPermissions } from 'expo-camera';", """import {\n  CameraView,\n  useCameraPermissions,\n  type CameraType,\n  type FlashMode,\n} from 'expo-camera';""", 'camera imports')
    s = rep(s, """function delay(ms: number) {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\n\nexport default function CameraScreen() {""", """function delay(ms: number) {\n  return new Promise((resolve) => setTimeout(resolve, ms));\n}\nfunction clampZoom(value: number) { return Math.min(1, Math.max(0, value)); }\nfunction touchDistance(touches: readonly { pageX: number; pageY: number }[]) { if (touches.length < 2) return 0; const [a,b] = touches; return Math.hypot(a.pageX-b.pageX, a.pageY-b.pageY); }\nfunction lensLabel(lens: string) { if (lens.includes('UltraWide')) return '0.5×'; if (lens.includes('WideAngle')) return '1×'; if (lens.includes('Telephoto')) return '望遠'; return '鏡頭'; }\nfunction lensPriority(lens: string) { if (lens.includes('UltraWide')) return 0; if (lens.includes('WideAngle')) return 1; if (lens.includes('Telephoto')) return 2; return 9; }\n\nexport default function CameraScreen() {""", 'camera helpers')
    s = rep(s, """  const [librarySaveState, setLibrarySaveState] = useState<\n    'idle' | 'saved' | 'passport-only'\n  >('idle');""", """  const [librarySaveState, setLibrarySaveState] = useState<\n    'idle' | 'saved' | 'passport-only'\n  >('idle');\n  const [facing, setFacing] = useState<CameraType>('back');\n  const [flashMode, setFlashMode] = useState<FlashMode>('off');\n  const [zoom, setZoom] = useState(0);\n  const [availableLenses, setAvailableLenses] = useState<string[]>([]);\n  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);\n  const pinchStartDistanceRef = useRef(0);\n  const pinchStartZoomRef = useRef(0);\n  const pinchActiveRef = useRef(false);""", 'camera state')
    s = rep(s, "  async function takePhoto() {", r'''  async function refreshAvailableLenses() {
    if (Platform.OS !== 'ios' || facing !== 'back' || !cameraRef.current) { setAvailableLenses([]); setSelectedLens(undefined); return; }
    try {
      const lenses = (await cameraRef.current.getAvailableLensesAsync()) as string[];
      const physical = lenses.filter((lens) => lens.includes('UltraWide') || lens.includes('WideAngle') || lens.includes('Telephoto')).sort((a,b) => lensPriority(a)-lensPriority(b));
      const normalized = Array.from(new Set(physical)); setAvailableLenses(normalized);
      const wide = normalized.find((lens) => lens.includes('WideAngle'));
      setSelectedLens((current) => current && normalized.includes(current) ? current : wide ?? normalized[0] ?? undefined);
    } catch { setAvailableLenses([]); setSelectedLens(undefined); }
  }
  function cycleFlash() { setFlashMode((current) => current === 'off' ? 'auto' : current === 'auto' ? 'on' : 'off'); void Haptics.selectionAsync(); }
  function switchFacing() { setFacing((current) => current === 'back' ? 'front' : 'back'); setZoom(0); setSelectedLens(undefined); setAvailableLenses([]); setFlashMode('off'); void Haptics.selectionAsync(); }
  function chooseLens(lens: string) { setSelectedLens(lens); setZoom(0); void Haptics.selectionAsync(); }
  function handlePinchStart(touches: readonly { pageX: number; pageY: number }[]) { if (touches.length < 2) return; const distance = touchDistance(touches); if (distance <= 0) return; pinchStartDistanceRef.current = distance; pinchStartZoomRef.current = zoom; pinchActiveRef.current = true; }
  function handlePinchMove(touches: readonly { pageX: number; pageY: number }[]) { if (touches.length < 2 || !pinchActiveRef.current || pinchStartDistanceRef.current <= 0) return; const distance = touchDistance(touches); if (distance <= 0) return; const ratio = distance / pinchStartDistanceRef.current; const delta = Math.log2(Math.max(0.35, ratio)) * 0.18; setZoom(clampZoom(pinchStartZoomRef.current + delta)); }
  function handlePinchEnd() { pinchActiveRef.current = false; pinchStartDistanceRef.current = 0; }

  async function takePhoto() {''', 'camera functions')
    s = rep(s, """      <CameraView\n        ref={cameraRef}\n        style={styles.cameraView}\n        facing=\"back\"\n        onCameraReady={() => {\n          setCameraReady(true);\n          setMountError(null);\n        }}\n        onMountError={(event) => {\n          setCameraReady(false);\n          setMountError(event.message);\n        }}\n      />\n\n      <View style={styles.cameraOverlay} pointerEvents=\"box-none\">""", """      <CameraView\n        ref={cameraRef}\n        style={styles.cameraView}\n        facing={facing}\n        flash={facing === 'back' ? flashMode : 'off'}\n        zoom={zoom}\n        selectedLens={Platform.OS === 'ios' && facing === 'back' ? selectedLens : undefined}\n        autofocus=\"on\"\n        responsiveOrientationWhenOrientationLocked\n        onCameraReady={() => { setCameraReady(true); setMountError(null); void refreshAvailableLenses(); }}\n        onMountError={(event) => { setCameraReady(false); setMountError(event.message); }}\n      />\n      <View style={styles.pinchSurface} onTouchStart={(event) => handlePinchStart(event.nativeEvent.touches)} onTouchMove={(event) => handlePinchMove(event.nativeEvent.touches)} onTouchEnd={(event) => { if (event.nativeEvent.touches.length < 2) handlePinchEnd(); }} onTouchCancel={handlePinchEnd} />\n\n      <View style={styles.cameraOverlay} pointerEvents=\"box-none\">""", 'camera view')
    s = rep(s, """        <View style={styles.cameraTop}>\n          <Pressable\n            onPress={() => router.back()}\n            style={styles.closeButton}\n          >\n            <Text style={styles.closeText}>×</Text>\n          </Pressable>\n\n          <View style={styles.rollChip}>\n            <Text style={styles.rollChipLabel}>\n              DETOUR / ROLL {String(rollNumber).padStart(2, '0')}\n            </Text>\n            <Text style={styles.rollChipCount}>{rollDisplay}</Text>\n          </View>\n        </View>""", """        <View style={styles.cameraTop}>\n          <View style={styles.cameraTopLeft}><Pressable onPress={() => router.back()} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable><View style={styles.rollChip}><Text style={styles.rollChipLabel}>ROLL {String(rollNumber).padStart(2, '0')}</Text><Text style={styles.rollChipCount}>{rollDisplay}</Text></View></View>\n          <View style={styles.cameraTopActions}>{facing === 'back' && <Pressable onPress={cycleFlash} style={styles.cameraUtilityButton}><Text style={styles.cameraUtilityText}>{flashMode === 'off' ? '閃光 關' : flashMode === 'auto' ? '閃光 自動' : '閃光 開'}</Text></Pressable>}<Pressable onPress={switchFacing} style={styles.cameraUtilityButton}><Text style={styles.cameraUtilityText}>切換</Text></Pressable></View>\n        </View>""", 'camera top controls')
    s = rep(s, """        <View style={styles.cameraBottom}>\n          <View style={styles.statusColumn}>""", """        <View style={styles.cameraControlZone}>\n          {facing === 'back' && availableLenses.length > 1 && <View style={styles.lensRow}>{availableLenses.map((lens) => { const active = selectedLens === lens; return <Pressable key={lens} onPress={() => chooseLens(lens)} style={[styles.lensButton, active && styles.lensButtonActive]}><Text style={[styles.lensButtonText, active && styles.lensButtonTextActive]}>{lensLabel(lens)}</Text></Pressable>; })}</View>}\n          <Text style={styles.zoomHint}>雙指縮放</Text>\n          <View style={styles.cameraBottom}>\n          <View style={styles.statusColumn}>""", 'camera lens controls')
    s = rep(s, """            <Text style={styles.exposureLabel}>NEXT FRAME</Text>\n          </View>\n        </View>\n      </View>""", """            <Text style={styles.exposureLabel}>NEXT FRAME</Text>\n          </View>\n          </View>\n        </View>\n      </View>""", 'camera close')
    s = rep(s, """  cameraView: {\n    flex: 1,\n  },\n\n  cameraOverlay:""", """  cameraView: {\n    flex: 1,\n  },\n  pinchSurface: { ...StyleSheet.absoluteFillObject },\n\n  cameraOverlay:""", 'camera pinch style')
    s = rep(s, """  cameraTop: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    gap: 10,\n  },""", """  cameraTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },\n  cameraTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },\n  cameraTopActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },\n  cameraUtilityButton: { minHeight: 42, paddingHorizontal: 12, borderRadius: 21, backgroundColor: 'rgba(17,17,15,0.78)', alignItems: 'center', justifyContent: 'center' },\n  cameraUtilityText: { fontSize: 10, fontWeight: '700', color: BONE },""", 'camera top styles')
    s = rep(s, """  cameraBottom: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    justifyContent: 'space-between',\n  },""", """  cameraControlZone: { gap: 11 },\n  lensRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 24, backgroundColor: 'rgba(17,17,15,0.62)' },\n  lensButton: { minWidth: 46, height: 38, paddingHorizontal: 10, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },\n  lensButtonActive: { backgroundColor: BONE },\n  lensButtonText: { fontSize: 11, fontWeight: '700', color: BONE },\n  lensButtonTextActive: { color: INK },\n  zoomHint: { alignSelf: 'center', fontSize: 9, fontWeight: '600', color: 'rgba(241,239,231,0.72)' },\n  cameraBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },""", 'camera styles')
p.write_text(s, encoding='utf-8')
print('patched src/app/camera.tsx')
print('v0.35 migration complete')
