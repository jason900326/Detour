import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { playPocketFeedback } from "../lib/pocket-feedback";
import {
  appendFix,
  chooseDiscovery,
  distance,
  phaseAt,
  shouldDiscardShortEmptyJourney,
  type PocketJourney,
  type Point,
} from "../lib/pocket-engine";
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
import type { PassportEntry } from "../lib/app-model";

const ACTIVE = "@detour/pocket/active/v2";
const HISTORY = "@detour/pocket/history/v2";
export function usePocketJourney() {
  const [journey, setJourney] = useState<PocketJourney | null>(null);
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
  const enqueue = (task: () => Promise<void>) => {
    saveQueue.current = saveQueue.current
      .then(task)
      .catch(() => setError("暫時無法儲存，請保留 App 並再試一次。"));
    return saveQueue.current;
  };
  function update(value: PocketJourney) {
    if (finishLock.current) return;
    current.current = value;
    setJourney(value);
    if (value.phase !== "finished")
      void enqueue(() => writeStored(ACTIVE, value));
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [active, saved, legacy] = await Promise.all([
          readStored<PocketJourney>(ACTIVE),
          readStored<PocketJourney[]>(HISTORY),
          readStored<PassportEntry[]>("@detour/passport/v1"),
        ]);
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
          current.current = active;
          setJourney(active);
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

  async function routeNext() {
    if (planning.current) {
      rerun.current = true;
      return;
    }
    const j = current.current;
    if (!j || j.phase === "finished" || j.demo) return;
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
        void routeNext();
      }
    }
  }
  async function start(demo = false) {
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
      const target = chooseDiscovery([], []);
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
      };
      generation.current++;
      lastFix.current = time;
      legRef.current = null;
      setLeg(null);
      setNotice("");
      update(next);
      setNow(time);
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法開始，請稍後再試。");
    } finally {
      startLock.current = false;
      setStarting(false);
    }
  }
  async function finish() {
    const j = current.current;
    if (!j || j.phase === "finished" || finishLock.current) return;
    finishLock.current = true;

    if (shouldDiscardShortEmptyJourney(j)) {
      generation.current++;
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
    const target =
      phase === "closing" && !skip
        ? null
        : chooseDiscovery(
            found,
            j.seen,
            environment,
            Math.random,
            phase === "closing" || skip,
          );
    update({
      ...j,
      found,
      phase,
      target,
      targetSince: time,
      seen: target ? [...j.seen, target.id] : j.seen,
    });
    if (!skip) playPocketFeedback("discovery");
    if (!skip) void routeNext();
    return true;
  }
  function extraDiscovery() {
    const j = current.current;
    if (!j || j.closingTargetUsed || j.target) return;
    const target = chooseDiscovery(
      j.found,
      j.seen,
      "street",
      Math.random,
      true,
    );
    update({
      ...j,
      target,
      targetSince: Date.now(),
      seen: [...j.seen, target.id],
      closingTargetUsed: true,
    });
  }
  const active = journey !== null && journey.phase !== "finished";
  useEffect(() => {
    if (!active) return;
    function tick() {
      const time = Date.now();
      setNow(time);
      const j = current.current;
      if (!j || j.phase === "finished") return;
      const next = phaseAt((time - j.startedAt) / 1000, j.found.length);
      if (next === "finished") {
        void finish();
        return;
      }
      if (next === "closing" && j.phase === "exploration") {
        update({ ...j, phase: "closing", target: null });
        void routeNext();
      }
      if (
        j.phase === "closing" &&
        time - j.startedAt >= 480000 &&
        !j.endpoint &&
        time - lastPlan.current > 30000
      )
        void routeNext();
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
      if (s === "active") tick();
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
          update({ ...j, trace });
        }
        const route = legRef.current;
        if (
          trace !== j.trace &&
          Date.now() - lastPlan.current > 20000 &&
          (!route ||
            distanceToPolyline(fix.coords, route.coordinates) > 40 ||
            (!route.closing &&
              remainingDistanceOnPolyline(fix.coords, route.coordinates) < 25))
        )
          void routeNext();
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
    void routeNext();
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
    discover,
    extraDiscovery,
    finish,
    addPhoto,
    home,
    routeNext,
    advanceDemo,
  };
}
