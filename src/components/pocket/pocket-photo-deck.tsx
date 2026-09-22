import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { C, Enter, s } from "./pocket-ui";

export function PhotoDeck({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const selected = index % photos.length;
  return (
    <View style={{ marginTop: 26, marginBottom: 12 }}>
      <View style={[s.row, { marginBottom: 16 }]}>
        <Text style={[s.sectionTitle, { marginVertical: 0 }]}>路上的幾眼</Text>
        <Text style={s.serial}>
          {selected + 1} / {photos.length}
        </Text>
      </View>
      <View style={{ marginHorizontal: 14, paddingTop: 12 }}>
        {photos.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 5,
              bottom: 5,
              left: 0,
              right: 0,
              backgroundColor: C.purple,
              borderRadius: 12,
              transform: [{ rotate: "5deg" }],
            }}
          />
        )}
        {photos.length > 2 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 8,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: C.green,
              borderRadius: 12,
              transform: [{ rotate: "-4deg" }],
            }}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`照片 ${selected + 1}，共 ${photos.length} 張。點一下翻到下一張`}
          onPress={() => setIndex((v) => (v + 1) % photos.length)}
        >
          <Enter key={photos[selected]}>
            <View
              style={{
                backgroundColor: C.white,
                padding: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.line,
              }}
            >
              <Image
                source={{ uri: photos[selected] }}
                style={{ width: "100%", aspectRatio: 1.15, borderRadius: 6 }}
              />
              <Text
                style={[s.muted, { textAlign: "center", paddingVertical: 9 }]}
              >
                {photos.length > 1 ? "輕點，翻一張 →" : "今天，真的來過。"}
              </Text>
            </View>
          </Enter>
        </Pressable>
      </View>
    </View>
  );
}
