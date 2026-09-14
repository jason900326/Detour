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

# Keep surprise out of the visible grid.
if "{MOODS.map((item) => {" in view:
    view = view.replace(
        "{MOODS.map((item) => {",
        "{MOODS.filter((item) => item.id !== 'surprise').map((item) => {",
        1,
    )

# Preserve the physical-translation model. The paper itself moves; it is never
# height-revealed/cropped as a fake growing rectangle.
height_reveal = '''              <Animated.View
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
physical = '''              <View style={styles.v48PaperViewport} pointerEvents="none">
                <Animated.View
                  style={[
                    styles.v48PaperTrack,
                    {
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-380, 0],
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
if height_reveal in view:
    view = view.replace(height_reveal, physical, 1)
elif 'outputRange: [-405, 0],' in view:
    view = view.replace('outputRange: [-405, 0],', 'outputRange: [-380, 0],', 1)
elif 'outputRange: [-420, 0],' in view:
    view = view.replace('outputRange: [-420, 0],', 'outputRange: [-380, 0],', 1)
else:
    raise SystemExit('physical paper translation block not found')

view_path.write_text(view, encoding='utf-8')

style_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = style_path.read_text(encoding='utf-8')

# The actual slot opening and the front lip must both be wider than the ticket.
# Ticket = 280px. Slot opening ends up roughly >300px on the target phone width.
replacements = [
    ("    left: 18,\n    right: 18,\n    top: 31,", "    left: 8,\n    right: 8,\n    top: 31,"),
    ("    width: '94%',\n    height: 13,", "    width: '97%',\n    height: 13,"),
    ("    width: 310,\n    height: 409,", "    width: 280,\n    height: 409,"),
    ("    width: 310,\n    alignItems: 'center',", "    width: 280,\n    alignItems: 'center',"),
    ("    left: 22,\n    right: 22,\n    top: 51,", "    left: 8,\n    right: 8,\n    top: 51,"),
    ("  v46ArtTicket: {\n    width: 310,", "  v46ArtTicket: {\n    width: 280,"),
]
for old, new in replacements:
    if old in styles:
        styles = styles.replace(old, new, 1)
    elif new not in styles:
        raise SystemExit(f'style pattern not found: {old!r}')

style_path.write_text(styles, encoding='utf-8')

# ticket-visuals.tsx is deliberately untouched. ticket-base.png remains the
# artwork source, so paper texture, cut/perforation marks and serrated edges are
# not redrawn or replaced by programmatic rectangles.
