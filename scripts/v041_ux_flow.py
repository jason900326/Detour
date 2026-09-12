from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:140]!r}')
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags=re.S) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'expected one regex match in {path}, got {count}: {pattern[:120]!r}')
    write(path, next_text)


# ---------------------------------------------------------------------------
# Routing: tickets should prefer a good route quickly over comparing eight
# routes synchronously. Cache walking routes, try at most three candidates,
# return the first strong fit, and cap ticket routing work to a few seconds.
# ---------------------------------------------------------------------------
routing = 'src/lib/routing-engine.ts'
text = read(routing)
text = text.replace(
    "let lastRoutingRequestAt = 0;\n",
    "let lastRoutingRequestAt = 0;\nconst WALKING_ROUTE_CACHE_TTL = 2 * 60 * 1000;\nconst walkingRouteCache = new Map<string, { expiresAt: number; route: WalkingRoute }>();\n\nfunction walkingRouteCacheKey(start: GeoPoint, destination: GeoPoint) {\n  const round = (value: number) => value.toFixed(5);\n  return `${round(start.latitude)},${round(start.longitude)}>${round(destination.latitude)},${round(destination.longitude)}`;\n}\n",
    1,
)

text, count = re.subn(
    r"export async function fetchWalkingRoute\(\n  start: GeoPoint,\n  destination: GeoPoint\n\): Promise<WalkingRoute> \{.*?\n\}\n\nfunction targetDistance",
    """export async function fetchWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  timeoutMs = 12000
): Promise<WalkingRoute> {
  const cacheKey = walkingRouteCacheKey(start, destination);
  const cached = walkingRouteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.route;

  await throttleRouter();

  const coordinates = [
    `${start.longitude},${start.latitude}`,
    `${destination.longitude},${destination.latitude}`,
  ].join(';');

  const url =
    `${FOOT_ROUTER}/${coordinates}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false';
  const response = await fetchWithTimeout(url, timeoutMs);

  if (!response.ok) throw new Error(`Walking router ${response.status}`);

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (data.code !== 'Ok' || !route || !route.geometry?.coordinates?.length) {
    throw new Error('No walking route');
  }

  const normalized: WalkingRoute = {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };

  walkingRouteCache.set(cacheKey, {
    expiresAt: Date.now() + WALKING_ROUTE_CACHE_TTL,
    route: normalized,
  });

  return normalized;
}

export async function prewarmWalkingRoutes(
  start: GeoPoint,
  candidates: SceneCandidate[],
  limit = 2
) {
  for (const scene of candidates.slice(0, Math.max(0, limit))) {
    try {
      await fetchWalkingRoute(start, scene.point, 4200);
    } catch {
      // Prewarming is opportunistic; ticket issue can still try another route.
    }
  }
}

function targetDistance""",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('fetchWalkingRoute block not found')

text, count = re.subn(
    r"export async function resolveRoutedScene\(args: \{.*?\n\}\s*$",
    """export async function resolveRoutedScene(args: {
  start: GeoPoint;
  candidates: SceneCandidate[];
  minutes: number;
  maxDistanceMeters?: number;
  distanceScale?: number;
  sideMissionCount?: number;
  avoidRoutes?: GeoPoint[][];
}): Promise<RoutedScene> {
  const profile = routeDistanceProfile(
    args.minutes,
    args.distanceScale ?? 1
  );
  const maxDistance = args.maxDistanceMeters ?? profile.max;
  const straightTarget = profile.target * 0.74;
  const sideMissionCount = args.sideMissionCount ?? 0;
  const avoidRoutes = args.avoidRoutes ?? [];
  const timeBudgetSeconds = Math.max(5, args.minutes) * 60 * 1.05;
  const routingStartedAt = Date.now();
  const TICKET_ROUTING_BUDGET_MS = 6800;

  // Candidate quality is already ranked upstream. Only consider a small window,
  // then prefer the one whose straight-line distance best fits this duration.
  const shortlist = args.candidates
    .slice(0, 7)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, 3);

  let bestFallback: RoutedScene | null = null;
  let bestFallbackScore = Number.POSITIVE_INFINITY;

  for (const scene of shortlist) {
    if (Date.now() - routingStartedAt > TICKET_ROUTING_BUDGET_MS && bestFallback) {
      break;
    }

    try {
      const route = await fetchWalkingRoute(args.start, scene.point, 4400);
      const overlap = routeOverlapRatio(route.coordinates, avoidRoutes);
      const estimatedSeconds = estimatedJourneySeconds(
        route,
        sideMissionCount,
        args.minutes
      );
      const overtimeSeconds = Math.max(0, estimatedSeconds - timeBudgetSeconds);
      const distanceDelta = Math.abs(route.distanceMeters - profile.target);
      const noveltyPenalty = overlap * profile.target * 0.95;
      const overtimePenalty = overtimeSeconds * 1.4;
      const score = distanceDelta + noveltyPenalty + overtimePenalty;

      if (route.distanceMeters <= maxDistance * 1.08 && score < bestFallbackScore) {
        bestFallback = { scene, route };
        bestFallbackScore = score;
      }

      const distanceFits =
        route.distanceMeters >= profile.min &&
        route.distanceMeters <= maxDistance;
      const timeFits = estimatedSeconds <= timeBudgetSeconds;
      const noveltyFits = overlap <= 0.62;

      // Fast path: a route that clears all product gates is good enough. Do not
      // make the user wait while we compare mathematically nicer alternatives.
      if (distanceFits && timeFits && noveltyFits) {
        return { scene, route };
      }
    } catch {
      // Try the next Scene while the small routing budget remains.
    }
  }

  if (bestFallback) return bestFallback;

  throw new Error(
    `附近有 Scene，但目前找不到符合 ${args.minutes} 分鐘節奏的步行主線。`
  );
}
""",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('resolveRoutedScene block not found')
write(routing, text)


# ---------------------------------------------------------------------------
# Camera: shutter captures a temporary frame first. The user must explicitly
# keep it before we copy it into DETOUR, save it to Photos, consume 1/6, and
# return to navigation.
# ---------------------------------------------------------------------------
camera = 'src/app/camera.tsx'
text = read(camera)
text = text.replace("  Alert,\n", "  Alert,\n  Image,\n", 1)
text = text.replace(
    "  const [justExposed, setJustExposed] = useState(false);\n",
    "  const [pendingCaptureUri, setPendingCaptureUri] = useState<string | null>(null);\n  const [savingPhoto, setSavingPhoto] = useState(false);\n",
    1,
)

text, count = re.subn(
    r"  async function takePhoto\(\) \{.*?\n  \}\n\n  if \(!permission\)",
    """  async function takePhoto() {
    if (!cameraReady || !cameraRef.current || takingPhoto || atCapacity) return;

    setTakingPhoto(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const capture = await cameraRef.current.takePictureAsync({
        quality: 0.84,
      });

      if (!capture?.uri) {
        throw new Error('No photo URI');
      }

      // Keep the frame temporary until the user explicitly confirms it.
      setPendingCaptureUri(capture.uri);
      setTakingPhoto(false);
      await Haptics.selectionAsync();
    } catch {
      setTakingPhoto(false);
      Alert.alert(
        '拍照失敗',
        '這一格沒有曝光成功。底片沒有被使用，請再拍一次。'
      );
    }
  }

  async function retakePhoto() {
    if (savingPhoto) return;
    setPendingCaptureUri(null);
    setTakingPhoto(false);
    await Haptics.selectionAsync();
  }

  async function keepPhoto() {
    if (!pendingCaptureUri || savingPhoto || atCapacity) return;
    setSavingPhoto(true);

    try {
      const stableUri = await persistPhoto(pendingCaptureUri);
      const savedToLibrary = await saveToPhotos(stableUri);

      const photo: SessionPhoto = {
        id: `${Date.now()}`,
        uri: stableUri,
        missionCode,
        missionTitle,
        source: source === 'free' ? 'free' : 'mission',
        savedToLibrary,
      };

      const result: CameraRouteResult = {
        requestId,
        source,
        photo,
      };

      await AsyncStorage.setItem(CAMERA_RESULT_KEY, JSON.stringify(result));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSavingPhoto(false);
      Alert.alert('照片沒有存好', '這張還留在預覽畫面，可以再試一次。');
    }
  }

  if (!permission)""",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('camera takePhoto block not found')

review = """
  if (pendingCaptureUri) {
    return (
      <View style={styles.reviewScreen}>
        <StatusBar barStyle="light-content" />
        <Image source={{ uri: pendingCaptureUri }} style={styles.reviewImage} resizeMode="contain" />
        <View style={styles.reviewShade} pointerEvents="none" />
        <View style={styles.reviewTop}>
          <Text style={styles.reviewKicker}>剛剛這張</Text>
          <Text style={styles.reviewTitle} numberOfLines={2}>{missionTitle}</Text>
        </View>
        <View style={styles.reviewBottom}>
          <Text style={styles.reviewCount}>{Math.min(savedCount, rollCapacity)} / {rollCapacity}</Text>
          <View style={styles.reviewActions}>
            <Pressable disabled={savingPhoto} onPress={retakePhoto} style={({ pressed }) => [styles.reviewRetake, pressed && styles.reviewPressed]}>
              <Text style={styles.reviewRetakeText}>重拍</Text>
            </Pressable>
            <Pressable disabled={savingPhoto} onPress={keepPhoto} style={({ pressed }) => [styles.reviewKeep, savingPhoto && styles.reviewDisabled, pressed && styles.reviewPressed]}>
              <Text style={styles.reviewKeepText}>{savingPhoto ? '正在存…' : '留下這張'}</Text>
              <Text style={styles.reviewKeepArrow}>→</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

"""
marker = "  return (\n    <View\n      style={styles.cameraScreen}"
if marker not in text:
    raise SystemExit('camera live return marker missing')
text = text.replace(marker, review + marker, 1)
text = re.sub(
    r"\n      \{justExposed && \(.*?\n      \)\}\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)

review_styles = """
  reviewScreen: { flex: 1, backgroundColor: '#000' },
  reviewImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  reviewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  reviewTop: { position: 'absolute', top: 58, left: 24, right: 24 },
  reviewKicker: { fontSize: 16, fontWeight: '800', color: SIGNAL },
  reviewTitle: { marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#FFF' },
  reviewBottom: { position: 'absolute', left: 24, right: 24, bottom: 34 },
  reviewCount: { marginBottom: 12, fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.82)' },
  reviewActions: { flexDirection: 'row', gap: 10 },
  reviewRetake: { width: 112, minHeight: 68, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.44)', backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  reviewRetakeText: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  reviewKeep: { flex: 1, minHeight: 68, borderRadius: 18, backgroundColor: SIGNAL, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewKeepText: { fontSize: 21, fontWeight: '900', color: INK },
  reviewKeepArrow: { fontSize: 29, color: INK },
  reviewPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  reviewDisabled: { opacity: 0.58 },
"""
if "const styles = StyleSheet.create({" not in text:
    raise SystemExit('camera styles marker missing')
text = text.replace("const styles = StyleSheet.create({\n", "const styles = StyleSheet.create({\n" + review_styles, 1)
write(camera, text)


# ---------------------------------------------------------------------------
# Main UX flow: prewarm only after a mood is selected, never block issue on AI,
# keep failed ticket issue on the printer with retry, make the map a toggle,
# simplify mission reveal, add one-tap indoor progression, and turn Passport
# overview into a photo-first collection instead of a dashboard/map placeholder.
# ---------------------------------------------------------------------------
index = 'src/app/index.tsx'
text = read(index)
text = text.replace(
    "  fetchWalkingRoute,\n  resolveRoutedScene,\n",
    "  fetchWalkingRoute,\n  prewarmWalkingRoutes,\n  resolveRoutedScene,\n",
    1,
)
text = text.replace(
    "  const [ticketBuildStatus, setTicketBuildStatus] =\n    useState('等待開始…');\n",
    "  const [ticketBuildStatus, setTicketBuildStatus] =\n    useState('等待開始…');\n  const [ticketBuildError, setTicketBuildError] = useState<string | null>(null);\n",
    1,
)
text = text.replace(
    "  const routeProgress = useRef(new Animated.Value(0)).current;\n",
    "  const routeProgress = useRef(new Animated.Value(0)).current;\n  const printerPulse = useRef(new Animated.Value(0)).current;\n",
    1,
)

old_prewarm_effect = """  useEffect(() => {
    if (stage !== 'time' && stage !== 'mood') return;

    const timer = setTimeout(() => {
      void prewarmDetour();
    }, 180);

    return () => clearTimeout(timer);
  }, [stage]);
"""
new_prewarm_effect = """  useEffect(() => {
    if (stage !== 'mood' || !selectedMood) return;

    const timer = setTimeout(() => {
      void prewarmDetour(selectedMood);
    }, 80);

    return () => clearTimeout(timer);
  }, [stage, selectedMood, selectedMinutes]);
"""
if old_prewarm_effect not in text:
    raise SystemExit('prewarm effect missing')
text = text.replace(old_prewarm_effect, new_prewarm_effect, 1)

old_prepare_effect = """  useEffect(() => {
    if (stage !== 'preparing') return;

    routeProgress.setValue(0.04);
    setTicketBuildStatus(
      '正在取得現在位置…'
    );

    prepareDetourTicket();
  }, [stage]);
"""
new_prepare_effect = """  useEffect(() => {
    if (stage !== 'preparing') return;

    routeProgress.setValue(0.04);
    setTicketBuildError(null);
    setTicketBuildStatus('正在取得現在位置…');

    printerPulse.setValue(0);
    const printerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(printerPulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(printerPulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    printerLoop.start();
    void prepareDetourTicket();

    return () => printerLoop.stop();
  }, [stage]);
"""
if old_prepare_effect not in text:
    raise SystemExit('prepare effect missing')
text = text.replace(old_prepare_effect, new_prepare_effect, 1)

text = text.replace(
    "    setSelectedMood(moodId);\n\n    // Color Walk draws once per Detour session.",
    "    setSelectedMood(moodId);\n    void prewarmDetour(moodId);\n\n    // Color Walk draws once per Detour session.",
    1,
)
text = text.replace(
    "    await refreshPlaytestSessions();\n\n    transitionTo('preparing');",
    "    void refreshPlaytestSessions();\n\n    transitionTo('preparing');",
    1,
)

# Replace prewarm implementation.
prewarm_pattern = r"  async function prewarmDetour\(\) \{.*?\n  \}\n\n  function applyCachedRanking"
prewarm_replacement = """  async function prewarmDetour(moodOverride?: MoodId) {
    const targetMood = moodOverride ?? selectedMood;
    if (!targetMood) return;

    const cached = prewarmRef.current;
    if (
      cached &&
      Date.now() - cached.createdAt < 5 * 60 * 1000 &&
      (cached.candidatesByMood[targetMood]?.length ?? 0) > 0
    ) {
      return;
    }

    if (prewarmInFlightRef.current) return;
    prewarmInFlightRef.current = true;

    try {
      // Do not surprise a first-time user with a permission sheet on Home/Mood.
      // Prewarm only when permission already exists; ticket issue owns the ask.
      const permission = await Location.getForegroundPermissionsAsync();
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
      const minutes = selectedMinutes || 15;

      const candidates = await findSceneCandidates({
        start: point,
        moodId: targetMood,
        context,
        minutes,
        excludeSceneIds: visitedSceneIds,
        feedback: sceneFeedback,
        distanceScale: paceDistanceScale,
      });

      const createdAt = Date.now();
      prewarmRef.current = {
        point,
        context,
        candidatesByMood: { [targetMood]: candidates },
        rankedIdsByMood: { [targetMood]: candidates.map((candidate) => candidate.id) },
        aiUsedByMood: { [targetMood]: false },
        createdAt,
      };

      // Warm one or two likely walking legs in the background. fetchWalkingRoute
      // caches them, so pressing 出發 can often issue immediately.
      void prewarmWalkingRoutes(point, candidates, 2);

      // Taste ranking is future preference data only; never block this ticket.
      if (
        isAIEngineConfigured() &&
        candidates.length > 0 &&
        targetMood !== 'food' &&
        targetMood !== 'color'
      ) {
        void rankSceneCandidatesWithAI({
          candidates,
          moodId: targetMood,
          context,
          minutes,
        })
          .then((ranking) => {
            const current = prewarmRef.current;
            if (!current || current.createdAt !== createdAt) return;
            current.rankedIdsByMood[targetMood] = ranking.candidates.map(
              (candidate) => candidate.id
            );
            current.aiUsedByMood[targetMood] = ranking.usedAI;
          })
          .catch(() => undefined);
      }
    } catch {
      // Prewarming is an optimization. Ticket issue remains available.
    } finally {
      prewarmInFlightRef.current = false;
    }
  }

  function applyCachedRanking"""
text, count = re.subn(prewarm_pattern, prewarm_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('prewarm function missing')

# Modify prepareDetourTicket only inside its function body.
match = re.search(r"  async function prepareDetourTicket\(\) \{.*?\n  \}\n\n  async function startDetour", text, flags=re.S)
if not match:
    raise SystemExit('prepareDetourTicket function missing')
prepare = match.group(0)
prepare = prepare.replace(
    "  async function prepareDetourTicket() {\n    stopLocationWatcher();",
    "  async function prepareDetourTicket() {\n    stopLocationWatcher();\n    setTicketBuildError(null);",
    1,
)
prepare = prepare.replace(
    """    if (permission.status !== 'granted') {
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
""",
    """    if (permission.status !== 'granted') {
      const testSessionId = playtestSessionIdRef.current;
      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: 'location-permission',
          })
        );
      }
      setTicketBuildStatus('需要定位才能繼續');
      setTicketBuildError('允許定位後再試一次。DETOUR 只會用現在的位置找這趟的終點和步行路線。');
      return;
    }
""",
    1,
)
old_ai = """        if (
          isAIEngineConfigured() &&
          finalMood !== 'food' &&
          finalMood !== 'color'
        ) {
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
"""
new_ai = """        advanceTicketProgress(
          0.46,
          `找到 ${sceneCandidates.length} 個候選。正在確認步行路線…`
        );
        // Local ranking is already good enough to issue. AI taste ranking is
        // never allowed to hold the printer hostage.
        rankedCandidates = sceneCandidates;
        rankingUsedAI = false;
"""
if old_ai not in prepare:
    raise SystemExit('blocking AI block missing')
prepare = prepare.replace(old_ai, new_ai, 1)

old_catch = """    } catch (error) {
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
        `${message}\n\n車票只有在終點和步行路線都確認成功後才會發行。`
      );
    }
"""
new_catch = """    } catch (error) {
      stopLocationWatcher();

      const message =
        error instanceof Error
          ? error.message
          : '請確認網路和定位服務後再試一次。';
      const testSessionId = playtestSessionIdRef.current;

      setTicketBuildStatus('這張票沒有印成功');
      setTicketBuildError(message);
      routeProgress.stopAnimation();

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: message.slice(0, 120),
          })
        );
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
"""
if old_catch not in prepare:
    raise SystemExit('prepare catch block missing')
prepare = prepare.replace(old_catch, new_catch, 1)
text = text[:match.start()] + prepare + text[match.end():]

# One-tap indoor progression. Keep simulateWalk for compatibility but expose a
# true next-beat action for sitting at home.
sim_match = re.search(r"  async function simulateWalk\(\) \{.*?\n  \}\n", text, flags=re.S)
if not sim_match:
    raise SystemExit('simulateWalk missing')
sim_next = """
  async function simulateNextBeat() {
    if (!devMode) return;
    const route = navigationRouteRef.current;
    const beat = route?.beats[navigationBeatIndexRef.current];
    if (!beat) return;

    const previousPoint =
      latitude !== null && longitude !== null
        ? { latitude, longitude }
        : detourStart ?? beat.point;
    const moved = getDistanceInMeters(
      previousPoint.latitude,
      previousPoint.longitude,
      beat.point.latitude,
      beat.point.longitude
    );

    setLatitude(beat.point.latitude);
    setLongitude(beat.point.longitude);
    setBeatRemainingMeters(0);
    beatRemainingMetersRef.current = 0;
    const nextTraveled = traveledMetersRef.current + moved;
    traveledMetersRef.current = nextTraveled;
    setTraveledMeters(nextTraveled);
    setActiveTrace((trace) => [...trace, beat.point]);
    await Haptics.selectionAsync();
    setTimeout(() => void reachCurrentNavigationBeat(), 80);
  }
"""
text = text[:sim_match.end()] + sim_next + text[sim_match.end():]

# Preparing screen: keep current visual ticket untouched, but add a live printer
# scan and an inline retry state instead of dumping the user back to Mood.
prepare_screen_pattern = r"        \{stage === 'preparing' && \(.*?\n        \)\}\n\n        \{stage === 'ready' && \("
prepare_screen_replacement = """        {stage === 'preparing' && (
          <View style={styles.v35PreparingScreen}>
            <Text style={styles.v35PreparingBrand}>DETOUR</Text>
            <Text style={styles.v35PreparingTitle}>{ticketBuildError ? '車票卡住了。' : '正在印製車票…'}</Text>
            <View style={styles.v35PreparingUnderline} />
            <View style={styles.v35Printer}>
              <View style={styles.v35PrinterTop} />
              <View style={styles.v35PrinterSlot} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v41PrinterScan,
                  {
                    opacity: printerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                    transform: [{ translateX: printerPulse.interpolate({ inputRange: [0, 1], outputRange: [-82, 82] }) }],
                  },
                ]}
              />
              <Animated.View style={[styles.v35PrintingTicket, { transform: [{ translateY: routeProgress.interpolate({ inputRange: [0, 1], outputRange: [-95, 12] }) }] }]}>
                <View style={styles.v35PrintOrangeBand} /><Text style={styles.v35PrintBrand}>DETOUR</Text><View style={styles.v35PrintDash} />
                <View style={styles.v35PrintFacts}>
                  <View><Text style={styles.v35PrintLabel}>旅程時間</Text><Text style={styles.v35PrintMinute}>{selectedTime}<Text style={styles.v35PrintMinuteUnit}> 分鐘</Text></Text></View>
                  <View style={styles.v35PrintDivider} />
                  <View style={styles.v35PrintMoodBlock}><Text style={styles.v35PrintLabel}>此趟心情</Text><Text style={styles.v35PrintMood}>{mood?.label ?? '—'}{selectedMood === 'color' && selectedColor ? ` · ${selectedColor.label}` : ''}</Text></View>
                </View>
                <View style={styles.v35PrintDash} /><Text style={styles.v35PrintDestination}>目的地　● ???</Text>
                <View style={styles.v35PrintBarcode}>{[2,1,3,1,2,4,1,3,2,1,4,2,1,3,2,1,4,1].map((w,i)=>(<View key={i} style={[styles.v35PrintBar,{width:w}]} />))}</View>
              </Animated.View>
            </View>
            <Text style={styles.v41PreparingStatus}>{ticketBuildStatus}</Text>
            {ticketBuildError && (
              <View style={styles.v41TicketErrorPanel}>
                <Text style={styles.v41TicketErrorText}>{ticketBuildError}</Text>
                <Pressable
                  onPress={() => {
                    routeProgress.setValue(0.04);
                    setTicketBuildError(null);
                    setTicketBuildStatus('再試一次…');
                    void prepareDetourTicket();
                  }}
                  style={({ pressed }) => [styles.v41TicketRetry, pressed && styles.v35Pressed]}
                >
                  <Text style={styles.v41TicketRetryText}>再試一次</Text>
                  <Text style={styles.v41TicketRetryArrow}>→</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {stage === 'ready' && ("""
text, count = re.subn(prepare_screen_pattern, prepare_screen_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('preparing screen block missing')

# Navigation: map button is a real toggle; mission reminder is readable; indoor
# testing advances the full beat in one tap.
old_nav_mission = """                    <Pressable
                      onPress={() => openCamera('side')}
                      style={({ pressed }) => [{ marginTop: 16, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(241,239,231,0.28)', borderRadius: 16 }, pressed && styles.v35JourneyPressed]}
                    >
                      <Text numberOfLines={1} style={{ flex: 1, color: BONE, fontSize: 17, fontWeight: '800' }}>{currentMission.title}</Text>
                      <Text style={{ color: SIGNAL, fontSize: 12, fontWeight: '800' }}>看到就拍</Text>
                    </Pressable>
"""
new_nav_mission = """                    <Pressable
                      onPress={() => openCamera('side')}
                      style={({ pressed }) => [styles.v41ActiveFind, pressed && styles.v35JourneyPressed]}
                    >
                      <View style={styles.v41ActiveFindCopy}>
                        <Text style={styles.v41ActiveFindLabel}>正在找</Text>
                        <Text numberOfLines={2} style={styles.v41ActiveFindTitle}>{currentMission.title}</Text>
                      </View>
                      <Text style={styles.v41ActiveFindAction}>拍照 →</Text>
                    </Pressable>
"""
if old_nav_mission not in text:
    raise SystemExit('navigation mission card missing')
text = text.replace(old_nav_mission, new_nav_mission, 1)

old_bottom = """                <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>↗</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>小地圖</Text></Pressable>
                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>
                {devMode && <Pressable onPress={simulateWalk} style={styles.v35DevAdvance}><Text style={styles.v35DevAdvanceText}>室內測試 · 模擬前進</Text></Pressable>}
"""
new_bottom = """                <Pressable onPress={() => setShowNextBeatMap((value) => !value)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>{showNextBeatMap ? '↙' : '↗'}</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>{showNextBeatMap ? '收起地圖' : '小地圖'}</Text></Pressable>
                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>
                {devMode && <Pressable onPress={simulateNextBeat} style={styles.v41DevAdvance}><Text style={styles.v41DevAdvanceText}>室內測試 · 下一段 →</Text></Pressable>}
"""
if old_bottom not in text:
    raise SystemExit('journey bottom block missing')
text = text.replace(old_bottom, new_bottom, 1)

# Mission reveal: one big instruction, one big action, minimal secondary copy.
mission_pattern = r"        \{stage === 'mission' && plan && currentMission && \(.*?\n        \)\}\n\n        \{stage === 'arrival' && plan && \("
mission_replacement = """        {stage === 'mission' && plan && currentMission && (
          <View style={styles.v41MissionScreen}>
            <View style={styles.v41MissionTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v41MissionBack}>
                <Text style={styles.v41MissionBackText}>←</Text>
              </Pressable>
              <Text style={styles.v41MissionBrand}>DETOUR</Text>
              <View style={styles.v41MissionBadge}><Text style={styles.v41MissionBadgeText}>✦</Text></View>
            </View>

            <View style={styles.v41MissionRoute}>
              <View style={styles.v41MissionRouteStart}><View style={styles.v41MissionRouteCore} /></View>
              <View style={styles.v41MissionRouteLine} />
              <View style={styles.v41MissionRouteQuest}><Text style={styles.v41MissionRouteQuestText}>✦</Text></View>
              <View style={styles.v41MissionRouteLineMuted} />
            </View>

            <View style={styles.v41MissionHero}>
              <Text style={styles.v41MissionCue}>新的尋找</Text>
              <Text style={styles.v41MissionTitle}>{currentMission.title}</Text>
              {plan.context !== 'day' && (
                <Text style={styles.v41MissionSafety}>只在有照明、公開可走的位置找。</Text>
              )}
            </View>

            <View style={styles.v41MissionBottom}>
              <Pressable onPress={beginCurrentMissionSearch} style={({ pressed }) => [styles.v41MissionPrimary, pressed && styles.pressedLight]}>
                <Text style={styles.v41MissionPrimaryText}>開始找</Text>
                <Text style={styles.v41MissionPrimaryArrow}>→</Text>
              </Pressable>
              <Pressable onPress={skipCurrentRequiredMission} style={({ pressed }) => [styles.v41MissionSkip, pressed && styles.pressedLight]}>
                <Text style={styles.v41MissionSkipText}>先跳過</Text>
              </Pressable>
            </View>
          </View>
        )}

        {stage === 'arrival' && plan && ("""
text, count = re.subn(mission_pattern, mission_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('mission stage block missing')

# Passport overview: photo-first cards, no giant route-map placeholder.
passport_pattern = r"        \{stage === 'passport' && \(.*?\n        \)\}\n\n        \{stage === 'passportDetail' && selectedPassportEntry && \("
passport_replacement = """        {stage === 'passport' && (
          <View style={styles.v41PassportScreen}>
            <View style={styles.v41PassportTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v41PassportBack}><Text style={styles.v41PassportBackText}>←</Text></Pressable>
              <Text style={styles.v41PassportHeader}>已完成的旅程</Text>
              <Text style={styles.v41PassportMeta}>收藏</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v41PassportScroll}>
              <Text style={styles.v41PassportKicker}>你的 DETOUR 收藏</Text>
              <Text style={styles.v41PassportTitle}>走過的路，{`\n`}一趟一趟留下來。</Text>

              <View style={styles.v41PassportStats}>
                <View style={styles.v41PassportStat}><Text style={styles.v41PassportStatValue}>{passport.length}</Text><Text style={styles.v41PassportStatLabel}>趟旅程</Text></View>
                <View style={styles.v41PassportStat}><Text style={styles.v41PassportStatValue}>{(totalDistanceMeters / 1000).toFixed(1)}</Text><Text style={styles.v41PassportStatLabel}>公里</Text></View>
                <View style={styles.v41PassportStat}><Text style={styles.v41PassportStatValue}>{totalDiscoveries}</Text><Text style={styles.v41PassportStatLabel}>個發現</Text></View>
              </View>

              <View style={styles.v41PassportSectionRow}>
                <Text style={styles.v41PassportSectionTitle}>旅程收藏</Text>
                <Text style={styles.v41PassportSectionMeta}>{passportLoaded ? '存在這支手機' : '載入中'}</Text>
              </View>

              {passport.length === 0 ? (
                <View style={styles.v41PassportEmpty}>
                  <Text style={styles.v41PassportEmptyMark}>○ ─── ⚑</Text>
                  <Text style={styles.v41PassportEmptyTitle}>第一趟走完後，會留在這裡。</Text>
                </View>
              ) : (
                <View style={styles.v41PassportList}>
                  {passport.map((entry, index) => {
                    const coverUri = entry.photos?.[0]?.uri;
                    return (
                      <Pressable key={entry.id} onPress={() => openPassportEntry(entry)} style={({ pressed }) => [styles.v41PassportCard, pressed && styles.v35Pressed]}>
                        {coverUri ? (
                          <Image source={{ uri: coverUri }} style={styles.v41PassportPhoto} resizeMode="cover" />
                        ) : (
                          <View style={styles.v41PassportNoPhoto}>
                            <View style={styles.v41PassportNoPhotoLine} />
                            <View style={styles.v41PassportNoPhotoDot} />
                            <Text style={styles.v41PassportNoPhotoText}>{entry.moodLabel}</Text>
                          </View>
                        )}
                        <View style={styles.v41PassportCardBody}>
                          <View style={styles.v41PassportCardTop}>
                            <Text style={styles.v41PassportCardNumber}>{String(passport.length - index).padStart(2, '0')}</Text>
                            <Text style={styles.v41PassportCardDate}>{formatPassportDate(entry.completedAt)}</Text>
                          </View>
                          <Text style={styles.v41PassportCardMood}>{entry.moodLabel}</Text>
                          <Text style={styles.v41PassportCardDestination} numberOfLines={2}>{entry.sceneName ?? `${entry.city}的一趟 DETOUR`}</Text>
                          <View style={styles.v41PassportCardFacts}>
                            <Text style={styles.v41PassportCardFact}>{entry.minutes} 分鐘</Text>
                            <Text style={styles.v41PassportCardFact}>{entry.photoCount ?? 0} 張照片</Text>
                            <Text style={styles.v41PassportCardFact}>{entry.discoveries} 個發現</Text>
                          </View>
                          <View style={styles.v41PassportOpen}><Text style={styles.v41PassportOpenText}>打開這趟</Text><Text style={styles.v41PassportOpenArrow}>→</Text></View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {devMode && passport.length > 0 && (
                <Pressable onPress={clearPassport} style={({ pressed }) => [styles.v41PassportClear, pressed && styles.pressedLight]}>
                  <Text style={styles.v41PassportClearText}>清除測試收藏</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'passportDetail' && selectedPassportEntry && ("""
text, count = re.subn(passport_pattern, passport_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('passport overview block missing')

# Readability nudges on other journey screens without touching ready-ticket
# layout being designed in another chat.
text = text.replace("<Text style={styles.cleanArrivalMeta}>", "<Text style={[styles.cleanArrivalMeta, styles.v41ReadableMeta]}>", 1)
text = text.replace("<Text style={styles.cleanArrivalKicker}>", "<Text style={[styles.cleanArrivalKicker, styles.v41ReadableKicker]}>", 1)
text = text.replace("<Text style={styles.cleanArrivalInstruction}>", "<Text style={[styles.cleanArrivalInstruction, styles.v41ReadableBody]}>", 1)
text = text.replace("<Text style={styles.cleanArrivalSource}>", "<Text style={[styles.cleanArrivalSource, styles.v41ReadableMeta]}>", 1)
text = text.replace("<Text style={styles.developingCode}>", "<Text style={[styles.developingCode, styles.v41DevelopingCode]}>", 1)
text = text.replace("<Text style={styles.developingBody}>", "<Text style={[styles.developingBody, styles.v41DevelopingBody]}>", 1)

# v0.41 styles are intentionally additive so the ticket-ready design remains
# untouched and merge conflicts with the other design chat stay small.
v41_styles = r'''
  v41PrinterScan: { position: 'absolute', top: 38, width: 76, height: 4, borderRadius: 2, backgroundColor: SIGNAL, zIndex: 6 },
  v41PreparingStatus: { marginTop: 8, paddingHorizontal: 24, fontSize: 16, lineHeight: 23, fontWeight: '800', color: '#5F5A52', textAlign: 'center' },
  v41TicketErrorPanel: { width: '100%', marginTop: 14, padding: 16, borderWidth: 1, borderColor: '#D3CEC1', backgroundColor: '#FAF7EE' },
  v41TicketErrorText: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: INK },
  v41TicketRetry: { minHeight: 58, marginTop: 14, paddingHorizontal: 18, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41TicketRetryText: { fontSize: 20, fontWeight: '900', color: INK },
  v41TicketRetryArrow: { fontSize: 28, color: INK },

  v41ActiveFind: { marginTop: 18, alignSelf: 'stretch', minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(241,239,231,0.34)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.035)' },
  v41ActiveFindCopy: { flex: 1 },
  v41ActiveFindLabel: { fontSize: 14, fontWeight: '900', color: SIGNAL },
  v41ActiveFindTitle: { marginTop: 4, fontSize: 22, lineHeight: 27, fontWeight: '900', color: BONE },
  v41ActiveFindAction: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v41DevAdvance: { position: 'absolute', right: 0, bottom: 82, minHeight: 44, paddingHorizontal: 15, borderRadius: 22, backgroundColor: '#302F2B', alignItems: 'center', justifyContent: 'center' },
  v41DevAdvanceText: { fontSize: 14, fontWeight: '800', color: BONE },

  v41MissionScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, paddingHorizontal: 24, paddingBottom: 28 },
  v41MissionTop: { flexDirection: 'row', alignItems: 'center' },
  v41MissionBack: { width: 44, height: 44, justifyContent: 'center' },
  v41MissionBackText: { fontSize: 36, color: INK },
  v41MissionBrand: { marginLeft: 10, fontSize: 31, fontWeight: '900', letterSpacing: -1.7, color: INK },
  v41MissionBadge: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 21, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v41MissionBadgeText: { fontSize: 22, fontWeight: '900', color: BONE },
  v41MissionRoute: { height: 82, marginTop: 46, flexDirection: 'row', alignItems: 'center' },
  v41MissionRouteStart: { width: 28, height: 28, borderRadius: 14, borderWidth: 4, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v41MissionRouteCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: SIGNAL },
  v41MissionRouteLine: { flex: 0.45, height: 4, backgroundColor: SIGNAL },
  v41MissionRouteQuest: { width: 56, height: 56, borderRadius: 28, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v41MissionRouteQuestText: { fontSize: 27, color: BONE },
  v41MissionRouteLineMuted: { flex: 1, height: 2, backgroundColor: '#D1CBC0' },
  v41MissionHero: { flex: 1, justifyContent: 'center', paddingBottom: 28 },
  v41MissionCue: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v41MissionTitle: { marginTop: 16, maxWidth: 355, fontSize: 52, lineHeight: 60, fontWeight: '900', letterSpacing: -2.9, color: INK },
  v41MissionSafety: { marginTop: 22, maxWidth: 340, fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#67625A' },
  v41MissionBottom: { gap: 10 },
  v41MissionPrimary: { minHeight: 74, backgroundColor: SIGNAL, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41MissionPrimaryText: { fontSize: 26, fontWeight: '900', color: INK },
  v41MissionPrimaryArrow: { fontSize: 32, color: INK },
  v41MissionSkip: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  v41MissionSkipText: { fontSize: 16, fontWeight: '700', color: '#77736B' },

  v41PassportScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58 },
  v41PassportTop: { minHeight: 48, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  v41PassportBack: { width: 44, height: 44, justifyContent: 'center' },
  v41PassportBackText: { fontSize: 36, color: INK },
  v41PassportHeader: { marginLeft: 8, fontSize: 27, fontWeight: '900', letterSpacing: -1.2, color: INK },
  v41PassportMeta: { marginLeft: 'auto', fontSize: 15, fontWeight: '800', color: MUTED },
  v41PassportScroll: { paddingHorizontal: 24, paddingTop: 42, paddingBottom: 56 },
  v41PassportKicker: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v41PassportTitle: { marginTop: 12, fontSize: 42, lineHeight: 49, fontWeight: '900', letterSpacing: -2.3, color: INK },
  v41PassportStats: { marginTop: 34, paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#CFC9BD', flexDirection: 'row' },
  v41PassportStat: { flex: 1 },
  v41PassportStatValue: { fontSize: 38, lineHeight: 42, fontWeight: '900', color: INK },
  v41PassportStatLabel: { marginTop: 5, fontSize: 14, fontWeight: '700', color: MUTED },
  v41PassportSectionRow: { marginTop: 42, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41PassportSectionTitle: { fontSize: 21, fontWeight: '900', color: INK },
  v41PassportSectionMeta: { fontSize: 14, fontWeight: '700', color: MUTED },
  v41PassportList: { gap: 18 },
  v41PassportCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#D2CBC0', backgroundColor: '#FAF7EE' },
  v41PassportPhoto: { width: '100%', height: 220, backgroundColor: SOFT },
  v41PassportNoPhoto: { width: '100%', height: 190, backgroundColor: '#E6E0D5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  v41PassportNoPhotoLine: { position: 'absolute', width: 280, height: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-12deg' }] },
  v41PassportNoPhotoDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 6, borderColor: SIGNAL, backgroundColor: '#E6E0D5' },
  v41PassportNoPhotoText: { marginTop: 60, fontSize: 23, fontWeight: '900', color: INK },
  v41PassportCardBody: { padding: 18 },
  v41PassportCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41PassportCardNumber: { fontSize: 17, fontWeight: '900', color: SIGNAL },
  v41PassportCardDate: { fontSize: 14, fontWeight: '700', color: MUTED },
  v41PassportCardMood: { marginTop: 18, fontSize: 18, fontWeight: '900', color: SIGNAL },
  v41PassportCardDestination: { marginTop: 7, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v41PassportCardFacts: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  v41PassportCardFact: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: '#EDE7DC', fontSize: 14, fontWeight: '800', color: INK },
  v41PassportOpen: { marginTop: 18, minHeight: 54, borderTopWidth: 1, borderColor: '#D2CBC0', paddingTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41PassportOpenText: { fontSize: 17, fontWeight: '900', color: INK },
  v41PassportOpenArrow: { fontSize: 25, color: SIGNAL },
  v41PassportEmpty: { minHeight: 220, borderWidth: 1, borderColor: '#D2CBC0', alignItems: 'center', justifyContent: 'center', padding: 24 },
  v41PassportEmptyMark: { fontSize: 28, color: SIGNAL },
  v41PassportEmptyTitle: { marginTop: 22, fontSize: 21, lineHeight: 28, fontWeight: '900', color: INK, textAlign: 'center' },
  v41PassportClear: { marginTop: 30, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D2CBC0' },
  v41PassportClearText: { fontSize: 15, fontWeight: '800', color: SIGNAL },

  v41ReadableMeta: { fontSize: 15, lineHeight: 21 },
  v41ReadableKicker: { fontSize: 17, lineHeight: 23 },
  v41ReadableBody: { fontSize: 17, lineHeight: 26 },
  v41DevelopingCode: { fontSize: 14, lineHeight: 20 },
  v41DevelopingBody: { fontSize: 16, lineHeight: 23, letterSpacing: 0.4 },
'''
text = text.replace("\n});\n", "\n" + v41_styles + "\n});\n", 1)
write(index, text)


# ---------------------------------------------------------------------------
# Build marker + product notes.
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/build-info.ts',
    "// v0.40: six-frame budget, route novelty/time guard, collection cleanup, and field-ready UI hierarchy.\nexport const DETOUR_BUILD_VERSION = '0.40.0';\n",
    "// v0.41: fast ticket issue, photo review, map toggle, readable field UI, and collection-first Passport.\nexport const DETOUR_BUILD_VERSION = '0.41.0';\n",
)

foundation = read('PRODUCT_FOUNDATION.md').rstrip() + """

## v0.41 — field UX before Monday

- Ticket issue optimizes perceived speed: local ranking never waits for AI, routing tries at most three candidates, and the first route that clears time / distance / novelty gates wins.
- Mood selection is the prewarm moment. It may warm Scene and walking-route caches only when location permission already exists; the Home screen must not surprise a first-time user with a permission prompt.
- A failed ticket stays at the printer and offers retry. Never dump the user back to Mood without explanation.
- Camera capture is two-step: shutter -> review -> keep/retake. Only “留下這張” consumes one of six frames, saves to DETOUR/Photos, and completes a photo mission.
- The journey map is a toggle. The same control that opens it must be able to close it.
- Consumer field UI should be readable while walking: primary instructions are large, secondary copy is at least normal body size, and game feel comes from reveal / pulse / haptics rather than tiny metadata.
- Completed journeys are a photo-first collection. Aggregate maps are secondary; an empty map rectangle must never dominate the collection home.
- Indoor test mode advances a full navigation beat in one tap so the end-to-end flow can be tested from home.
""" + "\n"
write('PRODUCT_FOUNDATION.md', foundation)

# Invariants: ticket-ready JSX remains present and this migration does not
# replace its stage block.
for path, needle in [
    (index, "{stage === 'ready' && ("),
    (index, "留下這張"),
    (index, "收起地圖"),
    (index, "室內測試 · 下一段"),
    (index, "v41PassportCard"),
    (camera, "pendingCaptureUri"),
    (routing, ".slice(0, 3)"),
]:
    if needle not in read(path):
        raise SystemExit(f'missing v0.41 invariant {needle!r} in {path}')
