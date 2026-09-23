import { Text, View } from "react-native";
import type { PocketJourney } from "../../../lib/pocket-engine";
import { Button, C, mono, s } from "../pocket-ui";
import { PocketHistoryGallery } from "../pocket-history-gallery";
import { PocketScreenHeader } from "./pocket-screen-header";

export function PocketHistoryScreen({
  entries,
  onBack,
  onStart,
  onOpen,
}: {
  entries: PocketJourney[];
  onBack: () => void;
  onStart: () => void;
  onOpen: (entry: PocketJourney) => void;
}) {
  return (
    <>
      <PocketScreenHeader title="我的票根" back={onBack} />
      <View style={{ marginTop: 10 }}>
        <Text
          style={[
            s.title,
            {
              fontSize: 34,
              lineHeight: 42,
              letterSpacing: -1.1,
            },
          ]}
        >
          繞過的，都留著
          <Text style={{ color: C.orange }}>。</Text>
        </Text>
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 11,
            borderRadius: 999,
            backgroundColor: C.green,
            paddingHorizontal: 11,
            paddingVertical: 7,
          }}
        >
          <Text
            style={{
              fontFamily: mono,
              fontSize: 11,
              color: "#59674A",
              fontWeight: "700",
              letterSpacing: 0.7,
            }}
          >
            {String(entries.length).padStart(2, "0")} 張票根
          </Text>
        </View>
      </View>
      {!entries.length ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 55 }}>🎟️</Text>
          <Text style={s.body}>還沒有票根，也還有好多意外。</Text>
          <Button label="去繞一下" onPress={onStart} />
        </View>
      ) : (
        <PocketHistoryGallery entries={entries} onOpen={onOpen} />
      )}
    </>
  );
}
