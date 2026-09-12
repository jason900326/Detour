import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import {
  Album,
  Asset,
  requestPermissionsAsync as requestMediaLibraryPermissionsAsync,
} from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

const CAMERA_RESULT_KEY = '@detour/camera/result/v1';

const INK = '#11110F';
const BONE = '#F1EFE7';
const MUTED = '#B7B2A8';
const SIGNAL = '#FF5A36';

type CameraSource = 'side' | 'arrival' | 'free';

type SessionPhoto = {
  id: string;
  uri: string;
  missionCode: string;
  missionTitle: string;
  source?: 'mission' | 'free';
  savedToLibrary?: boolean;
};

type CameraRouteResult = {
  requestId: string;
  source: CameraSource;
  photo: SessionPhoto;
};

function getParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cameraRef = useRef<CameraView | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [justExposed, setJustExposed] = useState(false);
  const [librarySaveState, setLibrarySaveState] = useState<
    'idle' | 'saved' | 'passport-only'
  >('idle');

  const requestId = getParam(params.requestId);
  const source = getParam(params.source, 'free') as CameraSource;
  const missionCode = getParam(params.missionCode, 'FREE FRAME');
  const missionTitle = getParam(
    params.missionTitle,
    '留下現在看到的東西。'
  );
  const missionCompletion = getParam(
    params.missionCompletion,
    '拍或不拍都不影響主線。'
  );
  const photoRequired = getParam(params.photoRequired, '0') === '1';
  const savedCount =
    Number.parseInt(getParam(params.savedCount, '0'), 10) || 0;
  const rollCapacity =
    Number.parseInt(getParam(params.rollCapacity, '6'), 10) || 6;
  const rollNumber =
    Number.parseInt(getParam(params.rollNumber, '1'), 10) || 1;

  const nextExposure = savedCount + 1;
  const rollDisplay =
    savedCount <= rollCapacity
      ? `${savedCount} / ${rollCapacity} EXPOSED`
      : `${savedCount} EXPOSED · EXTENDED`;

  useEffect(() => {
    if (!permission) return;

    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  async function persistPhoto(tempUri: string) {
    try {
      const directory = new Directory(Paths.document, 'detour-photos');
      directory.create({ idempotent: true, intermediates: true });

      const sourceFile = new File(tempUri);
      const destination = new File(
        directory,
        `detour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
      );

      await sourceFile.copy(destination);
      return destination.uri;
    } catch {
      return tempUri;
    }
  }

  async function saveToPhotos(localUri: string) {
    try {
      const mediaPermission =
        await requestMediaLibraryPermissionsAsync(true);

      if (mediaPermission.status !== 'granted') {
        return false;
      }

      // New expo-media-library API:
      // Asset.create() imports the local file into the iPhone Photos library.
      const asset = await Asset.create(localUri);

      // Also keep DETOUR photos grouped together when album APIs are available.
      try {
        const existingAlbum = await Album.get('DETOUR');

        if (existingAlbum) {
          await existingAlbum.add(asset);
        } else {
          await Album.create('DETOUR', [asset]);
        }
      } catch {
        // The photo is already safely in the main Photos library.
        // Album creation is optional and must not make the capture fail.
      }

      return true;
    } catch (error) {
      console.warn('DETOUR photo save failed:', error);
      return false;
    }
  }

  async function takePhoto() {
    if (!cameraReady || !cameraRef.current || takingPhoto) return;

    setTakingPhoto(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const capture = await cameraRef.current.takePictureAsync({
        quality: 0.84,
      });

      if (!capture?.uri) {
        throw new Error('No photo URI');
      }

      // FILM ROLL: no Photo Check. Pressing the shutter commits the frame.
      const stableUri = await persistPhoto(capture.uri);
      const savedToLibrary = await saveToPhotos(stableUri);
      setLibrarySaveState(savedToLibrary ? 'saved' : 'passport-only');

      const photo: SessionPhoto = {
        id: `${Date.now()}`,
        uri: stableUri,
        missionCode,
        missionTitle,
        source: source === 'free' ? 'free' : 'mission',
        savedToLibrary,
      };

      const result: CameraRouteResult = {
        requestId,
        source,
        photo,
      };

      await AsyncStorage.setItem(
        CAMERA_RESULT_KEY,
        JSON.stringify(result)
      );

      setJustExposed(true);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      await delay(380);
      router.back();
    } catch {
      setTakingPhoto(false);
      setJustExposed(false);
      setLibrarySaveState('idle');

      Alert.alert(
        '拍照失敗',
        '這一格沒有曝光成功。底片沒有被使用，請再拍一次。'
      );
    }
  }

  if (!permission) {
    return (
      <View style={styles.blackScreen}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.centerMessage}>LOADING CAMERA</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />

        <Text style={styles.permissionBrand}>DETOUR CAMERA</Text>

        <View>
          <Text style={styles.permissionTitle}>
            需要相機權限，{`\n`}才能留下這趟路。
          </Text>
          <Text style={styles.permissionBody}>
            DETOUR 只會在你主動按下快門時使用相機。
          </Text>
        </View>

        <View>
          {permission.canAskAgain ? (
            <Pressable
              onPress={requestPermission}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>允許相機</Text>
              <Text style={styles.permissionButtonText}>→</Text>
            </Pressable>
          ) : (
            <Text style={styles.permissionBody}>
              請到 iPhone 設定裡允許 DETOUR / Expo Go 使用相機。
            </Text>
          )}

          <Pressable
            onPress={() => router.back()}
            style={styles.cancelPermission}
          >
            <Text style={styles.cancelPermissionText}>返回</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={styles.cameraView}
        facing="back"
        onCameraReady={() => {
          setCameraReady(true);
          setMountError(null);
        }}
        onMountError={(event) => {
          setCameraReady(false);
          setMountError(event.message);
        }}
      />

      <View style={styles.cameraOverlay} pointerEvents="box-none">
        <View style={styles.cameraTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>

          <View style={styles.rollChip}>
            <Text style={styles.rollChipLabel}>
              DETOUR / ROLL {String(rollNumber).padStart(2, '0')}
            </Text>
            <Text style={styles.rollChipCount}>{rollDisplay}</Text>
          </View>
        </View>

        <View style={styles.promptCard}>
          <Text style={styles.promptEyebrow}>
            {source === 'arrival'
              ? 'FINAL FRAME'
              : source === 'free'
                ? 'FREE FRAME'
                : photoRequired
                  ? 'MISSION FRAME'
                  : 'OPTIONAL FRAME'}{' '}
            · {missionCode}
          </Text>

          <Text style={styles.promptTitle}>{missionTitle}</Text>

          <Text style={styles.promptRule}>
            {source === 'free'
              ? '自由拍攝。按下快門就收進這趟底片，不會推進任務。'
              : photoRequired
                ? '這格就是完成條件。按下快門後直接回到旅程。'
                : `${missionCompletion} 這張只是一個額外紀錄。`}
          </Text>
        </View>

        <View style={styles.cameraBottom}>
          <View style={styles.statusColumn}>
            <Text style={styles.statusText}>
              {mountError
                ? 'PREVIEW ERROR'
                : cameraReady
                  ? 'LIVE'
                  : 'STARTING'}
            </Text>

            {mountError && (
              <Text style={styles.errorText}>{mountError}</Text>
            )}
          </View>

          <Pressable
            disabled={!cameraReady || takingPhoto}
            onPress={takePhoto}
            style={({ pressed }) => [
              styles.shutterOuter,
              (!cameraReady || takingPhoto) && styles.shutterDisabled,
              pressed && styles.shutterPressed,
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <View style={styles.exposureColumn}>
            <Text style={styles.exposureNext}>
              {nextExposure <= rollCapacity
                ? `${String(nextExposure).padStart(2, '0')} / ${String(
                    rollCapacity
                  ).padStart(2, '0')}`
                : `+${nextExposure - rollCapacity}`}
            </Text>
            <Text style={styles.exposureLabel}>NEXT FRAME</Text>
          </View>
        </View>
      </View>

      {justExposed && (
        <View style={styles.exposedOverlay} pointerEvents="none">
          <View style={styles.exposedCard}>
            <View style={styles.exposedDot} />
            <Text style={styles.exposedLabel}>EXPOSED</Text>
            <Text style={styles.exposedCount}>
              {nextExposure <= rollCapacity
                ? `${String(nextExposure).padStart(2, '0')} / ${String(
                    rollCapacity
                  ).padStart(2, '0')}`
                : `${nextExposure}`}
            </Text>
            <Text style={styles.exposedSaveState}>
              {librarySaveState === 'saved'
                ? 'SAVED TO PHOTOS'
                : librarySaveState === 'passport-only'
                  ? 'PASSPORT ONLY'
                  : 'SAVING'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blackScreen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerMessage: {
    fontSize: 10,
    letterSpacing: 2,
    color: BONE,
  },

  permissionScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },

  permissionBrand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.8,
    color: INK,
  },

  permissionTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  permissionBody: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 22,
    color: '#706C64',
  },

  permissionButton: {
    height: 64,
    backgroundColor: INK,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: BONE,
  },

  cancelPermission: {
    marginTop: 12,
    paddingVertical: 16,
  },

  cancelPermissionText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#706C64',
  },

  cameraScreen: {
    flex: 1,
    backgroundColor: '#000',
  },

  cameraView: {
    flex: 1,
  },

  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },

  cameraTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(17,17,15,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    fontSize: 27,
    lineHeight: 28,
    color: BONE,
  },

  rollChip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(17,17,15,0.78)',
    justifyContent: 'center',
  },

  rollChipLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: BONE,
  },

  rollChipCount: {
    marginTop: 5,
    fontSize: 7,
    letterSpacing: 1.2,
    color: MUTED,
  },

  promptCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(17,17,15,0.8)',
    padding: 16,
  },

  promptEyebrow: {
    fontSize: 8,
    letterSpacing: 1.7,
    color: SIGNAL,
    marginBottom: 10,
  },

  promptTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: BONE,
  },

  promptRule: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 18,
    color: MUTED,
  },

  cameraBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusColumn: {
    width: 108,
    gap: 5,
  },

  statusText: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: BONE,
  },

  errorText: {
    fontSize: 7,
    lineHeight: 12,
    color: SIGNAL,
  },

  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: BONE,
  },

  shutterDisabled: {
    opacity: 0.36,
  },

  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },

  exposureColumn: {
    width: 108,
    alignItems: 'flex-end',
  },

  exposureNext: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: BONE,
  },

  exposureLabel: {
    marginTop: 5,
    fontSize: 7,
    letterSpacing: 1.3,
    color: MUTED,
  },

  exposedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  exposedCard: {
    minWidth: 180,
    paddingVertical: 24,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(17,17,15,0.92)',
    alignItems: 'center',
  },

  exposedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    marginBottom: 14,
  },

  exposedLabel: {
    fontSize: 9,
    letterSpacing: 2.2,
    color: MUTED,
  },

  exposedCount: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: BONE,
  },

  exposedSaveState: {
    marginTop: 10,
    fontSize: 7,
    letterSpacing: 1.5,
    color: MUTED,
  },
});
