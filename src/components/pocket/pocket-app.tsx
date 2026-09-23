import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { usePocketJourney } from "../../hooks/use-pocket-journey";
import type { PocketJourney } from "../../lib/pocket-engine";
import { Button, C, Enter, s } from "./pocket-ui";
import { WanderMotion } from "./pocket-motion";
import { DetourBrand } from "./pocket-home-art";
import { EdgeBack } from "./pocket-edge-back";
import {
  previousPocketScreen,
  type PocketScreen,
} from "../../lib/pocket-navigation";
import PocketMap from "./pocket-map";
import PocketCamera from "./pocket-camera";
import { PocketLiveAlbum } from "./pocket-live-album";
import { sharePhotos } from "../../lib/pocket-share";
import {
  preparePocketFeedback,
  playPocketFeedback,
} from "../../lib/pocket-feedback";
import { PocketHomeScreen } from "./screens/pocket-home-screen";
import { PocketJourneyScreen } from "./screens/pocket-journey-screen";
import { PocketCompletionScreen } from "./screens/pocket-completion-screen";
import { PocketHistoryScreen } from "./screens/pocket-history-screen";
import { PocketDetailScreen } from "./screens/pocket-detail-screen";
import { PocketShareScreen } from "./screens/pocket-share-screen";
import { PocketHelpScreen } from "./screens/pocket-help-screen";

type Screen = PocketScreen;

export default function PocketApp() {
  const c = usePocketJourney();
  const [screen, setScreen] = useState<Screen>("home");
  const [atHome, setAtHome] = useState(false);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, boolean>>({});
  const [coverError, setCoverError] = useState(false);
  const [shareOrigin, setShareOrigin] = useState<"home" | "detail">("home");
  const [selected, setSelected] = useState<PocketJourney | null>(null);
  const [camera, setCamera] = useState(false);
  const [album, setAlbum] = useState(false);
  const [map, setMap] = useState(false);
  const [endSheet, setEndSheet] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const shareRef = useRef<View>(null);
  const shareLock = useRef(false);

  const j = c.journey;
  const active = !!j && j.phase !== "finished";
  const completed = j?.phase === "finished";
  const displayed = selected ?? j;
  const displayedFavorite = displayed
    ? (c.history.find((entry) => entry.id === displayed.id)?.favorite ??
      displayed.favorite ??
      false)
    : false;
  const cover = displayed
    ? (covers[displayed.id] ?? displayed.photos[0])
    : undefined;
  const selectedPhotos = displayed
    ? sharePhotos(displayed.photos, cover)
    : [];
  const photosReady = selectedPhotos.every((uri) => loadedPhotos[uri]);
  const elapsed = j
    ? Math.max(0, Math.floor((c.now - j.startedAt) / 1000))
    : 0;
  const discardOnFinish =
    !!j &&
    elapsed < 60 &&
    j.photos.length === 0 &&
    j.found.length === 0;

  useEffect(preparePocketFeedback, []);

  useEffect(() => {
    if (completed) setCamera(false);
  }, [completed]);

  function goHome() {
    c.home();
    setSelected(null);
    setScreen("home");
    setMap(false);
    setAtHome(true);
    setCamera(false);
    setAlbum(false);
  }

  const isJourney = screen === "home" && active && !atHome;
  const isCompletion = screen === "home" && completed && !atHome;
  const feedbackVisible =
    !!isJourney && !camera && !album && !map && !endSheet;
  const revealed = useRef(new Set<string>());

  useEffect(() => {
    if (!feedbackVisible || !j?.target) return;
    const key = `${j.id}:${j.target.id}:${j.targetSince}`;
    if (revealed.current.has(key)) return;
    revealed.current.add(key);
    playPocketFeedback("mission");
  }, [feedbackVisible, j?.id, j?.target?.id, j?.targetSince]);

  function back() {
    const previous = previousPocketScreen(screen, shareOrigin);
    if (previous) setScreen(previous);
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sharing || c.starting || c.finishing) return true;
      if (isJourney) {
        setEndSheet(true);
        return true;
      }
      if (screen !== "home") {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  });

  async function share() {
    if (shareLock.current || !photosReady || coverError) return;
    shareLock.current = true;
    setSharing(true);
    setShareError("");
    try {
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve()),
          ),
        );
        const uri = await captureRef(shareRef, {
          format: "png",
          quality: 1,
          width: 1080,
          height: 1920,
        });
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "分享這一趟 Detour",
        });
      } else {
        await Share.share({
          message: `今天，去繞了一下。\n${displayed?.found.map((found) => found.emoji).join(" ")}\nDetour · 一點時間，一點意外。`,
        });
      }
    } catch {
      setShareError("分享沒有完成，可以再試一次。");
    } finally {
      shareLock.current = false;
      setSharing(false);
    }
  }

  if (!c.ready || c.finishing) {
    return (
      <SafeAreaView
        style={[
          s.screen,
          { justifyContent: "center", alignItems: "center", gap: 20 },
        ]}
      >
        <DetourBrand large />
        <WanderMotion />
        <Text style={[s.paperTitle, { fontSize: 30 }]}>
          {c.finishing ? "把這一點意外，收好。" : "意外，就從這裡開始。"}
        </Text>
      </SafeAreaView>
    );
  }

  const pageKey = isJourney
    ? "journey"
    : isCompletion
      ? "completion"
      : screen;

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <EdgeBack onBack={screen !== "home" && !sharing ? back : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
          showsVerticalScrollIndicator={false}
        >
          <Enter key={pageKey} style={{ flex: 1 }}>
            <View style={[s.page, { flex: 1 }]}>
              {screen === "home" && (!j || atHome) && (
                <PocketHomeScreen
                  active={active}
                  completed={!!completed}
                  starting={c.starting}
                  error={c.error}
                  recoverableJourney={c.recoverableJourney}
                  onHome={goHome}
                  onHelp={() => setScreen("settings")}
                  onStart={() => {
                    setAtHome(false);
                    if (!j) void c.start();
                  }}
                  onHistory={() => setScreen("history")}
                  onResume={() => {
                    c.resumeRecovered();
                    setAtHome(false);
                  }}
                  onRestart={() => {
                    setAtHome(false);
                    void c.restartRecovered();
                  }}
                />
              )}

              {isJourney && j && (
                <PocketJourneyScreen
                  journey={j}
                  elapsed={elapsed}
                  route={c.leg?.coordinates ?? []}
                  heading={c.heading}
                  routing={c.routing}
                  notice={c.notice}
                  error={c.error}
                  feedbackVisible={feedbackVisible}
                  onEnd={() => setEndSheet(true)}
                  onFound={() => {
                    if (c.discover()) setCamera(true);
                  }}
                  onSkip={() => {
                    c.discover(true);
                  }}
                  onExtraDiscovery={c.extraDiscovery}
                  onMap={() => setMap(true)}
                  onCamera={() => setCamera(true)}
                  onAlbum={() => setAlbum(true)}
                  onRetryRoute={() => void c.routeNext()}
                  onFinishRetry={() => void c.finish()}
                  onAdvanceDemo={c.advanceDemo}
                />
              )}

              {isCompletion && j && (
                <PocketCompletionScreen
                  journey={j}
                  onHome={goHome}
                  onHelp={() => setScreen("settings")}
                  onShare={() => {
                    setSelected(j);
                    setShareOrigin("home");
                    setLoadedPhotos({});
                    setCoverError(false);
                    setScreen("share");
                  }}
                />
              )}

              {screen === "history" && (
                <PocketHistoryScreen
                  entries={c.history}
                  onBack={() => setScreen("home")}
                  onStart={() => setScreen("home")}
                  onOpen={(entry) => {
                    setSelected(entry);
                    setScreen("detail");
                  }}
                />
              )}

              {screen === "detail" && displayed && (
                <PocketDetailScreen
                  journey={displayed}
                  favorite={displayedFavorite}
                  onBack={() => setScreen("history")}
                  onToggleFavorite={() =>
                    void c.toggleFavorite(displayed.id)
                  }
                  onDelete={() => setDeleteSheet(true)}
                  onShare={() => {
                    setShareOrigin("detail");
                    setLoadedPhotos({});
                    setCoverError(false);
                    setScreen("share");
                  }}
                />
              )}

              {screen === "share" && displayed && (
                <PocketShareScreen
                  journey={displayed}
                  cover={cover}
                  cardRef={shareRef}
                  sharing={sharing}
                  photosReady={photosReady}
                  coverError={coverError}
                  shareError={shareError}
                  onBack={back}
                  onCover={(uri) => {
                    if (cover === uri) return;
                    setLoadedPhotos({});
                    setCoverError(false);
                    setCovers((value) => ({
                      ...value,
                      [displayed.id]: uri,
                    }));
                  }}
                  onPhotoLoad={(uri) =>
                    setLoadedPhotos((value) =>
                      value[uri]
                        ? value
                        : { ...value, [uri]: true },
                    )
                  }
                  onPhotoError={() => setCoverError(true)}
                  onShare={() => void share()}
                />
              )}

              {screen === "settings" && (
                <PocketHelpScreen
                  active={active}
                  onBack={back}
                  onDemo={() => {
                    setScreen("home");
                    setAtHome(false);
                    void c.start(true);
                  }}
                />
              )}
            </View>
          </Enter>
        </ScrollView>
      </EdgeBack>

      {camera && (
        <PocketCamera onClose={() => setCamera(false)} onSave={c.addPhoto} />
      )}
      <PocketLiveAlbum
        photos={j?.photos ?? []}
        visible={album}
        onClose={() => setAlbum(false)}
      />

      <Modal
        visible={map}
        transparent
        animationType="fade"
        onRequestClose={() => setMap(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#24292166",
          }}
        >
          <View
            style={{
              height: "70%",
              backgroundColor: C.paper,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingHorizontal: 18,
              paddingTop: 10,
              paddingBottom: 24,
              shadowColor: C.ink,
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
            }}
          >
            <View
              style={{
                width: 42,
                height: 5,
                borderRadius: 3,
                alignSelf: "center",
                backgroundColor: C.line,
                marginBottom: 10,
              }}
            />
            <View style={[s.row, { marginBottom: 12 }]}>
              <View>
                <Text style={s.eyebrow}>現在的位置</Text>
                <Text style={[s.sectionTitle, { marginVertical: 2 }]}>
                  方向地圖
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉地圖"
                hitSlop={8}
                onPress={() => setMap(false)}
                style={s.round}
              >
                <Text style={{ fontSize: 24, color: C.ink }}>×</Text>
              </Pressable>
            </View>
            {j && (
              <PocketMap
                trace={j.trace}
                route={c.leg?.coordinates ?? []}
                style={{ flex: 1 }}
              />
            )}
            <Text style={[s.muted, { textAlign: "center", marginTop: 10 }]}>
              地圖只是參考；看到有意思的，繞過去也可以。
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteSheet(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#24292155",
          }}
        >
          <View
            style={{
              padding: 28,
              paddingBottom: 45,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundColor: C.paper,
              gap: 14,
            }}
          >
            <Text style={s.sectionTitle}>刪掉這張票根？</Text>
            <Text style={[s.body, { marginBottom: 8 }]}>
              這趟記錄和 Detour 裡保存的照片會一起刪除。這個動作不能復原。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="確認刪除這張票根"
              onPress={() => {
                const id = displayed?.id;
                if (!id) return;
                setDeleteSheet(false);
                setSelected(null);
                setScreen("history");
                void c.deleteHistory(id);
              }}
              style={{
                minHeight: 58,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#D9A18C",
                backgroundColor: "#F9E5D9",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 20,
              }}
            >
              <Text
                style={{
                  color: "#964B32",
                  fontSize: 17,
                  fontWeight: "800",
                }}
              >
                刪除這張票根
              </Text>
            </Pressable>
            <Button
              secondary
              label="先留著"
              onPress={() => setDeleteSheet(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={endSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setEndSheet(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#24292155",
          }}
        >
          <View
            style={{
              padding: 28,
              paddingBottom: 45,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundColor: C.paper,
              gap: 15,
            }}
          >
            <Text style={s.sectionTitle}>
              {discardOnFinish ? "先停在這裡？" : "想在這裡停下來？"}
            </Text>
            <Text style={[s.body, { marginBottom: 12 }]}>
              {discardOnFinish ? (
                <>
                  這趟還不到一分鐘，也還沒有留下照片或發現。{"\n"}
                  現在離開，不會產生票根。
                </>
              ) : (
                <>
                  找到的東西，都會留在這張票上。{"\n"}
                  先到安全、能停留的地方再收好票根。
                </>
              )}
            </Text>
            <Button
              label={discardOnFinish ? "結束這趟" : "在這裡收好票根"}
              onPress={() => {
                setEndSheet(false);
                void c.finish();
              }}
            />
            <Button
              secondary
              label="再繞一下"
              onPress={() => setEndSheet(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
