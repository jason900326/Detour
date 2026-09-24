import { useEffect, useRef } from "react";
import { Image, Pressable, Text, View } from "react-native";
import {
  angle,
  bearing,
  distance,
  type PocketJourney,
  type Point,
} from "../../../lib/pocket-engine";
import {
  distanceToPolyline,
  guidanceBearingOnPolyline,
} from "../../../lib/navigation-engine";
import { playPocketFeedback } from "../../../lib/pocket-feedback";
import type { MissionActionType } from "../../../lib/pocket-mission-grammar";
import { Button, C, Enter, PHOTO_ASPECT, s } from "../pocket-ui";
import { DirectionBeacon } from "../pocket-direction-beacon";

export function PocketJourneyScreen({
  journey,
  elapsed,
  route,
  heading,
  routing,
  notice,
  error,
  feedbackVisible,
  onEnd,
  onFound,
  onSkip,
  onExtraDiscovery,
  onMap,
  onCamera,
  onAlbum,
  onRetryRoute,
  onFinishRetry,
  onAdvanceDemo,
}: {
  journey: PocketJourney;
  elapsed: number;
  route: Point[];
  heading: number | null;
  routing: boolean;
  notice: string;
  error: string;
  feedbackVisible: boolean;
  onEnd: () => void;
  onFound: () => void;
  onSkip: () => void;
  onExtraDiscovery: () => void;
  onMap: () => void;
  onCamera: () => void;
  onAlbum: () => void;
  onRetryRoute: () => void;
  onFinishRetry: () => void;
  onAdvanceDemo: () => void;
}) {
  return (
    <>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="結束這趟旅程"
          onPress={onEnd}
          style={s.round}
        >
          <Text style={{ fontSize: 24, color: C.ink }}>×</Text>
        </Pressable>
        <View style={s.pill}>
          <Text style={s.pillText}>
            {journey.demo
              ? "室內試玩"
              : journey.phase === "closing"
                ? "慢慢收尾"
                : "小探險進行中"}
          </Text>
        </View>
        <Text style={s.serial}>
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </Text>
      </View>

      {journey.target ? (
        <Enter key={`${journey.target.id}-${journey.targetSince}`}>
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
                {missionEyebrow(journey.target.actionType)}
              </Text>
              <Text style={s.serial}>
                NO. {String(journey.found.length + 1).padStart(2, "0")}
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
                <Text style={{ fontSize: 46 }}>{journey.target.emoji}</Text>
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
                  {journey.target.title}
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
                  {journey.target.hint}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 16 }}>
              <Button
                label="找到了"
                centered
                hideArrow
                accessibilityLabel="找到了，開啟相機記錄"
                onPress={onFound}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              style={[s.link, { minHeight: 38, marginTop: 2 }]}
            >
              <Text style={[s.linkText, { color: "#65546F" }]}>
                ↻　換個目標
              </Text>
            </Pressable>
          </View>
        </Enter>
      ) : journey.phase === "closing" ? (
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
          {!journey.closingTargetUsed && (
            <Button
              secondary
              label="再找一個小東西"
              onPress={onExtraDiscovery}
            />
          )}
        </Enter>
      ) : (
        <View
          accessibilityLabel="這一段先走走看，下一張紙條會自己出現"
          style={{
            minHeight: 58,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          <Text style={[s.eyebrow, { color: C.muted }]}>先走走看</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>
            下一張紙條會自己來。
          </Text>
        </View>
      )}

      <Direction
        feedbackVisible={feedbackVisible}
        journeyId={journey.id}
        route={route}
        trace={journey.trace}
        heading={heading}
        closing={journey.phase === "closing"}
        routing={routing}
        notice={notice}
        onMap={onMap}
      />

      {!!notice && !routing && (
        <Pressable
          accessibilityRole="button"
          onPress={onRetryRoute}
          style={s.link}
        >
          <Text style={s.linkText}>重新取得方向 ↻</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="沿途留一張，開啟相機"
        onPress={onCamera}
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
          <Text style={{ color: "#CACDBF", fontSize: 12, marginTop: 4 }}>
            {journey.photos.length
              ? `${journey.photos.length} 張，留在這趟裡`
              : "把偶然，收進今天。"}
          </Text>
        </View>
        {journey.photos.at(-1) ? (
          <Image
            source={{ uri: journey.photos.at(-1) }}
            resizeMode="contain"
            style={{
              width: 40,
              aspectRatio: PHOTO_ASPECT,
              borderRadius: 6,
              transform: [{ rotate: "5deg" }],
              backgroundColor: "#343A31",
            }}
          />
        ) : (
          <Text style={{ color: C.white, fontSize: 26 }}>＋</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`即時相簿，目前有 ${journey.photos.length} 張照片`}
        onPress={onAlbum}
        style={[
          s.row,
          {
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderRadius: 20,
            marginTop: 10,
          },
        ]}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: C.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: C.ink, fontSize: 17 }}>▦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: C.ink,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            即時相簿
          </Text>
          <Text style={[s.muted, { marginTop: 2 }]}>
            {journey.photos.length
              ? `${journey.photos.length} 張 · 點開回看`
              : "拍過的照片會留在這裡"}
          </Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 20 }}>↗</Text>
      </Pressable>

      {!!error && (
        <View style={s.error}>
          <Text style={s.errorText}>{error}</Text>
          <Button
            secondary
            small
            label="再試著收好票根"
            onPress={onFinishRetry}
          />
        </View>
      )}

      {journey.demo && (
        <Button
          small
          secondary
          label="試玩：時間前進 2 分鐘"
          onPress={onAdvanceDemo}
        />
      )}
    </>
  );
}

function missionEyebrow(actionType: MissionActionType | undefined) {
  switch (actionType) {
    case "compare":
      return "比一比";
    case "find_pattern":
      return "找規律";
    case "count":
      return "數一數";
    case "choose_viewpoint":
      return "換個角度";
    case "stop_and_observe":
      return "停一下";
    case "rest":
      return "喘口氣";
    default:
      return "找找看";
  }
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
  feedbackVisible,
  journeyId,
  route,
  trace,
  heading,
  closing,
  routing,
  notice,
  onMap,
}: {
  feedbackVisible: boolean;
  journeyId: string;
  route: Point[];
  trace: Point[];
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
    let nearest = 0;
    let best = Infinity;
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
  const end = route.at(-1);
  const directionKey =
    corner?.key ??
    (degrees !== null && end
      ? `leg:${end.latitude.toFixed(5)},${end.longitude.toFixed(5)}`
      : null);
  const cornerKey = directionKey ? `${journeyId}:${directionKey}` : null;

  useEffect(() => {
    if (
      feedbackVisible &&
      !routing &&
      !notice &&
      cornerKey &&
      !seenTurns.current.has(cornerKey)
    ) {
      const timer = setTimeout(() => {
        seenTurns.current.add(cornerKey);
        playPocketFeedback("direction");
      }, 360);
      return () => clearTimeout(timer);
    }
  }, [cornerKey, feedbackVisible, routing, notice]);

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
      onPress={onMap}
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
