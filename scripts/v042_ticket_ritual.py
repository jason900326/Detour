from pathlib import Path
import re

INDEX = Path('src/app/index.tsx')
BUILD = Path('src/lib/build-info.ts')
FOUNDATION = Path('PRODUCT_FOUNDATION.md')

text = INDEX.read_text()

# ---------------------------------------------------------------------------
# One ticket component for both printing and issued states.
# ---------------------------------------------------------------------------
component = r'''
const DETOUR_TICKET_BARS = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3];

type DetourTicketProps = {
  timeLabel: string;
  moodLabel: string;
  serial: string;
  stamped?: boolean;
  stampProgress?: Animated.Value;
};

function DetourTicket({
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
    <View style={styles.v42TicketPaper}>
      <View style={[styles.v42TicketNotch, styles.v42TicketNotchLeft]} />
      <View style={[styles.v42TicketNotch, styles.v42TicketNotchRight]} />

      <View style={styles.v42TicketHeader}>
        <Text style={styles.v42TicketBrand}>DETOUR</Text>
        <Text style={styles.v42TicketSerial}>{serial}</Text>
      </View>

      <View style={styles.v42TicketRule} />

      <Text style={styles.v42TicketLabel}>時間</Text>
      <View style={styles.v42TicketTimeRow}>
        <Text style={styles.v42TicketTime}>{timeLabel}</Text>
        <Text style={styles.v42TicketTimeUnit}>分鐘</Text>
      </View>

      <View style={styles.v42TicketRule} />

      <View style={styles.v42TicketMoodRow}>
        <View style={styles.v42TicketMoodCopy}>
          <Text style={styles.v42TicketLabel}>心情</Text>
          <Text style={styles.v42TicketMood}>{moodLabel}</Text>
        </View>

        {stamped && (
          <Animated.View style={[styles.v42TicketStamp, stampStyle]}>
            <Text style={styles.v42TicketStampText}>終點保密</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.v42TicketDash} />

      <View style={styles.v42TicketFooter}>
        <View style={styles.v42TicketBarcode}>
          {DETOUR_TICKET_BARS.map((width, index) => (
            <View key={`${width}-${index}`} style={[styles.v42TicketBar, { width }]} />
          ))}
        </View>
        <Text style={styles.v42TicketFooterMark}>探索票</Text>
      </View>
    </View>
  );
}

'''
marker = 'export default function HomeScreen() {'
if 'function DetourTicket(' not in text:
    if marker not in text:
        raise SystemExit('HomeScreen marker missing')
    text = text.replace(marker, component + marker, 1)

# ---------------------------------------------------------------------------
# Stamp state. The CTA stays locked until the stamp lands.
# ---------------------------------------------------------------------------
old_refs = """  const routeProgress = useRef(new Animated.Value(0)).current;
  const printerPulse = useRef(new Animated.Value(0)).current;
"""
new_refs = """  const routeProgress = useRef(new Animated.Value(0)).current;
  const printerPulse = useRef(new Animated.Value(0)).current;
  const ticketStamp = useRef(new Animated.Value(0)).current;
  const [ticketReadyUnlocked, setTicketReadyUnlocked] = useState(false);
"""
if old_refs not in text:
    raise SystemExit('animation refs marker missing')
text = text.replace(old_refs, new_refs, 1)

# Add ready-stage stamp effect directly after the preparing-stage effect.
prepare_effect_pattern = r"  useEffect\(\(\) => \{\n    if \(stage !== 'preparing'\) return;.*?\n  \}, \[stage\]\);"
match = re.search(prepare_effect_pattern, text, re.S)
if not match:
    raise SystemExit('preparing effect missing')
stamp_effect = r'''

  useEffect(() => {
    if (stage !== 'ready') return;

    setTicketReadyUnlocked(false);
    ticketStamp.setValue(0);

    const impactTimer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 290);

    const stampTimer = setTimeout(() => {
      Animated.timing(ticketStamp, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.back(1.25)),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setTicketReadyUnlocked(true);
      });
    }, 180);

    return () => {
      clearTimeout(impactTimer);
      clearTimeout(stampTimer);
    };
  }, [stage]);
'''
text = text[:match.end()] + stamp_effect + text[match.end():]

# ---------------------------------------------------------------------------
# Ticket output follows real work. If the backend finishes very quickly, give
# the physical printing ritual enough time to be legible. If it is slow, do not
# add extra waiting: the ticket simply holds around the current reveal point.
# ---------------------------------------------------------------------------
old_finish = "      advanceTicketProgress(1, '車票完成');\n"
new_finish = """      setTicketBuildStatus('車票完成');

      const minimumPrintMs = 1850;
      const remainingPrintMs = Math.max(
        0,
        minimumPrintMs - (Date.now() - ticketStartedAt)
      );

      if (remainingPrintMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remainingPrintMs);
        });
      }

      await new Promise<void>((resolve) => {
        Animated.timing(routeProgress, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => resolve());
      });
"""
if old_finish not in text:
    raise SystemExit('ticket finish progress marker missing')
text = text.replace(old_finish, new_finish, 1)

# The stamp is the success haptic now; avoid a second success buzz right before it.
prepare_start = text.find('  async function prepareDetourTicket()')
prepare_end = text.find('  async function startDetour()', prepare_start)
if prepare_start < 0 or prepare_end < 0:
    raise SystemExit('prepareDetourTicket bounds missing')
prepare = text[prepare_start:prepare_end]
old_haptic = """      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      console.log(
"""
new_haptic = """      console.log(
"""
if old_haptic not in prepare:
    raise SystemExit('prepare success haptic marker missing')
prepare = prepare.replace(old_haptic, new_haptic, 1)
text = text[:prepare_start] + prepare + text[prepare_end:]

# ---------------------------------------------------------------------------
# Replace both screens together. They now render the exact same DetourTicket.
# Printing only changes how much of that component is physically revealed.
# ---------------------------------------------------------------------------
stages_pattern = r"        \{stage === 'preparing' && \(.*?\n        \)\}\n\n        \{stage === 'ready' && \(.*?\n        \)\}\n\n        \{stage === 'journey' &&"
stages_replacement = r'''        {stage === 'preparing' && (
          <View style={styles.v42TicketFlowScreen}>
            <View style={styles.v42TicketTopBar}>
              <Text style={styles.v42TicketTopBrand}>DETOUR</Text>
            </View>

            <Text style={styles.v42PrintingTitle}>
              {ticketBuildError ? '這張票卡住了。' : '正在為你印製車票…'}
            </Text>

            <View style={styles.v42PrinterStage}>
              <View style={styles.v42PrinterHousing}>
                <Animated.View
                  style={[
                    styles.v42PrinterGlow,
                    {
                      opacity: printerPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.25, 0.92],
                      }),
                    },
                  ]}
                />
                <View style={styles.v42PrinterSlot} />
              </View>

              <View style={styles.v42TicketRevealWindow}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        translateY: routeProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-392, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <DetourTicket
                    timeLabel={selectedTime ?? '15'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                  />
                </Animated.View>
              </View>
            </View>

            {ticketBuildError && (
              <View style={styles.v42TicketErrorPanel}>
                <Text style={styles.v42TicketErrorText}>{ticketBuildError}</Text>
                <Pressable
                  onPress={() => {
                    routeProgress.setValue(0.04);
                    setTicketBuildError(null);
                    setTicketBuildStatus('再試一次…');
                    void prepareDetourTicket();
                  }}
                  style={({ pressed }) => [
                    styles.v42TicketRetry,
                    pressed && styles.v35Pressed,
                  ]}
                >
                  <Text style={styles.v42TicketRetryText}>再試一次</Text>
                  <Text style={styles.v42TicketRetryArrow}>→</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {stage === 'ready' && (
          <View style={styles.v42TicketFlowScreen}>
            <View style={styles.v42TicketTopBar}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v42TicketBack}>
                <Text style={styles.v42TicketBackText}>←</Text>
              </Pressable>
              <Text style={styles.v42TicketTopBrand}>DETOUR</Text>
              <View style={styles.v42TicketTopSpacer} />
            </View>

            <View style={styles.v42ReadyTicketStage}>
              <Animated.View
                style={{
                  transform: [
                    {
                      translateY: ticketStamp.interpolate({
                        inputRange: [0, 0.72, 1],
                        outputRange: [0, 3, 0],
                      }),
                    },
                    {
                      scale: ticketStamp.interpolate({
                        inputRange: [0, 0.72, 1],
                        outputRange: [1, 0.994, 1],
                      }),
                    },
                  ],
                }}
              >
                <DetourTicket
                  timeLabel={selectedTime ?? '15'}
                  moodLabel={mood?.label ?? '—'}
                  serial={ticketSerial(selectedTime, selectedMood)}
                  stamped
                  stampProgress={ticketStamp}
                />
              </Animated.View>
            </View>

            <Pressable
              disabled={!ticketReadyUnlocked}
              onPress={startDetour}
              style={({ pressed }) => [
                styles.v42DepartButton,
                !ticketReadyUnlocked && styles.v42DepartButtonLocked,
                pressed && ticketReadyUnlocked && styles.v35TicketButtonPressed,
              ]}
            >
              <Text style={styles.v42DepartText}>出發</Text>
              <Text style={styles.v42DepartArrow}>→</Text>
            </Pressable>
          </View>
        )}

        {stage === 'journey' &&'''
text, count = re.subn(stages_pattern, stages_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'preparing/ready stage pair match count = {count}')

# ---------------------------------------------------------------------------
# Add v0.42 ticket styles. Old ticket styles can stay temporarily; they are no
# longer rendered and can be removed in the later index.tsx split.
# ---------------------------------------------------------------------------
styles_marker = 'const styles = StyleSheet.create({\n'
v42_styles = r'''  v42TicketFlowScreen: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  v42TicketTopBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v42TicketTopBrand: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 7,
    color: INK,
  },
  v42TicketBack: {
    position: 'absolute',
    left: 0,
    width: 46,
    height: 46,
    justifyContent: 'center',
    zIndex: 2,
  },
  v42TicketBackText: {
    fontSize: 34,
    color: INK,
  },
  v42TicketTopSpacer: {
    position: 'absolute',
    right: 0,
    width: 46,
    height: 46,
  },
  v42PrintingTitle: {
    marginTop: 38,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: INK,
    textAlign: 'center',
  },
  v42PrinterStage: {
    alignSelf: 'center',
    width: 330,
    height: 490,
    marginTop: 26,
  },
  v42PrinterHousing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    borderRadius: 15,
    backgroundColor: '#1A1917',
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  v42PrinterSlot: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#090908',
  },
  v42PrinterGlow: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 20,
    height: 9,
    borderRadius: 5,
    backgroundColor: SIGNAL,
    shadowColor: SIGNAL,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  v42TicketRevealWindow: {
    position: 'absolute',
    top: 50,
    left: 9,
    right: 9,
    height: 440,
    overflow: 'hidden',
    alignItems: 'center',
  },
  v42ReadyTicketStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  v42TicketPaper: {
    width: 312,
    height: 432,
    paddingHorizontal: 26,
    paddingTop: 25,
    paddingBottom: 22,
    backgroundColor: '#FCF8EE',
    borderWidth: 1,
    borderColor: '#D8D0C3',
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
  },
  v42TicketNotch: {
    position: 'absolute',
    top: 186,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F1E8',
    borderWidth: 1,
    borderColor: '#D8D0C3',
  },
  v42TicketNotchLeft: { left: -13 },
  v42TicketNotchRight: { right: -13 },
  v42TicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v42TicketBrand: {
    fontSize: 35,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v42TicketSerial: {
    paddingBottom: 4,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: MUTED,
  },
  v42TicketRule: {
    height: 1,
    marginTop: 17,
    marginBottom: 14,
    backgroundColor: '#BEB6AA',
  },
  v42TicketLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    color: '#5E5951',
  },
  v42TicketTimeRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  v42TicketTime: {
    fontSize: 63,
    lineHeight: 67,
    fontWeight: '900',
    letterSpacing: -3.5,
    color: INK,
  },
  v42TicketTimeUnit: {
    marginLeft: 7,
    marginBottom: 8,
    fontSize: 23,
    fontWeight: '900',
    color: INK,
  },
  v42TicketMoodRow: {
    minHeight: 93,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v42TicketMoodCopy: {
    flex: 1,
  },
  v42TicketMood: {
    marginTop: 3,
    fontSize: 39,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v42TicketStamp: {
    position: 'absolute',
    right: -4,
    bottom: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(252,248,238,0.76)',
  },
  v42TicketStampText: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: SIGNAL,
  },
  v42TicketDash: {
    marginTop: 6,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BEB6AA',
  },
  v42TicketFooter: {
    flex: 1,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v42TicketBarcode: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },
  v42TicketBar: {
    height: '100%',
    backgroundColor: INK,
  },
  v42TicketFooterMark: {
    paddingBottom: 2,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    color: SIGNAL,
  },
  v42DepartButton: {
    minHeight: 76,
    borderRadius: 38,
    backgroundColor: INK,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  v42DepartButtonLocked: {
    opacity: 0.28,
  },
  v42DepartText: {
    fontSize: 24,
    fontWeight: '900',
    color: BONE,
  },
  v42DepartArrow: {
    fontSize: 32,
    color: SIGNAL,
  },
  v42TicketErrorPanel: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D3CEC1',
    backgroundColor: '#FCF8EE',
  },
  v42TicketErrorText: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    color: INK,
  },
  v42TicketRetry: {
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 18,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v42TicketRetryText: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
  },
  v42TicketRetryArrow: {
    fontSize: 28,
    color: INK,
  },
'''
if styles_marker not in text:
    raise SystemExit('StyleSheet marker missing')
text = text.replace(styles_marker, styles_marker + v42_styles, 1)

INDEX.write_text(text)

# Build marker.
build = BUILD.read_text()
build, count = re.subn(
    r"// v0\.41:.*?\nexport const DETOUR_BUILD_VERSION = '0\.41\.0';",
    "// v0.42: one physical ticket from print to departure, with a stamp ritual and no progress bar.\nexport const DETOUR_BUILD_VERSION = '0.42.0';",
    build,
    count=1,
)
if count != 1:
    raise SystemExit('v0.41 build marker missing')
BUILD.write_text(build)

foundation = FOUNDATION.read_text().rstrip() + r'''

## v0.42 — one ticket, one ritual

- Printing and issued states must render the exact same `DetourTicket` component. A user should never watch one ticket print and receive a visually different ticket.
- The ticket itself is the progress language. Do not add a progress bar or duplicate loading UI.
- Ticket reveal follows real work. Fast builds keep a short ~2 second physical-printing ritual; slow builds hold the ticket partially revealed instead of pretending to be complete.
- `終點保密` is the final stamp. The stamp lands after the full ticket is visible, gives one short haptic, and only then unlocks the departure CTA.
- The issued screen does not need a redundant “車票好了” headline; a complete stamped ticket plus an enabled `出發` action communicates completion.
'''
FOUNDATION.write_text(foundation + '\n')

# Invariants.
checks = {
    'src/app/index.tsx': [
        'function DetourTicket(',
        '<DetourTicket',
        "outputRange: [-392, 0]",
        '終點保密',
        'ticketReadyUnlocked',
        'v42DepartButton',
    ],
    'src/lib/build-info.ts': ["DETOUR_BUILD_VERSION = '0.42.0'"],
}
for path, needles in checks.items():
    contents = Path(path).read_text()
    for needle in needles:
        if needle not in contents:
            raise SystemExit(f'missing invariant {needle!r} in {path}')

# The new preparing/ready blocks must not render the old status/progress language.
idx = INDEX.read_text()
start = idx.find("{stage === 'preparing' && (")
end = idx.find("{stage === 'journey' &&", start)
flow = idx[start:end]
for forbidden in ['v41PreparingStatus', 'ticketReadyMeta', 'ticketReadyTitle', '車票好了']:
    if forbidden in flow:
        raise SystemExit(f'old ticket UI still rendered: {forbidden}')
