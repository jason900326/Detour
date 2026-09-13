from pathlib import Path
import re

INDEX = Path('src/app/index.tsx')
BUILD = Path('src/lib/build-info.ts')

text = INDEX.read_text()

mood_block = r'''type MoodGlyphProps = {
  moodId: MoodId;
  active: boolean;
};

function MoodGlyph({ moodId, active }: MoodGlyphProps) {
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

function moodHint'''

text, count = re.subn(
    r"type MoodGlyphProps = \{.*?\n\}\n\nfunction moodHint",
    mood_block,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Expected to replace MoodGlyph once, got {count}')

new_ticket = r'''const DETOUR_TICKET_BARS = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3];
const DETOUR_TICKET_EDGE = Array.from({ length: 8 }, (_, index) => 30 + index * 50);

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

export default function HomeScreen() {'''

text, count = re.subn(
    r"const DETOUR_TICKET_BARS = \[.*?\n\}\n\nexport default function HomeScreen\(\) \{",
    new_ticket,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Expected to replace DetourTicket once, got {count}')

old_reveal = '''                  style={{
                    transform: [
                      {
                        translateY: routeProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-392, 0],
                        }),
                      },
                    ],
                  }}'''
new_reveal = '''                  style={{
                    height: routeProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 436],
                    }),
                    overflow: 'hidden',
                  }}'''
if old_reveal not in text:
    raise SystemExit('Ticket reveal animation block not found')
text = text.replace(old_reveal, new_reveal, 1)

style_insert = r'''  v44MoodGlyph: {
    width: 86,
    height: 76,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v44MoodGlyphActive: {
    transform: [{ translateY: -1 }, { scale: 1.035 }],
  },
  v44WanderStem: {
    position: 'absolute',
    left: 40,
    top: 35,
    width: 6,
    height: 31,
    borderRadius: 3,
    backgroundColor: INK,
  },
  v44WanderBranchLeft: {
    position: 'absolute',
    left: 23,
    top: 29,
    width: 25,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK,
    transform: [{ rotate: '-38deg' }],
  },
  v44WanderBranchRight: {
    position: 'absolute',
    right: 20,
    top: 25,
    width: 30,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK,
    transform: [{ rotate: '38deg' }],
  },
  v44WanderOrigin: {
    position: 'absolute',
    left: 36,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: INK,
  },
  v44WanderChoice: {
    position: 'absolute',
    right: 11,
    top: 11,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SIGNAL,
  },
  v44FoodPlate: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 5,
    borderColor: INK,
  },
  v44FoodForkHandle: {
    position: 'absolute',
    left: 7,
    top: 23,
    width: 5,
    height: 46,
    borderRadius: 3,
    backgroundColor: INK,
  },
  v44FoodForkTineA: { position: 'absolute', left: 3, top: 9, width: 4, height: 20, borderRadius: 2, backgroundColor: INK },
  v44FoodForkTineB: { position: 'absolute', left: 9, top: 8, width: 4, height: 21, borderRadius: 2, backgroundColor: INK },
  v44FoodForkTineC: { position: 'absolute', left: 15, top: 9, width: 4, height: 20, borderRadius: 2, backgroundColor: INK },
  v44FoodKnife: {
    position: 'absolute',
    right: 7,
    top: 9,
    width: 7,
    height: 59,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '4deg' }],
  },
  v44QuietBar: { position: 'absolute', bottom: 15, width: 7, borderRadius: 4, backgroundColor: INK },
  v44QuietBarA: { left: 18, height: 20 },
  v44QuietBarB: { left: 30, height: 34 },
  v44QuietBarC: { left: 42, height: 48 },
  v44QuietBarD: { right: 30, height: 34 },
  v44QuietBarE: { right: 18, height: 20 },
  v44QuietSlash: {
    position: 'absolute',
    width: 70,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-37deg' }],
  },
  v44WeirdTile: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 5,
    borderColor: INK,
  },
  v44WeirdTileA: { left: 17, top: 12 },
  v44WeirdTileB: { left: 17, top: 40 },
  v44WeirdTileC: { left: 45, top: 40 },
  v44WeirdOddTile: {
    position: 'absolute',
    right: 4,
    top: 3,
    width: 25,
    height: 25,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '12deg' }],
  },
  v44ColorSwatch: {
    position: 'absolute',
    width: 30,
    height: 48,
    borderRadius: 3,
  },
  v44ColorSwatchBack: {
    left: 17,
    top: 16,
    backgroundColor: INK,
    transform: [{ rotate: '-13deg' }],
  },
  v44ColorSwatchSignal: {
    right: 16,
    top: 17,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '13deg' }],
  },
  v44ColorSwatchFront: {
    left: 29,
    top: 9,
    backgroundColor: BONE,
    borderWidth: 5,
    borderColor: INK,
  },
  v44FateDie: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 5,
    borderColor: INK,
    transform: [{ rotate: '8deg' }],
  },
  v44FatePip: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: INK },
  v44FatePipA: { left: 8, top: 8 },
  v44FatePipB: { left: 17, top: 17, backgroundColor: SIGNAL },
  v44FatePipC: { right: 8, bottom: 8 },
  v44FateSignal: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  v44TicketPaper: {
    width: 296,
    height: 436,
    paddingHorizontal: 27,
    paddingTop: 26,
    paddingBottom: 22,
    backgroundColor: '#FBF5E9',
    borderWidth: 1,
    borderColor: '#D3CABD',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    position: 'relative',
  },
  v44TicketEdgeCut: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BONE,
    zIndex: 3,
  },
  v44TicketEdgeLeft: { left: -7 },
  v44TicketEdgeRight: { right: -7 },
  v44TicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v44TicketBrand: {
    fontSize: 39,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -2.2,
    color: INK,
  },
  v44TicketSerial: {
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },
  v44TicketRule: {
    height: 1,
    marginTop: 18,
    backgroundColor: '#AAA296',
  },
  v44TicketTimeBlock: {
    paddingTop: 18,
    paddingBottom: 15,
  },
  v44TicketLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    color: '#5F5A52',
  },
  v44TicketTimeRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  v44TicketTime: {
    fontSize: 68,
    lineHeight: 71,
    fontWeight: '900',
    letterSpacing: -4,
    color: INK,
  },
  v44TicketTimeUnit: {
    marginLeft: 7,
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '900',
    color: INK,
  },
  v44TicketMoodBlock: {
    minHeight: 104,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#C0B7AA',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  v44TicketMoodCopy: { flex: 1 },
  v44TicketMood: {
    marginTop: 3,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -2.1,
    color: INK,
  },
  v44TicketStamp: {
    position: 'absolute',
    right: -2,
    bottom: 13,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(251,245,233,0.82)',
  },
  v44TicketStampText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: SIGNAL,
  },
  v44TicketDash: {
    marginTop: 7,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#AFA79B',
  },
  v44TicketFooter: {
    flex: 1,
    paddingTop: 22,
    justifyContent: 'flex-end',
  },
  v44TicketBarcode: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },
  v44TicketBar: {
    height: '100%',
    backgroundColor: INK,
  },

'''
needle = 'const styles = StyleSheet.create({\n'
if needle not in text:
    raise SystemExit('StyleSheet marker not found')
text = text.replace(needle, needle + style_insert, 1)

INDEX.write_text(text)

build = BUILD.read_text()
build = build.replace(
    "// v0.43: custom Mood glyphs, memory-first journey review, and separate developer tools.\nexport const DETOUR_BUILD_VERSION = '0.43.0';",
    "// v0.44: redesigned Mood glyphs and a physical-ticket visual while preserving the print ritual.\nexport const DETOUR_BUILD_VERSION = '0.44.0';",
)
if "DETOUR_BUILD_VERSION = '0.44.0'" not in build:
    raise SystemExit('Build version update failed')
BUILD.write_text(build)
