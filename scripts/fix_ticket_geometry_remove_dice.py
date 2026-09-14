from pathlib import Path

view_path = Path('src/components/detour-home-view.tsx')
view = view_path.read_text(encoding='utf-8')

# Remove the dice animation state/function entirely.
start = view.find('  const fateRoll = useRef(new Animated.Value(0)).current;')
if start != -1:
    end = view.find('\n\n  return (', start)
    if end == -1:
        raise SystemExit('could not find end of fate roll block')
    view = view[:start] + view[end + 2:]

# Remove the sixth dice card while leaving the five real moods.
dice_start = view.find('              <Pressable\n                accessibilityLabel="隨機選一個心情"')
if dice_start != -1:
    dice_end = view.find('              </Pressable>', dice_start)
    if dice_end == -1:
        raise SystemExit('could not find end of dice pressable')
    dice_end += len('              </Pressable>')
    view = view[:dice_start] + view[dice_end:]

# Keep surprise out of the visible grid if the previous patch already filtered it.
view = view.replace(
    "{MOODS.map((item) => {",
    "{MOODS.filter((item) => item.id !== 'surprise').map((item) => {",
    1,
)

# Replace height reveal with true physical translation of the entire finished ticket.
old_paper = '''              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v48PaperViewport,
                  {
                    height: routeProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 409],
                    }),
                  },
                ]}
              >
                <View style={styles.v48PaperTrack}>
                  <V45Ticket
                    timeLabel={selectedTime ?? '15'}
                    moodId={selectedMood ?? 'wander'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                    stamped={stage === 'ready'}
                    stampProgress={ticketStamp}
                  />
                </View>
              </Animated.View>'''
new_paper = '''              <View style={styles.v48PaperViewport} pointerEvents="none">
                <Animated.View
                  style={[
                    styles.v48PaperTrack,
                    {
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 0.13, 1],
                            outputRange: [-372, -330, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <V45Ticket
                    timeLabel={selectedTime ?? '15'}
                    moodId={selectedMood ?? 'wander'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                    stamped={stage === 'ready'}
                    stampProgress={ticketStamp}
                  />
                </Animated.View>
              </View>'''
if old_paper not in view:
    raise SystemExit('height-reveal paper block not found')
view = view.replace(old_paper, new_paper, 1)
view_path.write_text(view, encoding='utf-8')

style_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = style_path.read_text(encoding='utf-8')

replacements = {
    "    left: 18,\n    right: 18,\n    top: 31,": "    left: 8,\n    right: 8,\n    top: 31,",
    "    width: '94%',\n    height: 13,": "    width: '97%',\n    height: 13,",
    "    width: 310,\n    height: 409,": "    width: 280,\n    height: 409,",
    "    width: 310,\n    alignItems: 'center',": "    width: 280,\n    alignItems: 'center',",
    "    left: 22,\n    right: 22,\n    top: 51,": "    left: 8,\n    right: 8,\n    top: 51,",
    "  v46ArtTicket: {\n    width: 310,": "  v46ArtTicket: {\n    width: 280,",
}
for old, new in replacements.items():
    if old not in styles:
        raise SystemExit(f'style pattern not found: {old!r}')
    styles = styles.replace(old, new, 1)

style_path.write_text(styles, encoding='utf-8')

# Important: ticket-visuals.tsx is deliberately untouched. The original
# ticket-base.png remains the single artwork source so paper texture, printed
# rules, perforation/serrated edges and all supplied art survive intact.
