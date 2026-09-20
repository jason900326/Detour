import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useHybridDetourController } from '../hooks/use-hybrid-detour-controller';
import { HybridSwipeStart } from './hybrid-swipe-start';

function ActionButton(props: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  test?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.actionButton,
        props.secondary && styles.secondaryButton,
        props.test && styles.testButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.actionButtonLabel,
          props.secondary && styles.secondaryButtonLabel,
          props.test && styles.testButtonLabel,
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function HybridDetourExperiment() {
  const controller = useHybridDetourController();

  if (controller.phase === 'home') {
    return (
      <SafeAreaView style={styles.shell}>
        <View style={styles.homeContent}>
          <View>
            <Text style={styles.wordmark}>DETOUR</Text>
            <Text style={styles.homeTitle}>出去岔一下。</Text>
            <Text style={styles.homeBody}>
              不用先選時間，也不用先決定去哪裡。
              {'\n'}滑一下，讓下一步在路上出現。
            </Text>
          </View>

          <HybridSwipeStart onStart={() => void controller.start()} />

          <Text style={styles.versionLabel}>HYBRID EXPERIMENT V0</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.phase === 'starting') {
    return (
      <SafeAreaView style={styles.shell}>
        <View style={styles.centerContent}>
          <Text style={styles.eyebrow}>DETOUR / HYBRID</Text>
          <Text style={styles.loadingTitle}>正在找下一段路。</Text>
          <Text style={styles.loadingBody}>
            不用先決定終點，只處理眼前這一段。
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.phase === 'walking') {
    return (
      <SafeAreaView style={styles.shell}>
        <View style={styles.walkContent}>
          <View>
            <Text style={styles.eyebrow}>現在</Text>
            {controller.decisionLabel && (
              <View style={styles.decisionRow}>
                <Text style={styles.decisionEyebrow}>HYBRID 選擇</Text>
                <Text style={styles.decisionLabel}>
                  {controller.decisionLabel}
                </Text>
              </View>
            )}
            <Text style={styles.instruction}>{controller.instruction}</Text>
            <Text style={styles.hint}>{controller.hint}</Text>
          </View>

          <View>
            <View style={styles.safetyCard}>
              <Text style={styles.safetyText}>
                只走看得到、原本就安全的路。不要為了指示穿越馬路或進入禁止區域。
              </Text>
            </View>
            <Text style={styles.progressLabel}>
              HYBRID · 第 {controller.segmentNumber} 段
            </Text>
            <View style={styles.buttonStack}>
              <ActionButton
                label="室內測試：模擬走一段"
                onPress={() => void controller.simulateSegment()}
                test
              />
              <ActionButton
                label="結束這趟"
                onPress={controller.finish}
                secondary
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.phase === 'chapter') {
    return (
      <SafeAreaView style={styles.shell}>
        <View style={styles.centerContent}>
          <Text style={styles.eyebrow}>這一段完成了</Text>
          <Text style={styles.chapterTitle}>要不要再岔一下？</Text>
          <Text style={styles.loadingBody}>
            下一個方向由 DETOUR 接手。
          </Text>
          <View style={styles.buttonStack}>
            <ActionButton
              label="再走一段"
              onPress={() => void controller.continueChapter()}
            />
            <ActionButton
              label="就到這裡"
              onPress={controller.finish}
              secondary
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (controller.phase === 'finished') {
    return (
      <SafeAreaView style={styles.shell}>
        <View style={styles.centerContent}>
          <Text style={styles.eyebrow}>DETOUR</Text>
          <Text style={styles.chapterTitle}>這趟就走到這裡。</Text>
          <Text style={styles.loadingBody}>
            先把這次的路留在身上。
          </Text>
          <ActionButton label="回到首頁" onPress={controller.resetToHome} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.centerContent}>
        <Text style={styles.eyebrow}>DETOUR / HYBRID</Text>
        <Text style={styles.chapterTitle}>這次沒有走成。</Text>
        <Text style={styles.loadingBody}>
          {controller.error ?? '請確認定位與網路後再試。'}
        </Text>
        <View style={styles.buttonStack}>
          <ActionButton
            label="重新開始"
            onPress={() => void controller.start()}
          />
          <ActionButton
            label="回到首頁"
            onPress={controller.resetToHome}
            secondary
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#101012',
  },
  homeContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 34,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  walkContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 34,
  },
  wordmark: {
    color: '#F5F0E8',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  eyebrow: {
    color: '#A9A29A',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 18,
    textTransform: 'uppercase',
  },
  homeTitle: {
    color: '#F5F0E8',
    fontSize: 46,
    fontWeight: '700',
    letterSpacing: -1.6,
    marginTop: 28,
  },
  homeBody: {
    color: '#A9A29A',
    fontSize: 18,
    lineHeight: 30,
    marginTop: 22,
  },
  loadingTitle: {
    color: '#F5F0E8',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 43,
  },
  chapterTitle: {
    color: '#F5F0E8',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
  },
  loadingBody: {
    color: '#A9A29A',
    fontSize: 17,
    lineHeight: 28,
    marginTop: 18,
  },
  decisionRow: {
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  decisionEyebrow: {
    color: '#A9A29A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  decisionLabel: {
    color: '#D9A85D',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  instruction: {
    color: '#F5F0E8',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.8,
    lineHeight: 58,
  },
  hint: {
    color: '#BDB5AA',
    fontSize: 18,
    lineHeight: 28,
    marginTop: 20,
  },
  safetyCard: {
    borderColor: '#3B3937',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  safetyText: {
    color: '#8F8A84',
    fontSize: 13,
    lineHeight: 20,
  },
  progressLabel: {
    color: '#6F6A65',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  swipeRail: {
    alignItems: 'center',
    backgroundColor: '#252427',
    borderColor: '#3A383B',
    borderRadius: 32,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  swipeLabel: {
    color: '#D7D1C8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  swipeHandle: {
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    top: 7,
    width: 48,
  },
  swipeArrow: {
    color: '#141316',
    fontSize: 25,
    fontWeight: '700',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    borderRadius: 24,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  secondaryButton: {
    backgroundColor: '#252427',
    borderColor: '#3A383B',
    borderWidth: 1,
  },
  testButton: {
    backgroundColor: '#D9A85D',
  },
  actionButtonLabel: {
    color: '#141316',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonLabel: {
    color: '#E2DCD3',
  },
  testButtonLabel: {
    color: '#141316',
  },
  pressed: {
    opacity: 0.72,
  },
  buttonStack: {
    gap: 12,
    marginTop: 32,
  },
  versionLabel: {
    color: '#57535A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
});
