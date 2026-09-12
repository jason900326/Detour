from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch target: {label}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, new: str, label: str, flags=0) -> str:
    next_text, count = re.subn(pattern, new, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"missing/ambiguous patch target: {label} ({count})")
    return next_text


# ---------------------------------------------------------------------------
# src/app/index.tsx
# ---------------------------------------------------------------------------
p = Path("src/app/index.tsx")
s = p.read_text()

s = replace_once(
    s,
    "import MapView, { Circle, Polyline } from 'react-native-maps';\n",
    "import MapView, { Circle, Polyline } from 'react-native-maps';\nimport { captureRef } from 'react-native-view-shot';\n",
    "view-shot import",
)

s = regex_once(
    s,
    r"const MOODS: Array<\{ id: MoodId; label: string; code: string \}> = \[.*?\n\];",
    """const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走走', code: 'WANDER' },
  { id: 'food', label: '吃點東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜一下', code: 'QUIET' },
  { id: 'weird', label: '奇怪一點', code: 'WEIRD' },
  { id: 'surprise', label: '隨機帶我走', code: 'SURPRISE' },
];""",
    "mood list",
    re.S,
)

s = regex_once(
    s,
    r"function moodSymbol\(moodId: MoodId\) \{.*?\n\}",
    """function moodSymbol(moodId: MoodId) {
  if (moodId === 'wander') return '↗';
  if (moodId === 'food') return '♨';
  if (moodId === 'quiet') return '☾';
  if (moodId === 'weird') return '?';
  return '✦';
}""",
    "mood symbols",
    re.S,
)

s = regex_once(
    s,
    r"function getFilmRollCapacity\(minutes: number\) \{.*?\n\}",
    """function getFilmRollCapacity(_minutes: number) {
  // Every DETOUR keeps one small roll. Camera-first Side Quests plus the
  // arrival frame are designed to fit inside these six intentional photos.
  return 6;
}""",
    "film roll capacity",
    re.S,
)

s = replace_once(
    s,
    "  const [passportPhotoIndex, setPassportPhotoIndex] = useState(0);\n",
    "  const [passportPhotoIndex, setPassportPhotoIndex] = useState(0);\n  const [passportZoomUri, setPassportZoomUri] = useState<string | null>(null);\n",
    "passport zoom state",
)

s = replace_once(
    s,
    "  const prewarmInFlightRef = useRef(false);\n",
    "  const prewarmInFlightRef = useRef(false);\n  const shareTicketRef = useRef<any>(null);\n",
    "share ticket ref",
)

s = replace_once(
    s,
    "<Text style={styles.v35MoodTitle}>今天想要哪種心情？</Text>",
    "<Text style={styles.v35MoodTitle}>這次想怎麼晃？</Text>",
    "mood page title",
)

s = replace_once(
    s,
    "style={({ pressed }) => [styles.v35MoodCard, active && styles.v35MoodCardActive, pressed && styles.v35Pressed]}",
    "style={({ pressed }) => [styles.v35MoodCard, item.id === 'surprise' && styles.v38MoodWide, active && styles.v35MoodCardActive, pressed && styles.v35Pressed]}",
    "surprise mood card width",
)

old_share = """  async function shareJourney(entry: PassportEntry) {
    const message = [
      `DETOUR · ${entry.city}`,
      `${formatPassportDate(entry.completedAt)} · ${entry.minutes} 分鐘`,
      entry.sceneName ? `終點：${entry.sceneName}` : null,
      `${entry.photoCount ?? 0} 張照片 · ${entry.discoveries} 個任務`,
    ]
      .filter(Boolean)
      .join('\\n');

    const firstPhoto = entry.photos?.[0]?.uri;

    await Share.share({
      title: '分享這趟 DETOUR',
      message,
      ...(firstPhoto ? { url: firstPhoto } : {}),
    });
  }
"""
new_share = """  async function shareJourney(entry: PassportEntry) {
    const message = [
      'DETOUR JOURNEY TICKET',
      entry.sceneName ? `終點：${entry.sceneName}` : null,
      `${formatPassportDate(entry.completedAt)} · ${entry.minutes} 分鐘`,
    ]
      .filter(Boolean)
      .join('\\n');

    try {
      const ticketUri = await captureRef(shareTicketRef, {
        format: 'jpg',
        quality: 0.94,
        result: 'tmpfile',
      });

      await Share.share({
        title: '分享這趟 DETOUR',
        message,
        url: ticketUri,
      });
    } catch {
      // Sharing should still work even if a device cannot capture the card.
      await Share.share({
        title: '分享這趟 DETOUR',
        message,
      });
    }
  }
"""
s = replace_once(s, old_share, new_share, "share journey as ticket")

old_hero = """                  <Image source={{ uri: selectedPassportEntry.photos[Math.min(passportPhotoIndex, selectedPassportEntry.photos.length - 1)].uri }} style={styles.v35ReviewHeroPhoto} resizeMode=\"cover\" />"""
new_hero = """                  <Pressable
                    accessibilityLabel=\"放大檢視照片\"
                    onPress={() =>
                      setPassportZoomUri(
                        selectedPassportEntry.photos![
                          Math.min(
                            passportPhotoIndex,
                            selectedPassportEntry.photos!.length - 1
                          )
                        ].uri
                      )
                    }
                    style={({ pressed }) => [pressed && styles.v38PhotoPressed]}
                  >
                    <Image
                      source={{ uri: selectedPassportEntry.photos[Math.min(passportPhotoIndex, selectedPassportEntry.photos.length - 1)].uri }}
                      style={styles.v35ReviewHeroPhoto}
                      resizeMode=\"cover\"
                    />
                    <View style={styles.v38ZoomBadge}>
                      <Text style={styles.v38ZoomBadgeText}>點一下放大</Text>
                    </View>
                  </Pressable>"""
s = replace_once(s, old_hero, new_hero, "passport hero zoom trigger")

old_share_button = """              <Pressable onPress={() => shareJourney(selectedPassportEntry)} style={({ pressed }) => [styles.v35ReviewShare, pressed && styles.v35TicketButtonPressed]}>
                <Text style={styles.v35ReviewShareIcon}>↥</Text><Text style={styles.v35ReviewShareText}>分享這趟旅程</Text>
              </Pressable>
"""
new_share_button = """              <View style={styles.v38ShareSection}>
                <Text style={styles.v38SharePreviewLabel}>分享預覽</Text>
                <View
                  ref={shareTicketRef}
                  collapsable={false}
                  style={styles.v38ShareTicket}
                >
                  <View style={styles.v38ShareSignal} />
                  <View style={styles.v38ShareTicketHead}>
                    <View>
                      <Text style={styles.v38ShareBrand}>DETOUR</Text>
                      <Text style={styles.v38ShareMicro}>JOURNEY TICKET</Text>
                    </View>
                    <Text style={styles.v38ShareSerial}>
                      {String(selectedPassportEntry.id).slice(-8).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.v38ShareDash} />

                  <Text style={styles.v38ShareDestinationLabel}>DESTINATION</Text>
                  <Text style={styles.v38ShareDestination} numberOfLines={2}>
                    {selectedPassportEntry.sceneName ?? selectedPassportEntry.city ?? 'DETOUR'}
                  </Text>

                  {selectedPassportEntry.photos?.[0]?.uri ? (
                    <Image
                      source={{ uri: selectedPassportEntry.photos[0].uri }}
                      style={styles.v38SharePhoto}
                      resizeMode=\"cover\"
                    />
                  ) : (
                    <View style={styles.v38ShareNoPhoto}>
                      <Text style={styles.v38ShareNoPhotoMark}>● ───────── ⚑</Text>
                    </View>
                  )}

                  <View style={styles.v38ShareRouteRow}>
                    <View style={styles.v38ShareRouteStart} />
                    <View style={styles.v38ShareRouteLine} />
                    <Text style={styles.v38ShareRouteFlag}>⚑</Text>
                  </View>

                  <View style={styles.v38ShareFacts}>
                    <View style={styles.v38ShareFact}>
                      <Text style={styles.v38ShareFactLabel}>TIME</Text>
                      <Text style={styles.v38ShareFactValue}>{selectedPassportEntry.minutes} MIN</Text>
                    </View>
                    <View style={styles.v38ShareFact}>
                      <Text style={styles.v38ShareFactLabel}>MOOD</Text>
                      <Text style={styles.v38ShareFactValue}>{selectedPassportEntry.moodLabel}</Text>
                    </View>
                    <View style={styles.v38ShareFact}>
                      <Text style={styles.v38ShareFactLabel}>DATE</Text>
                      <Text style={styles.v38ShareFactValue}>{formatPassportDate(selectedPassportEntry.completedAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.v38ShareDash} />
                  <View style={styles.v38ShareFoot}>
                    <Text style={styles.v38ShareFootText}>KEEP THIS DETOUR</Text>
                    <Text style={styles.v38ShareFootText}>{selectedPassportEntry.discoveries} QUESTS</Text>
                  </View>
                </View>
              </View>

              <Pressable onPress={() => shareJourney(selectedPassportEntry)} style={({ pressed }) => [styles.v35ReviewShare, pressed && styles.v35TicketButtonPressed]}>
                <Text style={styles.v35ReviewShareIcon}>↥</Text><Text style={styles.v35ReviewShareText}>分享車票</Text>
              </Pressable>
"""
s = replace_once(s, old_share_button, new_share_button, "share ticket preview")

old_root_close = """      </Animated.View>
    </View>
  );
}
"""
new_root_close = """      </Animated.View>

      <Modal
        visible={Boolean(passportZoomUri)}
        transparent={false}
        animationType=\"fade\"
        onRequestClose={() => setPassportZoomUri(null)}
      >
        <View style={styles.v38ZoomScreen}>
          <StatusBar barStyle=\"light-content\" />
          <ScrollView
            style={styles.v38ZoomScroll}
            contentContainerStyle={styles.v38ZoomContent}
            minimumZoomScale={1}
            maximumZoomScale={4}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {passportZoomUri && (
              <Image
                source={{ uri: passportZoomUri }}
                style={styles.v38ZoomImage}
                resizeMode=\"contain\"
              />
            )}
          </ScrollView>
          <Pressable
            onPress={() => setPassportZoomUri(null)}
            style={styles.v38ZoomClose}
            hitSlop={12}
          >
            <Text style={styles.v38ZoomCloseText}>×</Text>
          </Pressable>
          <Text style={styles.v38ZoomHint}>雙指縮放</Text>
        </View>
      </Modal>
    </View>
  );
}
"""
s = replace_once(s, old_root_close, new_root_close, "photo zoom modal")

styles = """

  // v0.38 — five clearer moods; surprise gets the last full-width beat.
  v38MoodWide: {
    width: '100%',
    minHeight: 126,
  },

  v38PhotoPressed: {
    opacity: 0.82,
  },
  v38ZoomBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(17,17,15,0.78)',
  },
  v38ZoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BONE,
  },
  v38ZoomScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  v38ZoomScroll: {
    flex: 1,
  },
  v38ZoomContent: {
    flexGrow: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ZoomImage: {
    width: '100%',
    height: '100%',
    minHeight: 620,
  },
  v38ZoomClose: {
    position: 'absolute',
    top: 58,
    left: 22,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(17,17,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ZoomCloseText: {
    fontSize: 30,
    lineHeight: 32,
    color: BONE,
  },
  v38ZoomHint: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(241,239,231,0.78)',
  },

  v38ShareSection: {
    marginTop: 34,
  },
  v38SharePreviewLabel: {
    marginBottom: 12,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: MUTED,
  },
  v38ShareTicket: {
    width: '100%',
    minHeight: 570,
    padding: 24,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#CFC8B8',
    position: 'relative',
    overflow: 'hidden',
  },
  v38ShareSignal: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 10,
    backgroundColor: SIGNAL,
  },
  v38ShareTicketHead: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  v38ShareBrand: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 2,
    color: INK,
  },
  v38ShareMicro: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: SIGNAL,
  },
  v38ShareSerial: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },
  v38ShareDash: {
    marginVertical: 18,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BEB7A8',
  },
  v38ShareDestinationLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2,
    color: MUTED,
  },
  v38ShareDestination: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: INK,
  },
  v38SharePhoto: {
    marginTop: 18,
    width: '100%',
    height: 205,
    borderRadius: 4,
    backgroundColor: SOFT,
  },
  v38ShareNoPhoto: {
    marginTop: 18,
    height: 205,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ShareNoPhotoMark: {
    fontSize: 20,
    color: SIGNAL,
  },
  v38ShareRouteRow: {
    marginTop: 20,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v38ShareRouteStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },
  v38ShareRouteLine: {
    flex: 1,
    height: 3,
    marginLeft: 5,
    backgroundColor: SIGNAL,
  },
  v38ShareRouteFlag: {
    marginLeft: 6,
    fontSize: 25,
    color: SIGNAL,
  },
  v38ShareFacts: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  v38ShareFact: {
    flex: 1,
  },
  v38ShareFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },
  v38ShareFactValue: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    color: INK,
  },
  v38ShareFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v38ShareFootText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },
"""
idx = s.rfind("\n});")
if idx < 0:
    raise SystemExit("missing final StyleSheet terminator")
s = s[:idx] + styles + s[idx:]
p.write_text(s)


# ---------------------------------------------------------------------------
# src/app/camera.tsx
# ---------------------------------------------------------------------------
p = Path("src/app/camera.tsx")
s = p.read_text()

s = replace_once(
    s,
    "function clampZoom(value: number) { return Math.min(1, Math.max(0, value)); }\nfunction touchDistance",
    "const MAX_DIGITAL_ZOOM = 0.48;\nfunction clampZoom(value: number) { return Math.min(MAX_DIGITAL_ZOOM, Math.max(0, value)); }\nfunction touchDistance",
    "camera zoom cap",
)

s = replace_once(
    s,
    "function lensLabel(lens: string) { if (lens.includes('UltraWide')) return '0.5×'; if (lens.includes('WideAngle')) return '1×'; if (lens.includes('Telephoto')) return '望遠'; return '鏡頭'; }\nfunction lensPriority(lens: string) { if (lens.includes('UltraWide')) return 0; if (lens.includes('WideAngle')) return 1; if (lens.includes('Telephoto')) return 2; return 9; }",
    "function lensLabel(lens: string) { const key = lens.toLowerCase(); if (key.includes('ultrawide')) return '0.5×'; if (key.includes('wideangle')) return '1×'; if (key.includes('telephoto')) return '望遠'; return '鏡頭'; }\nfunction lensPriority(lens: string) { const key = lens.toLowerCase(); if (key.includes('ultrawide')) return 0; if (key.includes('wideangle')) return 1; if (key.includes('telephoto')) return 2; return 9; }",
    "camera lens helpers",
)

s = regex_once(
    s,
    r"  async function refreshAvailableLenses\(\) \{.*?\n  \}",
    """  async function refreshAvailableLenses() {
    // Expo Camera's native default is the 1× wide camera. Keep that default
    // unless the device explicitly reports a physical lens we can identify.
    setZoom(0);

    if (Platform.OS !== 'ios' || facing !== 'back' || !cameraRef.current) {
      setAvailableLenses([]);
      setSelectedLens(undefined);
      return;
    }

    try {
      const lenses = (await cameraRef.current.getAvailableLensesAsync()) as string[];
      const physical = lenses
        .filter((lens) => {
          const key = lens.toLowerCase();
          return key.includes('ultrawide') || key.includes('wideangle') || key.includes('telephoto');
        })
        .sort((a, b) => lensPriority(a) - lensPriority(b));
      const normalized = Array.from(new Set(physical));
      setAvailableLenses(normalized);

      const mainWide = normalized.find((lens) => {
        const key = lens.toLowerCase();
        return key.includes('wideangle') && !key.includes('ultrawide');
      });

      // Never fall back to the first reported physical lens: some iPhones
      // report tele/ultra-wide first. Undefined safely uses Expo's 1× default.
      setSelectedLens(mainWide);
    } catch {
      setAvailableLenses([]);
      setSelectedLens(undefined);
      setZoom(0);
    }
  }""",
    "camera lens refresh",
    re.S,
)

s = replace_once(
    s,
    "  function handlePinchMove(touches: readonly { pageX: number; pageY: number }[]) { if (touches.length < 2 || !pinchActiveRef.current || pinchStartDistanceRef.current <= 0) return; const distance = touchDistance(touches); if (distance <= 0) return; const ratio = distance / pinchStartDistanceRef.current; const delta = Math.log2(Math.max(0.35, ratio)) * 0.18; setZoom(clampZoom(pinchStartZoomRef.current + delta)); }",
    "  function handlePinchMove(touches: readonly { pageX: number; pageY: number }[]) { if (touches.length < 2 || !pinchActiveRef.current || pinchStartDistanceRef.current <= 0) return; const distance = touchDistance(touches); if (distance <= 0) return; const ratio = distance / pinchStartDistanceRef.current; const delta = Math.log2(Math.max(0.35, ratio)) * 0.24; setZoom(clampZoom(pinchStartZoomRef.current + delta)); }",
    "camera pinch sensitivity",
)

s = replace_once(
    s,
    "    <View style={styles.cameraScreen}>",
    """    <View
      style={styles.cameraScreen}
      onTouchStart={(event) => handlePinchStart(event.nativeEvent.touches)}
      onTouchMove={(event) => handlePinchMove(event.nativeEvent.touches)}
      onTouchEnd={(event) => {
        if (event.nativeEvent.touches.length < 2) handlePinchEnd();
      }}
      onTouchCancel={handlePinchEnd}
    >""",
    "camera root pinch handlers",
)

s = replace_once(
    s,
    "        onCameraReady={() => { setCameraReady(true); setMountError(null); void refreshAvailableLenses(); }}",
    "        onCameraReady={() => { setZoom(0); setCameraReady(true); setMountError(null); void refreshAvailableLenses(); }}",
    "camera reset zoom on ready",
)

s = regex_once(
    s,
    r"\n      <View style=\{styles\.pinchSurface\}.*?/>",
    "",
    "remove pinch blocker",
)

p.write_text(s)


# ---------------------------------------------------------------------------
# src/lib/journey-engine.ts — unified camera-first Side Quest grammar
# ---------------------------------------------------------------------------
p = Path("src/lib/journey-engine.ts")
s = p.read_text()

s = replace_once(
    s,
    "else { targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18); sideMissionCount = 6; }",
    "else { targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18); sideMissionCount = 5; }",
    "mission count max five",
)

camera_pool = r'''

function cameraFirstSideMissions(context: LightContext): Mission[] {
  const nightNote = context === 'night'
    ? '留在有照明、公開可走的位置。'
    : '';

  return withIds('camera-first', [
    {
      code: 'RED HIT',
      family: 'visual',
      title: '拍一個紅色。',
      instruction: `${nightNote} 不用找漂亮的；沿主線看到一個清楚的紅色物件就拍。`,
      completion: '照片裡有一個明確的紅色物件。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE CIRCLE',
      family: 'pattern',
      title: '拍一個圓形。',
      instruction: `${nightNote} 招牌、輪子、蓋子、燈或圖案都可以；只要一眼看得出是圓的。`,
      completion: '拍到一個清楚的圓形。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE NUMBER',
      family: 'count',
      title: '拍一個數字。',
      instruction: `${nightNote} 門牌、路牌、價目、標示都可以；看到第一個清楚的數字就拍。`,
      completion: '照片裡有一個讀得出的數字。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE ARROW',
      family: 'perspective',
      title: '拍一個箭頭。',
      instruction: `${nightNote} 地面、路牌、貼紙或標示都算；不要為了找它繞路。`,
      completion: '照片裡有一個清楚的箭頭。',
      photo: true,
      portable: true,
    },
    {
      code: 'BLUE HIT',
      family: 'contrast',
      title: '拍一個藍色。',
      instruction: `${nightNote} 只選一個明顯的藍色物件，不用安排構圖。`,
      completion: '照片裡有一個明確的藍色物件。',
      photo: true,
      portable: true,
    },
    {
      code: 'TWO SAME',
      family: 'framing',
      title: '把兩個一樣的東西拍在一起。',
      instruction: `${nightNote} 兩張椅子、兩個盆栽、兩扇窗、兩個路樁都可以。`,
      completion: '同一張照片裡看得到兩個相同或幾乎相同的東西。',
      photo: true,
      portable: true,
    },
    {
      code: 'UTILITY BOX',
      family: 'texture',
      title: '拍一個電箱。',
      instruction: `${nightNote} 找路邊公開可見的配電箱、控制箱或金屬設備箱。找不到就直接跳過。`,
      completion: '拍到一個箱型的公共設備。',
      photo: true,
      portable: true,
    },
    {
      code: 'MANHOLE',
      family: 'boundary',
      title: '拍一個人孔蓋。',
      instruction: `${nightNote} 不用走到馬路中央；只拍安全可見的人孔蓋或排水蓋。找不到就跳過。`,
      completion: '拍到一個地面金屬蓋。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE STICKER',
      family: 'mystery',
      title: '拍一張貼紙。',
      instruction: `${nightNote} 只拍公共可見、已經貼著的貼紙；不要撕、不要碰。`,
      completion: '照片裡有一張清楚的貼紙。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE TRIANGLE',
      family: 'scale',
      title: '拍一個三角形。',
      instruction: `${nightNote} 標誌、屋頂、支架、圖案都可以。`,
      completion: '照片裡有一個一眼能認出的三角形。',
      photo: true,
      portable: true,
    },
    {
      code: 'WHITE HIT',
      family: 'visual',
      title: '拍一個白色。',
      instruction: `${nightNote} 找一個清楚的白色物件，第一個合格的就拍。`,
      completion: '照片裡有一個明確的白色物件。',
      photo: true,
      portable: true,
    },
    {
      code: 'STRAIGHT LINE',
      family: 'pattern',
      title: '拍一條很直的線。',
      instruction: `${nightNote} 牆邊、欄杆、磁磚縫、路面標線都可以。`,
      completion: '照片裡有一條明確的直線。',
      photo: true,
      portable: true,
    },
  ]);
}
'''
marker = "\n\nexport type MissionFamily ="
if marker not in s:
    raise SystemExit("missing MissionFamily marker")
s = s.replace(marker, camera_pool + marker, 1)

s = replace_once(
    s,
    "function missionFamily(mission: Mission): MissionFamily {\n  if (mission.photo) return 'photo';",
    "function missionFamily(mission: Mission): MissionFamily {\n  if (mission.family) return mission.family;\n  if (mission.photo) return 'photo';",
    "explicit mission family",
)

s = regex_once(
    s,
    r"  let unique: Mission\[\];\n\n  if \(args\.moodId === 'food'\) \{.*?\n    unique = selectVariedMissions\(\n      pool,\n      profile\.sideMissionCount\n    \);\n  \}",
    """  // v0.38 mission rule: mood changes the destination taste, not the
  // basic Side Quest grammar. Every Side Quest is a quick, concrete camera
  // prompt so the user naturally returns with a small visual record.
  const unique = selectVariedMissions(
    cameraFirstSideMissions(args.context),
    profile.sideMissionCount
  );""",
    "camera-first build plan",
    re.S,
)

p.write_text(s)


# ---------------------------------------------------------------------------
# src/lib/scene-engine.ts — every Arrival is a simple photo payoff
# ---------------------------------------------------------------------------
p = Path("src/lib/scene-engine.ts")
s = p.read_text()

arrival = r'''export function buildSceneArrivalMission(args: {
  scene: SceneCandidate;
  moodId: MoodId;
  context: LightContext;
}): Mission {
  const { scene } = args;

  if (scene.kind === 'statue') {
    return {
      id: `scene-${scene.id}-statue`,
      code: 'ARRIVAL · DETAIL',
      title: '拍一個雕像細節。',
      instruction: '只選手上的東西、衣服紋路、底座文字或姿勢裡的一個，不用拍整尊。',
      completion: '照片裡只有一個清楚可辨的細節。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'mural' || scene.kind === 'street-art' || scene.kind === 'artwork') {
    return {
      id: `scene-${scene.id}-art`,
      code: 'ARRIVAL · ONE PART',
      title: '不要拍整個作品。',
      instruction: '找一個最清楚的顏色、形狀或材質細節，只拍那一小塊。',
      completion: '拍下一個你能直接指出的作品細節。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'food' || scene.kind === 'market') {
    return {
      id: `scene-${scene.id}-food`,
      code: 'ARRIVAL · PROOF',
      title: '拍下「到了」的證據。',
      instruction: `留在公開位置，把「${scene.name}」的店名、攤位名或入口標示拍進去；不用消費。`,
      completion: '照片裡看得到這個目的地的名稱或入口。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'public-bookcase') {
    return {
      id: `scene-${scene.id}-book`,
      code: 'ARRIVAL · ONE TITLE',
      title: '拍一個書名。',
      instruction: '不用翻書，只從公共可見的書脊或封面選一個清楚的書名。',
      completion: '照片裡讀得到一個書名。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'historic' || scene.kind === 'culture') {
    return {
      id: `scene-${scene.id}-culture`,
      code: 'ARRIVAL · ONE MARK',
      title: '拍一個這裡才有的標記。',
      instruction: '只看館外或公共可見範圍，找名稱、年份、符號、牌子或刻字中的一個。',
      completion: '拍下一個能辨認這個地方的文字或符號。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'heritage-tree') {
    return {
      id: `scene-${scene.id}-tree`,
      code: 'ARRIVAL · BARK',
      title: '拍一小塊樹皮。',
      instruction: '不用碰樹，也不要拍整棵；只取樹幹上一塊清楚的紋理。',
      completion: '照片裡看得到明確的樹皮紋理。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'fountain') {
    return {
      id: `scene-${scene.id}-water`,
      code: 'ARRIVAL · WATER EDGE',
      title: '拍水碰到邊緣的地方。',
      instruction: '只拍水和石頭、金屬或地面接觸的一小塊，不用拍完整噴泉。',
      completion: '照片裡同時有水和一個硬質邊緣。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'steps') {
    return {
      id: `scene-${scene.id}-steps`,
      code: 'ARRIVAL · LINES',
      title: '拍三條重複的線。',
      instruction: '留在安全位置，用階梯本身的邊緣完成，不必走完整段。',
      completion: '照片裡至少有三條重複線。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'footbridge') {
    return {
      id: `scene-${scene.id}-bridge`,
      code: 'ARRIVAL · LINE',
      title: '拍橋上最長的一條線。',
      instruction: '只在公共可走的位置找欄杆、地面或結構的一條長直線。',
      completion: '讓那條線從照片一側延伸到另一側。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'viewpoint') {
    return {
      id: `scene-${scene.id}-view`,
      code: 'ARRIVAL · NEAR / FAR',
      title: '拍一個近的，也留一個遠的。',
      instruction: '站在原地，把一個近處物件放在畫面下緣，遠方留在後面。',
      completion: '同一張照片裡明顯看得到近景和遠景。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'green-space') {
    return {
      id: `scene-${scene.id}-green`,
      code: 'ARRIVAL · GREEN',
      title: '拍一個綠色。',
      instruction: '不用走進草地；從公共路徑拍一個清楚的綠色物件或植物。',
      completion: '照片裡有一個明確的綠色主體。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'square' || scene.kind === 'pedestrian') {
    return {
      id: `scene-${scene.id}-shape`,
      code: 'ARRIVAL · SHAPE',
      title: '拍一個圓形。',
      instruction: '只看你站著就能安全看到的範圍；標誌、燈、蓋子或圖案都可以。',
      completion: '照片裡有一個清楚的圓形。',
      photo: true,
      portable: false,
    };
  }

  return {
    id: `scene-${scene.id}-arrival`,
    code: 'ARRIVAL · NUMBER',
    title: '拍一個數字。',
    instruction: '只看目的地外面或公共可見範圍；門牌、年份、標示或牌子上的數字都可以。',
    completion: '照片裡有一個讀得出的數字。',
    photo: true,
    portable: false,
  };
}
'''
start = s.find("export function buildSceneArrivalMission(args:")
if start < 0:
    raise SystemExit("missing buildSceneArrivalMission")
s = s[:start] + arrival
p.write_text(s)


# ---------------------------------------------------------------------------
# src/lib/ai-engine.ts — old deployed AI is not allowed to overwrite the new
# deterministic Arrival with listening/speaking/non-photo tasks.
# ---------------------------------------------------------------------------
p = Path("src/lib/ai-engine.ts")
s = p.read_text()

s = replace_once(
    s,
    "];\n\nasync function loadRecentAIMissions",
    "];\n\nconst NON_CAMERA_ARRIVAL_PHRASES = [\n  '說出',\n  '描述',\n  '三個詞',\n  '寫下',\n  '猜',\n  '聽',\n  '聲音',\n  '呼吸',\n  '記住',\n];\n\nasync function loadRecentAIMissions",
    "arrival banned phrases",
)

quality_marker = """  const hiddenName =
    hiddenSceneName
      .trim()
      .toLowerCase();
"""
quality_insert = """  if (!result.arrivalMission.photo) {
    return false;
  }

  const arrivalCombined =
    `${result.arrivalMission.title} ${result.arrivalMission.instruction} ${result.arrivalMission.completion}`
      .toLowerCase();

  if (
    NON_CAMERA_ARRIVAL_PHRASES.some((phrase) =>
      arrivalCombined.includes(phrase)
    )
  ) {
    return false;
  }

  const hiddenName =
    hiddenSceneName
      .trim()
      .toLowerCase();
"""
s = replace_once(s, quality_marker, quality_insert, "AI arrival camera gate")
p.write_text(s)


# ---------------------------------------------------------------------------
# backend source — keep repository rules aligned for the next Edge deploy.
# The client-side gate above protects the current deployed function meanwhile.
# ---------------------------------------------------------------------------
p = Path("backend/detour-ai/index.ts")
s = p.read_text()

s = replace_once(
    s,
    """- Prefer: counting, contrast, scale, texture, sound, movement, framing, boundaries, patterns, perspective.
- Do not require a specific object that may not exist on the route.
""",
    """- Camera-first rule: prefer one concrete, instantly recognizable visual target (a color, number, circle, arrow, repeated pair, sticker, utility box, manhole cover, simple line or shape).
- Keep each prompt simple: one target or one tiny composition rule, never an abstract interpretation.
- Do not use listening, breathing, speaking, describing, guessing, memory-only, mindfulness, or subjective ranking tasks.
- If a less-common object is requested, the app must allow a graceful skip.
""",
    "backend side quest rules",
)

s = replace_once(
    s,
    "- At most one side quest may require a photo. Photo=false is preferred.",
    "- Photo=true is the default for Side Quests. The journey should naturally return with photos rather than relying on verbal completion.",
    "backend photo preference",
)

s = replace_once(
    s,
    "- Give one concise task that makes this exact Scene worth stopping for.\n- Do not turn arrival into a history lesson.",
    "- Give one concise camera task that makes this exact Scene worth stopping for. Arrival must have photo=true.\n- Never ask the user to speak, describe in words, guess, listen, breathe, remember, or write text as the completion action.\n- Do not turn arrival into a history lesson.",
    "backend arrival rule",
)

s = replace_once(
    s,
    "\"At most one side mission may have photo=true.\",",
    "\"Side missions should be camera-first. Use photo=true and ask for one concrete visual target or one tiny composition rule.\",",
    "backend hard requirement photo",
)

s = replace_once(
    s,
    "\"Arrival must be about the supplied destination and should feel meaningfully different from the side quests.\",",
    "\"Arrival must be about the supplied destination, must have photo=true, and must never require speaking, describing, listening, guessing, breathing, remembering, or writing words.\",",
    "backend hard arrival requirement",
)
p.write_text(s)


# Versions
p = Path("src/lib/playtest-analytics.ts")
s = p.read_text().replace("'0.37.0'", "'0.38.0'", 1)
p.write_text(s)

p = Path("src/lib/build-info.ts")
s = p.read_text().replace("'0.36.0'", "'0.38.0'", 1)
p.write_text(s)

print("v0.38 camera-first patch applied")
