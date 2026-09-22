import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function ExpoGoCameraFallback() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>DETOUR</Text>

      <View style={styles.content}>
        <Text style={styles.title}>相機預覽</Text>
        <Text style={styles.body}>
          目前使用 Expo Go 預覽介面。
          {'\n\n'}
          真正的相機功能需要開啟 Detour Preview 版本。
        </Text>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>返回旅程</Text>
        <Text style={styles.buttonText}>→</Text>
      </Pressable>
    </View>
  );
}

export default function CameraRoute() {
  if (isExpoGo) {
    return <ExpoGoCameraFallback />;
  }

  const NativeCameraScreen = require(
    '../components/detour-camera-screen'
  ).default as ComponentType;

  return <NativeCameraScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE7',
    padding: 24,
    paddingTop: 64,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.8,
    color: '#11110F',
  },
  content: {
    gap: 18,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '700',
    color: '#11110F',
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    color: '#706C64',
  },
  button: {
    height: 64,
    paddingHorizontal: 20,
    backgroundColor: '#11110F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1EFE7',
  },
});