from pathlib import Path
import re

INDEX = Path('src/app/index.tsx')
BUILD = Path('src/lib/build-info.ts')
FOUNDATION = Path('PRODUCT_FOUNDATION.md')

text = INDEX.read_text()

# ---------------------------------------------------------------------------
# Mood glyphs: replace the old unicode/emoji-like symbols with a single
# DETOUR-owned geometric system built entirely from React Native Views.
# ---------------------------------------------------------------------------
old_mood_symbol = """function moodSymbol(moodId: MoodId) {
  if (moodId === 'wander') return '↗';
  if (moodId === 'food') return '♨';
  if (moodId === 'quiet') return '☾';
  if (moodId === 'weird') return '?';
  if (moodId === 'color') return '◉';
  return '✦';
}
"""
new_mood_symbol = r'''type MoodGlyphProps = {
  moodId: MoodId;
  active: boolean;
};

function MoodGlyph({ moodId, active }: MoodGlyphProps) {
  const ink = active ? BONE : INK;
  const signal = active ? BONE : SIGNAL;
  const cutout = active ? SIGNAL : BONE;

  if (moodId === 'wander') {
    return (
      <View style={styles.v43MoodGlyph}>
        <View style={[styles.v43WanderLineA, { backgroundColor: ink }]} />
        <View style={[styles.v43WanderLineB, { backgroundColor: ink }]} />
        <View style={[styles.v43WanderDot, styles.v43WanderDotA, { backgroundColor: signal }]} />
        <View style={[styles.v43WanderDot, styles.v43WanderDotB, { backgroundColor: ink }]} />
        <View style={[styles.v43WanderDot, styles.v43WanderDotC, { backgroundColor: ink }]} />
      </View>
    );
  }

  if (moodId === 'food') {
    return (
      <View style={styles.v43MoodGlyph}>
        <View style={[styles.v43FoodBowl, { borderColor: ink }]} />
        <View style={[styles.v43FoodPlate, { backgroundColor: ink }]} />
        <View style={[styles.v43FoodStem, styles.v43FoodStemLeft, { backgroundColor: signal }]} />
        <View style={[styles.v43FoodStem, styles.v43FoodStemRight, { backgroundColor: signal }]} />
      </View>
    );
  }

  if (moodId === 'quiet') {
    return (
      <View style={styles.v43MoodGlyph}>
        <View style={[styles.v43QuietMoon, { backgroundColor: ink }]} />
        <View style={[styles.v43QuietCutout, { backgroundColor: cutout }]} />
        <View style={[styles.v43QuietDot, { backgroundColor: signal }]} />
      </View>
    );
  }

  if (moodId === 'weird') {
    return (
      <View style={styles.v43MoodGlyph}>
        <View style={[styles.v43WeirdFrame, { borderColor: ink }]} />
        <View style={[styles.v43WeirdFrameInner, { borderColor: signal }]} />
        <View style={[styles.v43WeirdDot, { backgroundColor: ink }]} />
      </View>
    );
  }

  if (moodId === 'color') {
    return (
      <View style={styles.v43MoodGlyph}>
        <View style={[styles.v43ColorRingOuter, { borderColor: ink }]} />
        <View style={[styles.v43ColorRingMid, { borderColor: signal }]} />
        <View style={[styles.v43ColorCore, { backgroundColor: ink }]} />
      </View>
    );
  }

  return (
    <View style={styles.v43MoodGlyph}>
      <View style={[styles.v43FateDiamond, styles.v43FateDiamondMain, { backgroundColor: ink }]} />
      <View style={[styles.v43FateDiamond, styles.v43FateDiamondA, { backgroundColor: signal }]} />
      <View style={[styles.v43FateDiamond, styles.v43FateDiamondB, { backgroundColor: signal }]} />
      <View style={[styles.v43FateDiamond, styles.v43FateDiamondC, { backgroundColor: ink }]} />
    </View>
  );
}
'''
if old_mood_symbol not in text:
    raise SystemExit('moodSymbol block missing')
text = text.replace(old_mood_symbol, new_mood_symbol, 1)

old_mood_jsx = """                      <View style={styles.v35MoodArt}>
                        <Text style={[styles.v35MoodSymbol, active && styles.v35MoodSymbolActive]}>{moodSymbol(item.id)}</Text>
                      </View>
"""
new_mood_jsx = """                      <View style={styles.v35MoodArt}>
                        <MoodGlyph moodId={item.id} active={active} />
                      </View>
"""
if old_mood_jsx not in text:
    raise SystemExit('mood JSX missing')
text = text.replace(old_mood_jsx, new_mood_jsx, 1)

# ---------------------------------------------------------------------------
# Developer tools and indoor simulation are separate concepts.
# devMode continues to mean indoor test runtime behavior; a new unlock flag
# controls whether the developer-only settings are visible.
# ---------------------------------------------------------------------------
old_dev_state = "  const [devMode, setDevMode] = useState(false);\n"
new_dev_state = """  const [devMode, setDevMode] = useState(false);
  const [developerToolsUnlocked, setDeveloperToolsUnlocked] = useState(false);
"""
if old_dev_state not in text:
    raise SystemExit('devMode state missing')
text = text.replace(old_dev_state, new_dev_state, 1)

old_toggle_marker = """  async function toggleDevMode() {
"""
new_toggle_marker = """  async function toggleDeveloperTools() {
    const next = !developerToolsUnlocked;
    setDeveloperToolsUnlocked(next);
    await Haptics.selectionAsync();
  }

  async function toggleDevMode() {
"""
if old_toggle_marker not in text:
    raise SystemExit('toggleDevMode marker missing')
text = text.replace(old_toggle_marker, new_toggle_marker, 1)

# Settings only: keep consumer settings clean; developer sections are behind a
# hidden long-press unlock and no longer depend on indoor test being enabled.
settings_start = text.index("        {stage === 'settings' && (")
settings_end = text.index("        {stage === 'time' && (", settings_start)
settings = text[settings_start:settings_end]
settings = settings.replace('onLongPress={toggleDevMode}', 'onLongPress={toggleDeveloperTools}', 1)
settings = settings.replace('{devMode && (', '{developerToolsUnlocked && (')
settings = settings.replace('PROTOTYPE', '開發者工具')
settings = settings.replace('AI ENGINE', 'AI 狀態')
settings = settings.replace('PLAYTEST DATA', '測試資料')
settings = settings.replace('BACKEND', 'AI 後端')
settings = settings.replace('LAST RUN', '上次執行')
settings = settings.replace('TESTER', '測試裝置')
settings = settings.replace('RUNS', '測試次數')
settings = settings.replace('CLOUD SYNC', '雲端同步')
settings = settings.replace("{devMode ? 'ON' : 'OFF'}", "{devMode ? '開' : '關'}")
settings = settings.replace("                  AI 失敗時 DETOUR 會自動使用內建 Engine，不會中斷旅程。", "                  AI 失敗時會自動改用內建路線邏輯。")
settings = settings.replace("                      真正跑一次 Scene ranking，確認 OpenAI 與 Structured Output。", "                      測試目前的 AI 排序服務是否正常。")
settings = settings.replace("                      平常會自動同步；這顆只是測試前手動確認。", "                      手動確認測試資料已同步。")
settings = settings.replace("                      匿名統計，不包含 GPS、照片、路線或目的地名稱。", "                      匿名資料，不包含照片與完整定位軌跡。")

# Add a clear way to leave developer tools without disabling indoor test.
needle = """                  </Text>
                </Pressable>
              </View>
              )}

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  開始導覽
"""
replacement = """                  </Text>
                </Pressable>

                <Pressable
                  onPress={toggleDeveloperTools}
                  style={({ pressed }) => [
                    styles.v43DevClose,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={styles.v43DevCloseText}>隱藏開發者工具</Text>
                </Pressable>
              </View>
              )}

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  開始導覽
"""
if needle not in settings:
    raise SystemExit('developer tools insertion marker missing')
settings = settings.replace(needle, replacement, 1)
text = text[:settings_start] + settings + text[settings_end:]

# Passport dev clear should also follow developer-tools visibility, not whether
# indoor simulation happens to be enabled.
text = text.replace(
    "              {devMode && passport.length > 0 && (\n",
    "              {developerToolsUnlocked && passport.length > 0 && (\n",
    1,
)

# ---------------------------------------------------------------------------
# Passport detail: replace the old analytics/map-heavy page with a photo-first
# memory page. The unreliable large MapView is removed; route data is shown as
# a compact summary only when valid route points exist.
# ---------------------------------------------------------------------------
passport_pattern = r"        \{stage === 'passportDetail' && selectedPassportEntry && \(.*?\n        \)\}\n\n      </Animated.View>"
passport_replacement = r'''        {stage === 'passportDetail' && selectedPassportEntry && (
          <View style={styles.v43DetailScreen}>
            <View style={styles.v43DetailTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v43DetailBack}>
                <Text style={styles.v43DetailBackText}>←</Text>
              </Pressable>
              <Text style={styles.v43DetailHeader}>旅程回顧</Text>
              <View style={styles.v43DetailTopSpacer} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.v43DetailScroll}
            >
              <View ref={shareTicketRef} collapsable={false} style={styles.v43MemoryCard}>
                {selectedPassportEntry.photos?.[Math.min(passportPhotoIndex, Math.max(0, (selectedPassportEntry.photos?.length ?? 1) - 1))]?.uri ? (
                  <Image
                    source={{
                      uri: selectedPassportEntry.photos![
                        Math.min(passportPhotoIndex, selectedPassportEntry.photos!.length - 1)
                      ].uri,
                    }}
                    style={styles.v43MemoryHeroPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.v43MemoryNoPhoto}>
                    <View style={styles.v43MemoryRouteLine} />
                    <View style={styles.v43MemoryRouteDot} />
                    <View style={styles.v43MemoryRouteFlag} />
                    <Text style={styles.v43MemoryNoPhotoText}>這趟沒有留下照片</Text>
                  </View>
                )}

                <View style={styles.v43MemoryCopy}>
                  <View style={styles.v43MemoryTopline}>
                    <Text style={styles.v43MemoryBrand}>DETOUR</Text>
                    <Text style={styles.v43MemoryDate}>
                      {formatPassportDate(selectedPassportEntry.completedAt)}
                    </Text>
                  </View>

                  <Text style={styles.v43MemoryMood}>{selectedPassportEntry.moodLabel}</Text>
                  <Text style={styles.v43MemoryDestination} numberOfLines={2}>
                    {selectedPassportEntry.sceneName ?? `${selectedPassportEntry.city}的一趟 DETOUR`}
                  </Text>

                  <View style={styles.v43MemoryFacts}>
                    <Text style={styles.v43MemoryFact}>{selectedPassportEntry.minutes} 分鐘</Text>
                    <Text style={styles.v43MemoryFact}>{selectedPassportEntry.discoveries} 個發現</Text>
                    <Text style={styles.v43MemoryFact}>{selectedPassportEntry.photoCount ?? selectedPassportEntry.photos?.length ?? 0} 張照片</Text>
                  </View>
                </View>
              </View>

              {selectedPassportEntry.photos && selectedPassportEntry.photos.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.v43PhotoStrip}
                >
                  {selectedPassportEntry.photos.map((photo, index) => (
                    <Pressable key={photo.id} onPress={() => setPassportPhotoIndex(index)}>
                      <Image
                        source={{ uri: photo.uri }}
                        style={[
                          styles.v43PhotoThumb,
                          index === passportPhotoIndex && styles.v43PhotoThumbActive,
                        ]}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.v43SummaryRow}>
                <View style={styles.v43SummaryItem}>
                  <Text style={styles.v43SummaryValue}>
                    {selectedPassportEntry.actualDurationMinutes ?? selectedPassportEntry.minutes}
                  </Text>
                  <Text style={styles.v43SummaryLabel}>分鐘</Text>
                </View>
                <View style={styles.v43SummaryItem}>
                  <Text style={styles.v43SummaryValue}>
                    {((selectedPassportEntry.distanceMeters ?? selectedPassportEntry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(1)}
                  </Text>
                  <Text style={styles.v43SummaryLabel}>公里</Text>
                </View>
                <View style={styles.v43SummaryItem}>
                  <Text style={styles.v43SummaryValue}>{selectedPassportEntry.discoveries}</Text>
                  <Text style={styles.v43SummaryLabel}>個發現</Text>
                </View>
              </View>

              {((selectedPassportEntry.route?.length ?? 0) >= 2 ||
                (selectedPassportEntry.plannedRoute?.length ?? 0) >= 2) && (
                <View style={styles.v43RouteSection}>
                  <View style={styles.v43SectionHead}>
                    <Text style={styles.v43SectionTitle}>走過的路</Text>
                    <Text style={styles.v43SectionMeta}>
                      {((selectedPassportEntry.distanceMeters ?? selectedPassportEntry.plannedRouteDistanceMeters ?? 0) / 1000).toFixed(2)} 公里
                    </Text>
                  </View>

                  <View style={styles.v43RouteCard}>
                    <View style={styles.v43RouteVisual}>
                      <View style={styles.v43RouteStart} />
                      <View style={styles.v43RouteSegmentA} />
                      <View style={styles.v43RouteTurn} />
                      <View style={styles.v43RouteSegmentB} />
                      <View style={styles.v43RouteEnd} />
                    </View>
                    <Text style={styles.v43RouteDestination}>
                      {selectedPassportEntry.sceneName ?? '這趟的終點'}
                    </Text>
                    {selectedPassportEntry.rerouteCount ? (
                      <Text style={styles.v43RouteNote}>
                        途中換過 {selectedPassportEntry.rerouteCount} 次終點
                      </Text>
                    ) : (
                      <Text style={styles.v43RouteNote}>這條路已經留在這趟旅程裡。</Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.v43MissionSection}>
                <View style={styles.v43SectionHead}>
                  <Text style={styles.v43SectionTitle}>這趟發生的事</Text>
                  <Text style={styles.v43SectionMeta}>
                    {selectedPassportEntry.missions?.length ?? 0} 個尋找
                  </Text>
                </View>

                {selectedPassportEntry.missions && selectedPassportEntry.missions.length > 0 ? (
                  selectedPassportEntry.missions.map((mission, index) => {
                    const missionPhoto = selectedPassportEntry.photos?.find(
                      (photo) => photo.missionCode === mission.code
                    );
                    const skipped = mission.result === 'skipped';

                    return (
                      <View
                        key={`${selectedPassportEntry.id}-${mission.code}-${index}`}
                        style={styles.v43MissionCard}
                      >
                        <View style={styles.v43MissionCopy}>
                          <View style={styles.v43MissionTopline}>
                            <Text style={styles.v43MissionNumber}>
                              {String(index + 1).padStart(2, '0')}
                            </Text>
                            <View
                              style={[
                                styles.v43MissionStatus,
                                skipped && styles.v43MissionStatusSkipped,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.v43MissionStatusText,
                                  skipped && styles.v43MissionStatusTextSkipped,
                                ]}
                              >
                                {skipped ? '跳過' : '完成'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.v43MissionTitle}>{mission.title}</Text>
                        </View>
                        {missionPhoto?.uri && (
                          <Image
                            source={{ uri: missionPhoto.uri }}
                            style={styles.v43MissionPhoto}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.v43LegacyCard}>
                    <Text style={styles.v43LegacyText}>
                      這趟是舊版紀錄，當時還沒有保存每個尋找的結果。
                    </Text>
                  </View>
                )}
              </View>

              {selectedPassportEntry.sceneFailures && selectedPassportEntry.sceneFailures.length > 0 && (
                <View style={styles.v43RecoveryCard}>
                  <Text style={styles.v43RecoveryTitle}>途中有改過路</Text>
                  <Text style={styles.v43RecoveryBody}>
                    換過 {selectedPassportEntry.sceneFailures.length} 次終點；已完成的尋找都有保留。
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => shareJourney(selectedPassportEntry)}
                style={({ pressed }) => [
                  styles.v43ShareButton,
                  pressed && styles.v35TicketButtonPressed,
                ]}
              >
                <Text style={styles.v43ShareText}>分享這趟</Text>
                <Text style={styles.v43ShareArrow}>↗</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

      </Animated.View>'''
text, count = re.subn(passport_pattern, passport_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'passport detail replacement count = {count}')

# ---------------------------------------------------------------------------
# Styles for v0.43. Insert before v0.42 to keep the current ticket untouched.
# ---------------------------------------------------------------------------
styles_marker = "const styles = StyleSheet.create({\n"
v43_styles = r'''  v43MoodGlyph: {
    width: 84,
    height: 84,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v43WanderLineA: {
    position: 'absolute',
    left: 18,
    top: 43,
    width: 34,
    height: 7,
    borderRadius: 4,
    transform: [{ rotate: '-31deg' }],
  },
  v43WanderLineB: {
    position: 'absolute',
    left: 43,
    top: 28,
    width: 27,
    height: 7,
    borderRadius: 4,
    transform: [{ rotate: '21deg' }],
  },
  v43WanderDot: { position: 'absolute', width: 13, height: 13, borderRadius: 7 },
  v43WanderDotA: { left: 12, bottom: 21 },
  v43WanderDotB: { left: 40, top: 29 },
  v43WanderDotC: { right: 8, top: 20 },
  v43FoodBowl: {
    position: 'absolute',
    top: 32,
    width: 55,
    height: 29,
    borderWidth: 6,
    borderTopWidth: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  v43FoodPlate: { position: 'absolute', bottom: 17, width: 52, height: 6, borderRadius: 3 },
  v43FoodStem: { position: 'absolute', top: 14, width: 6, height: 25, borderRadius: 3 },
  v43FoodStemLeft: { left: 29, transform: [{ rotate: '-8deg' }] },
  v43FoodStemRight: { right: 28, transform: [{ rotate: '9deg' }] },
  v43QuietMoon: { position: 'absolute', width: 54, height: 54, borderRadius: 27, left: 15, top: 15 },
  v43QuietCutout: { position: 'absolute', width: 48, height: 48, borderRadius: 24, left: 31, top: 8 },
  v43QuietDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, right: 13, bottom: 17 },
  v43WeirdFrame: { width: 48, height: 48, borderWidth: 6, transform: [{ rotate: '13deg' }] },
  v43WeirdFrameInner: { position: 'absolute', width: 24, height: 24, borderWidth: 5, transform: [{ rotate: '-11deg' }] },
  v43WeirdDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, right: 10, top: 13 },
  v43ColorRingOuter: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 6 },
  v43ColorRingMid: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 6 },
  v43ColorCore: { width: 16, height: 16, borderRadius: 8 },
  v43FateDiamond: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  v43FateDiamondMain: { width: 34, height: 34 },
  v43FateDiamondA: { width: 12, height: 12, left: 9, top: 17 },
  v43FateDiamondB: { width: 10, height: 10, right: 11, bottom: 16 },
  v43FateDiamondC: { width: 8, height: 8, right: 13, top: 10 },

  v43DevClose: {
    minHeight: 50,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: LINE,
    justifyContent: 'center',
  },
  v43DevCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: SIGNAL,
  },

  v43DetailScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
  },
  v43DetailTop: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v43DetailBack: {
    position: 'absolute',
    left: 0,
    width: 48,
    height: 48,
    justifyContent: 'center',
  },
  v43DetailBackText: { fontSize: 34, color: INK },
  v43DetailHeader: { fontSize: 27, fontWeight: '900', color: INK, letterSpacing: -0.6 },
  v43DetailTopSpacer: { position: 'absolute', right: 0, width: 48, height: 48 },
  v43DetailScroll: { paddingTop: 24, paddingBottom: 64 },
  v43MemoryCard: {
    overflow: 'hidden',
    backgroundColor: '#FCF8EE',
    borderWidth: 1,
    borderColor: '#D7D1C4',
  },
  v43MemoryHeroPhoto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: SOFT },
  v43MemoryNoPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#E6E1D5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  v43MemoryRouteLine: { width: '58%', height: 6, borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '-9deg' }] },
  v43MemoryRouteDot: { position: 'absolute', left: '20%', top: '47%', width: 18, height: 18, borderRadius: 9, backgroundColor: SIGNAL },
  v43MemoryRouteFlag: { position: 'absolute', right: '19%', top: '37%', width: 18, height: 26, borderLeftWidth: 4, borderLeftColor: INK, borderTopWidth: 11, borderTopColor: SIGNAL },
  v43MemoryNoPhotoText: { position: 'absolute', bottom: 24, fontSize: 17, fontWeight: '700', color: MUTED },
  v43MemoryCopy: { padding: 22 },
  v43MemoryTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  v43MemoryBrand: { fontSize: 20, fontWeight: '900', letterSpacing: 3.6, color: INK },
  v43MemoryDate: { fontSize: 15, fontWeight: '700', color: MUTED },
  v43MemoryMood: { marginTop: 26, fontSize: 45, lineHeight: 50, fontWeight: '900', letterSpacing: -2.1, color: INK },
  v43MemoryDestination: { marginTop: 8, fontSize: 22, lineHeight: 29, fontWeight: '800', color: INK },
  v43MemoryFacts: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  v43MemoryFact: { fontSize: 16, fontWeight: '800', color: MUTED },
  v43PhotoStrip: { gap: 10, paddingTop: 14, paddingRight: 22 },
  v43PhotoThumb: { width: 86, height: 86, borderWidth: 2, borderColor: 'transparent', backgroundColor: SOFT },
  v43PhotoThumbActive: { borderColor: SIGNAL },
  v43SummaryRow: {
    marginTop: 34,
    minHeight: 112,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
  },
  v43SummaryItem: { flex: 1, justifyContent: 'center' },
  v43SummaryValue: { fontSize: 34, lineHeight: 39, fontWeight: '900', color: INK },
  v43SummaryLabel: { marginTop: 5, fontSize: 15, fontWeight: '700', color: MUTED },
  v43RouteSection: { marginTop: 38 },
  v43SectionHead: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v43SectionTitle: { fontSize: 20, fontWeight: '900', color: INK },
  v43SectionMeta: { fontSize: 15, fontWeight: '700', color: MUTED },
  v43RouteCard: { padding: 22, borderWidth: 1, borderColor: LINE, backgroundColor: '#F7F3E9' },
  v43RouteVisual: { height: 92, position: 'relative' },
  v43RouteStart: { position: 'absolute', left: 4, bottom: 12, width: 18, height: 18, borderRadius: 9, backgroundColor: SIGNAL },
  v43RouteSegmentA: { position: 'absolute', left: 20, bottom: 27, width: '45%', height: 6, borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '-10deg' }] },
  v43RouteTurn: { position: 'absolute', left: '46%', top: 28, width: 26, height: 26, borderTopWidth: 6, borderRightWidth: 6, borderColor: INK, transform: [{ rotate: '15deg' }] },
  v43RouteSegmentB: { position: 'absolute', right: 24, top: 28, width: '35%', height: 6, borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '7deg' }] },
  v43RouteEnd: { position: 'absolute', right: 4, top: 20, width: 20, height: 28, borderLeftWidth: 4, borderLeftColor: SIGNAL, borderTopWidth: 12, borderTopColor: SIGNAL },
  v43RouteDestination: { marginTop: 4, fontSize: 23, lineHeight: 30, fontWeight: '900', color: INK },
  v43RouteNote: { marginTop: 8, fontSize: 16, lineHeight: 23, color: MUTED },
  v43MissionSection: { marginTop: 42 },
  v43MissionCard: { minHeight: 126, paddingVertical: 18, borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', alignItems: 'center', gap: 16 },
  v43MissionCopy: { flex: 1 },
  v43MissionTopline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  v43MissionNumber: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v43MissionStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: INK },
  v43MissionStatusSkipped: { backgroundColor: '#D9D4C9' },
  v43MissionStatusText: { fontSize: 14, fontWeight: '900', color: BONE },
  v43MissionStatusTextSkipped: { color: MUTED },
  v43MissionTitle: { marginTop: 14, fontSize: 25, lineHeight: 32, fontWeight: '900', color: INK },
  v43MissionPhoto: { width: 94, height: 94, borderRadius: 4, backgroundColor: SOFT },
  v43LegacyCard: { padding: 20, borderWidth: 1, borderColor: LINE },
  v43LegacyText: { fontSize: 16, lineHeight: 24, color: MUTED },
  v43RecoveryCard: { marginTop: 28, padding: 20, backgroundColor: '#EAE5D9' },
  v43RecoveryTitle: { fontSize: 19, fontWeight: '900', color: INK },
  v43RecoveryBody: { marginTop: 7, fontSize: 16, lineHeight: 24, color: MUTED },
  v43ShareButton: { marginTop: 34, minHeight: 72, borderRadius: 36, backgroundColor: INK, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v43ShareText: { fontSize: 21, fontWeight: '900', color: BONE },
  v43ShareArrow: { fontSize: 28, color: SIGNAL },

'''
if styles_marker not in text:
    raise SystemExit('StyleSheet marker missing')
text = text.replace(styles_marker, styles_marker + v43_styles, 1)

INDEX.write_text(text)

build = BUILD.read_text()
build = re.sub(
    r"// v0\.42:.*?\nexport const DETOUR_BUILD_VERSION = '0\.42\.0';",
    "// v0.43: custom Mood glyphs, memory-first journey review, and separate developer tools.\nexport const DETOUR_BUILD_VERSION = '0.43.0';",
    build,
    count=1,
)
BUILD.write_text(build)

foundation = FOUNDATION.read_text().rstrip() + r'''

## v0.43 — UI convergence

- Mood icons are a DETOUR-owned geometric system. Do not use emoji, Unicode pictograms, or platform-dependent symbols as the primary artwork.
- Journey review is a memory page, not a diagnostics report: lead with the photo and destination, keep route information compact, and never show an empty map rectangle.
- Mission rows in Journey Review use large readable titles and show the matching mission photo when one exists.
- Developer-tool visibility and Indoor Test are separate states. Consumer Settings never exposes prototype, AI, or playtest controls unless developer tools have explicitly been unlocked.
- Indoor Test remains a developer toggle and may stay on or off independently of whether the developer-tool panel is currently visible.
'''
FOUNDATION.write_text(foundation + '\n')

# Invariants that should remain true after migration.
assert 'function moodSymbol(' not in text
assert '<MoodGlyph moodId={item.id} active={active} />' in text
assert 'developerToolsUnlocked' in text
assert 'onLongPress={toggleDeveloperTools}' in text
assert 'postcardMapShell' not in text[text.index("{stage === 'passportDetail'"):text.index('</Animated.View>', text.index("{stage === 'passportDetail'"))]
assert 'v43MemoryCard' in text
assert 'v42TicketFlowScreen' in text
