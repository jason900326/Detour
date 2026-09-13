from pathlib import Path
import re

path = Path('src/app/index.tsx')
text = path.read_text(encoding='utf-8')


def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)


once(
"""const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走走', code: 'WANDER' },
  { id: 'food', label: '吃點東西', code: 'FOOD' },
  { id: 'quiet', label: '放鬆一下', code: 'QUIET' },
  { id: 'weird', label: '探索新鮮', code: 'WEIRD' },
  { id: 'color', label: '拍照走走', code: 'COLOR' },
  { id: 'surprise', label: '交給驚喜', code: 'SURPRISE' },
];""",
"""const MOODS: Array<{ id: MoodId; label: string; code: string }> = [
  { id: 'wander', label: '隨便走', code: 'WANDER' },
  { id: 'food', label: '吃東西', code: 'FOOD' },
  { id: 'quiet', label: '想安靜', code: 'QUIET' },
  { id: 'weird', label: '這是哪', code: 'WEIRD' },
  { id: 'color', label: '色色的', code: 'COLOR' },
  { id: 'surprise', label: '命運', code: 'SURPRISE' },
];""",
'Mood labels')

once(
"""type DetourTicketProps = {
  timeLabel: string;
  moodLabel: string;
  serial: string;""",
"""type DetourTicketProps = {
  timeLabel: string;
  moodLabel: string;
  moodId?: MoodId;
  serial: string;""",
'Ticket props')

once(
"""function V45MoodIcon({ moodId }: { moodId: MoodId }) {
  const commonProps = { width: 76, height: 76 };""",
"""function V45MoodIcon({ moodId, size = 76 }: { moodId: MoodId; size?: number }) {
  const commonProps = { width: size, height: size };""",
'Mood icon sizing')

new_ticket = r'''function V45Ticket({
  timeLabel,
  moodLabel,
  moodId = 'wander',
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
    <View style={styles.v46TicketPaper}>
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`v46-left-${top}`} style={[styles.v46TicketEdgeCut, styles.v46TicketEdgeLeft, { top }]} />
      ))}
      {DETOUR_TICKET_EDGE.map((top) => (
        <View key={`v46-right-${top}`} style={[styles.v46TicketEdgeCut, styles.v46TicketEdgeRight, { top }]} />
      ))}

      <View style={styles.v46TicketOrangeBand} />
      <Text style={styles.v46TicketBrand}>DETOUR</Text>
      <View style={styles.v46TicketRule} />

      <View style={styles.v46TicketInfoRow}>
        <View style={styles.v46TicketInfoBlock}>
          <Text style={styles.v46TicketLabel}>旅程時間</Text>
          <View style={styles.v46TicketMinutesRow}>
            <Text style={styles.v46TicketMinutes}>{timeLabel}</Text>
            <Text style={styles.v46TicketMinutesUnit}>分鐘</Text>
          </View>
        </View>
        <View style={styles.v46TicketVerticalRule} />
        <View style={styles.v46TicketInfoBlock}>
          <Text style={styles.v46TicketLabel}>此趟心情</Text>
          <View style={styles.v46TicketMoodRow}>
            <View style={styles.v46TicketMoodIcon}>
              <V45MoodIcon moodId={moodId} size={40} />
            </View>
            <Text style={styles.v46TicketMood}>{moodLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.v46TicketRule} />
      <View style={styles.v46TicketDestinationRow}>
        <View style={styles.v46TicketDestinationCopy}>
          <Text style={styles.v46TicketLabel}>目的地</Text>
          <View style={styles.v46TicketUnknownRow}>
            <View style={styles.v46TicketPin}><View style={styles.v46TicketPinCore} /></View>
            <Text style={styles.v46TicketUnknown}>???</Text>
          </View>
        </View>
        <View style={styles.v46TicketRouteMini}>
          <View style={styles.v46TicketMiniBuilding} />
          <View style={styles.v46TicketMiniTreeCrown} />
          <View style={styles.v46TicketMiniTreeTrunk} />
          <View style={[styles.v46TicketRouteDash, styles.v46TicketRouteDashA]} />
          <View style={[styles.v46TicketRouteDash, styles.v46TicketRouteDashB]} />
          <View style={[styles.v46TicketRouteDot, styles.v46TicketRouteDotA]} />
          <View style={[styles.v46TicketRouteDot, styles.v46TicketRouteDotB]} />
          <View style={styles.v46TicketRouteFlagPole} />
          <View style={styles.v46TicketRouteFlag} />
        </View>
      </View>

      <View style={styles.v46TicketRule} />
      <View style={styles.v46BarcodeRow}>
        {DETOUR_TICKET_BARS.concat(DETOUR_TICKET_BARS.slice(0, 9)).map((width, index) => (
          <View key={`${width}-${index}`} style={[styles.v46BarcodeBar, { width: Math.max(1, width) }]} />
        ))}
      </View>

      {stamped && (
        <Animated.View style={[styles.v46TicketStamp, stampAnimatedStyle]}>
          <Text style={styles.v46TicketStampText}>終點保密</Text>
        </Animated.View>
      )}
    </View>
  );
}'''

pattern = r"function V45Ticket\(\{.*?\n\}\n\nfunction V45SharePoster"
match = re.search(pattern, text, flags=re.S)
if not match:
    raise SystemExit('V45Ticket function: no match')
text = text[:match.start()] + new_ticket + '\n\nfunction V45SharePoster' + text[match.end():]

old_call = """moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}"""
if text.count(old_call) != 2:
    raise SystemExit(f'Ticket calls: expected 2, got {text.count(old_call)}')
text = text.replace(
    old_call,
    """moodLabel={mood?.label ?? '—'}
                    moodId={selectedMood ?? 'wander'}
                    serial={ticketSerial(selectedTime, selectedMood)}""")

new_stage = r'''            <View style={styles.v46PrinterStage}>
              <Animated.View
                style={[
                  styles.v46PaperReveal,
                  {
                    height: routeProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 432],
                    }),
                  },
                ]}
              >
                <V45Ticket
                  timeLabel={selectedTime ?? '15'}
                  moodLabel={mood?.label ?? '—'}
                  moodId={selectedMood ?? 'wander'}
                  serial={ticketSerial(selectedTime, selectedMood)}
                />
              </Animated.View>

              <View style={styles.v46PrinterMachine}>
                <View pointerEvents="none" style={styles.v46PrinterMetalHighlight} />
                <View pointerEvents="none" style={styles.v46PrinterMetalShade} />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.v46PrinterGlow,
                    {
                      opacity: printerPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.06, 0.2],
                      }),
                    },
                  ]}
                />
                <View style={styles.v46PrinterSlotFrame}>
                  <View style={styles.v46PrinterSlotInner} />
                  <View pointerEvents="none" style={styles.v46PrinterSlotSheen} />
                </View>
              </View>
            </View>'''

stage_pattern = r"            <View style=\{styles\.v45PrinterStage\}>.*?\n            </View>\n\n            \{ticketBuildError"
match = re.search(stage_pattern, text, flags=re.S)
if not match:
    raise SystemExit('Printer stage: no match')
text = text[:match.start()] + new_stage + '\n\n            {ticketBuildError' + text[match.end():]

skyline_anchor = """            )}
            <V45Skyline />
          </View>
        )}

        {stage === 'ready'"""
if text.count(skyline_anchor) != 1:
    raise SystemExit(f'Preparing skyline: expected 1, got {text.count(skyline_anchor)}')
text = text.replace(
    skyline_anchor,
    """            )}
          </View>
        )}

        {stage === 'ready'""",
    1)

styles = r'''

  // v0.45.2 — approved Mood reference + physical ticket printer
  v46PrinterStage: {
    marginTop: 34,
    height: 510,
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  v46PrinterMachine: {
    position: 'absolute', top: 0, width: '100%', height: 108, borderRadius: 20,
    backgroundColor: '#96938D', borderWidth: 1, borderColor: '#BBB8B0',
    paddingHorizontal: 20, justifyContent: 'center', zIndex: 6, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.22,
    shadowRadius: 13, elevation: 9,
  },
  v46PrinterMetalHighlight: {
    position: 'absolute', left: 18, right: 18, top: 8, height: 2,
    borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.46)',
  },
  v46PrinterMetalShade: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 25,
    backgroundColor: 'rgba(42,40,37,0.14)',
  },
  v46PrinterGlow: {
    position: 'absolute', left: 24, right: 24, top: 39, height: 34,
    borderRadius: 12, backgroundColor: SIGNAL,
  },
  v46PrinterSlotFrame: {
    height: 31, borderRadius: 10, padding: 5, backgroundColor: '#4C4A46',
    borderWidth: 1, borderColor: '#6B6862', shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.34, shadowRadius: 4, elevation: 4,
  },
  v46PrinterSlotInner: { flex: 1, borderRadius: 5, backgroundColor: '#080807' },
  v46PrinterSlotSheen: {
    position: 'absolute', left: 10, right: 10, top: 5, height: 2,
    borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  v46PaperReveal: {
    position: 'absolute', top: 62, width: '86%', overflow: 'hidden',
    alignItems: 'center', zIndex: 3,
  },
  v46TicketPaper: {
    width: '100%', height: 432, backgroundColor: '#FCF8EE', paddingHorizontal: 24,
    paddingTop: 48, paddingBottom: 16, borderRadius: 2, position: 'relative',
    overflow: 'hidden', borderWidth: 1, borderColor: '#E2DBCF', shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  v46TicketEdgeCut: {
    position: 'absolute', width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#F5F1E8', zIndex: 4,
  },
  v46TicketEdgeLeft: { left: -7 },
  v46TicketEdgeRight: { right: -7 },
  v46TicketOrangeBand: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 37, backgroundColor: SIGNAL,
  },
  v46TicketBrand: {
    fontSize: 30, lineHeight: 33, fontWeight: '900', letterSpacing: -1.5, color: INK,
  },
  v46TicketRule: { height: 1, backgroundColor: '#C8C0B3', marginVertical: 11, opacity: 0.82 },
  v46TicketInfoRow: { minHeight: 106, flexDirection: 'row', alignItems: 'stretch' },
  v46TicketInfoBlock: { flex: 1, justifyContent: 'center' },
  v46TicketVerticalRule: { width: 1, marginHorizontal: 13, backgroundColor: '#D1C9BB' },
  v46TicketLabel: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: INK },
  v46TicketMinutesRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  v46TicketMinutes: {
    fontSize: 61, lineHeight: 65, fontWeight: '900', color: SIGNAL, letterSpacing: -3,
  },
  v46TicketMinutesUnit: {
    fontSize: 16, lineHeight: 25, fontWeight: '900', color: INK, marginLeft: 5, marginBottom: 5,
  },
  v46TicketMoodRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  v46TicketMoodIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  v46TicketMood: { flexShrink: 1, fontSize: 21, lineHeight: 27, fontWeight: '900', color: INK },
  v46TicketDestinationRow: {
    minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  v46TicketDestinationCopy: { minWidth: 112 },
  v46TicketUnknownRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 9 },
  v46TicketPin: {
    width: 25, height: 25, borderRadius: 13, backgroundColor: SIGNAL,
    alignItems: 'center', justifyContent: 'center',
  },
  v46TicketPinCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FCF8EE' },
  v46TicketUnknown: { fontSize: 29, lineHeight: 32, fontWeight: '900', color: INK, letterSpacing: 1 },
  v46TicketRouteMini: { width: 124, height: 62, position: 'relative' },
  v46TicketMiniBuilding: {
    position: 'absolute', left: 7, bottom: 12, width: 16, height: 24, backgroundColor: INK,
  },
  v46TicketMiniTreeCrown: {
    position: 'absolute', left: 63, bottom: 23, width: 17, height: 17,
    borderRadius: 9, backgroundColor: INK,
  },
  v46TicketMiniTreeTrunk: {
    position: 'absolute', left: 70, bottom: 12, width: 3, height: 15, backgroundColor: INK,
  },
  v46TicketRouteDash: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: SIGNAL },
  v46TicketRouteDashA: { left: 24, bottom: 22, width: 37, transform: [{ rotate: '22deg' }] },
  v46TicketRouteDashB: { left: 76, bottom: 21, width: 28, transform: [{ rotate: '-20deg' }] },
  v46TicketRouteDot: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    backgroundColor: SIGNAL, borderWidth: 2, borderColor: '#FCF8EE',
  },
  v46TicketRouteDotA: { left: 24, bottom: 16 },
  v46TicketRouteDotB: { right: 8, bottom: 18 },
  v46TicketRouteFlagPole: {
    position: 'absolute', right: 10, bottom: 21, width: 3, height: 28,
    backgroundColor: INK, transform: [{ rotate: '5deg' }],
  },
  v46TicketRouteFlag: {
    position: 'absolute', right: -1, bottom: 37, width: 18, height: 12,
    backgroundColor: SIGNAL, transform: [{ rotate: '8deg' }],
  },
  v46BarcodeRow: {
    height: 39, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: 3,
  },
  v46BarcodeBar: { height: 39, backgroundColor: '#4E4B46' },
  v46TicketStamp: {
    position: 'absolute', right: 17, top: 133, width: 86, height: 40,
    borderWidth: 3, borderColor: SIGNAL, borderRadius: 5, alignItems: 'center',
    justifyContent: 'center', transform: [{ rotate: '-7deg' }],
    backgroundColor: 'rgba(252,248,238,0.9)',
  },
  v46TicketStampText: { fontSize: 15, fontWeight: '900', color: SIGNAL },
'''

end = text.rfind('\n});')
if end < 0:
    raise SystemExit('StyleSheet end not found')
text = text[:end] + styles + text[end:]
path.write_text(text, encoding='utf-8')

build_path = Path('src/lib/build-info.ts')
build = build_path.read_text(encoding='utf-8')
if "DETOUR_BUILD_VERSION = '0.45.1'" not in build:
    raise SystemExit('Unexpected build version')
build = re.sub(
    r"// v0\.45\.1:.*?\nexport const DETOUR_BUILD_VERSION = '0\.45\.1';",
    "// v0.45.2: Approved Mood labels/icons and physical printer-ticket relationship.\nexport const DETOUR_BUILD_VERSION = '0.45.2';",
    build,
    count=1)
build_path.write_text(build, encoding='utf-8')
print('Applied approved Mood labels and physical ticket printer.')
