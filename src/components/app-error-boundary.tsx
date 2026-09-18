import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep a stable breadcrumb until native crash reporting is connected.
    // This also makes release logs useful when a field-test build fails.
    console.error('[DETOUR CRASH]', error, info.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.brand}>DETOUR</Text>
        <Text style={styles.title}>這一頁暫時卡住了。</Text>
        <Text style={styles.body}>
          旅程資料會先保留。請重新載入畫面；如果仍然發生，我們可以依照錯誤紀錄追查原因。
        </Text>
        <Pressable onPress={this.retry} style={styles.button}>
          <Text style={styles.buttonText}>重新載入</Text>
          <Text style={styles.buttonArrow}>→</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
    justifyContent: 'space-between',
    backgroundColor: '#11110F',
  },
  brand: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#F1EFE7',
  },
  title: {
    marginTop: 40,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '900',
    color: '#F1EFE7',
  },
  body: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '600',
    color: '#B7B2A8',
  },
  button: {
    minHeight: 64,
    paddingHorizontal: 20,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF5A36',
  },
  buttonText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#11110F',
  },
  buttonArrow: {
    fontSize: 28,
    fontWeight: '800',
    color: '#11110F',
  },
});
