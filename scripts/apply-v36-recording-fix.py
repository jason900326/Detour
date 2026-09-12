from pathlib import Path

ROOT = Path('.')


def rep(text: str, old: str, new: str, label: str, required: bool = True) -> str:
    count = text.count(old)
    if count == 0 and not required:
        print(f'[skip] {label}')
        return text
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


def between(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'{label}: start marker missing')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'{label}: end marker missing')
    return text[:start] + replacement + text[end:]


# ------------------------------------------------------------
# Main app: fix mood grid + prewarm + make ticket non-blocking on AI
# ------------------------------------------------------------
p = ROOT / 'src/app/index.tsx'
s = p.read_text(encoding='utf-8')

s = rep(
    s,
    """type SessionSceneFailure = {\n  sceneId: string;\n  sceneName: string;\n  reason: SceneIssueReason;\n  createdAt: string;\n};""",
    """type SessionSceneFailure = {\n  sceneId: string;\n  sceneName: string;\n  reason: SceneIssueReason;\n  createdAt: string;\n};\n\ntype DetourPrewarm = {\n  point: GeoPoint;\n  context: LightContext;\n  candidatesByMood: Partial<Record<MoodId, SceneCandidate[]>>;\n  rankedIdsByMood: Partial<Record<MoodId, string[]>>;\n  aiUsedByMood: Partial<Record<MoodId, boolean>>;\n  createdAt: number;\n};""",
    'prewarm type',
)

s = rep(
    s,
    """  const stageRef = useRef<Stage>('boot');\n\n  const screenOpacity = useRef(new Animated.Value(1)).current;""",
    """  const stageRef = useRef<Stage>('boot');\n  const prewarmRef = useRef<DetourPrewarm | null>(null);\n  const prewarmInFlightRef = useRef(false);\n\n  const screenOpacity = useRef(new Animated.Value(1)).current;""",
    'prewarm refs',
)

s = rep(
    s,
    """  useEffect(() => {\n    traveledMetersRef.current = traveledMeters;\n  }, [traveledMeters]);\n\n  useFocusEffect(""",
    """  useEffect(() => {\n    traveledMetersRef.current = traveledMeters;\n  }, [traveledMeters]);\n\n  useEffect(() => {\n    if (stage !== 'time' && stage !== 'mood') return;\n\n    const timer = setTimeout(() => {\n      void prewarmDetour();\n    }, 180);\n\n    return () => clearTimeout(timer);\n  }, [stage]);\n\n  useFocusEffect(""",
    'prewarm effect',
)

prewarm_helpers = r'''  async function prewarmDetour() {
    const cached = prewarmRef.current;

    if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) {
      return;
    }

    if (prewarmInFlightRef.current) return;
    prewarmInFlightRef.current = true;

    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') return;

      let location = await Location.getLastKnownPositionAsync({
        maxAge: 3 * 60 * 1000,
        requiredAccuracy: 120,
      });

      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const point: GeoPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const context = getLightContext(point, new Date());
      const visitedSceneIds = passport
        .map((entry) => entry.sceneId)
        .filter((value): value is string => typeof value === 'string');
      const sceneFeedback = await loadSceneFeedback();
      const moodIds = MOODS.map((item) => item.id);

      const candidateEntries = await Promise.all(
        moodIds.map(async (moodId) => {
          try {
            const candidates = await findSceneCandidates({
              start: point,
              moodId,
              context,
              minutes: 60,
              excludeSceneIds: visitedSceneIds,
              feedback: sceneFeedback,
              distanceScale: paceDistanceScale,
            });
            return [moodId, candidates] as const;
          } catch {
            return [moodId, [] as SceneCandidate[]] as const;
          }
        })
      );

      const candidatesByMood: Partial<Record<MoodId, SceneCandidate[]>> = {};
      const rankedIdsByMood: Partial<Record<MoodId, string[]>> = {};
      const aiUsedByMood: Partial<Record<MoodId, boolean>> = {};

      for (const [moodId, candidates] of candidateEntries) {
        candidatesByMood[moodId] = candidates;
        rankedIdsByMood[moodId] = candidates.map((candidate) => candidate.id);
        aiUsedByMood[moodId] = false;
      }

      const createdAt = Date.now();
      prewarmRef.current = {
        point,
        context,
        candidatesByMood,
        rankedIdsByMood,
        aiUsedByMood,
        createdAt,
      };

      // Taste ranking continues in the background. Ticket issuance never waits
      // for these calls; local scoring remains a valid fallback.
      if (isAIEngineConfigured()) {
        void Promise.all(
          candidateEntries.map(async ([moodId, candidates]) => {
            if (candidates.length === 0) return;

            try {
              const ranking = await rankSceneCandidatesWithAI({
                candidates,
                moodId,
                context,
                minutes: selectedMinutes || 15,
              });

              const current = prewarmRef.current;
              if (!current || current.createdAt !== createdAt) return;

              current.rankedIdsByMood[moodId] = ranking.candidates.map(
                (candidate) => candidate.id
              );
              current.aiUsedByMood[moodId] = ranking.usedAI;
            } catch {
              // Local ranking is already stored.
            }
          })
        );
      }
    } catch {
      // Prewarming is an optimization. A normal ticket build remains available.
    } finally {
      prewarmInFlightRef.current = false;
    }
  }

  function applyCachedRanking(
    candidates: SceneCandidate[],
    rankedIds: string[] | undefined
  ) {
    if (!rankedIds?.length) return candidates;

    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const ranked = rankedIds
      .map((id) => byId.get(id))
      .filter((candidate): candidate is SceneCandidate => Boolean(candidate));
    const used = new Set(ranked.map((candidate) => candidate.id));

    return [
      ...ranked,
      ...candidates.filter((candidate) => !used.has(candidate.id)),
    ];
  }

'''

s = rep(
    s,
    "  async function prepareDetourTicket() {",
    prewarm_helpers + "  async function prepareDetourTicket() {",
    'prewarm helpers',
)

new_prepare = r'''  async function prepareDetourTicket() {
    stopLocationWatcher();
    const ticketStartedAt = Date.now();

    let permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      const testSessionId = playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: 'location-permission',
          })
        );
      }

      transitionTo('mood');
      Alert.alert(
        '需要定位才能印出這張票',
        'DETOUR 會用你現在的位置選 Scene、確認步行路線，並判斷白天或夜間情境。'
      );
      return;
    }

    try {
      const finalMood: MoodId = selectedMood ?? 'wander';
      const minutes = selectedMinutes || 15;
      const cached =
        prewarmRef.current &&
        Date.now() - prewarmRef.current.createdAt < 5 * 60 * 1000
          ? prewarmRef.current
          : null;

      let startPoint: GeoPoint;
      let context: LightContext;
      let rankedCandidates: SceneCandidate[];
      let rankingUsedAI = false;

      const cachedCandidates = cached?.candidatesByMood[finalMood] ?? [];

      if (cached && cachedCandidates.length > 0) {
        startPoint = cached.point;
        context = cached.context;
        rankedCandidates = applyCachedRanking(
          cachedCandidates,
          cached.rankedIdsByMood[finalMood]
        );
        rankingUsedAI = cached.aiUsedByMood[finalMood] ?? false;

        advanceTicketProgress(
          0.58,
          `附近已先準備好。正在確認 ${rankedCandidates.length} 個候選的步行路線…`
        );
      } else {
        advanceTicketProgress(0.12, '正在取得現在位置…');

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        startPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        context = getLightContext(startPoint, new Date());

        advanceTicketProgress(0.24, '位置確認。正在找附近的小發現…');

        const visitedSceneIds = passport
          .map((entry) => entry.sceneId)
          .filter((value): value is string => typeof value === 'string');
        const sceneFeedback = await loadSceneFeedback();
        const sceneCandidates = await findSceneCandidates({
          start: startPoint,
          moodId: finalMood,
          context,
          minutes,
          excludeSceneIds: visitedSceneIds,
          feedback: sceneFeedback,
          distanceScale: paceDistanceScale,
        });

        if (sceneCandidates.length === 0) {
          throw new Error(
            finalMood === 'food'
              ? '附近暫時找不到適合「吃點東西」的真實食物 Scene。'
              : '附近暫時沒有找到適合現在情境的 Scene。'
          );
        }

        if (isAIEngineConfigured()) {
          advanceTicketProgress(
            0.46,
            `找到 ${sceneCandidates.length} 個候選。正在做最後挑選…`
          );

          const aiRanking = await rankSceneCandidatesWithAI({
            candidates: sceneCandidates,
            moodId: finalMood,
            context,
            minutes,
          });
          rankedCandidates = aiRanking.candidates;
          rankingUsedAI = aiRanking.usedAI;
        } else {
          rankedCandidates = sceneCandidates;
        }
      }

      if (rankedCandidates.length === 0) {
        throw new Error('附近暫時沒有可用的 Scene。');
      }

      setLastAIResult(rankingUsedAI ? 'ai' : 'fallback');

      const routed = await resolveRoutedScene({
        start: startPoint,
        candidates: rankedCandidates,
        minutes,
        distanceScale: paceDistanceScale,
      });

      advanceTicketProgress(
        0.82,
        `步行主線 ${Math.round(routed.route.distanceMeters)}m 已確認。正在出票…`
      );

      const nextPlan = buildJourneyPlan({
        minutes,
        moodId: finalMood,
        context,
        color: selectedColor,
      });
      nextPlan.arrivalMission = buildSceneArrivalMission({
        scene: routed.scene,
        moodId: finalMood,
        context,
      });

      // Side Quests are intentionally deterministic during field testing.
      // They must be instantly available and easy to compare across runs.
      const nextNavigationRoute = buildNavigationRouteFromPolyline({
        coordinates: routed.route.coordinates,
        totalDistanceMeters: routed.route.distanceMeters,
        durationSeconds: routed.route.durationSeconds,
        sideMissionCount: nextPlan.sideMissions.length,
      });

      if (nextNavigationRoute.beats.length < 2) {
        throw new Error(
          '這個 Scene 太近或路線資料不足，暫時無法組成一趟 DETOUR。'
        );
      }

      setLatitude(startPoint.latitude);
      setLongitude(startPoint.longitude);
      setDetourStart(startPoint);
      setSelectedScene(routed.scene);
      selectedSceneRef.current = routed.scene;
      setWalkingRoute(routed.route);
      setPlan(nextPlan);
      planRef.current = nextPlan;
      setNavigationRoute(nextNavigationRoute);
      navigationRouteRef.current = nextNavigationRoute;
      setNavigationBeatIndex(0);
      navigationBeatIndexRef.current = 0;

      const firstBeatDistance =
        nextNavigationRoute.beats[0]?.segmentDistanceMeters ?? 0;
      setBeatRemainingMeters(firstBeatDistance);
      beatRemainingMetersRef.current = firstBeatDistance;
      setShowNextBeatMap(false);
      setSideMissionIndex(0);
      sideMissionIndexRef.current = 0;
      setTraveledMeters(0);
      traveledMetersRef.current = 0;
      setLightContext(context);
      setPhotos([]);
      setActiveTrace([]);
      setRerouteCount(0);
      rerouteCountRef.current = 0;
      setRerouteFailed(false);
      offRouteCountRef.current = 0;
      rerouteInFlightRef.current = false;
      setSceneFailures([]);
      sceneFailuresRef.current = [];
      lastTracePointRef.current = null;

      advanceTicketProgress(1, '車票完成');

      const testSessionId = playtestSessionIdRef.current;
      if (testSessionId) {
        void updatePlaytestSession(testSessionId, {
          status: 'ready',
          lightContext: context,
          sceneKind: routed.scene.kind,
          plannedDistanceMeters: routed.route.distanceMeters,
          plannedDurationSeconds: routed.route.durationSeconds,
          sideMissionsTotal: nextPlan.sideMissions.length,
        }).then(setPlaytestSessions);
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      console.log(
        `[DETOUR TIMING] ticket ready in ${Date.now() - ticketStartedAt}ms`
      );
      transitionTo('ready');

      // Arrival copy may get an AI polish later, but never blocks the ticket.
      if (isAIEngineConfigured()) {
        void generateJourneyWithAI({
          scene: routed.scene,
          moodId: finalMood,
          context,
          minutes,
          sideMissionCount: 0,
          missionMilestones: [],
          routeDistanceMeters: routed.route.distanceMeters,
          routeDurationSeconds: routed.route.durationSeconds,
        })
          .then((aiJourney) => {
            if (!aiJourney?.arrivalMission) return;
            if (selectedSceneRef.current?.id !== routed.scene.id) return;

            setPlan((current) => {
              if (!current) return current;
              const updated = {
                ...current,
                arrivalMission: aiJourney.arrivalMission,
              };
              planRef.current = updated;
              return updated;
            });
            setLastAIResult('ai');
          })
          .catch(() => undefined);
      }
    } catch (error) {
      stopLocationWatcher();
      transitionTo('mood');

      const message =
        error instanceof Error
          ? error.message
          : '請確認網路和定位服務後再試一次。';
      const testSessionId = playtestSessionIdRef.current;

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: message.slice(0, 120),
          })
        );
      }

      Alert.alert(
        '這張 DETOUR 車票暫時印不出來',
        `${message}\n\n車票只有在 Scene 和步行路線都確認成功後才會發行。`
      );
    }
  }

'''

s = between(
    s,
    "  async function prepareDetourTicket() {",
    "  async function startDetour() {",
    new_prepare,
    'replace ticket builder',
)

s = rep(
    s,
    """  v35MoodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },\n  v35MoodCard: { width: '48.6%',""",
    """  v35MoodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },\n  v35MoodCard: { width: '48%',""",
    'two-column mood grid',
)

s = rep(
    s,
    """                  DETOUR 不會在開 App 時先要求定位。\n                  只有你按下「開始繞路」後，才會用目前位置找 Scene、\n                  算步行路線與推進導航。""",
    """                  DETOUR 會在首頁先用目前位置準備附近候選，\n                  讓你選完時間和心情後不用從零開始等。\n                  旅程中的 GPS 軌跡仍只留在手機。""",
    'settings location copy',
)

# Accuracy-aware off-route threshold; high GPS error should not trigger a false reroute.
s = rep(
    s,
    """        if (offRouteDistance > 45) {\n          offRouteCountRef.current += 1;""",
    """        const gpsAccuracy = newLocation.coords.accuracy ?? 0;\n        const offRouteThreshold = Math.max(45, Math.min(70, gpsAccuracy + 30));\n\n        if (offRouteDistance > offRouteThreshold) {\n          offRouteCountRef.current += 1;""",
    'accuracy-aware reroute',
)

p.write_text(s, encoding='utf-8')
print('patched src/app/index.tsx')


# ------------------------------------------------------------
# Scene discovery: stronger time bands, statue support, shared OSM cache
# ------------------------------------------------------------
p = ROOT / 'src/lib/scene-engine.ts'
s = p.read_text(encoding='utf-8')

s = rep(s, "  | 'artwork'\n  | 'historic'", "  | 'artwork'\n  | 'statue'\n  | 'historic'", 'statue type')

s = rep(
    s,
    """  if (tags.tourism === 'artwork') {\n    const artworkType = tags.artwork_type ?? '';\n\n    if (artworkType === 'mural') {""",
    """  if (tags.tourism === 'artwork') {\n    const artworkType = tags.artwork_type ?? '';\n\n    if (['statue', 'sculpture', 'bust'].includes(artworkType)) {\n      return { kind: 'statue', label: '雕像' };\n    }\n\n    if (artworkType === 'mural') {""",
    'tourism statue classification',
)

s = rep(
    s,
    """  if (\n    tags.historic &&\n    !['memorial', 'wayside_shrine'].includes(tags.historic)\n  ) {""",
    """  if (\n    tags.historic === 'memorial' &&\n    ['statue', 'sculpture', 'bust'].includes(tags.memorial ?? '')\n  ) {\n    return { kind: 'statue', label: '紀念雕像' };\n  }\n\n  if (\n    tags.historic &&\n    !['memorial', 'wayside_shrine'].includes(tags.historic)\n  ) {""",
    'memorial statue classification',
)

s = rep(s, "    artwork: 32,", "    artwork: 32,\n    statue: 48,", 'statue quality')
s = rep(s, "      'mural', 'street-art', 'artwork'", "      'mural', 'street-art', 'artwork', 'statue'", 'statue primary', required=False)
# destinationTier list is formatted over lines in current source.
s = rep(
    s,
    """    ['mural', 'street-art', 'artwork'].includes(kind)""",
    """    ['mural', 'street-art', 'artwork', 'statue'].includes(kind)""",
    'statue visual tier',
)
s = rep(s, "    case 'artwork':\n      return '一件公共藝術';", "    case 'artwork':\n      return '一件公共藝術';\n    case 'statue':\n      return '一座沒有名字的雕像';", 'statue generated name')
s = rep(
    s,
    """        'historic',\n        'viewpoint',""",
    """        'historic',\n        'statue',\n        'viewpoint',""",
    'statue night gate',
)
s = rep(s, "    artwork: 118,", "    artwork: 118,\n    statue: 138,", 'statue base score')
s = rep(
    s,
    """        'artwork',\n        'steps',""",
    """        'artwork',\n        'statue',\n        'steps',""",
    'statue weird boost',
)

new_distance_profile = r'''function journeyTargetDistance(minutes: number) {
  const safeMinutes = Math.max(5, Math.min(60, Math.round(minutes / 5) * 5));

  if (safeMinutes <= 5) return 220;
  if (safeMinutes <= 10) return 420;
  if (safeMinutes <= 15) return 680;
  if (safeMinutes <= 30) return Math.round(680 + (safeMinutes - 15) * 28);
  if (safeMinutes <= 45) return Math.round(1100 + (safeMinutes - 30) * 22);
  return Math.round(1430 + (safeMinutes - 45) * 18);
}

function distanceProfile(
  minutes: number,
  distanceScale = 1
) {
  const routeTarget = journeyTargetDistance(minutes) * distanceScale;

  // OSM candidate distance is straight-line; walking route is normally longer.
  return {
    ideal: routeTarget * 0.74,
    max: routeTarget * 1.15,
  };
}

'''
s = between(s, 'function distanceProfile(', 'function scoreDistance(', new_distance_profile, 'distance profile')

s = rep(
    s,
    """  const radius =\n    moodId === 'food'\n      ? 700\n      : 900;""",
    """  const radius =\n    moodId === 'food'\n      ? 1400\n      : 1800;""",
    'discovery radius',
)

s = rep(
    s,
    """  nwr${around}[\"historic\"][\"name\"];\n  nwr${around}[\"natural\"=\"tree\"][\"heritage\"];""",
    """  nwr${around}[\"historic\"][\"name\"];\n  nwr${around}[\"historic\"=\"memorial\"][\"memorial\"~\"statue|sculpture|bust\"];\n  nwr${around}[\"natural\"=\"tree\"][\"heritage\"];""",
    'statue overpass query',
)

s = rep(
    s,
    """const OVERPASS_ENDPOINTS = [\n  'https://overpass-api.de/api/interpreter',\n  'https://overpass.kumi.systems/api/interpreter',\n];""",
    """const OVERPASS_ENDPOINTS = [\n  'https://overpass-api.de/api/interpreter',\n  'https://overpass.kumi.systems/api/interpreter',\n];\n\nconst OVERPASS_CACHE_TTL = 10 * 60 * 1000;\nconst overpassCache = new Map<string, { expiresAt: number; elements: OverpassElement[] }>();\nconst overpassInFlight = new Map<string, Promise<OverpassElement[]>>();""",
    'overpass cache state',
)

cache_helper = r'''
async function fetchOverpassCached(query: string) {
  const cached = overpassCache.get(query);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.elements;
  }

  const inFlight = overpassInFlight.get(query);
  if (inFlight) return inFlight;

  const request = fetchOverpass(query)
    .then((elements) => {
      overpassCache.set(query, {
        expiresAt: Date.now() + OVERPASS_CACHE_TTL,
        elements,
      });
      return elements;
    })
    .finally(() => {
      overpassInFlight.delete(query);
    });

  overpassInFlight.set(query, request);
  return request;
}

export function clearSceneDiscoveryCache() {
  overpassCache.clear();
  overpassInFlight.clear();
}

'''
s = rep(
    s,
    "export async function findSceneCandidates(args: {",
    cache_helper + "export async function findSceneCandidates(args: {",
    'overpass cache helper',
)
s = rep(
    s,
    """  const elements = await fetchOverpass(\n    buildQuery(args.start, args.moodId)\n  );""",
    """  const elements = await fetchOverpassCached(\n    buildQuery(args.start, args.moodId)\n  );""",
    'use overpass cache',
)

s = rep(
    s,
    """  if (moodId === 'weird') {\n    return {\n      id: `scene-${scene.id}-weird`,\n      code: 'ARRIVAL · ODD DETAIL',\n      title: '找它最不像自己的地方。',\n      instruction:\n        '只看公共可見範圍。找一個和這個 Scene 格格不入的細節，先猜它為什麼在這裡。',\n      completion: '猜出一個理由，就完成。照片可拍可不拍。',\n      photo: false,\n      portable: true,\n    };\n  }""",
    """  if (moodId === 'weird') {\n    return {\n      id: `scene-${scene.id}-weird`,\n      code: 'ARRIVAL · COLOR HIT',\n      title: '找最搶眼的一個顏色。',\n      instruction:\n        '只看公共可見範圍。不要分析意義，直接選第一眼最搶眼的顏色。',\n      completion: '把那個顏色和 Scene 的一部分拍進同一張照片。',\n      photo: true,\n      portable: false,\n    };\n  }""",
    'objective weird arrival',
)

s = rep(
    s,
    """  if (scene.kind === 'artwork') {""",
    """  if (scene.kind === 'statue') {\n    return {\n      id: `scene-${scene.id}-statue`,\n      code: 'ARRIVAL · STATUE DETAIL',\n      title: '只拍一個明確細節。',\n      instruction:\n        '找手上拿的東西、衣服紋路、底座文字或姿勢裡最清楚的一個細節。不要拍整尊。',\n      completion: '把那個細節拍下來。',\n      photo: true,\n      portable: false,\n    };\n  }\n\n  if (scene.kind === 'artwork') {""",
    'statue arrival mission',
)

p.write_text(s, encoding='utf-8')
print('patched src/lib/scene-engine.ts')


# ------------------------------------------------------------
# Routing: selected minutes are a target, not merely a maximum.
# ------------------------------------------------------------
routing = r'''import type { GeoPoint } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

export type WalkingRoute = {
  coordinates: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
};

export type RoutedScene = {
  scene: SceneCandidate;
  route: WalkingRoute;
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      type: 'LineString';
      coordinates: [number, number][];
    };
  }>;
};

const FOOT_ROUTER =
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving';

let lastRoutingRequestAt = 0;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleRouter() {
  const elapsed = Date.now() - lastRoutingRequestAt;
  const waitFor = Math.max(0, 1100 - elapsed);

  if (waitFor > 0) await wait(waitFor);
  lastRoutingRequestAt = Date.now();
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint
): Promise<WalkingRoute> {
  await throttleRouter();

  const coordinates = [
    `${start.longitude},${start.latitude}`,
    `${destination.longitude},${destination.latitude}`,
  ].join(';');

  const url =
    `${FOOT_ROUTER}/${coordinates}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false';
  const response = await fetchWithTimeout(url, 12000);

  if (!response.ok) throw new Error(`Walking router ${response.status}`);

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (data.code !== 'Ok' || !route || !route.geometry?.coordinates?.length) {
    throw new Error('No walking route');
  }

  return {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

function targetDistance(minutes: number) {
  const safeMinutes = Math.max(5, Math.min(60, Math.round(minutes / 5) * 5));

  if (safeMinutes <= 5) return 220;
  if (safeMinutes <= 10) return 420;
  if (safeMinutes <= 15) return 680;
  if (safeMinutes <= 30) return Math.round(680 + (safeMinutes - 15) * 28);
  if (safeMinutes <= 45) return Math.round(1100 + (safeMinutes - 30) * 22);
  return Math.round(1430 + (safeMinutes - 45) * 18);
}

function routeDistanceProfile(minutes: number, distanceScale = 1) {
  const target = targetDistance(minutes) * distanceScale;

  return {
    target,
    min: Math.max(120, target * 0.68),
    max: target * 1.28,
  };
}

export async function resolveRoutedScene(args: {
  start: GeoPoint;
  candidates: SceneCandidate[];
  minutes: number;
  maxDistanceMeters?: number;
  distanceScale?: number;
}): Promise<RoutedScene> {
  const profile = routeDistanceProfile(
    args.minutes,
    args.distanceScale ?? 1
  );
  const maxDistance = args.maxDistanceMeters ?? profile.max;
  const straightTarget = profile.target * 0.74;

  // AI/editorial rank chooses taste. For the final route check, distance fit
  // gets priority inside that shortlist so a 20-minute request cannot end in
  // a 2-minute walk simply because that candidate was ranked first.
  const shortlist = args.candidates
    .slice(0, 14)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, 8);

  let bestFallback: RoutedScene | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const scene of shortlist) {
    try {
      const route = await fetchWalkingRoute(args.start, scene.point);
      const delta = Math.abs(route.distanceMeters - profile.target);

      if (route.distanceMeters <= maxDistance * 1.08 && delta < bestDelta) {
        bestFallback = { scene, route };
        bestDelta = delta;
      }

      if (
        route.distanceMeters >= profile.min &&
        route.distanceMeters <= maxDistance
      ) {
        return { scene, route };
      }
    } catch {
      // Try the next Scene. Public routing can occasionally miss a snap.
    }
  }

  if (bestFallback) return bestFallback;

  throw new Error(
    `附近有 Scene，但目前找不到符合 ${args.minutes} 分鐘節奏的步行主線。`
  );
}
'''
(ROOT / 'src/lib/routing-engine.ts').write_text(routing, encoding='utf-8')
print('patched src/lib/routing-engine.ts')


# ------------------------------------------------------------
# Playtest version marker
# ------------------------------------------------------------
p = ROOT / 'src/lib/playtest-analytics.ts'
s = p.read_text(encoding='utf-8')
s = rep(s, "  '0.35.0';", "  '0.36.0';", 'playtest version')
p.write_text(s, encoding='utf-8')
print('patched src/lib/playtest-analytics.ts')

print('v0.36 recording fixes complete')
