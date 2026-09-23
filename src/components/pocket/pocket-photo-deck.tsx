import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { C, Enter, PHOTO_ASPECT, s } from "./pocket-ui";

export function PhotoDeck({
  photos,
  compact = false,
}: {
  photos: string[];
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const selected = index % photos.length;
  return (
    <View
      style={{
        marginTop: compact ? 16 : 26,
        marginBottom: compact ? 8 : 12,
      }}
    >
      <View style={[s.row, { marginBottom: compact ? 10 : 16 }]}>
        <Text
          style={[
            s.sectionTitle,
            {
              marginVertical: 0,
              fontSize: compact ? 18 : 21,
            },
          ]}
        >
          路上的幾眼
        </Text>
        <Text style={s.serial}>
          {selected + 1} / {photos.length}
        </Text>
      </View>
      <View
        style={{
          width: compact ? "72%" : undefined,
          alignSelf: compact ? "center" : undefined,
          marginHorizontal: compact ? 0 : 14,
          paddingTop: compact ? 8 : 12,
        }}
      >
        {photos.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              left: 0,
              right: 0,
              backgroundColor: C.purple,
              borderRadius: 12,
              transform: [{ rotate: "4deg" }],
            }}
          />
        )}
        {photos.length > 2 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 7,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: C.green,
              borderRadius: 12,
              transform: [{ rotate: "-3deg" }],
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
                padding: compact ? 6 : 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.line,
              }}
            >
              <Image
                source={{ uri: photos[selected] }}
                resizeMode="contain"
                style={{
                  width: "100%",
                  aspectRatio: PHOTO_ASPECT,
                  borderRadius: 6,
                  alignSelf: "center",
                  backgroundColor: C.white,
                }}
              />
              {!compact && (
                <Text
                  style={[s.muted, { textAlign: "center", paddingVertical: 9 }]}
                >
                  {photos.length > 1
                    ? "輕點，翻一張 →"
                    : "今天，真的來過。"}
                </Text>
              )}
            </View>
          </Enter>
        </Pressable>
      </View>
    </View>
  );
}
