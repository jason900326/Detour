import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorBoundary } from '../components/app-error-boundary';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
          }}
        />
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
