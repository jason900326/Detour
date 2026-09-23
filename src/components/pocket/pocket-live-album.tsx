import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, PHOTO_ASPECT, s } from "./pocket-ui";

export function PocketLiveAlbum({
  photos,
  visible,
  onClose,
}: {
  photos: string[];
  visible: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (selected) setSelected(null);
        else close();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
        {selected ? (
          <View
            style={{
              flex: 1,
              backgroundColor: C.ink,
              paddingHorizontal: 18,
              paddingBottom: 24,
            }}
          >
            <View
              style={[
                s.row,
                {
                  minHeight: 68,
                  justifyContent: "flex-end",
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉照片檢視"
                hitSlop={10}
                onPress={() => setSelected(null)}
                style={[
                  s.round,
                  {
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    borderColor: "#64685F",
                  },
                ]}
              >
                <Text style={{ color: C.white, fontSize: 25 }}>×</Text>
              </Pressable>
            </View>
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={{ uri: selected }}
                resizeMode="contain"
                style={{
                  width: "100%",
                  aspectRatio: PHOTO_ASPECT,
                  borderRadius: 20,
                  backgroundColor: "#11140F",
                }}
              />
            </View>
          </View>
        ) : (
          <View style={[s.page, { flex: 1, paddingTop: 8 }]}>
            <View style={s.header}>
              <View>
                <Text style={s.eyebrow}>這一趟的照片</Text>
                <Text style={[s.sectionTitle, { marginVertical: 2 }]}>
                  即時相簿
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉即時相簿"
                hitSlop={10}
                onPress={close}
                style={s.round}
              >
                <Text style={{ color: C.ink, fontSize: 24 }}>×</Text>
              </Pressable>
            </View>

            {photos.length ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 9,
                  paddingTop: 10,
                  paddingBottom: 28,
                }}
              >
                {photos.map((uri, index) => (
                  <Pressable
                    key={`${uri}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`放大檢視第 ${index + 1} 張照片`}
                    onPress={() => setSelected(uri)}
                    style={{
                      width: "31%",
                    }}
                  >
                    <Image
                      source={{ uri }}
                      resizeMode="contain"
                      style={{
                        width: "100%",
                        aspectRatio: PHOTO_ASPECT,
                        borderRadius: 12,
                        backgroundColor: C.white,
                        borderWidth: 1,
                        borderColor: C.line,
                      }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingBottom: 80,
                }}
              >
                <Text style={{ fontSize: 42, marginBottom: 12 }}>📷</Text>
                <Text style={s.body}>還沒有照片。路上看到喜歡的，再留一張。</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
