from pathlib import Path

INDEX = Path('src/app/index.tsx')
BUILD = Path('src/lib/build-info.ts')
text = INDEX.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    text = text.replace(old, new, 1)


def replace_style_object(key: str, body: str) -> None:
    global text
    marker = f'  {key}: {{'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f'style {key}: not found')
    brace = text.find('{', start)
    depth = 0
    end = None
    for i in range(brace, len(text)):
        ch = text[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise SystemExit(f'style {key}: unterminated')
    if text[end:end+1] == ',':
        end += 1
    text = text[:start] + f'  {key}: {{\n{body}\n  }},' + text[end:]


# 1) Curved, round-ended Detour emphasis stroke instead of rotated rectangular bars.
replace_once(
    "import MapView, { Circle, Polyline } from 'react-native-maps';\n",
    "import MapView, { Circle, Polyline } from 'react-native-maps';\nimport Svg, { Path as SvgPath } from 'react-native-svg';\n",
    'react-native-svg import',
)

accent_component = r'''
function DetourAccentStroke({
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

'''
marker = '// DETOUR V45 — ticket / mood / recap visual system\n'
if marker not in text:
    raise SystemExit('accent insertion marker not found')
text = text.replace(marker, accent_component + marker, 1)

replacements = {
    '<View style={styles.v35Underline} />': '<DetourAccentStroke width={126} style={styles.v35Underline} />',
    '<View style={styles.v45MoodUnderline} />': '<DetourAccentStroke width={180} style={styles.v45MoodUnderline} />',
    '<View style={styles.v45PrintingUnderline} />': '<DetourAccentStroke width={180} style={styles.v45PrintingUnderline} />',
    '<View style={styles.v45FinishTitleUnderline} />': '<DetourAccentStroke width={76} style={styles.v45FinishTitleUnderline} />',
    '<View style={styles.v45DetailTitleUnderline} />': '<DetourAccentStroke width={86} style={styles.v45DetailTitleUnderline} />',
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'underline replacement {old}: expected 1, found {count}')
    text = text.replace(old, new, 1)

replace_style_object('v35Underline', "    alignSelf: 'center',\n    marginTop: 0,\n    marginLeft: 112,")
replace_style_object('v45MoodUnderline', "    marginTop: 2,")
replace_style_object('v45PrintingUnderline', "    marginTop: 2,")
replace_style_object('v45FinishTitleUnderline', "    marginTop: -2,\n    marginLeft: 120,")
replace_style_object('v45DetailTitleUnderline', "    marginTop: -2,\n    marginLeft: 72,")

# 2) Physical ticket printer: the machine stays directly below the title,
#    the ticket is behind it, and the FINAL ticket is revealed bottom-first.
preparing_start = text.find("{stage === 'preparing' && (")
ready_start = text.find("{stage === 'ready' && (", preparing_start)
if preparing_start < 0 or ready_start < 0:
    raise SystemExit('preparing/ready stage boundaries not found')
preparing = text[preparing_start:ready_start]

old_ticket = """                <V45Ticket
                  timeLabel={selectedTime ?? '15'}
                  moodId={selectedMood ?? 'wander'}
                  moodLabel={mood?.label ?? '—'}
                  serial={ticketSerial(selectedTime, selectedMood)}
                />"""
new_ticket = """                <View style={styles.v47PrintTicketBottomAnchor}>
                  <V45Ticket
                    timeLabel={selectedTime ?? '15'}
                    moodId={selectedMood ?? 'wander'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                  />
                </View>"""
if preparing.count(old_ticket) != 1:
    raise SystemExit(f'preparing ticket call: expected 1, found {preparing.count(old_ticket)}')
preparing = preparing.replace(old_ticket, new_ticket, 1)

old_range = """inputRange: [0, 1],
                      outputRange: [2, 420],"""
new_range = """inputRange: [0, 1],
                      outputRange: [8, 392],"""
if preparing.count(old_range) != 1:
    raise SystemExit(f'print reveal range: expected 1, found {preparing.count(old_range)}')
preparing = preparing.replace(old_range, new_range, 1)
text = text[:preparing_start] + preparing + text[ready_start:]

replace_style_object('v45PrintingTitleWrap', "    marginTop: 68,\n    alignItems: 'center',\n    zIndex: 5,")
replace_style_object('v46ArtPrinterStage', "    width: '100%',\n    height: 430,\n    marginTop: 18,\n    alignItems: 'center',\n    position: 'relative',\n    zIndex: 2,")
replace_style_object('v46ArtPrinterImage', "    position: 'absolute',\n    top: -25,\n    width: '100%',\n    aspectRatio: 2048 / 682,\n    zIndex: 4,")
replace_style_object('v46ArtPaperReveal', "    position: 'absolute',\n    top: 34,\n    width: 310,\n    overflow: 'hidden',\n    alignItems: 'center',\n    zIndex: 2,")
replace_style_object('v46ArtPrinterTopMask', "    display: 'none',")

# Insert the bottom anchor style immediately before the hidden legacy mask style.
anchor_marker = '  v46ArtPrinterTopMask: {'
anchor_style = """  v47PrintTicketBottomAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
"""
if text.count(anchor_marker) != 1:
    raise SystemExit(f'anchor insertion marker: expected 1, found {text.count(anchor_marker)}')
text = text.replace(anchor_marker, anchor_style + anchor_marker, 1)

# 3) Error/retry must always remain reachable inside the viewport.
replace_style_object('v45TicketErrorPanel', "    position: 'absolute',\n    left: 30,\n    right: 30,\n    bottom: 24,\n    zIndex: 10,\n    padding: 16,\n    borderWidth: 1,\n    borderColor: SIGNAL,\n    borderRadius: 14,\n    backgroundColor: '#FFF7F1',")
replace_style_object('v45TicketRetry', "    marginTop: 12,\n    minHeight: 54,\n    borderRadius: 27,\n    backgroundColor: INK,\n    paddingHorizontal: 20,\n    flexDirection: 'row',\n    alignItems: 'center',\n    justifyContent: 'space-between',")

INDEX.write_text(text, encoding='utf-8')

build = BUILD.read_text(encoding='utf-8')
build = build.replace(
    '// v0.46.0: wire final Detour artwork into Home, Mood, ticket, journey review, and journey complete.\n'
    "export const DETOUR_BUILD_VERSION = '0.46.0';",
    '// v0.46.1: round accent strokes, reachable ticket retry, and bottom-first physical ticket printing.\n'
    "export const DETOUR_BUILD_VERSION = '0.46.1';",
)
if "DETOUR_BUILD_VERSION = '0.46.1'" not in build:
    raise SystemExit('build-info version patch failed')
BUILD.write_text(build, encoding='utf-8')

# Product invariants for this patch.
final = INDEX.read_text(encoding='utf-8')
checks = {
    'accent component': final.count('function DetourAccentStroke(') == 1,
    'five accent uses': final.count('<DetourAccentStroke ') == 5,
    'bottom-first anchor': 'v47PrintTicketBottomAnchor' in final,
    'bottom-first range': 'outputRange: [8, 392]' in final,
    'printer over paper': "v46ArtPrinterImage: {\n    position: 'absolute',\n    top: -25" in final,
    'retry fixed in viewport': "v45TicketErrorPanel: {\n    position: 'absolute'" in final and 'bottom: 24' in final,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('invariants failed: ' + ', '.join(failed))
print('v0.46.1 print/UI fixes applied')
