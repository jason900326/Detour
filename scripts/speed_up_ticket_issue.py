from pathlib import Path

controller_path = Path('src/hooks/use-detour-home-controller.ts')
controller = controller_path.read_text(encoding='utf-8')

old_effect = """  useEffect(() => {\n    if (stage !== 'mood' || !selectedMood) return;\n\n    const timer = setTimeout(() => {\n      void prewarmDetour(selectedMood);\n    }, 80);\n\n    return () => clearTimeout(timer);\n  }, [stage, selectedMood, selectedMinutes]);"""
new_effect = """  useEffect(() => {\n    if (stage !== 'mood') return;\n\n    // Warm the generic nearby OSM query as soon as the mood screen appears.\n    // All non-food moods share this discovery query, so the user's decision\n    // time becomes useful network time instead of dead time after tapping go.\n    const warmMood = selectedMood ?? 'wander';\n    const timer = setTimeout(() => {\n      void prewarmDetour(warmMood);\n    }, selectedMood ? 40 : 0);\n\n    return () => clearTimeout(timer);\n  }, [stage, selectedMood, selectedMinutes]);"""
if old_effect not in controller:
    raise SystemExit('mood prewarm effect not found')
controller = controller.replace(old_effect, new_effect, 1)

old_prewarm_call = """      void prewarmWalkingRoutes(point, candidates, 2);"""
new_prewarm_call = """      void prewarmWalkingRoutes(\n        point,\n        candidates,\n        2,\n        minutes,\n        paceDistanceScale\n      );"""
if old_prewarm_call not in controller:
    raise SystemExit('prewarmWalkingRoutes call not found')
controller = controller.replace(old_prewarm_call, new_prewarm_call, 1)

old_prepare_start = """  async function prepareDetourTicket() {\n    stopLocationWatcher();\n    setTicketBuildError(null);\n    const ticketStartedAt = Date.now();"""
new_prepare_start = """  async function prepareDetourTicket() {\n    stopLocationWatcher();\n    setTicketBuildError(null);\n    const ticketStartedAt = Date.now();\n\n    // Never show a dead printer. Feed the top edge immediately while data is\n    // being prepared, then hold here until the real route is ready.\n    routeProgress.stopAnimation();\n    Animated.timing(routeProgress, {\n      toValue: 0.13,\n      duration: 420,\n      easing: Easing.out(Easing.cubic),\n      useNativeDriver: false,\n    }).start();"""
if old_prepare_start not in controller:
    raise SystemExit('prepare start not found')
controller = controller.replace(old_prepare_start, new_prepare_start, 1)

old_cached_cond = """      if (cached && cachedCandidates.length > 0) {"""
new_cached_cond = """      if (cached) {"""
if old_cached_cond not in controller:
    raise SystemExit('cached condition not found')
controller = controller.replace(old_cached_cond, new_cached_cond, 1)

old_location = """        const location = await Location.getCurrentPositionAsync({\n          accuracy: Location.Accuracy.Balanced,\n        });\n\n        startPoint = {\n          latitude: location.coords.latitude,\n          longitude: location.coords.longitude,\n        };"""
new_location = """        let location = await Location.getLastKnownPositionAsync({\n          maxAge: 2 * 60 * 1000,\n          requiredAccuracy: 150,\n        });\n\n        if (!location) {\n          location = await Location.getCurrentPositionAsync({\n            accuracy: Location.Accuracy.Balanced,\n          });\n        }\n\n        startPoint = {\n          latitude: location.coords.latitude,\n          longitude: location.coords.longitude,\n        };"""
if old_location not in controller:
    raise SystemExit('prepare location block not found')
controller = controller.replace(old_location, new_location, 1)

old_print = """      const minimumPrintMs = 650;\n      const remainingPrintMs = Math.max(\n        0,\n        minimumPrintMs - (Date.now() - ticketStartedAt)\n      );\n\n      if (remainingPrintMs > 0) {\n        await new Promise<void>((resolve) => {\n          setTimeout(resolve, remainingPrintMs);\n        });\n      }\n\n      await new Promise<void>((resolve) => {\n        Animated.timing(routeProgress, {\n          toValue: 1,\n          duration: 1100,\n          easing: Easing.inOut(Easing.quad),\n          useNativeDriver: false,\n        }).start(() => resolve());\n      });"""
new_print = """      // The printer has already shown a small paper edge while searching.\n      // Once routing is real, finish the physical feed quickly instead of\n      // adding another full second of perceived loading.\n      const minimumPrintMs = 300;\n      const remainingPrintMs = Math.max(\n        0,\n        minimumPrintMs - (Date.now() - ticketStartedAt)\n      );\n\n      if (remainingPrintMs > 0) {\n        await new Promise<void>((resolve) => {\n          setTimeout(resolve, remainingPrintMs);\n        });\n      }\n\n      routeProgress.stopAnimation();\n      await new Promise<void>((resolve) => {\n        Animated.timing(routeProgress, {\n          toValue: 1,\n          duration: 650,\n          easing: Easing.out(Easing.cubic),\n          useNativeDriver: false,\n        }).start(() => resolve());\n      });"""
if old_print not in controller:
    raise SystemExit('final print block not found')
controller = controller.replace(old_print, new_print, 1)

controller_path.write_text(controller, encoding='utf-8')

view_path = Path('src/components/detour-home-view.tsx')
view = view_path.read_text(encoding='utf-8')
old_view = """              <View style={styles.v48PaperViewport} pointerEvents=\"none\">\n                <Animated.View\n                  style={[\n                    styles.v48PaperTrack,\n                    {\n                      transform: [\n                        {\n                          translateY: routeProgress.interpolate({\n                            inputRange: [0, 1],\n                            outputRange: [-420, 0],\n                          }),\n                        },\n                      ],\n                    },\n                  ]}\n                >\n                  <V45Ticket\n                    timeLabel={selectedTime ?? '15'}\n                    moodId={selectedMood ?? 'wander'}\n                    moodLabel={mood?.label ?? '—'}\n                    serial={ticketSerial(selectedTime, selectedMood)}\n                    stamped={stage === 'ready'}\n                    stampProgress={ticketStamp}\n                  />\n                </Animated.View>\n              </View>"""
new_view = """              <Animated.View\n                pointerEvents=\"none\"\n                style={[\n                  styles.v48PaperViewport,\n                  {\n                    height: routeProgress.interpolate({\n                      inputRange: [0, 1],\n                      outputRange: [0, 409],\n                    }),\n                  },\n                ]}\n              >\n                <View style={styles.v48PaperTrack}>\n                  <V45Ticket\n                    timeLabel={selectedTime ?? '15'}\n                    moodId={selectedMood ?? 'wander'}\n                    moodLabel={mood?.label ?? '—'}\n                    serial={ticketSerial(selectedTime, selectedMood)}\n                    stamped={stage === 'ready'}\n                    stampProgress={ticketStamp}\n                  />\n                </View>\n              </Animated.View>"""
if old_view not in view:
    raise SystemExit('paper animation block not found')
view = view.replace(old_view, new_view, 1)
view_path.write_text(view, encoding='utf-8')

routing_path = Path('src/lib/routing-engine.ts')
routing = routing_path.read_text(encoding='utf-8')
old_cache = """const WALKING_ROUTE_CACHE_TTL = 2 * 60 * 1000;\nconst walkingRouteCache = new Map<string, { expiresAt: number; route: WalkingRoute }>();"""
new_cache = """const WALKING_ROUTE_CACHE_TTL = 2 * 60 * 1000;\nconst walkingRouteCache = new Map<string, { expiresAt: number; route: WalkingRoute }>();\nconst walkingRouteInFlight = new Map<string, Promise<WalkingRoute>>();"""
if old_cache not in routing:
    raise SystemExit('route cache declarations not found')
routing = routing.replace(old_cache, new_cache, 1)

old_fetch = """  const cacheKey = walkingRouteCacheKey(start, destination);\n  const cached = walkingRouteCache.get(cacheKey);\n  if (cached && cached.expiresAt > Date.now()) return cached.route;\n\n  await throttleRouter();\n\n  const coordinates = [\n    `${start.longitude},${start.latitude}`,\n    `${destination.longitude},${destination.latitude}`,\n  ].join(';');\n\n  const url =\n    `${FOOT_ROUTER}/${coordinates}` +\n    '?overview=full&geometries=geojson&steps=true&alternatives=false';\n  const response = await fetchWithTimeout(url, timeoutMs);\n\n  if (!response.ok) throw new Error(`Walking router ${response.status}`);\n\n  const data = (await response.json()) as OsrmResponse;\n  const route = data.routes?.[0];\n\n  if (data.code !== 'Ok' || !route || !route.geometry?.coordinates?.length) {\n    throw new Error('No walking route');\n  }\n\n  const normalized: WalkingRoute = {\n    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({\n      latitude,\n      longitude,\n    })),\n    distanceMeters: route.distance,\n    durationSeconds: route.duration,\n  };\n\n  walkingRouteCache.set(cacheKey, {\n    expiresAt: Date.now() + WALKING_ROUTE_CACHE_TTL,\n    route: normalized,\n  });\n\n  return normalized;"""
new_fetch = """  const cacheKey = walkingRouteCacheKey(start, destination);\n  const cached = walkingRouteCache.get(cacheKey);\n  if (cached && cached.expiresAt > Date.now()) return cached.route;\n\n  // Prewarm and ticket issue often ask for the exact same leg at nearly the\n  // same time. Share that request instead of queueing a duplicate behind the\n  // router throttle.\n  const inFlight = walkingRouteInFlight.get(cacheKey);\n  if (inFlight) return inFlight;\n\n  const request = (async () => {\n    await throttleRouter();\n\n    const coordinates = [\n      `${start.longitude},${start.latitude}`,\n      `${destination.longitude},${destination.latitude}`,\n    ].join(';');\n\n    const url =\n      `${FOOT_ROUTER}/${coordinates}` +\n      '?overview=full&geometries=geojson&steps=true&alternatives=false';\n    const response = await fetchWithTimeout(url, timeoutMs);\n\n    if (!response.ok) throw new Error(`Walking router ${response.status}`);\n\n    const data = (await response.json()) as OsrmResponse;\n    const route = data.routes?.[0];\n\n    if (data.code !== 'Ok' || !route || !route.geometry?.coordinates?.length) {\n      throw new Error('No walking route');\n    }\n\n    const normalized: WalkingRoute = {\n      coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({\n        latitude,\n        longitude,\n      })),\n      distanceMeters: route.distance,\n      durationSeconds: route.duration,\n    };\n\n    walkingRouteCache.set(cacheKey, {\n      expiresAt: Date.now() + WALKING_ROUTE_CACHE_TTL,\n      route: normalized,\n    });\n\n    return normalized;\n  })().finally(() => {\n    walkingRouteInFlight.delete(cacheKey);\n  });\n\n  walkingRouteInFlight.set(cacheKey, request);\n  return request;"""
if old_fetch not in routing:
    raise SystemExit('fetchWalkingRoute body not found')
routing = routing.replace(old_fetch, new_fetch, 1)

old_prewarm = """export async function prewarmWalkingRoutes(\n  start: GeoPoint,\n  candidates: SceneCandidate[],\n  limit = 2\n) {\n  for (const scene of candidates.slice(0, Math.max(0, limit))) {\n    try {\n      await fetchWalkingRoute(start, scene.point, 4200);\n    } catch {\n      // Prewarming is opportunistic; ticket issue can still try another route.\n    }\n  }\n}"""
new_prewarm = """export async function prewarmWalkingRoutes(\n  start: GeoPoint,\n  candidates: SceneCandidate[],\n  limit = 2,\n  minutes = 15,\n  distanceScale = 1\n) {\n  const straightTarget = targetDistance(minutes) * distanceScale * 0.74;\n  const likely = candidates\n    .slice(0, 7)\n    .sort(\n      (a, b) =>\n        Math.abs(a.straightDistanceMeters - straightTarget) -\n        Math.abs(b.straightDistanceMeters - straightTarget)\n    )\n    .slice(0, Math.max(0, limit));\n\n  for (const scene of likely) {\n    try {\n      await fetchWalkingRoute(start, scene.point, 3200);\n    } catch {\n      // Prewarming is opportunistic; ticket issue can still try another route.\n    }\n  }\n}"""
if old_prewarm not in routing:
    raise SystemExit('prewarmWalkingRoutes function not found')
routing = routing.replace(old_prewarm, new_prewarm, 1)

if 'const TICKET_ROUTING_BUDGET_MS = 6800;' not in routing:
    raise SystemExit('routing budget not found')
routing = routing.replace('const TICKET_ROUTING_BUDGET_MS = 6800;', 'const TICKET_ROUTING_BUDGET_MS = 4800;', 1)
if 'const route = await fetchWalkingRoute(args.start, scene.point, 4400);' not in routing:
    raise SystemExit('ticket route timeout not found')
routing = routing.replace('const route = await fetchWalkingRoute(args.start, scene.point, 4400);', 'const route = await fetchWalkingRoute(args.start, scene.point, 3200);', 1)

old_fast = """      if (route.distanceMeters <= maxDistance * 1.08 && score < bestFallbackScore) {\n        bestFallback = { scene, route };\n        bestFallbackScore = score;\n      }\n\n      const distanceFits ="""
new_fast = """      if (route.distanceMeters <= maxDistance * 1.08 && score < bestFallbackScore) {\n        bestFallback = { scene, route };\n        bestFallbackScore = score;\n      }\n\n      // A route that is safely inside the time/distance envelope is already\n      // good enough for a fast ticket, even if it misses the ideal-distance\n      // band or repeats a little more history than preferred.\n      const fastFallbackFits =\n        route.distanceMeters <= maxDistance * 1.08 &&\n        estimatedSeconds <= timeBudgetSeconds * 1.1 &&\n        overlap <= 0.76;\n\n      const distanceFits ="""
if old_fast not in routing:
    raise SystemExit('fallback scoring block not found')
routing = routing.replace(old_fast, new_fast, 1)

old_return = """      if (distanceFits && timeFits && noveltyFits) {\n        return { scene, route };\n      }"""
new_return = """      if (distanceFits && timeFits && noveltyFits) {\n        return { scene, route };\n      }\n\n      if (fastFallbackFits) {\n        return { scene, route };\n      }"""
if old_return not in routing:
    raise SystemExit('fast path return block not found')
routing = routing.replace(old_return, new_return, 1)

routing_path.write_text(routing, encoding='utf-8')
