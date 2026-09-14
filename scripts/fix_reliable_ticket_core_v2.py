from pathlib import Path
import re

# 1) Remove the dice UI entirely and restore physical ticket translation.
view_path = Path('src/components/detour-home-view.tsx')
view = view_path.read_text(encoding='utf-8')

view = re.sub(
    r"\n  const fateRoll = useRef\(new Animated\.Value\(0\)\)\.current;\n  const \[fateRolling, setFateRolling\] = useState\(false\);\n\n  function rollRandomMood\(\) \{.*?\n  \}\n\n  return \(",
    "\n  return (",
    view,
    count=1,
    flags=re.S,
)

old_dice = '''\n              <Pressable\n                accessibilityLabel="隨機選一個心情"\n                disabled={fateRolling}\n                onPress={rollRandomMood}\n                style={({ pressed }) => [\n                  styles.v45MoodCard,\n                  fateRolling && styles.v45MoodCardActive,\n                  pressed && !fateRolling && styles.v45MoodCardPressed,\n                ]}\n              >\n                <Animated.View\n                  style={{\n                    transform: [\n                      {\n                        rotate: fateRoll.interpolate({\n                          inputRange: [0, 1],\n                          outputRange: ['0deg', '540deg'],\n                        }),\n                      },\n                      {\n                        scale: fateRoll.interpolate({\n                          inputRange: [0, 0.45, 1],\n                          outputRange: [1, 0.82, 1],\n                        }),\n                      },\n                    ],\n                  }}\n                >\n                  <V45MoodIcon moodId="surprise" size={88} />\n                </Animated.View>\n              </Pressable>'''
if old_dice not in view:
    raise SystemExit('dice block not found')
view = view.replace(old_dice, '', 1)

old_reveal = '''              <Animated.View\n                pointerEvents="none"\n                style={[\n                  styles.v48PaperViewport,\n                  {\n                    height: routeProgress.interpolate({\n                      inputRange: [0, 1],\n                      outputRange: [0, 409],\n                    }),\n                  },\n                ]}\n              >\n                <View style={styles.v48PaperTrack}>\n                  <V45Ticket\n                    timeLabel={selectedTime ?? '15'}\n                    moodId={selectedMood ?? 'wander'}\n                    moodLabel={mood?.label ?? '—'}\n                    serial={ticketSerial(selectedTime, selectedMood)}\n                    stamped={stage === 'ready'}\n                    stampProgress={ticketStamp}\n                  />\n                </View>\n              </Animated.View>'''
new_reveal = '''              <View style={styles.v48PaperViewport} pointerEvents="none">\n                <Animated.View\n                  style={[\n                    styles.v48PaperTrack,\n                    {\n                      transform: [\n                        {\n                          translateY: routeProgress.interpolate({\n                            inputRange: [0, 1],\n                            outputRange: [-405, 0],\n                          }),\n                        },\n                      ],\n                    },\n                  ]}\n                >\n                  <V45Ticket\n                    timeLabel={selectedTime ?? '15'}\n                    moodId={selectedMood ?? 'wander'}\n                    moodLabel={mood?.label ?? '—'}\n                    serial={ticketSerial(selectedTime, selectedMood)}\n                    stamped={stage === 'ready'}\n                    stampProgress={ticketStamp}\n                  />\n                </Animated.View>\n              </View>'''
if old_reveal not in view:
    raise SystemExit('ticket reveal block not found')
view = view.replace(old_reveal, new_reveal, 1)
view_path.write_text(view, encoding='utf-8')

# 2) Keep the user's original ticket artwork untouched. Remove the synthetic
# white feed head and put the real barcode back in its original bottom area.
ticket_path = Path('src/components/ticket-visuals.tsx')
ticket = ticket_path.read_text(encoding='utf-8')
feed_head = '''\n      <View pointerEvents="none" style={styles.v51TicketFeedHead}>\n        <View style={styles.v51TicketFeedBarcode}>\n          {Array.from({ length: 29 }).map((_, index) => (\n            <View\n              key={`feed-barcode-${index}`}\n              style={[\n                styles.v51TicketFeedBarcodeBar,\n                { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },\n              ]}\n            />\n          ))}\n        </View>\n      </View>\n'''
if feed_head not in ticket:
    raise SystemExit('synthetic feed head not found')
ticket = ticket.replace(feed_head, '\n', 1)

barcode = '''      <View style={styles.v46ArtBarcode}>\n        {Array.from({ length: 29 }).map((_, index) => (\n          <View\n            key={`art-barcode-${index}`}\n            style={[\n              styles.v46ArtBarcodeBar,\n              { width: index % 7 === 0 ? 4 : index % 3 === 0 ? 2.4 : 1.4 },\n            ]}\n          />\n        ))}\n      </View>\n\n'''
barcode_anchor = '''      {stamped && (\n        <Animated.View'''
if barcode_anchor not in ticket:
    raise SystemExit('barcode restore anchor not found')
ticket = ticket.replace(barcode_anchor, barcode + barcode_anchor, 1)
ticket_path.write_text(ticket, encoding='utf-8')

# 3) Make the physical slot wider than the entire ticket, while keeping the
# artwork at its tuned 310px size so texture/perforations/score lines stay intact.
style_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = style_path.read_text(encoding='utf-8')
styles = styles.replace("    left: 18,\n    right: 18,\n    top: 31,", "    left: 3,\n    right: 3,\n    top: 31,", 1)
styles = styles.replace("    width: '94%',\n    height: 13,", "    width: '100%',\n    height: 13,", 1)
styles = styles.replace("    width: 310,\n    height: 409,", "    width: 318,\n    height: 409,", 1)
styles = styles.replace("    width: 310,\n    alignItems: 'center',", "    width: 318,\n    alignItems: 'center',", 1)
styles = styles.replace("    left: 22,\n    right: 22,\n    top: 51,", "    left: 4,\n    right: 4,\n    top: 51,", 1)
styles = re.sub(
    r"\n  v51TicketFeedHead: \{.*?\n  v51TicketFeedBarcodeBar: \{\n    height: 38,\n    backgroundColor: INK,\n  \},",
    '',
    styles,
    count=1,
    flags=re.S,
)
style_path.write_text(styles, encoding='utf-8')

# 4) Overpass must never serially block for 21s + 21s. Race both mirrors,
# stagger the second slightly, and cap each attempt to a few seconds.
scene_path = Path('src/lib/scene-engine.ts')
scene = scene_path.read_text(encoding='utf-8')
scene = scene.replace('[out:json][timeout:18];', '[out:json][timeout:6];')
scene = scene.replace('nwr${around}["leisure"~"park|garden"];', 'nwr${around}["leisure"~"park|garden|playground|pitch|sports_centre|track"];\n  nwr${around}["amenity"="community_centre"];')
scene = scene.replace("  if (\n    ['park', 'garden'].includes(tags.leisure ?? '')\n  ) {\n    return { kind: 'green-space', label: '綠地' };\n  }", "  if (\n    ['park', 'garden', 'playground', 'pitch', 'sports_centre', 'track'].includes(\n      tags.leisure ?? ''\n    )\n  ) {\n    return { kind: 'green-space', label: '戶外空間' };\n  }\n\n  if (tags.amenity === 'community_centre') {\n    return { kind: 'culture', label: '公共空間' };\n  }")
scene = scene.replace("    case 'green-space':\n      return '一塊有名字的綠地';", "    case 'green-space':\n      return '一個戶外空間';")

pattern = re.compile(r"async function fetchOverpass\(query: string\) \{.*?\n\}\n\n\nasync function fetchOverpassCached", re.S)
replacement = '''async function fetchOverpass(query: string) {\n  const requestEndpoint = async (endpoint: string, delayMs: number) => {\n    if (delayMs > 0) {\n      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));\n    }\n\n    const response = await fetchWithTimeout(\n      endpoint,\n      {\n        method: 'POST',\n        headers: {\n          'Content-Type':\n            'application/x-www-form-urlencoded;charset=UTF-8',\n          Accept: 'application/json',\n        },\n        body: `data=${encodeURIComponent(query)}`,\n      },\n      5200\n    );\n\n    if (!response.ok) {\n      throw new Error(`Overpass ${response.status}`);\n    }\n\n    const data = (await response.json()) as OverpassResponse;\n\n    if (!Array.isArray(data.elements)) {\n      throw new Error('Overpass response missing elements');\n    }\n\n    return data.elements;\n  };\n\n  return await new Promise<OverpassElement[]>((resolve, reject) => {\n    let failures = 0;\n    let lastError: unknown = null;\n    let settled = false;\n\n    const fail = (error: unknown) => {\n      failures += 1;\n      lastError = error;\n      if (!settled && failures >= OVERPASS_ENDPOINTS.length) {\n        settled = true;\n        if (\n          lastError instanceof Error &&\n          lastError.message === 'Scene request timed out'\n        ) {\n          reject(new Error('Scene 資料服務逾時，請再試一次。'));\n        } else {\n          reject(new Error('Scene 資料服務暫時沒有回應，請再試一次。'));\n        }\n      }\n    };\n\n    OVERPASS_ENDPOINTS.forEach((endpoint, index) => {\n      void requestEndpoint(endpoint, index * 350)\n        .then((elements) => {\n          if (settled) return;\n          settled = true;\n          resolve(elements);\n        })\n        .catch(fail);\n    });\n  });\n}\n\n\nasync function fetchOverpassCached'''
scene, count = pattern.subn(replacement, scene, count=1)
if count != 1:
    raise SystemExit('fetchOverpass function not replaced')
scene_path.write_text(scene, encoding='utf-8')

# 5) Treat selected time as the important gate. A nearby walkable place should
# not be rejected because it misses an ideal-distance target.
routing_path = Path('src/lib/routing-engine.ts')
routing = routing_path.read_text(encoding='utf-8')
routing = routing.replace("  // Candidate quality is already ranked upstream. Only consider a small window,\n  // then prefer the one whose straight-line distance best fits this duration.\n  const shortlist = args.candidates\n    .slice(0, 7)", "  // Search a broader quality window, then try the candidates closest to the\n  // requested time first. This avoids throwing away perfectly walkable nearby\n  // places just because they ranked 8th or 9th on POI quality.\n  const shortlist = args.candidates\n    .slice(0, 18)")
routing = routing.replace("    .slice(0, 3);", "    .slice(0, 5);", 1)
routing = routing.replace("      if (route.distanceMeters <= maxDistance * 1.08 && score < bestFallbackScore) {\n        bestFallback = { scene, route };\n        bestFallbackScore = score;\n      }", "      if (\n        route.distanceMeters >= 70 &&\n        estimatedSeconds <= timeBudgetSeconds * 1.12 &&\n        score < bestFallbackScore\n      ) {\n        bestFallback = { scene, route };\n        bestFallbackScore = score;\n      }")
routing = routing.replace("      const fastFallbackFits =\n        route.distanceMeters <= maxDistance * 1.08 &&\n        estimatedSeconds <= timeBudgetSeconds * 1.1 &&\n        overlap <= 0.76;", "      const fastFallbackFits =\n        route.distanceMeters >= 70 &&\n        estimatedSeconds <= timeBudgetSeconds * 1.06 &&\n        overlap <= 0.85;")
routing_path.write_text(routing, encoding='utf-8')

# 6) AI is removed from destination choice. OSM + deterministic scoring + OSRM
# are the reliable core. Keep AI utilities available only for explicit dev tests.
controller_path = Path('src/hooks/use-detour-home-controller.ts')
controller = controller_path.read_text(encoding='utf-8')
controller = controller.replace("  generateJourneyWithAI,\n  isAIEngineConfigured,\n  rankSceneCandidatesWithAI,\n  testAIEngineConnection,", "  isAIEngineConfigured,\n  testAIEngineConnection,")

prewarm_ai = re.compile(r"\n      // Taste ranking is future preference data only; never block this ticket\.\n      if \(.*?\n      \}\n", re.S)
controller, count = prewarm_ai.subn('', controller, count=1)
if count != 1:
    raise SystemExit('prewarm AI block not removed')

old_recovery_rank = '''      const aiRanking =\n        recoveryMood === 'food' || recoveryMood === 'color'\n          ? { candidates, usedAI: false }\n          : await rankSceneCandidatesWithAI({\n              candidates,\n              moodId:\n                recoveryMood,\n              context:\n                recoveryContext,\n              minutes:\n                recoveryMinutes,\n            });\n\n      const routed =\n        await resolveRoutedScene({\n          start: currentPoint,\n          candidates:\n            aiRanking.candidates,'''
new_recovery_rank = '''      const routed =\n        await resolveRoutedScene({\n          start: currentPoint,\n          candidates,'''
if old_recovery_rank not in controller:
    raise SystemExit('recovery AI ranking block not found')
controller = controller.replace(old_recovery_rank, new_recovery_rank, 1)

recovery_ai = re.compile(r"\n      const aiRecovery =\n        recoveryMood === 'color'.*?\n\n      const nextArrivalMission =\n        aiRecovery\?\.arrivalMission \?\?\n        fallbackArrival;", re.S)
controller, count = recovery_ai.subn("\n      const nextArrivalMission =\n        fallbackArrival;", controller, count=1)
if count != 1:
    raise SystemExit('recovery AI mission block not removed')

post_ready_ai = re.compile(r"\n      // Arrival copy may get an AI polish later, but never blocks the ticket\..*?\n      \}\n", re.S)
controller, count = post_ready_ai.subn('', controller, count=1)
if count != 1:
    raise SystemExit('post-ready AI polish block not removed')

controller_path.write_text(controller, encoding='utf-8')
