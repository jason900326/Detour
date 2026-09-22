import { Text, View } from "react-native";
import type { Point } from "../../lib/pocket-engine";
import { C, Trail } from "./pocket-ui";
export default function PocketMap({
  trace,
}: {
  trace: Point[];
  route: Point[];
}) {
  return (
    <View style={{ backgroundColor: C.white, padding: 20, borderRadius: 20 }}>
      <Trail points={trace} />
      <Text style={{ color: C.muted, fontSize: 12 }}>
        已走過的路 · 街道地圖請在 Expo Go 查看
      </Text>
    </View>
  );
}
