from pathlib import Path

view_path = Path('src/components/detour-home-view.tsx')
view = view_path.read_text(encoding='utf-8')

anchor = """    completeDetour,\n  } = controller;\n\n  return ("""
insert = """    completeDetour,\n  } = controller;\n\n  const fateRoll = useRef(new Animated.Value(0)).current;\n  const [fateRolling, setFateRolling] = useState(false);\n\n  function rollRandomMood() {\n    if (fateRolling) return;\n\n    const choices = MOODS.filter((item) => item.id !== 'surprise');\n    const picked = choices[Math.floor(Math.random() * choices.length)];\n    if (!picked) return;\n\n    setFateRolling(true);\n    setSelectedMood(null);\n    fateRoll.stopAnimation();\n    fateRoll.setValue(0);\n    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);\n\n    Animated.timing(fateRoll, {\n      toValue: 1,\n      duration: 520,\n      easing: Easing.out(Easing.cubic),\n      useNativeDriver: true,\n    }).start(({ finished }) => {\n      fateRoll.setValue(0);\n      setFateRolling(false);\n      if (finished) {\n        void chooseMood(picked.id);\n      }\n    });\n  }\n\n  return ("""
if anchor not in view:
    raise SystemExit('controller return anchor not found')
view = view.replace(anchor, insert, 1)

old_grid = """            <View style={styles.v45MoodGrid}>\n              {MOODS.map((item) => {\n                const active = selectedMood === item.id;\n                return (\n                  <Pressable\n                    key={item.id}\n                    onPress={() => chooseMood(item.id)}\n                    style={({ pressed }) => [\n                      styles.v45MoodCard,\n                      active && styles.v45MoodCardActive,\n                      pressed && styles.v45MoodCardPressed,\n                    ]}\n                  >\n                    <V45MoodIcon moodId={item.id} />\n                    <Text style={styles.v45MoodLabel}>{item.label}</Text>\n                  </Pressable>\n                );\n              })}\n            </View>"""
new_grid = """            <View style={styles.v45MoodGrid}>\n              {MOODS.filter((item) => item.id !== 'surprise').map((item) => {\n                const active = selectedMood === item.id;\n                return (\n                  <Pressable\n                    key={item.id}\n                    onPress={() => chooseMood(item.id)}\n                    style={({ pressed }) => [\n                      styles.v45MoodCard,\n                      active && styles.v45MoodCardActive,\n                      pressed && styles.v45MoodCardPressed,\n                    ]}\n                  >\n                    <V45MoodIcon moodId={item.id} />\n                    <Text style={styles.v45MoodLabel}>{item.label}</Text>\n                  </Pressable>\n                );\n              })}\n\n              <Pressable\n                accessibilityLabel=\"隨機選一個心情\"\n                disabled={fateRolling}\n                onPress={rollRandomMood}\n                style={({ pressed }) => [\n                  styles.v45MoodCard,\n                  fateRolling && styles.v45MoodCardActive,\n                  pressed && !fateRolling && styles.v45MoodCardPressed,\n                ]}\n              >\n                <Animated.View\n                  style={{\n                    transform: [\n                      {\n                        rotate: fateRoll.interpolate({\n                          inputRange: [0, 1],\n                          outputRange: ['0deg', '540deg'],\n                        }),\n                      },\n                      {\n                        scale: fateRoll.interpolate({\n                          inputRange: [0, 0.45, 1],\n                          outputRange: [1, 0.82, 1],\n                        }),\n                      },\n                    ],\n                  }}\n                >\n                  <V45MoodIcon moodId=\"surprise\" size={88} />\n                </Animated.View>\n              </Pressable>\n            </View>"""
if old_grid not in view:
    raise SystemExit('mood grid block not found')
view = view.replace(old_grid, new_grid, 1)
view_path.write_text(view, encoding='utf-8')

ticket_path = Path('src/components/ticket-visuals.tsx')
ticket = ticket_path.read_text(encoding='utf-8')
old_base = """      <Image\n        source={require('../../assets/detour/ticket-base.png')}\n        style={styles.v46ArtTicketBase}\n        resizeMode=\"stretch\"\n        onLoad={markArtworkReady}\n        onLoadEnd={markArtworkReady}\n      />\n\n      <View style={styles.v46ArtTicketHeader}>"""
new_base = """      <Image\n        source={require('../../assets/detour/ticket-base.png')}\n        style={styles.v46ArtTicketBase}\n        resizeMode=\"stretch\"\n        onLoad={markArtworkReady}\n        onLoadEnd={markArtworkReady}\n      />\n\n      <View pointerEvents=\"none\" style={styles.v51TicketFeedHead}>\n        <View style={styles.v51TicketFeedBarcode}>\n          {Array.from({ length: 29 }).map((_, index) => (\n            <View\n              key={`feed-barcode-${index}`}\n              style={[\n                styles.v51TicketFeedBarcodeBar,\n                { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },\n              ]}\n            />\n          ))}\n        </View>\n      </View>\n\n      <View style={styles.v46ArtTicketHeader}>"""
if old_base not in ticket:
    raise SystemExit('ticket base block not found')
ticket = ticket.replace(old_base, new_base, 1)
old_barcode = """      <View style={styles.v46ArtBarcode}>\n        {Array.from({ length: 29 }).map((_, index) => (\n          <View\n            key={`art-barcode-${index}`}\n            style={[\n              styles.v46ArtBarcodeBar,\n              { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },\n            ]}\n          />\n        ))}\n      </View>\n\n"""
if old_barcode not in ticket:
    raise SystemExit('old ticket barcode block not found')
ticket = ticket.replace(old_barcode, '', 1)
ticket_path.write_text(ticket, encoding='utf-8')

style_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = style_path.read_text(encoding='utf-8')
style_anchor = """  v46ArtTicketBase: {\n    ...ABSOLUTE_FILL,\n    width: '100%',\n    height: '100%',\n  },"""
style_insert = """  v46ArtTicketBase: {\n    ...ABSOLUTE_FILL,\n    width: '100%',\n    height: '100%',\n  },\n  v51TicketFeedHead: {\n    position: 'absolute',\n    left: 7,\n    right: 7,\n    top: 0,\n    height: 63,\n    backgroundColor: '#FCF8EE',\n    alignItems: 'center',\n    justifyContent: 'center',\n    zIndex: 2,\n    borderBottomWidth: 1,\n    borderBottomColor: '#D8D0C2',\n  },\n  v51TicketFeedBarcode: {\n    height: 38,\n    flexDirection: 'row',\n    alignItems: 'stretch',\n    justifyContent: 'center',\n    gap: 2.6,\n  },\n  v51TicketFeedBarcodeBar: {\n    height: 38,\n    backgroundColor: INK,\n  },"""
if style_anchor not in styles:
    raise SystemExit('ticket style anchor not found')
styles = styles.replace(style_anchor, style_insert, 1)
style_path.write_text(styles, encoding='utf-8')
