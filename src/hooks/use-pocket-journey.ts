import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { playPocketFeedback } from "../lib/pocket-feedback";
import {
  appendFix,
  DISCOVERY_ROAM_MIN_MS,
  distance,
  nextDiscoveryRevealReason,
  phaseAt,
  shouldDiscardShortEmptyJourney,
  type PocketJourney,
  type Point,
} from "../lib/pocket-engine";
import {
  DISCOVERIES,
  getExperience,
  type Environment,
  type ExperienceId,
} from "../lib/pocket-content";
import {
  chooseDiscoveryDecision,
  type DiscoveryContext,
  type DiscoveryPerformance,
  type PreviousDiscoveryContext,
} from "../lib/pocket-discovery-selection";
import {
  nearbyPlaces,
  planLeg,
  type LocalPlace,
  type PocketLeg,
} from "../lib/pocket-routing";
import {
  distanceToPolyline,
  remainingDistanceOnPolyline,
} from "../lib/navigation-engine";
import { readStored, removeStored, writeStored } from "../lib/storage";
import { computePocketRouteQuality } from "../lib/pocket-route-quality";
import {
  beginPocketTelemetryRun,
  finalizePocketTelemetryRun,
  loadPocketDiscoveryPerformance,
  recordPocketDiscoveryShown,
  recordPocketReroute,
  resolvePocketDiscovery,
} from "../lib/pocket-telemetry";
import type { PassportEntry } from "../lib/app-model";

const ACTIVE = "@detour/pocket/active/v2";
const HISTORY = "@detour/pocket/history/v2";
export function usePocketJourney() {
  const [journey, setJourney] = useState<PocketJourney | null>(null);
  const [recoverableJourney, setRecoverableJourney] =
    useState<PocketJourney | null>(null);
  const current = useRef<PocketJourney | null>(null);
  const [history, setHistory] = useState<PocketJourney[]>([]);
  const historyRef = useRef<PocketJourney[]>([]);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [leg, setLeg] = useState<PocketLeg | null>(null);
  const legRef = useRef<PocketLeg | null>(null);
  const [routing, setRouting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [heading, setHeading] = useState<number | null>(null);
  const places = useRef<LocalPlace[]>([]);
  const planning = useRef(false);
  const rerun = useRef(false);
  const generation = useRef(0);
  const lastPlan = useRef(0);
  const lastFix = useRef(Date.now());
  const saveQueue = useRef(Promise.resolve());
  const startLock = useRef(false);
  const finishLock = useRef(false);
  const actionAt = useRef(0);
  const appState = useRef(AppState.currentState);
  const discoveryPerformance = useRef<Record<string, DiscoveryPerformance>>({});

  function daylightForExperience(experienceId: ExperienceId | undefined) {
    const experience = getExperience(experienceId);
    const hour = new Date().getHours();
    return (
      experience.availability?.daylight ??
      (hour >= 18 || hour < 6 ? ("night" as const) : ("day" as const))
    );
  }

  function quickFindStreak(
    found: PocketJourney["found"],
    previous?: PreviousDiscoveryContext,
  ) {
    if (previous?.result === "skipped") return 0;
    let streak = 0;
    for (let index = found.length - 1; index >= 0; index--) {
      if (found[index].seconds >= 60) break;
      streak += 1;
    }
    return streak;
  }

  function selectionContext(input: {
    journey?: PocketJourney;
    experienceId?: ExperienceId;
    environment: Environment;
    elapsedSeconds: number;
    discoveryIndex: number;
    phase: "exploration" | "closing";
    previousDiscovery?: PreviousDiscoveryContext;
    recentlySeenIds?: string[];
    recentlyFoundIds?: string[];
    found?: PocketJourney["found"];
    forceLight?: boolean;
  }): DiscoveryContext {
    const experienceId =
      input.experienceId ?? input.journey?.experienceId ?? "core";
    const found = input.found ?? input.journey?.found ?? [];
    const recentIds =
      input.recentlySeenIds ?? input.journey?.seen ?? [];
    const recentMissions = recentIds
      .map((id) => DISCOVERIES.find((discovery) => discovery.id === id))
      .filter((discovery) => discovery !== undefined);
    return {
      environment: input.environment,
      experienceId,
      elapsedSeconds: Math.max(0, input.elapsedSeconds),
      discoveryIndex: Math.max(1, input.discoveryIndex),
      phase: input.phase,
      daylight: daylightForExperience(experienceId),
      previousDiscovery: input.previousDiscovery,
      recentlySeenIds: recentIds,
      recentlyFoundIds:
        input.recentlyFoundIds ??
        found.map((item) => item.id),
      recentDirections: recentMissions
        .map((mission) => mission.direction)
        .filter((value) => value !== undefined),
      recentActionTypes: recentMissions
        .map((mission) => mission.actionType)
        .filter((value) => value !== undefined),
      recentRoles: recentMissions
        .map((mission) => mission.role)
        .filter((value) => value !== undefined),
      quickFindStreak: quickFindStreak(found, input.previousDiscovery),
      performanceById: discoveryPerformance.current,
      forceLight: input.forceLight,
    };
  }

  const enqueue = (task: () => Promise<void>) => {
    saveQueue.current = saveQueue.current
      .then(task)
      .catch(() => setError("暫時無法儲存，請保留 App 並再試一次。"));
    return saveQueue.current;
  };
  function update(value: PocketJourney) {
    if (finishLock.current) return;
    const next =
      value.phase !== "finished" && !value.suspendedAt
        ? { ...value, lastActiveAt: Date.now() }
        : value;
    current.current = next;
    setJourney(next);
    if (next.phase !== "finished")
      void enqueue(() => writeStored(ACTIVE, next));
  }

  function resumeValue(value: PocketJourney, time = Date.now()) {
    const pausedFrom = value.suspendedAt ?? value.lastActiveAt;
    const pausedFor = pausedFrom ? Math.max(0, time - pausedFrom) : 0;
    return {
      ...value,
      startedAt: value.startedAt + pausedFor,
      targetSince: value.targetSince ? value.targetSince + pausedFor : 0,
      nextDiscoveryAt: value.nextDiscoveryAt
        ? value.nextDiscoveryAt + pausedFor
        : undefined,
      suspendedAt: undefined,
      lastActiveAt: time,
    };
  }

  function resumeRecovered() {
    const saved = recoverableJourney;
    if (!saved) return;
    const time = Date.now();
    const resumed = resumeValue(saved, time);
    void beginPocketTelemetryRun({
      id: resumed.id,
      startedAt: resumed.startedAt,
      devMode: !!resumed.demo,
      experienceId: resumed.experienceId ?? "core",
    });
    if (resumed.target) {
      void recordPocketDiscoveryShown({
        journeyId: resumed.id,
        target: resumed.target,
        environment: legRef.current?.destination.environment ?? "street",
        shownAt: resumed.targetSince,
        journeyStartedAt: resumed.startedAt,
        discoveryIndex: Math.max(1, resumed.seen.length),
        experienceId: resumed.experienceId ?? "core",
        repeatExposure: resumed.seen
          .slice(0, -1)
          .includes(resumed.target.id),
      });
    }
    generation.current++;
    lastFix.current = time;
    current.current = resumed;
    setRecoverableJourney(null);
    setJourney(resumed);
    setNow(time);
    void enqueue(() => writeStored(ACTIVE, resumed));
  }

  async function restartRecovered() {
    const saved = recoverableJourney;
    generation.current++;
    if (saved) {
      const completedAt = Date.now();
      void finalizePocketTelemetryRun({
        journeyId: saved.id,
        status: "discarded",
        completedAt,
        photoCount: saved.photos.length,
        foundCount: saved.found.length,
        actualDurationSeconds: Math.max(
          0,
          (completedAt - saved.startedAt) / 1000,
        ),
        routeQuality: computePocketRouteQuality(
          saved.trace,
          historyRef.current.slice(0, 2).map((entry) => entry.trace),
          0,
        ),
      });
    }
    await saveQueue.current;
    await removeStored(ACTIVE);
    setRecoverableJourney(null);
    current.current = null;
    setJourney(null);
    await start(false, saved?.experienceId ?? "core");
  }

  function toggleFavorite(id: string) {
    const entries = historyRef.current.map((entry) =>
      entry.id === id ? { ...entry, favorite: !entry.favorite } : entry,
    );
    return enqueue(async () => {
      await writeStored(HISTORY, entries);
      historyRef.current = entries;
      setHistory(entries);
    });
  }

  function deleteHistory(id: string) {
    const target = historyRef.current.find((entry) => entry.id === id);
    const entries = historyRef.current.filter((entry) => entry.id !== id);
    return enqueue(async () => {
      const root = FileSystem.documentDirectory;
      if (target && root) {
        await Promise.all(
          target.photos
            .filter((uri) => uri.startsWith(`${root}pocket-photos/`))
            .map((uri) =>
              FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}),
            ),
        );
      }
      await writeStored(HISTORY, entries);
      historyRef.current = entries;
      setHistory(entries);
    });
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [active, saved, legacy, performance] = await Promise.all([
          readStored<PocketJourney>(ACTIVE),
          readStored<PocketJourney[]>(HISTORY),
          readStored<PassportEntry[]>("@detour/passport/v1"),
          loadPocketDiscoveryPerformance(),
        ]);
        discoveryPerformance.current = performance;
        if (!alive) return;
        const cleanedSaved = (saved ?? []).filter(
          (entry) =>
            !shouldDiscardShortEmptyJourney(
              entry,
              entry.finishedAt ?? Date.now(),
            ),
        );
        if (cleanedSaved.length !== (saved ?? []).length)
          await writeStored(HISTORY, cleanedSaved);
        const imported: PocketJourney[] = (legacy ?? [])
          .filter((e) => e.id && !cleanedSaved.some((p) => p.id === e.id))
          .map((e) => ({
            id: e.id,
            startedAt: Date.parse(e.startedAt ?? e.completedAt),
            finishedAt: Date.parse(e.completedAt),
            origin: e.route?.[0] ?? { latitude: 0, longitude: 0 },
            trace: e.route ?? [],
            found: [],
            seen: [],
            target: null,
            targetSince: 0,
            photos: (e.photos ?? []).map((p) => p.uri),
            phase: "finished",
            closingTargetUsed: true,
            area: e.city,
            endpoint:
              e.sceneName && e.scenePoint
                ? { name: e.sceneName, point: e.scenePoint }
                : undefined,
          }));
        historyRef.current = [...cleanedSaved, ...imported].sort(
          (a, b) => b.startedAt - a.startedAt,
        );
        setHistory(historyRef.current);
        if (
          active &&
          active.phase !== "finished" &&
          !historyRef.current.some((p) => p.id === active.id)
        ) {
          // A stored active journey belongs to a previous process. Keep it
          // recoverable, but do not silently throw the user back into it.
          setRecoverableJourney(active);
        }
      } catch {
        setError("收藏暫時無法讀取，請重新開啟再試。");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
      generation.current++;
    };
  }, []);

  type RouteReason =
    | "initial"
    | "advance"
    | "discovery"
    | "closing"
    | "off-route"
    | "retry"
    | "refresh";

  async function routeNext(reason: RouteReason = "retry") {
    if (planning.current) {
      rerun.current = true;
      return;
    }
    const j = current.current;
    if (!j || j.phase === "finished" || j.demo) return;
    if (reason === "off-route" || reason === "retry")
      void recordPocketReroute(j.id);
    planning.current = true;
    setRouting(true);
    lastPlan.current = Date.now();
    const token = generation.current;
    const point = j.trace.at(-1) ?? j.origin;
    try {
      places.current = await nearbyPlaces(point);
      const seconds = (Date.now() - j.startedAt) / 1000;
      const closing = j.phase === "closing" && seconds >= 480;
      const result = await planLeg({
        current: point,
        origin: j.origin,
        trace: j.trace,
        closing,
        elapsed: seconds,
        places: places.current,
        recentRoutes: historyRef.current.slice(0, 2).map((h) => h.trace),
      });
      const latest = current.current;
      if (
        token !== generation.current ||
        latest?.id !== j.id ||
        latest.phase === "finished"
      )
        return;
      if (
        latest.phase !== j.phase ||
        distance(latest.trace.at(-1) ?? latest.origin, point) > 50
      ) {
        rerun.current = true;
        return;
      }
      legRef.current = result;
      setLeg(result);
      setNotice(
        result ? "" : "這裡暫時沒有可用的步行方向，先在安全的地方看看。",
      );
      if (result?.closing)
        update({
          ...latest,
          endpoint: {
            name: result.destination.name,
            point: result.coordinates.at(-1)!,
          },
        });
    } catch {
      if (token === generation.current) {
        legRef.current = null;
        setLeg(null);
        setNotice("路線暫時連不上。你可以繼續找，稍後再試。");
      }
    } finally {
      planning.current = false;
      setRouting(false);
      if (rerun.current) {
        rerun.current = false;
        void routeNext("refresh");
      }
    }
  }
  async function start(
    demo = false,
    experienceId: ExperienceId = "core",
  ) {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(true);
    setError("");
    try {
      let point: Point = { latitude: 25.0339, longitude: 121.5636 };
      if (!demo) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "需要定位，才能從你現在的位置開始。請在手機設定允許定位後再試。",
          );
        const recent = await Location.getLastKnownPositionAsync({
          maxAge: 120000,
          requiredAccuracy: 100,
        });
        let fix = recent;
        if (!fix) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          fix = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("還抓不到位置，走到戶外再試一次。")),
                8000,
              );
            }),
          ]).finally(() => clearTimeout(timer));
        }
        if ((fix.coords.accuracy ?? 100) > 120)
          throw new Error("定位還不夠穩，走到空曠一點的地方再試。");
        point = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        };
      }
      const time = Date.now();
      const decision = chooseDiscoveryDecision(
        selectionContext({
          experienceId,
          environment: "street",
          elapsedSeconds: 0,
          discoveryIndex: 1,
          phase: "exploration",
          found: [],
          recentlySeenIds: [],
          recentlyFoundIds: [],
        }),
        { timestamp: time },
      );
      const target = decision.discovery;
      const next: PocketJourney = {
        id: `${time}`,
        startedAt: time,
        origin: point,
        trace: [point],
        found: [],
        seen: [target.id],
        target,
        targetSince: time,
        photos: [],
        phase: "exploration",
        closingTargetUsed: false,
        demo,
        experienceId,
        lastActiveAt: time,
      };
      generation.current++;
      lastFix.current = time;
      legRef.current = null;
      setLeg(null);
      setNotice("");
      update(next);
      setNow(time);
      void beginPocketTelemetryRun({
        id: next.id,
        startedAt: next.startedAt,
        devMode: !!next.demo,
        experienceId: next.experienceId ?? "core",
      });
      void recordPocketDiscoveryShown({
        journeyId: next.id,
        target,
        environment: "street",
        shownAt: time,
        journeyStartedAt: time,
        discoveryIndex: 1,
        experienceId: next.experienceId ?? "core",
        repeatExposure: false,
        selection: decision.log,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法開始，請稍後再試。");
    } finally {
      startLock.current = false;
      setStarting(false);
    }
  }
  function revealNextDiscovery(time = Date.now()) {
    const j = current.current;
    if (!j || j.phase !== "exploration" || j.target) return false;
    const revealReason = nextDiscoveryRevealReason(j, time);
    if (!revealReason) return false;

    const roamStartedAt = j.nextDiscoveryAt
      ? j.nextDiscoveryAt - (j.demo ? 3_000 : DISCOVERY_ROAM_MIN_MS)
      : time;
    const roamGapSeconds = Math.max(0, (time - roamStartedAt) / 1000);
    const roamFrom = j.nextDiscoveryFrom;
    const roamCurrent = j.trace.at(-1);
    const roamGapMeters =
      roamFrom && roamCurrent ? distance(roamFrom, roamCurrent) : undefined;

    const previousFound = j.found.at(-1);
    const previousDiscovery: PreviousDiscoveryContext | undefined =
      previousFound
        ? {
            id: previousFound.id,
            kind: previousFound.kind,
            difficulty: previousFound.difficulty,
            result: "found",
            secondsVisible: previousFound.seconds,
            direction: previousFound.direction,
            actionType: previousFound.actionType,
            role: previousFound.role,
          }
        : undefined;
    const environment =
      legRef.current?.destination.environment ?? "street";
    const decision = chooseDiscoveryDecision(
      selectionContext({
        journey: j,
        environment,
        elapsedSeconds: (time - j.startedAt) / 1000,
        discoveryIndex: j.seen.length + 1,
        phase: "exploration",
        previousDiscovery,
        recentlySeenIds: j.seen,
        recentlyFoundIds: j.found.map((item) => item.id),
        found: j.found,
      }),
      { timestamp: time },
    );
    const target = decision.discovery;
    const nextSeen = [...j.seen, target.id];
    update({
      ...j,
      target,
      targetSince: time,
      seen: nextSeen,
      nextDiscoveryAt: undefined,
      nextDiscoveryFrom: undefined,
    });
    void recordPocketDiscoveryShown({
      journeyId: j.id,
      target,
      environment,
      shownAt: time,
      journeyStartedAt: j.startedAt,
      discoveryIndex: nextSeen.length,
      experienceId: j.experienceId ?? "core",
      repeatExposure: j.seen.includes(target.id),
      roamGapSeconds,
      roamGapMeters,
      roamRevealReason: revealReason,
      selection: decision.log,
    });
    return true;
  }

  async function finish() {
    const j = current.current;
    if (!j || j.phase === "finished" || finishLock.current) return;
    finishLock.current = true;

    if (shouldDiscardShortEmptyJourney(j)) {
      generation.current++;
      const completedAt = Date.now();
      void finalizePocketTelemetryRun({
        journeyId: j.id,
        status: "discarded",
        completedAt,
        photoCount: j.photos.length,
        foundCount: j.found.length,
        actualDurationSeconds: Math.max(
          0,
          (completedAt - j.startedAt) / 1000,
        ),
        routeQuality: computePocketRouteQuality(
          j.trace,
          historyRef.current.slice(0, 2).map((entry) => entry.trace),
          0,
        ),
      });
      try {
        await saveQueue.current;
        await removeStored(ACTIVE);
        current.current = null;
        setJourney(null);
        legRef.current = null;
        setLeg(null);
        setNotice("");
        setError("");
      } catch {
        setError("暫時無法結束這趟，請再試一次。");
      } finally {
        finishLock.current = false;
      }
      return;
    }

    setFinishing(true);
    generation.current++;
    const point = j.trace.at(-1) ?? j.origin;
    const arrived = j.endpoint && distance(point, j.endpoint.point) < 45;
    const done: PocketJourney = {
      ...j,
      phase: "finished",
      target: null,
      finishedAt: Date.now(),
      endpoint: arrived ? j.endpoint : { name: "你停下來的這一角", point },
      suspendedAt: undefined,
      lastActiveAt: undefined,
    };
    const entries = [
      done,
      ...historyRef.current.filter((p) => p.id !== done.id),
    ];
    try {
      await saveQueue.current;
      await writeStored(HISTORY, entries);
      await removeStored(ACTIVE);
      historyRef.current = entries;
      setHistory(entries);
      current.current = done;
      setJourney(done);
      legRef.current = null;
      setLeg(null);
      void finalizePocketTelemetryRun({
        journeyId: done.id,
        status: "completed",
        completedAt: done.finishedAt!,
        photoCount: done.photos.length,
        foundCount: done.found.length,
        actualDurationSeconds: Math.max(
          0,
          (done.finishedAt! - done.startedAt) / 1000,
        ),
        routeQuality: computePocketRouteQuality(
          done.trace,
          historyRef.current
            .filter((entry) => entry.id !== done.id)
            .slice(0, 2)
            .map((entry) => entry.trace),
          0,
        ),
      });
      playPocketFeedback("completion");
    } catch {
      setError("票根還沒存好，請再按一次完成。");
    } finally {
      finishLock.current = false;
      setFinishing(false);
    }
  }
  function discover(skip = false) {
    if (finishLock.current || Date.now() - actionAt.current < 600) return false;
    actionAt.current = Date.now();
    const j = current.current;
    if (!j?.target || j.phase === "finished") return false;
    const time = Date.now();
    void resolvePocketDiscovery({
      journeyId: j.id,
      discoveryIndex: Math.max(1, j.seen.length),
      result: skip ? "skipped" : "found",
      resolvedAt: time,
    });
    const found = skip
      ? j.found
      : [
          ...j.found,
          {
            ...j.target,
            foundAt: time,
            seconds: (time - j.targetSince) / 1000,
          },
        ];
    const phase =
      j.phase === "closing"
        ? "closing"
        : phaseAt((time - j.startedAt) / 1000, found.length);
    if (phase === "finished") {
      update({ ...j, found });
      void finish();
      return false;
    }
    const environment = legRef.current?.destination.environment ?? "street";
    const previousDiscovery: PreviousDiscoveryContext = {
      id: j.target.id,
      kind: j.target.kind,
      difficulty: j.target.difficulty,
      result: skip ? "skipped" : "found",
      secondsVisible: Math.max(0, (time - j.targetSince) / 1000),
      direction: j.target.direction,
      actionType: j.target.actionType,
      role: j.target.role,
    };

    if (!skip) {
      update({
        ...j,
        found,
        phase,
        target: null,
        targetSince: 0,
        nextDiscoveryAt:
          phase === "exploration"
            ? time + (j.demo ? 3_000 : DISCOVERY_ROAM_MIN_MS)
            : undefined,
        nextDiscoveryFrom:
          phase === "exploration"
            ? (j.trace.at(-1) ?? j.origin)
            : undefined,
      });
      playPocketFeedback("discovery");
      void routeNext("discovery");
      return true;
    }

    const decision = chooseDiscoveryDecision(
      selectionContext({
        journey: j,
        environment,
        elapsedSeconds: (time - j.startedAt) / 1000,
        discoveryIndex: j.seen.length + 1,
        phase,
        previousDiscovery,
        recentlySeenIds: j.seen,
        recentlyFoundIds: found.map((item) => item.id),
        found,
      }),
      { timestamp: time },
    );
    const target = decision.discovery;
    const repeatExposure = j.seen.includes(target.id);
    const nextSeen = [...j.seen, target.id];
    update({
      ...j,
      found,
      phase,
      target,
      targetSince: time,
      seen: nextSeen,
      nextDiscoveryAt: undefined,
      nextDiscoveryFrom: undefined,
    });
    void recordPocketDiscoveryShown({
      journeyId: j.id,
      target,
      environment,
      shownAt: time,
      journeyStartedAt: j.startedAt,
      discoveryIndex: nextSeen.length,
      experienceId: j.experienceId ?? "core",
      repeatExposure,
      selection: decision.log,
    });
    return true;
  }
  function extraDiscovery() {
    const j = current.current;
    if (!j || j.closingTargetUsed || j.target) return;
    const time = Date.now();
    const previousFound = j.found.at(-1);
    const previousDiscovery: PreviousDiscoveryContext | undefined =
      previousFound
        ? {
            id: previousFound.id,
            kind: previousFound.kind,
            difficulty: previousFound.difficulty,
            result: "found",
            secondsVisible: previousFound.seconds,
            direction: previousFound.direction,
            actionType: previousFound.actionType,
            role: previousFound.role,
          }
        : undefined;
    const environment =
      legRef.current?.destination.environment ?? "street";
    const decision = chooseDiscoveryDecision(
      selectionContext({
        journey: j,
        environment,
        elapsedSeconds: (time - j.startedAt) / 1000,
        discoveryIndex: j.seen.length + 1,
        phase: "closing",
        previousDiscovery,
        forceLight: true,
      }),
      { timestamp: time },
    );
    const target = decision.discovery;
    const repeatExposure = j.seen.includes(target.id);
    const nextSeen = [...j.seen, target.id];
    update({
      ...j,
      target,
      targetSince: time,
      seen: nextSeen,
      closingTargetUsed: true,
    });
    void recordPocketDiscoveryShown({
      journeyId: j.id,
      target,
      environment,
      shownAt: time,
      journeyStartedAt: j.startedAt,
      discoveryIndex: nextSeen.length,
      experienceId: j.experienceId ?? "core",
      repeatExposure,
      selection: decision.log,
    });
  }
  const active = journey !== null && journey.phase !== "finished";
  useEffect(() => {
    if (!active) return;
    function tick() {
      const time = Date.now();
      setNow(time);
      const j = current.current;
      if (!j || j.phase === "finished" || j.suspendedAt) return;
      if (time - (j.lastActiveAt ?? 0) >= 15000) {
        const checkpoint = { ...j, lastActiveAt: time };
        current.current = checkpoint;
        void enqueue(() => writeStored(ACTIVE, checkpoint));
      }
      const next = phaseAt((time - j.startedAt) / 1000, j.found.length);
      if (next === "finished") {
        void finish();
        return;
      }
      if (next === "closing" && j.phase === "exploration") {
        update({
          ...j,
          phase: "closing",
          target: null,
          targetSince: 0,
          nextDiscoveryAt: undefined,
          nextDiscoveryFrom: undefined,
        });
        void routeNext("closing");
        return;
      }
      if (
        j.phase === "exploration" &&
        !j.target &&
        j.nextDiscoveryAt
      )
        revealNextDiscovery(time);
      if (
        j.phase === "closing" &&
        time - j.startedAt >= 480000 &&
        !j.endpoint &&
        time - lastPlan.current > 30000
      )
        void routeNext("closing");
      if (
        time - j.startedAt >= 570000 &&
        j.phase === "closing" &&
        j.endpoint &&
        distance(j.trace.at(-1) ?? j.origin, j.endpoint.point) < 40
      )
        void finish();
    }
    tick();
    const interval = setInterval(tick, 1000);
    const subscription = AppState.addEventListener("change", (s) => {
      appState.current = s;
      if (s !== "active") {
        const j = current.current;
        if (j && j.phase !== "finished" && !j.suspendedAt) {
          const time = Date.now();
          const suspended = {
            ...j,
            suspendedAt: time,
            lastActiveAt: time,
          };
          current.current = suspended;
          setJourney(suspended);
          void enqueue(() => writeStored(ACTIVE, suspended));
        }
        return;
      }
      const j = current.current;
      if (j?.suspendedAt) {
        const resumed = resumeValue(j);
        current.current = resumed;
        setJourney(resumed);
        setNow(Date.now());
        void enqueue(() => writeStored(ACTIVE, resumed));
      }
      tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [active]);
  useEffect(() => {
    if (!active || journey?.demo) return;
    let disposed = false;
    let watcher: Location.LocationSubscription | undefined;
    let compass: Location.LocationSubscription | undefined;
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 6,
        timeInterval: 4000,
      },
      (fix) => {
        const j = current.current;
        if (!j || j.phase === "finished") return;
        const trace = appendFix(
          j.trace,
          fix.coords,
          fix.coords.accuracy ?? 100,
          (Date.now() - lastFix.current) / 1000,
        );
        if (trace !== j.trace) {
          lastFix.current = Date.now();
          const traced = { ...j, trace };
          update(traced);
          if (
            traced.phase === "exploration" &&
            !traced.target &&
            traced.nextDiscoveryAt
          )
            revealNextDiscovery(Date.now());
        }
        const route = legRef.current;
        if (trace !== j.trace && Date.now() - lastPlan.current > 20000) {
          const offRoute =
            !!route && distanceToPolyline(fix.coords, route.coordinates) > 40;
          const nearLegEnd =
            !!route &&
            !route.closing &&
            remainingDistanceOnPolyline(fix.coords, route.coordinates) < 25;
          if (!route || offRoute || nearLegEnd)
            void routeNext(
              offRoute ? "off-route" : nearLegEnd ? "advance" : "retry",
            );
        }
      },
    )
      .then((w) => {
        if (disposed) w.remove();
        else watcher = w;
      })
      .catch(() => setNotice("定位暫停了。請確認手機定位權限。"));
    void Location.watchHeadingAsync((h) => {
      if (!disposed)
        setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
    })
      .then((w) => {
        if (disposed) w.remove();
        else compass = w;
      })
      .catch(() => {});
    void routeNext("initial");
    return () => {
      disposed = true;
      watcher?.remove();
      compass?.remove();
    };
  }, [active, journey?.id]);
  function addPhoto(uri: string) {
    const j = current.current;
    if (j && j.phase !== "finished")
      update({ ...j, photos: [...j.photos, uri] });
  }
  function home() {
    if (current.current?.phase === "finished") {
      current.current = null;
      setJourney(null);
    }
    setError("");
  }
  function advanceDemo() {
    const j = current.current;
    if (!j?.demo) return;
    update({ ...j, startedAt: j.startedAt - 120000 });
    setNow(Date.now());
  }
  return {
    journey,
    recoverableJourney,
    history,
    ready,
    starting,
    finishing,
    now,
    leg,
    routing,
    notice,
    error,
    heading,
    start,
    resumeRecovered,
    restartRecovered,
    toggleFavorite,
    deleteHistory,
    discover,
    extraDiscovery,
    finish,
    addPhoto,
    home,
    routeNext: () => routeNext("retry"),
    advanceDemo,
  };
}
