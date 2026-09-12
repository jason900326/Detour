from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"missing expected block in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = re.S) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"expected one regex match in {path}, got {count}: {pattern[:120]!r}")
    write(path, next_text)


def assert_contains(path: str, needle: str) -> None:
    if needle not in read(path):
        raise SystemExit(f"missing invariant in {path}: {needle!r}")


# ---------------------------------------------------------------------------
# Journey density: six photos are a real product rule, not a decorative count.
# Reserve room for free frames / arrival instead of scaling long trips into a
# checklist. Longer Detours get their depth from route + destination, not tasks.
# ---------------------------------------------------------------------------
journey_path = 'src/lib/journey-engine.ts'
replace_once(
    journey_path,
    "  } else if (safeMinutes <= 15) {\n    targetDistanceMeters = 680;\n    sideMissionCount = 3;",
    "  } else if (safeMinutes <= 15) {\n    targetDistanceMeters = 680;\n    sideMissionCount = 2;",
)
replace_once(
    journey_path,
    "  } else if (safeMinutes <= 30) {\n    targetDistanceMeters = Math.round(680 + (safeMinutes - 15) * 28);\n    sideMissionCount = 4;",
    "  } else if (safeMinutes <= 30) {\n    targetDistanceMeters = Math.round(680 + (safeMinutes - 15) * 28);\n    sideMissionCount = 3;",
)
replace_once(
    journey_path,
    "  } else if (safeMinutes <= 45) {\n    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);\n    sideMissionCount = 6;",
    "  } else if (safeMinutes <= 45) {\n    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);\n    sideMissionCount = 4;",
)
replace_once(
    journey_path,
    "  } else if (safeMinutes <= 60) {\n    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);\n    sideMissionCount = 7;",
    "  } else if (safeMinutes <= 60) {\n    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);\n    sideMissionCount = 4;",
)
regex_once(
    journey_path,
    r"    // Keep a live Find present through a long Detour without turning it into\n    // a checklist\. Public 90-minute journeys start around ten simple finds\.\n    sideMissionCount = Math\.min\(10, Math\.round\(7 \+ \(safeMinutes - 60\) / 10\)\);",
    "    // Long Detours deepen the route instead of adding more checklist items.\n    // Four photo finds leave room in the six-frame roll for free/arrival shots.\n    sideMissionCount = 4;",
)


# ---------------------------------------------------------------------------
# Routing: add recent-route overlap penalties and a real-world time ceiling.
# OSRM duration is corrected for city friction; task/arrival time is budgeted.
# ---------------------------------------------------------------------------
routing_path = 'src/lib/routing-engine.ts'
routing = read(routing_path)
start = routing.index('export async function resolveRoutedScene')
new_tail = r'''function distanceBetweenPoints(a: GeoPoint, b: GeoPoint) {
  const radians = Math.PI / 180;
  const radius = 6371000;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeOverlapRatio(route: GeoPoint[], avoidRoutes: GeoPoint[][]) {
  if (route.length < 4 || avoidRoutes.length === 0) return 0;

  // Every Detour from the same starting point naturally shares its first few
  // metres. Novelty matters after the route has actually left the origin.
  const startIndex = Math.min(route.length - 1, Math.floor(route.length * 0.18));
  const usable = route.slice(startIndex);
  const step = Math.max(1, Math.floor(usable.length / 20));
  const samples = usable.filter((_, index) => index % step === 0).slice(0, 24);
  if (samples.length === 0) return 0;

  const historical = avoidRoutes
    .filter((item) => item.length >= 2)
    .slice(0, 6)
    .flatMap((item) => {
      const historyStep = Math.max(1, Math.floor(item.length / 90));
      return item.filter((_, index) => index % historyStep === 0);
    });

  if (historical.length === 0) return 0;

  let overlapping = 0;
  for (const point of samples) {
    if (historical.some((oldPoint) => distanceBetweenPoints(point, oldPoint) <= 35)) {
      overlapping += 1;
    }
  }

  return overlapping / samples.length;
}

function estimatedJourneySeconds(
  route: WalkingRoute,
  sideMissionCount: number,
  minutes: number
) {
  // OSRM is optimistic in cities. Add crossings / hesitation, then reserve a
  // compact amount of time for each camera find and the final reveal.
  const cityWalking = route.durationSeconds * 1.18;
  const findAndPhoto = sideMissionCount * 75;
  const arrival = minutes <= 15 ? 90 : 120;
  return cityWalking + findAndPhoto + arrival;
}

export async function resolveRoutedScene(args: {
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

  const shortlist = args.candidates
    .slice(0, 14)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, 8);

  let bestViable: RoutedScene | null = null;
  let bestViableScore = Number.POSITIVE_INFINITY;
  let bestFallback: RoutedScene | null = null;
  let bestFallbackScore = Number.POSITIVE_INFINITY;

  for (const scene of shortlist) {
    try {
      const route = await fetchWalkingRoute(args.start, scene.point);
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

      if (
        route.distanceMeters <= maxDistance * 1.08 &&
        score < bestFallbackScore
      ) {
        bestFallback = { scene, route };
        bestFallbackScore = score;
      }

      const distanceFits =
        route.distanceMeters >= profile.min &&
        route.distanceMeters <= maxDistance;
      const timeFits = estimatedSeconds <= timeBudgetSeconds;
      const noveltyFits = overlap <= 0.62;

      if (distanceFits && timeFits && noveltyFits && score < bestViableScore) {
        bestViable = { scene, route };
        bestViableScore = score;
      }
    } catch {
      // Try the next Scene. Public routing can occasionally miss a snap.
    }
  }

  if (bestViable) return bestViable;
  if (bestFallback) return bestFallback;

  throw new Error(
    `附近有 Scene，但目前找不到符合 ${args.minutes} 分鐘節奏的步行主線。`
  );
}
'''
write(routing_path, routing[:start] + new_tail)


# ---------------------------------------------------------------------------
# Dedicated camera: hard six-frame cap and quieter controls.
# ---------------------------------------------------------------------------
camera_path = 'src/app/camera.tsx'
replace_once(
    camera_path,
    "  const rollCapacity =\n    Number.parseInt(getParam(params.rollCapacity, '6'), 10) || 6;",
    "  const rollCapacity =\n    Number.parseInt(getParam(params.rollCapacity, '6'), 10) || 6;\n  const atCapacity = savedCount >= rollCapacity;",
)
replace_once(
    camera_path,
    "  async function takePhoto() {\n    if (!cameraReady || !cameraRef.current || takingPhoto) return;",
    "  async function takePhoto() {\n    if (!cameraReady || !cameraRef.current || takingPhoto || atCapacity) return;",
)
replace_once(camera_path, "          <Text style={styles.zoomHint}>雙指縮放</Text>\n", "")
replace_once(
    camera_path,
    "                {savedCount} / {rollCapacity}\n              </Text>\n              <Text style={styles.exposureLabel}>這趟照片</Text>",
    "                {Math.min(savedCount, rollCapacity)} / {rollCapacity}\n              </Text>",
)
replace_once(
    camera_path,
    "              disabled={!cameraReady || takingPhoto}\n              onPress={takePhoto}\n              style={({ pressed }) => [\n                styles.shutterOuter,\n                (!cameraReady || takingPhoto) && styles.shutterDisabled,",
    "              disabled={!cameraReady || takingPhoto || atCapacity}\n              onPress={takePhoto}\n              style={({ pressed }) => [\n                styles.shutterOuter,\n                (!cameraReady || takingPhoto || atCapacity) && styles.shutterDisabled,",
)
replace_once(
    camera_path,
    "              {mountError ? (\n                <Text style={styles.errorText}>預覽錯誤</Text>\n              ) : (\n                <Text style={styles.statusText}>\n                  {cameraReady ? '可以拍了' : '正在開啟'}\n                </Text>\n              )}",
    "              {mountError ? (\n                <Text style={styles.errorText}>預覽錯誤</Text>\n              ) : atCapacity ? (\n                <Text style={styles.statusText}>已拍滿</Text>\n              ) : null}",
)


# ---------------------------------------------------------------------------
# Home flow: reserve frames for required finds, clean local photo lifecycle,
# remove obsolete in-index camera/review implementation, simplify UI language.
# ---------------------------------------------------------------------------
index_path = 'src/app/index.tsx'
replace_once(index_path, "  Modal,\n", "")
replace_once(index_path, "import { CameraView, useCameraPermissions } from 'expo-camera';\n", "")
replace_once(index_path, "import { Directory, File, Paths } from 'expo-file-system';\n", "import { Directory, Paths } from 'expo-file-system';\n")
replace_once(index_path, "import { Album, Asset, requestPermissionsAsync as requestMediaLibraryPermissionsAsync } from 'expo-media-library';\n", "")
replace_once(index_path, "  | 'camera'\n  | 'photoReview'\n", "")

regex_once(
    index_path,
    r"\n  const \[photos, setPhotos\] = useState<SessionPhoto\[\]>\(\[\]\);\n  const \[cameraSource, setCameraSource\] =\n    useState<CameraSource \| null>\(null\);\n  const \[capturedPhotoUri, setCapturedPhotoUri\] =\n    useState<string \| null>\(null\);\n  const \[cameraReady, setCameraReady\] = useState\(false\);\n  const \[cameraSessionKey, setCameraSessionKey\] = useState\(0\);\n  const \[cameraMountError, setCameraMountError\] = useState<string \| null>\(null\);\n  const \[missionResults, setMissionResults\] =",
    "\n  const [photos, setPhotos] = useState<SessionPhoto[]>([]);\n  const [missionResults, setMissionResults] =",
)
regex_once(
    index_path,
    r"\n  const \[cameraPermission, requestCameraPermission\] =\n    useCameraPermissions\(\);",
    "",
)
replace_once(index_path, "  const [passportZoomUri, setPassportZoomUri] = useState<string | null>(null);\n", "")
replace_once(index_path, "  const cameraRef = useRef<CameraView | null>(null);\n", "")

# Reset/goBack no longer know about the deleted modal camera state.
for old in [
    "    setCameraSource(null);\n",
    "    setCapturedPhotoUri(null);\n",
    "    setCameraReady(false);\n",
    "    setCameraMountError(null);\n",
]:
    text = read(index_path)
    if old in text:
        write(index_path, text.replace(old, "", 1))
regex_once(
    index_path,
    r"\n    if \(stage === 'camera'\) \{.*?\n    \}\n\n    if \(stage === 'photoReview'\) \{.*?\n    \}\n",
    "\n",
)

# Remove obsolete camera implementation functions. The /camera route is the
# only capture path after v0.40.
regex_once(index_path, r"\n  async function persistPhoto\(tempUri: string\) \{.*?\n  \}\n\n  async function savePhotoToSystemLibrary", "\n  async function savePhotoToSystemLibrary")
regex_once(index_path, r"\n  async function savePhotoToSystemLibrary\(localUri: string\) \{.*?\n  \}\n\n  function openPassportEntry", "\n  function openPassportEntry")
regex_once(index_path, r"\n  async function takePhoto\(\) \{.*?\n  \}\n\n  function retakePhoto", "\n  function retakePhoto")
regex_once(index_path, r"\n  function retakePhoto\(\) \{.*?\n  \}\n\n  async function keepPhoto", "\n  async function keepPhoto")
regex_once(index_path, r"\n  async function keepPhoto\(\) \{.*?\n  \}\n\n  async function handleCameraRouteResult", "\n  async function handleCameraRouteResult")

# Remove the two old full-screen Modal camera/review trees.
regex_once(
    index_path,
    r"\n      <Modal\n        visible=\{stage === 'camera'.*?</Modal>\n\n      <Modal\n        visible=\{\n          stage === 'photoReview'.*?</Modal>\n",
    "\n",
)

# Route novelty + time budget in initial and recovery routing.
replace_once(
    index_path,
    "      const routed = await resolveRoutedScene({\n        start: startPoint,\n        candidates: rankedCandidates,\n        minutes,\n        distanceScale: paceDistanceScale,\n      });",
    "      const recentRoutes = passport\n        .slice(0, 6)\n        .map((entry) =>\n          entry.route && entry.route.length >= 2\n            ? entry.route\n            : entry.plannedRoute ?? []\n        )\n        .filter((route) => route.length >= 2);\n\n      const routed = await resolveRoutedScene({\n        start: startPoint,\n        candidates: rankedCandidates,\n        minutes,\n        distanceScale: paceDistanceScale,\n        sideMissionCount: getJourneyProfile(minutes).sideMissionCount,\n        avoidRoutes: recentRoutes,\n      });",
)
replace_once(
    index_path,
    "          maxDistanceMeters:\n            distanceBudget,\n        });",
    "          maxDistanceMeters:\n            distanceBudget,\n          sideMissionCount: 0,\n          avoidRoutes: [\n            activeTrace,\n            ...passport.slice(0, 5).map((entry) =>\n              entry.route && entry.route.length >= 2\n                ? entry.route\n                : entry.plannedRoute ?? []\n            ),\n          ].filter((route) => route.length >= 2),\n        });",
)

# Clear the app-private photo directory together with Passport metadata.
replace_once(
    index_path,
    "          onPress: async () => {\n            await AsyncStorage.removeItem(PASSPORT_KEY);\n            setPassport([]);",
    "          onPress: async () => {\n            await AsyncStorage.removeItem(PASSPORT_KEY);\n\n            try {\n              const photoDirectory = new Directory(Paths.document, 'detour-photos');\n              if (photoDirectory.exists) photoDirectory.delete();\n            } catch {\n              // Passport metadata is already gone; stale local files should\n              // never make clearing the collection fail.\n            }\n\n            setPassport([]);",
)
replace_once(
    index_path,
    "    const nextPassport = [entry, ...passport].slice(0, 50);",
    "    const nextPassport = [entry, ...passport];",
)

# Count actual completed discoveries, not planned tasks.
regex_once(
    index_path,
    r"    const discoveries = \(plan\?\.sideMissions\.length \?\? 0\) \+ 1;\n    const finalPhotos = photoOverride \?\? photos;\n    const missionHistory: PassportMission\[\] = plan\n      \? \[\.\.\.plan\.sideMissions, plan\.arrivalMission\]\.map\(\(mission\) => \(\{\n          code: mission\.code,\n          title: mission\.title,\n          instruction: mission\.instruction,\n          completion: mission\.completion,\n          result: missionResultsRef\.current\[mission\.id\] \?\? 'completed',\n          photoRequired: mission\.photo,\n        \}\)\)\n      : \[\];",
    "    const finalPhotos = photoOverride ?? photos;\n    const missionHistory: PassportMission[] = plan\n      ? [...plan.sideMissions, plan.arrivalMission].map((mission) => ({\n          code: mission.code,\n          title: mission.title,\n          instruction: mission.instruction,\n          completion: mission.completion,\n          result: missionResultsRef.current[mission.id] ?? 'completed',\n          photoRequired: mission.photo,\n        }))\n      : [];\n    const discoveries = missionHistory.filter(\n      (mission) => mission.result === 'completed'\n    ).length;",
)

# Reserve enough of the six-frame roll for unfinished required photo missions.
insert_marker = "  async function openCamera(source: CameraSource) {"
text = read(index_path)
if insert_marker not in text:
    raise SystemExit('openCamera marker missing')
reservation_helper = r'''  function reservedMissionPhotoCount() {
    if (!plan) return 0;

    const remainingSide = plan.sideMissions
      .slice(sideMissionIndex)
      .filter(
        (mission) =>
          mission.photo &&
          missionResultsRef.current[mission.id] !== 'completed' &&
          missionResultsRef.current[mission.id] !== 'skipped'
      ).length;

    const arrivalReserved =
      plan.arrivalMission.photo &&
      missionResultsRef.current[plan.arrivalMission.id] !== 'completed' &&
      missionResultsRef.current[plan.arrivalMission.id] !== 'skipped'
        ? 1
        : 0;

    return remainingSide + arrivalReserved;
  }

'''
write(index_path, text.replace(insert_marker, reservation_helper + insert_marker, 1))
replace_once(
    index_path,
    "  async function openCamera(source: CameraSource) {\n    const colorWalkCameraMission: Mission =",
    "  async function openCamera(source: CameraSource) {\n    if (photos.length >= rollCapacity) {\n      Alert.alert('這趟已經拍滿了', `每趟 DETOUR 最多留下 ${rollCapacity} 張照片。`);\n      return;\n    }\n\n    if (source === 'free') {\n      const reserved = reservedMissionPhotoCount();\n      const freeLimit = Math.max(0, rollCapacity - reserved);\n\n      if (photos.length >= freeLimit) {\n        Alert.alert(\n          '先留幾張給路上的尋找',\n          `剩下 ${reserved} 張底片已保留給還沒完成的拍照尋找。`\n        );\n        return;\n      }\n    }\n\n    const colorWalkCameraMission: Mission =",
)

# Navigation: map becomes a secondary aid; camera returns to bottom-right.
replace_once(
    index_path,
    "                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>\n                <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>→</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>看下一段路</Text></Pressable>",
    "                <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>↗</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>小地圖</Text></Pressable>\n                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>",
)
replace_once(
    index_path,
    "  v35JourneyCamera: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: '#3A3936', alignItems: 'center', justifyContent: 'center' },\n  v35JourneyCameraText: { fontSize: 31, color: BONE },\n  v35JourneyPrimary: { flex: 1, minHeight: 68, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, position: 'relative' },\n  v35JourneyPrimaryPressed: { opacity: 0.8 },\n  v35JourneyPrimaryArrow: { fontSize: 34, color: BONE },\n  v35JourneyPrimaryDivider: { width: 1, height: 38, marginHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.35)' },\n  v35JourneyPrimaryText: { flex: 1, fontSize: 24, fontWeight: '900', color: BONE, textAlign: 'center' },",
    "  v35JourneyCamera: { width: 68, height: 68, borderRadius: 34, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },\n  v35JourneyCameraText: { fontSize: 31, color: BONE },\n  v35JourneyPrimary: { flex: 1, minHeight: 62, borderWidth: 1, borderColor: '#3A3936', backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, position: 'relative' },\n  v35JourneyPrimaryPressed: { opacity: 0.72 },\n  v35JourneyPrimaryArrow: { fontSize: 20, color: '#A9A59C' },\n  v35JourneyPrimaryDivider: { width: 1, height: 28, marginHorizontal: 13, backgroundColor: '#3A3936' },\n  v35JourneyPrimaryText: { flex: 1, fontSize: 16, fontWeight: '800', color: BONE, textAlign: 'center' },",
)

# Ready ticket: keep the object, remove the explanation-card feeling.
regex_once(
    index_path,
    r"              <View style=\{styles\.detourTicketHighlights\}>\n                \{selectedMood === 'color' && selectedColor \? \(\n                  <>.*?                \)\}\n              </View>",
    "              <View style={styles.detourTicketHighlights}>\n                {selectedMood === 'color' && selectedColor ? (\n                  <>\n                    <Text style={styles.detourTicketHighlight}>\n                      • 今天找{selectedColor.label}\n                    </Text>\n                    <Text style={styles.detourTicketHighlight}>\n                      • 終點保密\n                    </Text>\n                  </>\n                ) : (\n                  <>\n                    <Text style={styles.detourTicketHighlight}>\n                      • {previewProfile.sideMissionCount} 個沿路尋找\n                    </Text>\n                    <Text style={styles.detourTicketHighlight}>\n                      • 終點保密\n                    </Text>\n                  </>\n                )}\n              </View>",
)
replace_once(index_path, "                {devMode\n                  ? '使用這張票開始室內主線'\n                  : '使用這張票開始 DETOUR'}", "                {devMode ? '開始室內測試' : '出發'}")

# Passport: collection-first Chinese UI; photo stays directly tappable nowhere.
replace_once(index_path, "                  {selectedPassportEntry.moodCode}\n", "                  {selectedPassportEntry.moodLabel}\n")
replace_once(index_path, "                    DESTINATION · {selectedPassportEntry.sceneName}\n", "                    終點 · {selectedPassportEntry.sceneName}\n")
replace_once(index_path, ">START</Text>", ">出發</Text>")
replace_once(index_path, ">END</Text>", ">完成</Text>")
replace_once(index_path, ">ACTUAL</Text>", ">實際</Text>")
replace_once(index_path, "                      ? `${selectedPassportEntry.actualDurationMinutes} MIN`\n", "                      ? `${selectedPassportEntry.actualDurationMinutes} 分`\n")
replace_once(index_path, "                        ROUTE / TRACE\n", "                        走過的路\n")
replace_once(index_path, "                        ).toFixed(2)} KM\n", "                        ).toFixed(2)} 公里\n")
replace_once(index_path, "                          PLANNED\n", "                          原路線\n")
replace_once(index_path, "                          ACTUAL\n", "                          實際走過\n")

# Main passport photo no longer advertises a separate zoom interaction.
regex_once(
    index_path,
    r"                  <Pressable\n                    accessibilityLabel=\"放大檢視照片\".*?                    <View style=\{styles\.v38ZoomBadge\}>.*?                    </View>\n                  </Pressable>",
    "                  <Image\n                    source={{ uri: selectedPassportEntry.photos[Math.min(passportPhotoIndex, selectedPassportEntry.photos.length - 1)].uri }}\n                    style={styles.v35ReviewHeroPhoto}\n                    resizeMode=\"cover\"\n                  />",
)

# Mission list uses the find number rather than internal English mission codes.
replace_once(
    index_path,
    "                          <Text style={styles.postcardMissionCode}>\n                            {mission.code}\n                          </Text>",
    "                          <Text style={styles.postcardMissionCode}>\n                            尋找 {String(index + 1).padStart(2, '0')}\n                          </Text>",
)

# Remove the now-unused zoom modal.
regex_once(
    index_path,
    r"\n      <Modal\n        visible=\{Boolean\(passportZoomUri\)\}.*?</Modal>\n",
    "\n",
)


# ---------------------------------------------------------------------------
# Build marker + product notes.
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/build-info.ts',
    "// v0.39.3: ticket cleanup, Color Walk accent semantics, staged Find reveal, and a quieter camera.\nexport const DETOUR_BUILD_VERSION = '0.39.3';",
    "// v0.40: six-frame budget, route novelty/time guard, collection cleanup, and field-ready UI hierarchy.\nexport const DETOUR_BUILD_VERSION = '0.40.0';",
)

foundation_path = 'PRODUCT_FOUNDATION.md'
foundation = read(foundation_path)
addition = r'''

## v0.40 Field-ready 收斂

- **六張是真的上限**：每趟最多保留 6 張；自由拍照必須替尚未完成的必要拍照尋找保留底片。
- **長旅程不是更多 checklist**：15 / 30 / 45–90 分鐘的普通尋找密度收斂為 2 / 3 / 4；長時間的價值來自路線、區域與終點。
- **Route Novelty 進入 routing 層**：最近旅程的街段會對候選路線產生 overlap penalty；共同起步的一小段不計。
- **時間 budget 使用真實 routing duration**：OSRM 步行時間加入城市摩擦、拍照尋找與抵達 reserve，超時候選會降權或被淘汰。
- **導航把手機降級**：方向與距離是主角；小地圖是看不懂時的輔助；相機回到右下角主要行動位。
- **Passport 是旅行收藏，不是 analytics**：消費者頁面改中文、移除照片放大 CTA、不再只保留 50 趟；清除收藏時同步刪除 App 私有照片檔。
- **相機只留一套**：正式拍攝只走 `/camera` route；舊的 index Modal / Photo Check 流程移除。
'''
if '## v0.40 Field-ready 收斂' not in foundation:
    write(foundation_path, foundation.rstrip() + addition + '\n')


# Product invariants for the migration itself.
assert_contains(journey_path, 'sideMissionCount = 4;')
assert_contains(routing_path, 'avoidRoutes?: GeoPoint[][];')
assert_contains(routing_path, 'estimatedJourneySeconds')
assert_contains(camera_path, 'const atCapacity = savedCount >= rollCapacity;')
assert_contains(index_path, "Alert.alert('這趟已經拍滿了'")
assert_contains(index_path, 'reservedMissionPhotoCount')
assert_contains(index_path, 'const nextPassport = [entry, ...passport];')
assert_contains(index_path, "new Directory(Paths.document, 'detour-photos')")
assert_contains(index_path, '>小地圖</Text>')
assert_contains(index_path, "DETOUR_BUILD_VERSION") if False else None
