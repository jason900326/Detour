import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Album,
  Asset,
  requestPermissionsAsync as requestMediaLibraryPermissionsAsync,
} from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  CAMERA_RESULT_KEY,
  type CameraRouteResult,
  type CameraSource,
  type SessionPhoto,
} from '../lib/app-model';
import { writeStored } from '../lib/storage';

function getParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

async function cropCaptureToSquare(uri: string) {
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        reject
      );
    }
  );
  const side = Math.min(dimensions.width, dimensions.height);
  const originX = Math.max(0, Math.round((dimensions.width - side) / 2));
  const originY = Math.max(0, Math.round((dimensions.height - side) / 2));

  return ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 0.84, format: ImageManipulator.SaveFormat.JPEG }
  );
}

export default function DetourCameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = ImagePicker.useCameraPermissions();
  const [pendingCaptureUri, setPendingCaptureUri] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const startedRef = useRef(false);

  const requestId = getParam(params.requestId);
  const sourceParam = getParam(params.source, 'free');
  const source: CameraSource = ['side', 'arrival', 'free'].includes(sourceParam)
    ? (sourceParam as CameraSource)
    : 'free';
  const missionCode = getParam(params.missionCode, '自由拍攝');
  const missionTitle = getParam(params.missionTitle, '留下現在看到的東西。');

  const launchNativeCamera = useCallback(async () => {
    let granted = permission?.granted ?? false;

    if (!granted && permission?.canAskAgain) {
      const nextPermission = await requestPermission();
      granted = nextPermission.granted;
    }

    if (!granted) {
      setPermissionBlocked(true);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) {
        router.back();
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('Camera returned an empty image');

      const squareCapture = await cropCaptureToSquare(asset.uri);
      setPendingCaptureUri(squareCapture.uri);
    } catch (error) {
      console.warn('DETOUR native camera failed:', error);
      Alert.alert('相機沒有開啟', '這次沒有留下照片，請再試一次。');
      router.back();
    }
  }, [permission, requestPermission, router]);

  useEffect(() => {
    if (!permission || startedRef.current || pendingCaptureUri) return;
    startedRef.current = true;
    void launchNativeCamera();
  }, [launchNativeCamera, pendingCaptureUri, permission]);

  async function persistPhoto(tempUri: string) {
    try {
      const directory = new Directory(Paths.document, 'detour-photos');
      directory.create({ idempotent: true, intermediates: true });
      const sourceFile = new File(tempUri);
      const destination = new File(
        directory,
        'detour-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg'
      );
      await sourceFile.copy(destination);
      return destination.uri;
    } catch {
      return tempUri;
    }
  }

  async function saveToPhotos(localUri: string) {
    try {
      const mediaPermission = await requestMediaLibraryPermissionsAsync(true);
      if (mediaPermission.status !== 'granted') return false;

      const asset = await Asset.create(localUri);
      try {
        const existingAlbum = await Album.get('DETOUR');
        if (existingAlbum) await existingAlbum.add(asset);
        else await Album.create('DETOUR', [asset]);
      } catch {
        // Album grouping is optional; the photo is already in the library.
      }
      return true;
    } catch (error) {
      console.warn('DETOUR photo save failed:', error);
      return false;
    }
  }

  async function retakePhoto() {
    if (savingPhoto) return;
    startedRef.current = false;
    setPendingCaptureUri(null);
    setPermissionBlocked(false);
  }

  async function keepPhoto() {
    if (!pendingCaptureUri || savingPhoto) return;
    setSavingPhoto(true);

    try {
      const stableUri = await persistPhoto(pendingCaptureUri);
      const savedToLibrary = await saveToPhotos(stableUri);
      const photo: SessionPhoto = {
        id: String(Date.now()),
        uri: stableUri,
        missionCode,
        missionTitle,
        source: source === 'free' ? 'free' : 'mission',
        savedToLibrary,
      };
      const result: CameraRouteResult = { requestId, source, photo };
      await writeStored(CAMERA_RESULT_KEY, result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSavingPhoto(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('照片沒有存好', '這張還留在預覽畫面，可以再試一次。');
    }
  }

  function openSettings() {
    void Linking.openSettings();
  }

  if (pendingCaptureUri) {
    return (
      <View style={styles.previewScreen}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.brand}>DETOUR</Text>
        <Text style={styles.previewEyebrow}>這一張先留著</Text>
        <Image source={{ uri: pendingCaptureUri }} style={styles.previewImage} />
        <View style={styles.previewActions}>
          <Pressable onPress={() => void retakePhoto()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>重拍</Text>
          </Pressable>
          <Pressable
            disabled={savingPhoto}
            onPress={() => void keepPhoto()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {savingPhoto ? '正在收進旅程…' : '使用這張'}
            </Text>
            <Text style={styles.primaryButtonText}>→</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (permissionBlocked) {
    return (
      <View style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionBrand}>DETOUR</Text>
        <View>
          <Text style={styles.permissionTitle}>
            需要相機權限，{'\n'}才能留下這趟路。
          </Text>
          <Text style={styles.permissionBody}>
            相機由 iOS 系統開啟；DETOUR 只會在你主動拍照後保存照片。
          </Text>
        </View>
        <View>
          {permission?.canAskAgain ? (
            <Pressable
              onPress={() => {
                startedRef.current = false;
                setPermissionBlocked(false);
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>允許相機</Text>
              <Text style={styles.primaryButtonText}>→</Text>
            </Pressable>
          ) : (
            <Pressable onPress={openSettings} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>前往設定允許相機</Text>
              <Text style={styles.primaryButtonText}>→</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>返回</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.loadingScreen}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.loadingBrand}>DETOUR</Text>
      <Text style={styles.loadingTitle}>正在開啟 iOS 相機…</Text>
      <Text style={styles.loadingBody}>拍完後會回到這趟路。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F1EFE7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingBrand: {
    color: '#11110F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 24,
  },
  loadingTitle: {
    color: '#11110F',
    fontSize: 24,
    fontWeight: '900',
  },
  loadingBody: {
    color: '#6E6A61',
    fontSize: 15,
    marginTop: 9,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#F1EFE7',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 42,
  },
  permissionBrand: {
    color: '#11110F',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  permissionTitle: {
    color: '#11110F',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
  },
  permissionBody: {
    color: '#6E6A61',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
  },
  previewScreen: {
    flex: 1,
    backgroundColor: '#11110F',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 30,
  },
  brand: {
    color: '#F1EFE7',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
  },
  previewEyebrow: {
    color: '#B7B2A8',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 26,
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#292824',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  primaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#FF5A36',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonText: {
    color: '#11110F',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#6E6A61',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#F1EFE7',
    fontSize: 16,
    fontWeight: '900',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  cancelButtonText: {
    color: '#6E6A61',
    fontSize: 15,
    fontWeight: '800',
  },
});
