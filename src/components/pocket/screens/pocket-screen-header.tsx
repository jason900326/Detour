import { Pressable, Text, View } from "react-native";
import { DetourBrand } from "../pocket-home-art";
import { C, s } from "../pocket-ui";

export function PocketScreenHeader({
  title,
  back,
  onHome,
  onHelp,
  hideHelp = false,
  disabled = false,
}: {
  title?: string;
  back?: () => void;
  onHome?: () => void;
  onHelp?: () => void;
  hideHelp?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={s.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={back}
          disabled={disabled}
          style={s.round}
        >
          <Text style={{ fontSize: 23, color: C.ink }}>←</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回首頁"
          onPress={onHome}
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
      {!back && !hideHelp && onHelp && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="玩法說明"
          style={s.round}
          onPress={onHelp}
        >
          <Text style={{ color: C.ink, fontSize: 20 }}>?</Text>
        </Pressable>
      )}
    </View>
  );
}
