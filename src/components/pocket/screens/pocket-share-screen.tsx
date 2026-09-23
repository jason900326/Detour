import type { Ref } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { PocketJourney } from "../../../lib/pocket-engine";
import { Button, C, PHOTO_ASPECT, s } from "../pocket-ui";
import { PocketShareCard } from "../pocket-share-card";
import { PocketScreenHeader } from "./pocket-screen-header";

export function PocketShareScreen({
  journey,
  cover,
  cardRef,
  sharing,
  photosReady,
  coverError,
  shareError,
  onBack,
  onCover,
  onPhotoLoad,
  onPhotoError,
  onShare,
}: {
  journey: PocketJourney;
  cover?: string;
  cardRef: Ref<View>;
  sharing: boolean;
  photosReady: boolean;
  coverError: boolean;
  shareError: string;
  onBack: () => void;
  onCover: (uri: string) => void;
  onPhotoLoad: (uri: string) => void;
  onPhotoError: (uri: string) => void;
  onShare: () => void;
}) {
  return (
    <>
      <PocketScreenHeader
        title="把這一點意外分享出去"
        back={onBack}
        disabled={sharing}
      />
      {journey.photos.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={[s.eyebrow, { marginBottom: 12 }]}>
            哪一眼，放在最前面？
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {journey.photos.map((uri, index) => (
              <Pressable
                key={uri}
                accessibilityRole="button"
                accessibilityLabel={`選照片 ${index + 1} 作為分享封面`}
                accessibilityState={{
                  selected: cover === uri,
                  disabled: sharing,
                }}
                disabled={sharing}
                onPress={() => onCover(uri)}
                style={{
                  borderWidth: 3,
                  borderColor: cover === uri ? C.orange : "transparent",
                  padding: 3,
                  borderRadius: 14,
                }}
              >
                <Image
                  source={{ uri }}
                  resizeMode="contain"
                  style={{
                    width: 64,
                    aspectRatio: PHOTO_ASPECT,
                    borderRadius: 8,
                    backgroundColor: C.white,
                  }}
                />
                {cover === uri && (
                  <Text
                    style={{
                      position: "absolute",
                      bottom: 5,
                      right: 5,
                      color: C.white,
                      backgroundColor: C.orange,
                      borderRadius: 8,
                      paddingHorizontal: 5,
                    }}
                  >
                    ✓
                  </Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <PocketShareCard
        key={`${journey.id}:${cover ?? "empty"}`}
        journey={journey}
        cover={cover}
        cardRef={cardRef}
        onPhotoLoad={onPhotoLoad}
        onPhotoError={onPhotoError}
      />
      <View style={{ height: 24 }} />
      <Button
        label="分享這一趟"
        onPress={onShare}
        disabled={sharing || !photosReady || coverError}
      />
      {coverError && (
        <Text style={s.errorText}>
          部分照片無法讀取，請返回後再試一次。
        </Text>
      )}
      {!!shareError && <Text style={s.errorText}>{shareError}</Text>}
    </>
  );
}
