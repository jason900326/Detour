import { Text, View } from "react-native";
import type { PocketJourney } from "../../../lib/pocket-engine";
import { Button, C, Enter, s } from "../pocket-ui";
import {
  HomeDoodles,
  HomeJourneyMotion,
  HomeMoodStamp,
} from "../pocket-home-art";
import { PocketScreenHeader } from "./pocket-screen-header";

export function PocketHomeScreen({
  active,
  completed,
  starting,
  error,
  recoverableJourney,
  onHome,
  onHelp,
  onStart,
  onHistory,
  onResume,
  onRestart,
}: {
  active: boolean;
  completed: boolean;
  starting: boolean;
  error: string;
  recoverableJourney: PocketJourney | null;
  onHome: () => void;
  onHelp: () => void;
  onStart: () => void;
  onHistory: () => void;
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <>
      <PocketScreenHeader onHome={onHome} onHelp={onHelp} />
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

      {recoverableJourney && (
        <Enter>
          <View
            style={{
              marginBottom: 16,
              padding: 18,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "#E5DED0",
              backgroundColor: C.white,
              shadowColor: "#383B29",
              shadowOpacity: 0.05,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 7 },
            }}
          >
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.eyebrow, { color: C.orange }]}>
                  上次還停在路上
                </Text>
                <Text
                  style={{
                    color: C.ink,
                    fontSize: 22,
                    lineHeight: 30,
                    fontWeight: "800",
                    marginTop: 7,
                    letterSpacing: -0.5,
                  }}
                >
                  要接著走，還是重新來一趟？
                </Text>
              </View>
              <Text style={{ fontSize: 28 }}>↻</Text>
            </View>
            <Text style={[s.muted, { marginTop: 10, marginBottom: 14 }]}>
              {new Date(recoverableJourney.startedAt).toLocaleString("zh-TW", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {recoverableJourney.found.length} 個發現
              {" · "}
              {recoverableJourney.photos.length} 張照片
            </Text>
            <View style={{ gap: 9 }}>
              <Button small label="繼續這趟" onPress={onResume} />
              <Button
                small
                secondary
                label="重新開始"
                disabled={starting}
                onPress={onRestart}
              />
            </View>
          </View>
        </Enter>
      )}

      {!!error && (
        <View style={s.error}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {!recoverableJourney && (
        <Button
          label={
            starting
              ? "找位置中…"
              : active
                ? "繼續這趟 ↗"
                : completed
                  ? "看看這趟票根"
                  : "繞一下？"
          }
          onPress={onStart}
          disabled={starting}
        />
      )}
      <View style={{ marginTop: 14, marginBottom: 16 }}>
        <Button secondary label="我的票根" onPress={onHistory} />
      </View>
    </>
  );
}
