import { Pressable, Text, View } from "react-native";
import type { PocketJourney } from "../../../lib/pocket-engine";
import { Button, C, s, Ticket, Trail } from "../pocket-ui";
import { PhotoDeck } from "../pocket-photo-deck";
import { PocketScreenHeader } from "./pocket-screen-header";

export function PocketDetailScreen({
  journey,
  favorite,
  onBack,
  onToggleFavorite,
  onDelete,
  onShare,
}: {
  journey: PocketJourney;
  favorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  return (
    <>
      <PocketScreenHeader title="一張舊票根" back={onBack} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "從最愛移除" : "加入最愛"}
          accessibilityState={{ selected: favorite }}
          onPress={onToggleFavorite}
          style={{
            minHeight: 40,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: favorite ? C.orange : C.line,
            backgroundColor: favorite ? "#FBE8DF" : C.white,
            paddingHorizontal: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text
            style={{
              color: favorite ? C.orange : C.muted,
              fontSize: 15,
            }}
          >
            {favorite ? "♥" : "♡"}
          </Text>
          <Text
            style={{
              color: favorite ? C.orange : C.ink,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {favorite ? "已收藏" : "加到最愛"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="更多票根操作"
          onPress={onDelete}
          style={[
            s.round,
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: C.white,
            },
          ]}
        >
          <Text
            style={{
              color: C.ink,
              fontSize: 18,
              lineHeight: 20,
              marginTop: -6,
              letterSpacing: 1,
            }}
          >
            •••
          </Text>
        </Pressable>
      </View>

      <Ticket journey={journey} />
      <Text style={s.sectionTitle}>
        {journey.endpoint?.name ?? "城市的一角"}
      </Text>
      <Text style={s.body}>
        {new Date(journey.startedAt).toLocaleString("zh-TW")}
      </Text>
      <PhotoDeck key={journey.id} photos={journey.photos} />
      <Text style={s.sectionTitle}>走過的路</Text>
      <Trail points={journey.trace} />
      {journey.found.map((found, index) => (
        <View
          key={`${found.id}-${index}`}
          style={[
            s.row,
            {
              paddingVertical: 13,
              borderBottomWidth: 1,
              borderColor: C.line,
            },
          ]}
        >
          <Text style={{ fontSize: 26 }}>{found.emoji}</Text>
          <Text style={[s.body, { flex: 1, color: C.ink }]}>
            {found.title}
          </Text>
        </View>
      ))}
      <View style={{ height: 25 }} />
      <Button label="分享這一趟" onPress={onShare} />
    </>
  );
}
