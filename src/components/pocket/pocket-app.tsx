import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
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
import { usePocketJourney, tapHaptic } from "../../hooks/use-pocket-journey";
import {
  angle,
  bearing,
  distance,
  type PocketJourney,
} from "../../lib/pocket-engine";
import {
  guidanceBearingOnPolyline,
  distanceToPolyline,
} from "../../lib/navigation-engine";
import { Button, C, Enter, s, Ticket, Trail } from "./pocket-ui";
import { WanderMotion } from "./pocket-motion";
import { DirectionBeacon } from "./pocket-direction-beacon";
import {
  DetourBrand,
  HomeDoodles,
  HomeJourneyMotion,
  HomeMoodStamp,
} from "./pocket-home-art";
import { EdgeBack } from "./pocket-edge-back";
import { PhotoDeck } from "./pocket-photo-deck";
import {
  previousPocketScreen,
  type PocketScreen,
} from "../../lib/pocket-navigation";
import PocketMap from "./pocket-map";
import PocketCamera from "./pocket-camera";

type Screen = PocketScreen;
export default function PocketApp() {
  const c = usePocketJourney();
  const [screen, setScreen] = useState<Screen>("home");
  const [atHome, setAtHome] = useState(false);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [loadedCover, setLoadedCover] = useState("");
  const [coverError, setCoverError] = useState(false);
  const [shareOrigin, setShareOrigin] = useState<"home" | "detail">("home");
  const [selected, setSelected] = useState<PocketJourney | null>(null);
  const [camera, setCamera] = useState(false);
  const [map, setMap] = useState(false);
  const [endSheet, setEndSheet] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const shareRef = useRef<View>(null);
  const j = c.journey;
  const active = j && j.phase !== "finished";
  const completed = j?.phase === "finished";
  const displayed = selected ?? j;
  const cover = displayed
    ? (covers[displayed.id] ?? displayed.photos[0])
    : undefined;
  const currentCover = useRef(cover);
  currentCover.current = cover;
  const shareThumbs =
    displayed && cover
      ? displayed.photos.filter((uri) => uri !== cover).slice(0, 4)
      : [];
  const elapsed = j ? Math.max(0, Math.floor((c.now - j.startedAt) / 1000)) : 0;
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
  }
  const isJourney = screen === "home" && active && !atHome;
  const isCompletion = screen === "home" && completed && !atHome;
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
    if (sharing || (cover && (loadedCover !== cover || coverError))) return;
    setSharing(true);
    setShareError("");
    try {
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(shareRef, { format: "png", quality: 1 });
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "分享這一趟 Detour",
        });
      } else {
        await Share.share({
          message: `今天，去繞了一下。\n${displayed?.found.map((f) => f.emoji).join(" ")}\nDetour · 一點時間，一點意外。`,
        });
      }
    } catch {
      setShareError("分享沒有完成，可以再試一次。");
    } finally {
      setSharing(false);
    }
  }
  const Header = ({ title, back }: { title?: string; back?: () => void }) => (
    <View style={s.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={back}
          disabled={sharing}
          style={s.round}
        >
          <Text style={{ fontSize: 23, color: C.ink }}>←</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回首頁"
          onPress={goHome}
        >
          <DetourBrand large />
        </Pressable>
      )}
      {title && (
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink }}>
          {title}
        </Text>
      )}
      {back && <View style={{ width: 44 }} />}
      {!back && !isCompletion && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="玩法說明"
          style={s.round}
          onPress={() => setScreen("settings")}
        >
          <Text style={{ color: C.ink, fontSize: 20 }}>?</Text>
        </Pressable>
      )}
    </View>
  );
  if (!c.ready || c.finishing)
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
  const pageKey = isJourney ? "journey" : isCompletion ? "completion" : screen;
  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <EdgeBack onBack={screen !== "home" && !sharing ? back : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 0,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Enter key={pageKey} style={{ flex: 1 }}>
            <View style={[s.page, { flex: 1 }]}>
              {screen === "home" && (!j || atHome) && (
                <>
                  <Header />
                  <View
                    style={{
                      flex: 1,
                      minHeight: 405,
                      justifyContent: "center",
                      paddingTop: 8,
                      paddingBottom: 4,
                      position: "relative",
                    }}
                  >
                    <HomeDoodles />
                    <View style={{ zIndex: 1 }}>
                      <HomeMoodStamp />
                      <Text
                        style={[
                          s.title,
                          {
                            fontSize: 43,
                            lineHeight: 53,
                            marginTop: 18,
                            maxWidth: 280,
                          },
                        ]}
                      >
                        不知道{"\n"}要幹嘛
                        <Text style={{ color: C.orange }}>？</Text>
                      </Text>
                      <HomeJourneyMotion />
                    </View>
                  </View>
                  {!!c.error && (
                    <View style={s.error}>
                      <Text style={s.errorText}>{c.error}</Text>
                    </View>
                  )}
                  <Button
                    label={
                      c.starting
                        ? "找位置中…"
                        : active
                          ? "繼續這趟 ↗"
                          : completed
                            ? "看看這趟票根"
                            : "繞一下？"
                    }
                    onPress={() => {
                      setAtHome(false);
                      if (!j) void c.start();
                    }}
                    disabled={c.starting}
                  />
                  <View style={{ marginTop: 14, marginBottom: 16 }}>
                    <Button
                      secondary
                      label="我的票根"
                      onPress={() => setScreen("history")}
                    />
                  </View>
                </>
              )}
              {isJourney && j && (
                <>
                  <View style={s.header}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="結束這趟旅程"
                      onPress={() => setEndSheet(true)}
                      style={s.round}
                    >
                      <Text style={{ fontSize: 24, color: C.ink }}>×</Text>
                    </Pressable>
                    <View style={s.pill}>
                      <Text style={s.pillText}>
                        {j.demo
                          ? "室內試玩"
                          : j.phase === "closing"
                            ? "慢慢收尾"
                            : "小探險進行中"}
                      </Text>
                    </View>
                    <Text style={s.serial}>
                      {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                      {String(elapsed % 60).padStart(2, "0")}
                    </Text>
                  </View>
                  {j.target ? (
                    <Enter key={`${j.target.id}-${j.targetSince}`}>
                      <View
                        style={[
                          s.paper,
                          {
                            alignItems: "stretch",
                            padding: 18,
                            borderRadius: 24,
                            minHeight: 0,
                            marginTop: 8,
                            marginBottom: 12,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.tape,
                            {
                              alignSelf: "center",
                              width: 62,
                              height: 18,
                              top: -8,
                            },
                          ]}
                        />
                        <View style={s.row}>
                          <Text style={[s.eyebrow, { color: "#756483" }]}>
                            這一眼的任務
                          </Text>
                          <Text style={s.serial}>
                            NO. {String(j.found.length + 1).padStart(2, "0")}
                          </Text>
                        </View>
                        <View
                          style={[
                            s.row,
                            { alignItems: "center", marginTop: 14, gap: 14 },
                          ]}
                        >
                          <View
                            style={{
                              width: 76,
                              height: 76,
                              borderRadius: 22,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#F7F4EC99",
                              borderWidth: 1,
                              borderColor: "#D8CEE7",
                              transform: [{ rotate: "-4deg" }],
                            }}
                          >
                            <Text style={{ fontSize: 46 }}>{j.target.emoji}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                s.paperTitle,
                                {
                                  fontSize: 26,
                                  lineHeight: 34,
                                  textAlign: "left",
                                  marginTop: 0,
                                },
                              ]}
                            >
                              {j.target.title}
                            </Text>
                            <Text
                              style={[
                                s.paperHint,
                                {
                                  textAlign: "left",
                                  marginTop: 5,
                                  maxWidth: "100%",
                                  fontSize: 13,
                                  lineHeight: 20,
                                },
                              ]}
                            >
                              {j.target.hint}
                            </Text>
                          </View>
                        </View>
                        <View style={{ marginTop: 16 }}>
                          <Button
                            label="找到了"
                            centered
                            hideArrow
                            accessibilityLabel="找到了，開啟相機記錄"
                            onPress={() => {
                              c.discover();
                              setCamera(true);
                            }}
                          />
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => c.discover(true)}
                          style={[s.link, { minHeight: 38, marginTop: 2 }]}
                        >
                          <Text style={[s.linkText, { color: "#65546F" }]}>
                            ↻　換個目標
                          </Text>
                        </Pressable>
                      </View>
                    </Enter>
                  ) : (
                    <Enter>
                      <View
                        style={[
                          s.paper,
                          { backgroundColor: C.green, minHeight: 200 },
                        ]}
                      >
                        <View style={s.tape} />
                        <Text style={{ fontSize: 64 }}>🌿</Text>
                        <Text style={s.paperTitle}>
                          差不多了，{"\n"}再走一小段。
                        </Text>
                        <Text style={s.paperHint}>
                          沿途還有什麼，剛剛沒注意到？
                        </Text>
                      </View>
                      {!j.closingTargetUsed && (
                        <Button
                          secondary
                          label="再找一個小東西"
                          onPress={c.extraDiscovery}
                        />
                      )}
                    </Enter>
                  )}
                  <Direction
                    route={c.leg?.coordinates ?? []}
                    trace={j.trace}
                    heading={c.heading}
                    closing={j.phase === "closing"}
                    routing={c.routing}
                    notice={c.notice}
                    onMap={() => setMap(true)}
                  />
                  {!!c.notice && !c.routing && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void c.routeNext()}
                      style={s.link}
                    >
                      <Text style={s.linkText}>重新取得方向 ↻</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="沿途留一張，開啟相機"
                    onPress={() => setCamera(true)}
                    style={[
                      s.row,
                      {
                        backgroundColor: C.ink,
                        padding: 18,
                        borderRadius: 22,
                        marginTop: 8,
                      },
                    ]}
                  >
                    <CameraGlyph />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: C.white,
                          fontSize: 18,
                          fontWeight: "700",
                        }}
                      >
                        沿途留一張
                      </Text>
                      <Text
                        style={{ color: "#CACDBF", fontSize: 12, marginTop: 4 }}
                      >
                        {j.photos.length
                          ? `${j.photos.length} 張，留在這趟裡`
                          : "把偶然，收進今天。"}
                      </Text>
                    </View>
                    {j.photos.at(-1) ? (
                      <Image
                        source={{ uri: j.photos.at(-1) }}
                        style={{
                          width: 44,
                          height: 48,
                          borderRadius: 6,
                          transform: [{ rotate: "6deg" }],
                        }}
                      />
                    ) : (
                      <Text style={{ color: C.white, fontSize: 26 }}>＋</Text>
                    )}
                  </Pressable>
                  {!!c.error && (
                    <View style={s.error}>
                      <Text style={s.errorText}>{c.error}</Text>
                      <Button
                        secondary
                        small
                        label="再試著收好票根"
                        onPress={() => void c.finish()}
                      />
                    </View>
                  )}
                  {j.demo && (
                    <Button
                      small
                      secondary
                      label="試玩：時間前進 2 分鐘"
                      onPress={c.advanceDemo}
                    />
                  )}
                </>
              )}
              {isCompletion && j && (
                <>
                  <Header />
                  <View style={{ marginTop: 2, marginBottom: 16 }}>
                    <Text
                      style={[
                        s.title,
                        { fontSize: 40, lineHeight: 49, marginTop: 0 },
                      ]}
                    >
                      繞了一下，{"\n"}帶回這些
                      <Text style={{ color: C.orange }}>。</Text>
                    </Text>
                  </View>
                  <Enter delay={80}>
                    <Ticket journey={j} receipt />
                  </Enter>
                  <PhotoDeck key={j.id} photos={j.photos} compact />
                  <View style={{ marginTop: j.photos.length ? 10 : 20 }}>
                    <Button
                      label="分享這一趟"
                      onPress={() => {
                        setSelected(j);
                        setShareOrigin("home");
                        setLoadedCover("");
                        setCoverError(false);
                        setScreen("share");
                      }}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={goHome}
                    style={[s.link, { marginTop: 6 }]}
                  >
                    <Text style={s.linkText}>收好票根，回首頁</Text>
                  </Pressable>
                </>
              )}
              {screen === "history" && (
                <>
                  <Header title="我的票根" back={() => setScreen("home")} />
                  <Text style={[s.title, { marginTop: 17 }]}>
                    繞過的，{"\n"}都留著。
                  </Text>
                  <Text style={[s.body, { marginTop: 12, marginBottom: 25 }]}>
                    {c.history.length
                      ? `${c.history.length} 段原本不會發生的時間。`
                      : "第一張票，就從今天開始。"}
                  </Text>
                  {!c.history.length ? (
                    <View style={s.empty}>
                      <Text style={{ fontSize: 55 }}>🎟️</Text>
                      <Text style={s.body}>還沒有票根，也還有好多意外。</Text>
                      <Button
                        label="去繞一下"
                        onPress={() => setScreen("home")}
                      />
                    </View>
                  ) : (
                    c.history.map((entry) => (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityLabel={`查看 ${new Date(entry.startedAt).toLocaleDateString("zh-TW")} 的票根`}
                        onPress={() => {
                          setSelected(entry);
                          setScreen("detail");
                        }}
                        style={s.historyCard}
                      >
                        <View style={s.row}>
                          <View style={{ flex: 1, gap: 11 }}>
                            <Text style={{ fontSize: 29 }}>
                              {entry.found.length
                                ? entry.found.map((f) => f.emoji).join(" ")
                                : "一段留在路上的時間"}
                            </Text>
                            <Text style={s.muted}>
                              {new Date(entry.startedAt).toLocaleDateString(
                                "zh-TW",
                              )}{" "}
                              ·{" "}
                              {entry.demo
                                ? "室內試玩"
                                : entry.area ||
                                  entry.endpoint?.name ||
                                  "城市的一角"}
                            </Text>
                          </View>
                          {entry.photos[0] ? (
                            <Image
                              source={{ uri: entry.photos[0] }}
                              style={{ width: 75, height: 86, borderRadius: 8 }}
                            />
                          ) : (
                            <Text style={{ fontSize: 23, color: C.orange }}>
                              ↗
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    ))
                  )}
                </>
              )}
              {screen === "detail" && displayed && (
                <>
                  <Header
                    title="一張舊票根"
                    back={() => setScreen("history")}
                  />
                  <Ticket journey={displayed} />
                  <Text style={s.sectionTitle}>
                    {displayed.endpoint?.name ?? "城市的一角"}
                  </Text>
                  <Text style={s.body}>
                    {new Date(displayed.startedAt).toLocaleString("zh-TW")}
                  </Text>
                  <PhotoDeck key={displayed.id} photos={displayed.photos} />
                  <Text style={s.sectionTitle}>走過的路</Text>
                  <Trail points={displayed.trace} />
                  {displayed.found.map((f, i) => (
                    <View
                      key={`${f.id}-${i}`}
                      style={[
                        s.row,
                        {
                          paddingVertical: 13,
                          borderBottomWidth: 1,
                          borderColor: C.line,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 26 }}>{f.emoji}</Text>
                      <Text style={[s.body, { flex: 1, color: C.ink }]}>
                        {f.title}
                      </Text>
                    </View>
                  ))}
                  <View style={{ height: 25 }} />
                  <Button
                    label="分享這一趟"
                    onPress={() => {
                      setShareOrigin("detail");
                      setLoadedCover("");
                      setCoverError(false);
                      setScreen("share");
                    }}
                  />
                </>
              )}
              {screen === "share" && displayed && (
                <>
                  <Header title="把這一點意外分享出去" back={back} />
                  {displayed.photos.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={[s.eyebrow, { marginBottom: 12 }]}>
                        哪一眼，放在最前面？
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 10 }}
                      >
                        {displayed.photos.map((uri, index) => (
                          <Pressable
                            key={uri}
                            accessibilityRole="button"
                            accessibilityLabel={`選照片 ${index + 1} 作為分享封面`}
                            accessibilityState={{
                              selected: cover === uri,
                              disabled: sharing,
                            }}
                            disabled={sharing}
                            onPress={() => {
                              if (cover !== uri) {
                                setLoadedCover("");
                                setCoverError(false);
                                setCovers((v) => ({
                                  ...v,
                                  [displayed.id]: uri,
                                }));
                              }
                            }}
                            style={{
                              borderWidth: 3,
                              borderColor:
                                cover === uri ? C.orange : "transparent",
                              padding: 3,
                              borderRadius: 14,
                            }}
                          >
                            <Image
                              source={{ uri }}
                              style={{ width: 62, height: 76, borderRadius: 8 }}
                            />
                            {cover === uri && (
                              <Text
                                style={{
                                  position: "absolute",
                                  bottom: 5,
                                  right: 5,
                                  color: C.white,
                                  backgroundColor: C.orange,
                                  borderRadius: 8,
                                  paddingHorizontal: 5,
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  <View
                    ref={shareRef}
                    collapsable={false}
                    style={{
                      backgroundColor: C.paper,
                      padding: 18,
                      borderRadius: 18,
                    }}
                  >
                    {cover ? (
                      <>
                        <Image
                          key={cover}
                          source={{ uri: cover }}
                          resizeMode="cover"
                          onLoad={() => {
                            if (currentCover.current !== cover) return;
                            setLoadedCover(cover);
                            setCoverError(false);
                          }}
                          onError={() => {
                            if (currentCover.current === cover)
                              setCoverError(true);
                          }}
                          style={{
                            width: "100%",
                            aspectRatio: 4 / 5,
                            borderRadius: 14,
                            backgroundColor: C.line,
                          }}
                        />
                        <View style={{ marginTop: 16, marginBottom: 6 }}>
                          <DetourBrand />
                        </View>
                        <Text
                          style={{
                            fontSize: 27,
                            marginTop: 8,
                            marginBottom: 7,
                          }}
                        >
                          {displayed.found.map((f) => f.emoji).join(" ")}
                        </Text>
                        <Text
                          style={{
                            fontSize: 24,
                            lineHeight: 32,
                            fontWeight: "800",
                            color: C.ink,
                          }}
                        >
                          沒有目的地。卻遇見了這個。
                        </Text>
                        {!!shareThumbs.length && (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginTop: 15,
                            }}
                          >
                            {shareThumbs.map((uri) => (
                              <Image
                                key={uri}
                                source={{ uri }}
                                resizeMode="cover"
                                style={{
                                  flex: 1,
                                  aspectRatio: 1,
                                  borderRadius: 10,
                                  backgroundColor: C.line,
                                }}
                              />
                            ))}
                            {Array.from(
                              { length: Math.max(0, 4 - shareThumbs.length) },
                              (_, index) => (
                                <View
                                  key={`share-spacer-${index}`}
                                  style={{ flex: 1, aspectRatio: 1 }}
                                />
                              ),
                            )}
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <DetourBrand />
                        <Text
                          style={[
                            s.title,
                            {
                              fontSize: 30,
                              lineHeight: 39,
                              marginTop: 18,
                              marginBottom: 18,
                            },
                          ]}
                        >
                          沒有特別去哪，{"\n"}卻帶回了一點什麼。
                        </Text>
                        <Ticket journey={displayed} compact />
                      </>
                    )}
                    <View style={{ marginTop: 12 }}>
                      <Trail points={displayed.trace} height={62} framed />
                    </View>
                    <View style={[s.row, { marginTop: 12 }]}>
                      <Text style={s.muted}>
                        {new Date(displayed.startedAt).toLocaleDateString(
                          "zh-TW",
                        )}
                      </Text>
                      <Text style={s.muted}>一點時間，一點意外。</Text>
                    </View>
                  </View>
                  <View style={{ height: 24 }} />
                  <Button
                    label="分享這一趟"
                    onPress={() => void share()}
                    disabled={
                      sharing ||
                      (!!cover && (loadedCover !== cover || coverError))
                    }
                  />
                  {coverError && (
                    <Text style={s.errorText}>
                      這張照片無法讀取，請選另一張。
                    </Text>
                  )}
                  {!!shareError && (
                    <Text style={s.errorText}>{shareError}</Text>
                  )}
                  <Text
                    style={[s.muted, { textAlign: "center", marginTop: 12 }]}
                  >
                    照片、發現，還有你繞過的那段路。
                  </Text>
                </>
              )}
              {screen === "settings" && (
                <>
                  <Header title="怎麼繞？" back={() => setScreen("home")} />
                  <Text style={[s.title, { marginVertical: 20 }]}>
                    出門，{"\n"}剩下的交給好奇。
                  </Text>
                  <Text style={s.sectionTitle}>👀　帶著一個目標走</Text>
                  <Text style={s.body}>跟著方向，看看平常沒注意的地方。</Text>
                  <Text style={s.sectionTitle}>📷　找到，就留一眼</Text>
                  <Text style={s.body}>
                    按「找到了」開相機；也可以先不拍。找不到就換一個。
                  </Text>
                  <Text style={s.sectionTitle}>🎟️　收好今天的意外</Text>
                  <Text style={s.body}>約 10 分鐘後，帶回照片和專屬票根。</Text>
                  <Text style={[s.muted, { marginTop: 24 }]}>
                    走安全、能通行的路。照片與票根留在這台裝置。
                  </Text>
                  <View style={{ marginTop: 24 }}>
                    <Button label="懂了，去繞一下" onPress={back} />
                  </View>
                  {__DEV__ && (
                    <View style={{ marginTop: 40, gap: 12 }}>
                      <Text style={s.eyebrow}>開發測試</Text>
                      <Button
                        secondary
                        label="室內試玩（不使用定位）"
                        disabled={!!active}
                        onPress={() => {
                          setScreen("home");
                          setAtHome(false);
                          void c.start(true);
                        }}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          </Enter>
        </ScrollView>
      </EdgeBack>
      {camera && (
        <PocketCamera onClose={() => setCamera(false)} onSave={c.addPhoto} />
      )}
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
            <Text style={s.sectionTitle}>想在這裡停下來？</Text>
            <Text style={[s.body, { marginBottom: 12 }]}>
              找到的東西，都會留在這張票上。{"\n"}
              先到安全、能停留的地方再收好票根。
            </Text>
            <Button
              label="在這裡收好票根"
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

function CameraGlyph() {
  return (
    <View
      style={{
        width: 25,
        height: 19,
        borderColor: C.white,
        borderWidth: 1.8,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -5,
          left: 5,
          width: 10,
          height: 4,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          backgroundColor: C.white,
        }}
      />
      <View
        style={{
          width: 9,
          height: 9,
          borderColor: C.white,
          borderWidth: 1.5,
          borderRadius: 5,
        }}
      />
    </View>
  );
}
function Direction({
  route,
  trace,
  heading,
  closing,
  routing,
  notice,
  onMap,
}: {
  route: { latitude: number; longitude: number }[];
  trace: { latitude: number; longitude: number }[];
  heading: number | null;
  closing: boolean;
  routing: boolean;
  notice: string;
  onMap: () => void;
}) {
  const point = trace.at(-1);
  const degrees =
    point && route.length > 1 ? guidanceBearingOnPolyline(point, route) : null;
  const relative =
    degrees !== null && heading !== null ? angle(degrees, heading) : null;
  let corner: { key: string; right: boolean } | null = null;
  if (point && route.length > 2) {
    let nearest = 0,
      best = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const d = distanceToPolyline(point, [route[i], route[i + 1]]);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    let meters = distance(point, route[nearest + 1]);
    for (let i = nearest + 1; i < route.length - 1 && meters < 45; i++) {
      if (
        distance(route[i - 1], route[i]) > 5 &&
        distance(route[i], route[i + 1]) > 5
      ) {
        const turn = angle(
          bearing(route[i], route[i + 1]),
          bearing(route[i - 1], route[i]),
        );
        if (Math.abs(turn) > 40 && Math.abs(turn) < 130) {
          corner = {
            key:
              route[i].latitude.toFixed(5) +
              "," +
              route[i].longitude.toFixed(5),
            right: turn > 0,
          };
          break;
        }
      }
      meters += distance(route[i], route[i + 1]);
    }
  }
  const seenTurns = useRef(new Set<string>());
  const cornerKey = corner?.key;
  useEffect(() => {
    if (cornerKey && !seenTurns.current.has(cornerKey)) {
      seenTurns.current.add(cornerKey);
      tapHaptic();
    }
  }, [cornerKey]);
  const title = notice
    ? "先看看這條街"
    : routing
      ? "正在找一條舒服的方向"
      : corner
        ? corner.right
          ? "前面路口，往右看看"
          : "前面路口，往左看看"
        : degrees === null
          ? "先看看身邊的街景"
          : relative !== null
            ? "跟著大箭頭，走一小段"
            : `往${["北", "東北", "東", "東南", "南", "西南", "西", "西北"][Math.round(degrees / 45) % 8]}，走一小段`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="查看方向地圖"
      onPress={() => {
        tapHaptic();
        onMap();
      }}
      style={[
        s.direction,
        {
          minHeight: 168,
          backgroundColor: C.white,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: "#E4E0D5",
          paddingVertical: 16,
          paddingHorizontal: 15,
          marginTop: 4,
          marginBottom: 12,
          gap: 12,
          shadowColor: "#383B29",
          shadowOpacity: 0.05,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
        },
      ]}
    >
      <DirectionBeacon relative={relative} routing={routing} />
      <View style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}>
        <Text style={[s.eyebrow, { marginBottom: 7 }]}>接下來，往這邊</Text>
        <Text
          style={[
            s.directionTitle,
            { fontSize: 21, lineHeight: 29, paddingRight: 2 },
          ]}
        >
          {title}
        </Text>
        <Text style={[s.directionSub, { fontSize: 12.5, lineHeight: 19 }]}>
          {notice ||
            (closing
              ? "慢慢靠近一個可以停下的地方。"
              : "不用走得很準；大方向對了，就繼續找。")}
        </Text>
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: C.line,
            paddingHorizontal: 11,
            paddingVertical: 6,
          }}
        >
          <Text style={[s.serial, { color: C.ink }]}>打開地圖 ↗</Text>
        </View>
      </View>
    </Pressable>
  );
}
