import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
  type CameraType,
  type FlashMode,
} from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Album,
  Asset,
  requestPermissionsAsync as requestMediaLibraryPermissionsAsync,
} from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  CAMERA_RESULT_KEY,
  type CameraRouteResult,
  type CameraSource,
  type SessionPhoto,
} from '../lib/app-model';

const INK = '#11110F';
const BONE = '#F1EFE7';
const MUTED = '#B7B2A8';
const SIGNAL = '#FF5A36';
const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function getParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cropCaptureToSquare(capture: CameraCapturedPicture) {
  const side = Math.min(capture.width, capture.height);
  const originX = Math.max(0, Math.round((capture.width - side) / 2));
  const originY = Math.max(0, Math.round((capture.height - side) / 2));
  return ImageManipulator.manipulateAsync(
    capture.uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 0.84, format: ImageManipulator.SaveFormat.JPEG }
  );
}

const MAX_DIGITAL_ZOOM = 0.48;
function clampZoom(value: number) { return Math.min(MAX_DIGITAL_ZOOM, Math.max(0, value)); }
function touchDistance(touches: readonly { pageX: number; pageY: number }[]) { if (touches.length < 2) return 0; const [a,b] = touches; return Math.hypot(a.pageX-b.pageX, a.pageY-b.pageY); }
function lensLabel(lens: string) { const key = lens.toLowerCase(); if (key.includes('ultrawide')) return '0.5×'; if (key.includes('wideangle')) return '1×'; if (key.includes('telephoto')) return '望遠'; return '鏡頭'; }
function lensPriority(lens: string) { const key = lens.toLowerCase(); if (key.includes('ultrawide')) return 0; if (key.includes('wideangle')) return 1; if (key.includes('telephoto')) return 2; return 9; }

export default function DetourCameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cameraRef = useRef<CameraView | null>(null);
  const shutterFlash = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [pendingCaptureUri, setPendingCaptureUri] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartZoomRef = useRef(0);
  const pinchActiveRef = useRef(false);

  const requestId = getParam(params.requestId);
  const source = getParam(params.source, 'free') as CameraSource;
  const missionCode = getParam(params.missionCode, '自由拍攝');
  const missionTitle = getParam(params.missionTitle, '留下現在看到的東西。');
  const isArrivalCapture = source === 'arrival';

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  async function persistPhoto(tempUri: string) {
    try {
      const directory = new Directory(Paths.document, 'detour-photos');
      directory.create({ idempotent: true, intermediates: true });
      const sourceFile = new File(tempUri);
      const destination = new File(directory, `detour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`);
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

  async function refreshAvailableLenses() {
    setZoom(0);
    if (Platform.OS !== 'ios' || facing !== 'back' || !cameraRef.current) {
      setAvailableLenses([]);
      setSelectedLens(undefined);
      return;
    }

    try {
      const lenses = (await cameraRef.current.getAvailableLensesAsync()) as string[];
      const physical = lenses
        .filter((lens) => {
          const key = lens.toLowerCase();
          return key.includes('ultrawide') || key.includes('wideangle') || key.includes('telephoto');
        })
        .sort((a, b) => lensPriority(a) - lensPriority(b));
      const normalized = Array.from(new Set(physical));
      setAvailableLenses(normalized);
      const mainWide = normalized.find((lens) => {
        const key = lens.toLowerCase();
        return key.includes('wideangle') && !key.includes('ultrawide');
      });
      setSelectedLens(mainWide);
    } catch {
      setAvailableLenses([]);
      setSelectedLens(undefined);
      setZoom(0);
    }
  }

  function cycleFlash() {
    setFlashMode((current) => current === 'off' ? 'auto' : current === 'auto' ? 'on' : 'off');
    void Haptics.selectionAsync();
  }

  function switchFacing() {
    setFacing((current) => current === 'back' ? 'front' : 'back');
    setZoom(0);
    setSelectedLens(undefined);
    setAvailableLenses([]);
    setFlashMode('off');
    void Haptics.selectionAsync();
  }

  function chooseLens(lens: string) {
    setSelectedLens(lens);
    setZoom(0);
    void Haptics.selectionAsync();
  }

  function handlePinchStart(touches: readonly { pageX: number; pageY: number }[]) {
    if (touches.length < 2) return;
    const distance = touchDistance(touches);
    if (distance <= 0) return;
    pinchStartDistanceRef.current = distance;
    pinchStartZoomRef.current = zoom;
    pinchActiveRef.current = true;
  }

  function handlePinchMove(touches: readonly { pageX: number; pageY: number }[]) {
    if (touches.length < 2 || !pinchActiveRef.current || pinchStartDistanceRef.current <= 0) return;
    const distance = touchDistance(touches);
    if (distance <= 0) return;
    const ratio = distance / pinchStartDistanceRef.current;
    const delta = Math.log2(Math.max(0.35, ratio)) * 0.24;
    setZoom(clampZoom(pinchStartZoomRef.current + delta));
  }

  function handlePinchEnd() {
    pinchActiveRef.current = false;
    pinchStartDistanceRef.current = 0;
  }

  function runShutterMotion() {
    shutterFlash.stopAnimation();
    shutterScale.stopAnimation();
    shutterFlash.setValue(0);
    shutterScale.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(shutterFlash, {
          toValue: 0.92,
          duration: 34,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shutterFlash, {
          toValue: 0,
          duration: 105,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(shutterScale, {
          toValue: 0.91,
          duration: 54,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(shutterScale, {
          toValue: 1,
          speed: 28,
          bounciness: 3,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }

  async function takePhoto() {
    if (!cameraReady || !cameraRef.current || takingPhoto) return;

    setTakingPhoto(true);
    runShutterMotion();

    try {
      // Give the shutter blackout one frame to land before native capture.
      // iOS may suppress Taptic Engine feedback while CameraView is active, so
      // the visual shutter is primary and the crisp impact is fired after the
      // captured frame replaces CameraView.
      await delay(45);

      // Capture once at source quality, then create the canonical 1:1 file.
      // Review, session storage and Photos all use this exact square result.
      const capture = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (!capture?.uri) throw new Error('No photo URI');

      const squareCapture = await cropCaptureToSquare(capture);
      setPendingCaptureUri(squareCapture.uri);
      setTakingPhoto(false);

      await delay(45);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    } catch {
      setTakingPhoto(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('拍照失敗', '這一格沒有曝光成功。底片沒有被使用，請再拍一次。');
    }
  }

  async function retakePhoto() {
    if (savingPhoto) return;
    setPendingCaptureUri(null);
    setTakingPhoto(false);
    await Haptics.selectionAsync();
  }

  async function keepPhoto() {
    if (!pendingCaptureUri || savingPhoto) return;
    setSavingPhoto(true);

    try {
      const stableUri = await persistPhoto(pendingCaptureUri);
      const savedToLibrary = await saveToPhotos(stableUri);
      const photo: SessionPhoto = {
        id: `${Date.now()}`,
        uri: stableUri,
        missionCode,
        missionTitle,
        source: source === 'free' ? 'free' : 'mission',
        savedToLibrary,
      };
      const result: CameraRouteResult = { requestId, source, photo };
      await AsyncStorage.setItem(CAMERA_RESULT_KEY, JSON.stringify(result));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSavingPhoto(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('照片沒有存好', '這張還留在預覽畫面，可以再試一次。');
    }
  }

  if (!permission) {
    return (
      <View style={styles.blackScreen}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.centerMessage}>正在開啟相機</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionBrand}>DETOUR</Text>
        <View>
          <Text style={styles.permissionTitle}>需要相機權限，{`\n`}才能留下這趟路。</Text>
          <Text style={styles.permissionBody}>DETOUR 只會在你主動按下快門時使用相機。</Text>
        </View>
        <View>
          {permission.canAskAgain ? (
            <Pressable
              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void requestPermission(); }}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>允許相機</Text>
              <Text style={styles.permissionButtonText}>→</Text>
            </Pressable>
          ) : (
            <Text style={styles.permissionBody}>請到 iPhone 設定裡允許 DETOUR / Expo Go 使用相機。</Text>
          )}
          <Pressable
            onPress={() => { void Haptics.selectionAsync(); router.back(); }}
            style={styles.cancelPermission}
          >
            <Text style={styles.cancelPermissionText}>返回</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (pendingCaptureUri) {
    return (
      <View style={styles.reviewScreen}>
        <StatusBar barStyle="light-content" />
        <Image source={{ uri: pendingCaptureUri }} style={styles.reviewImage} resizeMode="contain" />
        <View style={styles.reviewShade} pointerEvents="none" />
        <View style={styles.reviewTop}>
          <Text style={styles.reviewKicker}>剛剛這張</Text>
          <Text style={styles.reviewTitle} numberOfLines={2}>{missionTitle}</Text>
        </View>
        <View style={styles.reviewBottom}>
          <View style={styles.reviewActions}>
            <Pressable disabled={savingPhoto} onPress={retakePhoto} style={({ pressed }) => [styles.reviewRetake, pressed && styles.reviewPressed]}>
              <Text style={styles.reviewRetakeText}>重拍</Text>
            </Pressable>
            <Pressable disabled={savingPhoto} onPress={keepPhoto} style={({ pressed }) => [styles.reviewKeep, savingPhoto && styles.reviewDisabled, pressed && styles.reviewPressed]}>
              <Text style={styles.reviewKeepText}>
                {savingPhoto
                  ? isArrivalCapture
                    ? '完成中…'
                    : '正在存…'
                  : isArrivalCapture
                    ? '完成旅程'
                    : '留下這張'}
              </Text>
              <Text style={styles.reviewKeepArrow}>→</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.cameraScreen}
      onTouchStart={(event) => handlePinchStart(event.nativeEvent.touches)}
      onTouchMove={(event) => handlePinchMove(event.nativeEvent.touches)}
      onTouchEnd={(event) => { if (event.nativeEvent.touches.length < 2) handlePinchEnd(); }}
      onTouchCancel={handlePinchEnd}
    >
      <StatusBar barStyle="light-content" />
      <CameraView
        ref={cameraRef}
        style={styles.cameraView}
        facing={facing}
        flash={facing === 'back' ? flashMode : 'off'}
        zoom={zoom}
        selectedLens={Platform.OS === 'ios' && facing === 'back' ? selectedLens : undefined}
        autofocus="on"
        responsiveOrientationWhenOrientationLocked
        onCameraReady={() => { setZoom(0); setCameraReady(true); setMountError(null); void refreshAvailableLenses(); }}
        onMountError={(event) => { setCameraReady(false); setMountError(event.message); }}
      />

      <View pointerEvents="none" style={styles.squareMaskWrap}>
        <View style={styles.squareMaskBand} />
        <View style={styles.squareViewport}>
          <View style={styles.squareGuide} />
        </View>
        <View style={styles.squareMaskBand} />
      </View>

      <Animated.View pointerEvents="none" style={[styles.shutterFlash, { opacity: shutterFlash }]} />

      <View style={styles.cameraOverlay} pointerEvents="box-none">
        <View style={styles.cameraTop}>
          <View style={styles.cameraTopLeft}>
            <Pressable onPress={() => { void Haptics.selectionAsync(); router.back(); }} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.cameraTopActions}>
            {facing === 'back' && (
              <Pressable onPress={cycleFlash} style={styles.cameraUtilityButton}>
                <Text style={styles.cameraUtilityText}>{flashMode === 'off' ? '閃光 關' : flashMode === 'auto' ? '閃光 自動' : '閃光 開'}</Text>
              </Pressable>
            )}
            <Pressable onPress={switchFacing} style={styles.cameraUtilityButton}>
              <Text style={styles.cameraUtilityText}>切換</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.promptCard}>
          <View style={styles.promptDot} />
          <Text numberOfLines={2} style={styles.promptTitle}>{missionTitle}</Text>
        </View>

        <View style={styles.cameraControlZone}>
          {facing === 'back' && availableLenses.length > 1 && (
            <View style={styles.lensRow}>
              {availableLenses.map((lens) => {
                const active = selectedLens === lens;
                return (
                  <Pressable key={lens} onPress={() => chooseLens(lens)} style={[styles.lensButton, active && styles.lensButtonActive]}>
                    <Text style={[styles.lensButtonText, active && styles.lensButtonTextActive]}>{lensLabel(lens)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={styles.cameraBottom}>
            <View style={styles.statusColumn} />

            <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
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
            </Animated.View>

            <View style={styles.exposureColumn}>
              {mountError ? <Text style={styles.errorText}>預覽錯誤</Text> : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewScreen: { flex: 1, backgroundColor: '#000' },
  reviewImage: { ...ABSOLUTE_FILL, width: '100%', height: '100%' },
  reviewShade: { ...ABSOLUTE_FILL, backgroundColor: 'rgba(0,0,0,0.12)' },
  reviewTop: { position: 'absolute', top: 58, left: 24, right: 24 },
  reviewKicker: { fontSize: 16, fontWeight: '800', color: SIGNAL },
  reviewTitle: { marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#FFF' },
  reviewBottom: { position: 'absolute', left: 24, right: 24, bottom: 34 },
  reviewCount: { marginBottom: 12, fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.82)' },
  reviewActions: { flexDirection: 'row', gap: 10 },
  reviewRetake: { width: 112, minHeight: 68, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.44)', backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  reviewRetakeText: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  reviewKeep: { flex: 1, minHeight: 68, borderRadius: 18, backgroundColor: SIGNAL, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewKeepText: { fontSize: 21, fontWeight: '900', color: INK },
  reviewKeepArrow: { fontSize: 29, color: INK },
  reviewPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  reviewDisabled: { opacity: 0.58 },
  blackScreen: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  centerMessage: { fontSize: 10, letterSpacing: 2, color: BONE },
  permissionScreen: { flex: 1, backgroundColor: BONE, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 36, justifyContent: 'space-between' },
  permissionBrand: { fontSize: 14, fontWeight: '800', letterSpacing: 2.8, color: INK },
  permissionTitle: { fontSize: 42, lineHeight: 48, fontWeight: '700', letterSpacing: -2.2, color: INK },
  permissionBody: { marginTop: 18, fontSize: 14, lineHeight: 22, color: '#706C64' },
  permissionButton: { height: 64, backgroundColor: INK, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permissionButtonText: { fontSize: 16, fontWeight: '700', color: BONE },
  cancelPermission: { marginTop: 12, paddingVertical: 16 },
  cancelPermissionText: { textAlign: 'center', fontSize: 13, color: '#706C64' },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraView: { flex: 1 },
  squareMaskWrap: { ...ABSOLUTE_FILL, zIndex: 3 },
  squareMaskBand: { flex: 1, width: '100%', backgroundColor: '#000' },
  squareViewport: { width: '100%', aspectRatio: 1, position: 'relative' },
  squareGuide: { ...ABSOLUTE_FILL, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.46)' },
  shutterFlash: { ...ABSOLUTE_FILL, backgroundColor: '#000', zIndex: 4 },
  cameraOverlay: { ...ABSOLUTE_FILL, paddingTop: 58, paddingHorizontal: 18, paddingBottom: 28, justifyContent: 'space-between', zIndex: 5 },
  cameraTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cameraTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  cameraTopActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cameraUtilityButton: { minHeight: 42, paddingHorizontal: 12, borderRadius: 21, backgroundColor: 'rgba(17,17,15,0.78)', alignItems: 'center', justifyContent: 'center' },
  cameraUtilityText: { fontSize: 10, fontWeight: '700', color: BONE },
  closeButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(17,17,15,0.78)', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 27, lineHeight: 28, color: BONE },
  promptCard: { alignSelf: 'center', maxWidth: '88%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(17,17,15,0.78)', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  promptDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SIGNAL },
  promptTitle: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '700', color: BONE },
  cameraControlZone: { gap: 11 },
  lensRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 24, backgroundColor: 'rgba(17,17,15,0.62)' },
  lensButton: { minWidth: 46, height: 38, paddingHorizontal: 10, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  lensButtonActive: { backgroundColor: BONE },
  lensButtonText: { fontSize: 11, fontWeight: '700', color: BONE },
  lensButtonTextActive: { color: INK },
  cameraBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusColumn: { width: 108, gap: 5 },
  statusText: { fontSize: 8, letterSpacing: 1.4, color: BONE },
  errorText: { fontSize: 7, lineHeight: 12, color: SIGNAL },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: BONE, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: BONE },
  shutterDisabled: { opacity: 0.36 },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  exposureColumn: { width: 108, alignItems: 'flex-end' },
});
