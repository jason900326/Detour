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

# Preserve true physical motion of the complete ticket. Do not grow/crop the
# ticket with an animated height. At 13% only a small bottom edge is visible.
if 'outputRange: [-405, 0],' in view:
    view = view.replace('outputRange: [-405, 0],', 'outputRange: [-380, 0],', 1)
elif 'outputRange: [-420, 0],' in view:
    view = view.replace('outputRange: [-420, 0],', 'outputRange: [-380, 0],', 1)
elif 'outputRange: [-380, 0],' not in view:
    raise SystemExit('physical paper translation block not found')

view_path.write_text(view, encoding='utf-8')

style_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = style_path.read_text(encoding='utf-8')

# The outlet is already almost full-width. Make the ticket clearly narrower
# than that opening and keep the viewport only slightly wider than the ticket.
# This guarantees the supplied serrated edges cannot collide with the slot lip.
replacements = [
    ("    width: 318,\n    height: 409,", "    width: 288,\n    height: 409,"),
    ("    width: 318,\n    alignItems: 'center',", "    width: 288,\n    alignItems: 'center',"),
    ("  v46ArtTicket: {\n    width: 310,", "  v46ArtTicket: {\n    width: 280,"),
]
for old, new in replacements:
    if old in styles:
        styles = styles.replace(old, new, 1)
    elif new not in styles:
        raise SystemExit(f'style pattern not found: {old!r}')

style_path.write_text(styles, encoding='utf-8')

# ticket-visuals.tsx is deliberately untouched. ticket-base.png remains the
# artwork source, so paper texture, printed rules, cut marks and serrated edges
# stay exactly in the user's supplied artwork. Only dynamic text overlays remain.
