import { Text, View } from "react-native";
import { Button, s } from "../pocket-ui";
import { PocketScreenHeader } from "./pocket-screen-header";

export function PocketHelpScreen({
  active,
  onBack,
  onDemo,
  onNightExperience,
}: {
  active: boolean;
  onBack: () => void;
  onDemo: () => void;
  onNightExperience: () => void;
}) {
  return (
    <>
      <PocketScreenHeader title="怎麼繞？" back={onBack} />
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
        <Button label="懂了，去繞一下" onPress={onBack} />
      </View>
      {__DEV__ && (
        <View style={{ marginTop: 40, gap: 12 }}>
          <Text style={s.eyebrow}>開發測試</Text>
          <Button
            secondary
            label="室內試玩（不使用定位）"
            disabled={active}
            onPress={onDemo}
          />
          <Button
            secondary
            label="Night Detour 內容測試"
            disabled={active}
            onPress={onNightExperience}
          />
          <Text style={s.muted}>
            Night Detour 只在開發版出現；正式首頁仍然直接「繞一下？」。
          </Text>
        </View>
      )}
    </>
  );
}
