import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { useRef, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, C, s } from "./pocket-ui";
import { EdgeBack } from "./pocket-edge-back";

export default function PocketCamera({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (uri: string) => void;
}) {
  const [permission, request] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const lock = useRef(false);

  async function snap() {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const p = await camera.current?.takePictureAsync({
        quality: 0.9,
        shutterSound: true,
      });
      if (p) setPhoto(p.uri);
    } catch {
      setError("這張沒拍好，再試一次。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function keep() {
    if (!photo || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let uri = photo;
      if (Platform.OS !== "web") {
        const dir = `${FileSystem.documentDirectory}pocket-photos/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        uri = `${dir}${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: photo, to: uri });
      }
      onSave(uri);
      onClose();
    } catch {
      setError("照片還沒存好，請再試一次。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!lock.current) {
          if (photo) setPhoto(null);
          else onClose();
        }
      }}
    >
      <View
        style={[
          s.screen,
          {
            backgroundColor: C.ink,
            paddingTop: Math.max(insets.top, 18),
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <EdgeBack
          onBack={
            busy
              ? undefined
              : () => {
                  if (photo) setPhoto(null);
                  else onClose();
                }
          }
        >
          <View
            style={[
              s.page,
              {
                flex: 1,
                paddingTop: 8,
                paddingHorizontal: 12,
              },
            ]}
          >
            <View style={[s.header, { paddingHorizontal: 4 }]}>
              <Text style={[s.brand, { color: C.white }]}>留住這一眼</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉相機"
                disabled={busy}
                hitSlop={10}
                onPress={onClose}
                style={[
                  s.round,
                  {
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    borderColor: "#686D64",
                  },
                ]}
              >
                <Text style={{ color: C.white, fontSize: 24, lineHeight: 28 }}>
                  ×
                </Text>
              </Pressable>
            </View>

            {permission?.granted ? (
              <>
                <View
                  style={{
                    flex: 1,
                    width: "100%",
                    borderRadius: 28,
                    overflow: "hidden",
                    backgroundColor: "#111",
                    alignSelf: "center",
                  }}
                >
                  {photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <CameraView
                      ref={camera}
                      style={{ flex: 1 }}
                      facing={facing}
                      onCameraReady={() => setReady(true)}
                      onMountError={() =>
                        setError("無法開啟相機，請確認權限後重試。")
                      }
                    />
                  )}
                </View>

                {!!error && (
                  <Text
                    style={{
                      color: "#FFB69C",
                      marginTop: 10,
                      marginBottom: 4,
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </Text>
                )}

                {photo ? (
                  <View style={{ gap: 12, paddingTop: 18 }}>
                    <Button
                      label="留下這張"
                      onPress={() => void keep()}
                      disabled={busy}
                    />
                    <Button
                      label="再拍一次"
                      disabled={busy}
                      onPress={() => {
                        setError("");
                        setPhoto(null);
                      }}
                      secondary
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-around",
                      paddingTop: 18,
                      paddingBottom: 12,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="切換鏡頭"
                      disabled={busy}
                      onPress={() => {
                        setReady(false);
                        setFacing((v) => (v === "back" ? "front" : "back"));
                      }}
                      style={[
                        s.round,
                        {
                          borderColor: "#686D64",
                          opacity: busy ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: C.white, fontSize: 26 }}>↻</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="拍照"
                      disabled={!ready || busy}
                      onPress={() => void snap()}
                      style={{
                        height: 82,
                        width: 82,
                        borderRadius: 41,
                        borderWidth: 5,
                        borderColor: C.white,
                        padding: 6,
                        opacity: ready && !busy ? 1 : 0.45,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 40,
                          backgroundColor: C.white,
                          transform: [{ scale: busy ? 0.88 : 1 }],
                        }}
                      />
                    </Pressable>
                    <View style={{ width: 44 }} />
                  </View>
                )}
              </>
            ) : (
              <View style={{ flex: 1, justifyContent: "center", gap: 24 }}>
                <Text style={[s.title, { color: C.white }]}>
                  留一張，{"\n"}今天的意外。
                </Text>
                <Text style={[s.body, { color: "#BBBFB1" }]}>
                  照片只會存進你的這趟旅程。
                </Text>
                <Button
                  label={
                    permission?.canAskAgain === false
                      ? "開啟手機設定"
                      : "允許使用相機"
                  }
                  onPress={() => {
                    if (permission?.canAskAgain === false)
                      void Linking.openSettings();
                    else void request();
                  }}
                />
                <Pressable onPress={onClose} style={s.link}>
                  <Text style={{ color: C.white }}>先不拍照</Text>
                </Pressable>
              </View>
            )}
          </View>
        </EdgeBack>
      </View>
    </Modal>
  );
}
