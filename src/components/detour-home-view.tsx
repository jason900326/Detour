import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import MapView, { Circle, Polygon, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useDetourHomeController } from '../hooks/use-detour-home-controller';
import { isAIEngineConfigured } from '../lib/ai-engine';
import type { SceneIssueReason, WalkingPace } from '../lib/app-model';
import { MOODS } from '../lib/app-model';
import { ticketSerial } from '../lib/detour-formatters';
import { offsetPoint } from '../lib/navigation-engine';
import { DETOUR_PLAYTEST_VERSION } from '../lib/playtest-analytics';
import { styles } from '../styles/home-styles';
import { BONE, INK, MUTED, SIGNAL } from '../theme/detour-theme';
import { CollectionStages } from './home/collection-stages';
import { V45MoodIcon, V45Skyline } from './mood-visuals';
import { SideEventPaper } from './side-event-paper';
import {
  DETOUR_TICKET_HEIGHT,
  DETOUR_TICKET_WIDTH,
  DetourAccentStroke,
  V45Ticket,
} from './ticket-visuals';

function navigationInstructionLabel(turn: string) {
  if (turn === 'left') return '下一個路口左轉';
  if (turn === 'right') return '下一個路口右轉';
  if (turn === 'slight-left') return '下一個路口往左前方';
  if (turn === 'slight-right') return '下一個路口往右前方';
  if (turn === 'arrive') return '快到了';
  return '繼續直走';
}

function formatElapsedJourneyTime(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatRecoveryTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '剛剛';
  return date.toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function headingSectorCoordinates(center: { latitude: number; longitude: number }, heading: number) {
  const safeHeading = Number.isFinite(heading) ? heading : 0;
  const tip = offsetPoint(center, 54, safeHeading);
  const left = offsetPoint(center, 40, safeHeading - 25);
  const right = offsetPoint(center, 40, safeHeading + 25);
  return [left, tip, right];
}

export function DetourHomeView({
  controller,
}: {
  controller: ReturnType<typeof useDetourHomeController>;
}) {
  const {
    stage,
    preferences,
    onboardingStep,
    onboardingFromSettings,
    ticketBuildError,
    setTicketBuildError,
    directStartActive,
    selectedTime,
    sliderDisplayMinutes,
    selectedMood,
    selectedColor,
    latitude,
    longitude,
    plan,
    selectedScene,
    navigationRoute,
    currentNavigationBeat,
    deviceHeading,
    nextBeatSegment,
    questPulse,
    elapsedJourneySeconds,
    isRerouting,
    replacementLoading,
    activeSideEvent,
    sideEventPhotoConfirmed,
    devMode,
    developerToolsUnlocked,
    photos,
    recoverySnapshot,
    recoveryLoading,
    passport,
    playtestSessions,
    playtestTesterId,
    playtestSyncing,
    lastAIResult,
    aiConnectionTesting,
    screenOpacity,
    screenY,
    routeProgress,
    markTicketVisualReady,
    ticketStamp,
    ticketReadyUnlocked,
    timeSliderProgress,
    timeSliderWidthRef,
    minutePulse,
    homeEntrance,
    mood,
    edgeBackResponder,
    goBack,
    nextOnboardingStep,
    transitionTo,
    toggleDeveloperTools,
    toggleDevMode,
    setWalkingPace,
    toggleNightRoutePreference,
    replayOnboarding,
    clearPassport,
    runAIConnectionTest,
    syncPlaytestDataNow,
    sharePlaytestData,
    clearPlaytestData,
    timeSliderResponder,
    startDirectDetour,
    chooseMood,
    continueFromMood,
    prepareDetourTicket,
    startDetour,
    acknowledgeActiveSideEvent,
    replaceActiveSideEvent,
    replaceFailedDestination,
    openCamera,
    simulateNextBeat,
    continueRecoveredJourney,
    discardRecoveredJourney,
    completeDetour,
  } = controller;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const [ticketDisplayReady, setTicketDisplayReady] = useState(false);
  const completionIris = useRef(new Animated.Value(1)).current;
  const [completionIrisActive, setCompletionIrisActive] = useState(false);
  const [arrivalPhotoFinishPending, setArrivalPhotoFinishPending] = useState(false);
  const [liveAlbumVisible, setLiveAlbumVisible] = useState(false);
  const [journeyMapVisible, setJourneyMapVisible] = useState(false);
  const arrivalPhotoStartCountRef = useRef(0);

  const printingLayout = useMemo(() => {
    const baseSidePadding = 30;
    const leftPadding = baseSidePadding + safeAreaInsets.left;
    const rightPadding = baseSidePadding + safeAreaInsets.right;
    const topPadding = Math.max(24, safeAreaInsets.top + 10);
    const bottomPadding = Math.max(24, safeAreaInsets.bottom + 12);
    const availableWidth = Math.max(1, windowWidth - leftPadding - rightPadding);
    const printerWidth = Math.min(availableWidth, 420);
    const slotWidth = Math.max(1, printerWidth - 6);
    const paperExitTop = 6;
    const chromeAndPrinterTop = 48 + 48 + 67 + 12 + paperExitTop;
    const tearHintReserve = 52 + bottomPadding;
    const maxPaperHeight = Math.max(
      1,
      windowHeight - topPadding - chromeAndPrinterTop - tearHintReserve
    );
    const ticketAspect = DETOUR_TICKET_HEIGHT / DETOUR_TICKET_WIDTH;
    const maxRailWidthByHeight =
      maxPaperHeight / Math.max(0.95 * ticketAspect, 0.001);
    const railWidth = Math.max(1, Math.min(slotWidth, maxRailWidthByHeight));
    const ticketWidth = railWidth * 0.95;
    const ticketHeight = ticketWidth * ticketAspect;

    return {
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      printerWidth,
      slotWidth,
      railWidth,
      ticketWidth,
      ticketHeight,
      paperExitTop,
      paperViewportHeight: ticketHeight + 2,
      assemblyHeight: paperExitTop + ticketHeight + 2,
    };
  }, [
    safeAreaInsets.bottom,
    safeAreaInsets.left,
    safeAreaInsets.right,
    safeAreaInsets.top,
    windowHeight,
    windowWidth,
  ]);

  const irisDiameter = Math.hypot(windowWidth, windowHeight) + 48;
  const irisRadius = irisDiameter / 2;
  const irisBorderWidth = completionIris.interpolate({
    inputRange: [0, 1],
    outputRange: [irisRadius, 0],
    extrapolate: 'clamp',
  });

  async function finishDetourWithIris(photoOverride = photos) {
    if (completionIrisActive) return;

    setArrivalPhotoFinishPending(false);
    setCompletionIrisActive(true);
    completionIris.stopAnimation();
    completionIris.setValue(1);

    await new Promise<void>((resolve) => {
      Animated.timing(completionIris, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => resolve());
    });

    try {
      await completeDetour(photoOverride);
    } catch {
      Animated.timing(completionIris, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => setCompletionIrisActive(false));
    }
  }

  useEffect(() => {
    if (stage === 'preparing') {
      setTicketDisplayReady(false);
    }
  }, [stage]);

  useEffect(() => {
    if (!arrivalPhotoFinishPending || stage !== 'arrival') return;
    if (photos.length <= arrivalPhotoStartCountRef.current) return;

    setArrivalPhotoFinishPending(false);
    void finishDetourWithIris(photos);
  }, [arrivalPhotoFinishPending, photos, stage]);

  useEffect(() => {
    if (!completionIrisActive || stage !== 'developing') return;
    const timer = setTimeout(() => transitionTo('finish'), 20);
    return () => clearTimeout(timer);
  }, [completionIrisActive, stage]);

  useEffect(() => {
    if (!completionIrisActive || stage !== 'finish') return;

    completionIris.stopAnimation();

    Animated.timing(completionIris, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setCompletionIrisActive(false);
      }
    });
  }, [completionIrisActive, stage]);

  const handleTicketVisualReady = () => {
    markTicketVisualReady();
    requestAnimationFrame(() => setTicketDisplayReady(true));
  };

  const chromeDark =
    stage === 'journey' || stage === 'developing' || completionIrisActive;

  return (
    <View style={[styles.app, chromeDark ? styles.appDark : styles.appLight]}>
      <StatusBar barStyle={chromeDark ? 'light-content' : 'dark-content'} />

      <Animated.View
        {...edgeBackResponder.panHandlers}
        style={[
          styles.animatedRoot,
          { opacity: screenOpacity, transform: [{ translateY: screenY }] },
        ]}
      >
        {recoverySnapshot ? (
          <View style={styles.v52RecoveryScreen}>
            <View style={styles.v52RecoveryTop}>
              <Text style={styles.v52RecoveryBrand}>DETOUR</Text>
              <Text style={styles.v52RecoveryEyebrow}>旅程還沒結束</Text>
            </View>

            <View style={styles.v52RecoveryHero}>
              <Text style={styles.v52RecoveryTitle}>要繼續上一趟嗎？</Text>
              <Text style={styles.v52RecoveryBody}>
                上次離開 App 時，這趟 DETOUR 還在進行中。你可以接著走，也可以結束這趟旅程重新開始。
              </Text>

              <View style={styles.v52RecoveryFacts}>
                <View style={styles.v52RecoveryFact}>
                  <Text style={styles.v52RecoveryFactLabel}>旅程開始</Text>
                  <Text style={styles.v52RecoveryFactValue}>
                    {formatRecoveryTimestamp(recoverySnapshot.detourStartedAt)}
                  </Text>
                </View>
                <View style={styles.v52RecoveryFact}>
                  <Text style={styles.v52RecoveryFactLabel}>已拍照片</Text>
                  <Text style={styles.v52RecoveryFactValue}>
                    {recoverySnapshot.photos.length} 張
                  </Text>
                </View>
              </View>

              {recoverySnapshot.photos[recoverySnapshot.photos.length - 1] && (
                <Image
                  source={{
                    uri: recoverySnapshot.photos[recoverySnapshot.photos.length - 1].uri,
                  }}
                  style={styles.v52RecoveryPhoto}
                />
              )}
            </View>

            <View style={styles.v52RecoveryActions}>
              <Pressable
                disabled={recoveryLoading}
                onPress={() => void continueRecoveredJourney()}
                style={[styles.v52RecoveryContinue, recoveryLoading && styles.v52RecoveryDisabled]}
              >
                <Text style={styles.v52RecoveryContinueText}>
                  {recoveryLoading ? '正在處理…' : '繼續上一趟'}
                </Text>
                <Text style={styles.v52RecoveryContinueArrow}>→</Text>
              </Pressable>
              <Pressable
                disabled={recoveryLoading}
                onPress={() => void discardRecoveredJourney()}
                style={styles.v52RecoveryDiscard}
              >
                <Text style={styles.v52RecoveryDiscardText}>結束這趟，重新開始</Text>
              </Pressable>
            </View>
          </View>
        ) : stage === 'boot' ? (
          <View style={styles.bootScreen}>
            <Text style={styles.bootBrand}>DETOUR</Text>
          </View>
        ) : null}

        {stage === 'onboarding' && (
          <View style={styles.onboardingScreen}>
            <View style={styles.onboardingTop}>
              {onboardingStep > 0 || onboardingFromSettings ? (
                <Pressable onPress={goBack} hitSlop={16} style={styles.onboardingBack}>
                  <Text style={styles.onboardingBackText}>←</Text>
                </Pressable>
              ) : (
                <View style={styles.onboardingBack} />
              )}
              <Text style={styles.onboardingBrand}>DETOUR</Text>
              <Text style={styles.onboardingCounter}>0{onboardingStep + 1} / 03</Text>
            </View>

            <View style={styles.onboardingHero}>
              {onboardingStep === 0 && (
                <>
                  <Text style={styles.onboardingEyebrow}>先選時間</Text>
                  <Text style={styles.onboardingTitle}>給我一點時間。{`\n`}剩下的我決定。</Text>
                  <Text style={styles.onboardingBody}>你只要選時間，還有這次想怎麼晃。</Text>
                </>
              )}
              {onboardingStep === 1 && (
                <>
                  <Text style={styles.onboardingEyebrow}>終點先保密</Text>
                  <Text style={styles.onboardingTitle}>終點先藏起來。</Text>
                  <Text style={styles.onboardingBody}>照方向走。真的看不懂，再打開那一小段地圖。</Text>
                </>
              )}
              {onboardingStep === 2 && (
                <>
                  <Text style={styles.onboardingEyebrow}>路上會有小插曲</Text>
                  <Text style={styles.onboardingTitle}>邊走，{`\n`}邊多看一點。</Text>
                  <Text style={styles.onboardingBody}>沒感覺就換一個，不用完成、不用交作業。</Text>
                </>
              )}
            </View>

            <Pressable onPress={nextOnboardingStep} style={styles.onboardingPrimary}>
              <Text style={styles.onboardingPrimaryText}>
                {onboardingStep === 2
                  ? onboardingFromSettings
                    ? '回到設定'
                    : '開始 DETOUR'
                  : '繼續'}
              </Text>
              <Text style={styles.onboardingPrimaryArrow}>→</Text>
            </Pressable>
          </View>
        )}

        {stage === 'settings' && (
          <View style={styles.settingsScreen}>
            <View style={styles.settingsTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.settingsBack}>
                <Text style={styles.settingsBackText}>←</Text>
              </Pressable>
              <Pressable onLongPress={toggleDeveloperTools} delayLongPress={900} hitSlop={10}>
                <Text style={styles.settingsBrand}>設定</Text>
              </Pressable>
              <Text style={styles.settingsMeta}>DETOUR</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsScroll}>
              <View style={styles.settingsHero}>
                <Text style={styles.settingsEyebrow}>調整步調</Text>
                <Text style={styles.settingsTitle}>讓 DETOUR{`\n`}更像你的步伐。</Text>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>步行節奏</Text>
                {([
                  ['relaxed', '慢一點', '同樣的空檔，少走一點。'],
                  ['normal', '一般', '目前 DETOUR 的預設節奏。'],
                  ['brisk', '快一點', '願意多走一點。'],
                ] as Array<[WalkingPace, string, string]>).map(([id, label, note]) => {
                  const active = preferences.walkingPace === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setWalkingPace(id)}
                      style={[styles.settingsChoice, active && styles.settingsChoiceActive]}
                    >
                      <View>
                        <Text style={styles.settingsChoiceLabel}>{label}</Text>
                        <Text style={styles.settingsChoiceNote}>{note}</Text>
                      </View>
                      <Text style={styles.settingsChoiceMark}>{active ? '●' : '○'}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>夜間路線</Text>
                <Pressable
                  onPress={toggleNightRoutePreference}
                  style={[
                    styles.settingsChoice,
                    preferences.preferLegibleRoutesAtNight && styles.settingsChoiceActive,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsChoiceLabel}>優先走明亮大路</Text>
                    <Text style={styles.settingsChoiceNote}>天黑後盡量避開無名小路。</Text>
                  </View>
                  <Text style={styles.settingsChoiceMark}>
                    {preferences.preferLegibleRoutesAtNight ? '●' : '○'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>開始導覽</Text>
                <Pressable onPress={replayOnboarding} style={styles.settingsAction}>
                  <View>
                    <Text style={styles.settingsActionTitle}>再看一次開始導覽</Text>
                    <Text style={styles.settingsActionNote}>不會清除旅程收藏或偏好。</Text>
                  </View>
                  <Text style={styles.settingsActionArrow}>→</Text>
                </Pressable>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>旅程資料</Text>
                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>已完成旅程</Text>
                  <Text style={styles.settingsDataValue}>{passport.length} 趟</Text>
                </View>
                <Pressable onPress={clearPassport} style={styles.settingsDanger}>
                  <Text style={styles.settingsDangerText}>清除已完成旅程</Text>
                </Pressable>
              </View>

              {developerToolsUnlocked && (
                <>
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionLabel}>開發者工具</Text>
                    <Pressable onPress={toggleDevMode} style={styles.settingsAction}>
                      <View>
                        <Text style={styles.settingsActionTitle}>室內測試</Text>
                        <Text style={styles.settingsActionNote}>真實 Scene / route，按按鈕模擬前進。</Text>
                      </View>
                      <Text style={styles.settingsActionState}>{devMode ? '開' : '關'}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionLabel}>AI 狀態</Text>
                    <View style={styles.settingsDataRow}>
                      <Text style={styles.settingsDataLabel}>AI 後端</Text>
                      <Text style={styles.settingsDataValue}>
                        {isAIEngineConfigured() ? 'CONFIGURED' : 'NOT CONNECTED'}
                      </Text>
                    </View>
                    <View style={styles.settingsDataRow}>
                      <Text style={styles.settingsDataLabel}>上次執行</Text>
                      <Text style={styles.settingsDataValue}>{lastAIResult.toUpperCase()}</Text>
                    </View>
                    <Pressable onPress={runAIConnectionTest} disabled={aiConnectionTesting} style={styles.settingsAction}>
                      <Text style={styles.settingsActionTitle}>
                        {aiConnectionTesting ? '正在測試 AI…' : '測試 AI 連線'}
                      </Text>
                      <Text style={styles.settingsActionArrow}>↗</Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionLabel}>測試資料</Text>
                    <View style={styles.settingsDataRow}>
                      <Text style={styles.settingsDataLabel}>測試裝置</Text>
                      <Text style={styles.settingsDataValue}>{playtestTesterId}</Text>
                    </View>
                    <View style={styles.settingsDataRow}>
                      <Text style={styles.settingsDataLabel}>測試次數</Text>
                      <Text style={styles.settingsDataValue}>{playtestSessions.length}</Text>
                    </View>
                    <View style={styles.settingsDataRow}>
                      <Text style={styles.settingsDataLabel}>雲端同步</Text>
                      <Text style={styles.settingsDataValue}>ON · v{DETOUR_PLAYTEST_VERSION}</Text>
                    </View>
                    <Pressable onPress={syncPlaytestDataNow} disabled={playtestSyncing} style={styles.settingsAction}>
                      <Text style={styles.settingsActionTitle}>{playtestSyncing ? '正在同步…' : '立即同步測試資料'}</Text>
                      <Text style={styles.settingsActionArrow}>↗</Text>
                    </Pressable>
                    <Pressable onPress={sharePlaytestData} style={styles.settingsAction}>
                      <Text style={styles.settingsActionTitle}>分享測試報告</Text>
                      <Text style={styles.settingsActionArrow}>↗</Text>
                    </Pressable>
                    <Pressable onPress={clearPlaytestData} style={styles.settingsDanger}>
                      <Text style={styles.settingsDangerText}>清除測試統計</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'time' && (
          <View style={styles.v35HomeScreen}>
            <View style={styles.v35TopBar}>
              <View>
                <Text style={styles.v35Brand}>DETOUR</Text>
                <View style={styles.v35BrandSlash} />
              </View>
              <Pressable onPress={() => transitionTo('settings')} style={styles.v35MenuButton}>
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLineShort} />
              </Pressable>
            </View>

            <Animated.View style={[styles.v35RouteSketch, { opacity: homeEntrance }]}>
              <Image
                source={require('../../assets/detour/home-hero-route.png')}
                style={styles.v46HomeHeroRoute}
                resizeMode="contain"
              />
            </Animated.View>

            <Text style={styles.v35HomeQuestion}>現在有一段空檔嗎？{`\n`}直接走一段。</Text>
            <DetourAccentStroke width={126} style={styles.v35Underline} />
            <View style={{ flex: 1 }} />

            <Pressable onPress={() => void startDirectDetour()} style={styles.v35TicketButton}>
              <View style={styles.v35TicketNotchLeft} />
              <View style={styles.v35TicketNotchRight} />
              <Text style={styles.v35TicketArrow}>→</Text>
              <Text style={styles.v35TicketText}>開始走一段</Text>
              <View style={styles.v35TicketDivider} />
              <Text style={styles.v35TicketMark}>▰</Text>
            </Pressable>

            <Pressable onPress={() => transitionTo('passport')} style={styles.v35CompletedButton}>
              <Text style={styles.v35CompletedText}>已完成的旅程</Text>
              <View style={styles.v35CompletedCount}>
                <Text style={styles.v35CompletedCountText}>{passport.length}</Text>
              </View>
              <Text style={styles.v35CompletedArrow}>→</Text>
            </Pressable>
          </View>
        )}

        {stage === 'mood' && (
          <View style={styles.v45MoodScreen}>
            <View style={styles.v45MoodHeader}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v45BackButton}>
                <Text style={styles.v45BackText}>‹</Text>
              </Pressable>
              <Text style={styles.v45MoodBrand}>DETOUR</Text>
              <View style={styles.v45TimePill}>
                <Text style={styles.v45TimePillIcon}>◷</Text>
                <Text style={styles.v45TimePillText}>{selectedTime} 分</Text>
              </View>
            </View>

            <View style={styles.v45MoodTitleWrap}>
              <Text style={styles.v45MoodTitle}>今天想要哪種心情？</Text>
              <DetourAccentStroke width={180} style={styles.v45MoodUnderline} />
            </View>

            <View style={styles.v45MoodGrid}>
              {MOODS.map((item) => {
                const active = selectedMood === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => chooseMood(item.id)}
                    style={({ pressed }) => [
                      styles.v45MoodCard,
                      item.id === 'wander'
                        ? styles.v45MoodCardHero
                        : styles.v45MoodCardSecondary,
                      active && styles.v45MoodCardActive,
                      pressed && styles.v45MoodCardPressed,
                    ]}
                  >
                    <V45MoodIcon
                      moodId={item.id}
                      size={item.id === 'wander' ? 92 : 72}
                    />
                    <Text style={styles.v45MoodLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={!selectedMood}
              onPress={continueFromMood}
              style={[styles.v45MoodCta, !selectedMood && styles.v45MoodCtaDisabled]}
            >
              <View style={styles.v45TicketNotchLeft} />
              <View style={styles.v45TicketNotchRight} />
              <Text style={styles.v45MoodCtaText}>{selectedMood ? '出發吧！' : '選一個心情'}</Text>
              <View style={styles.v45MoodCtaDivider} />
              <Text style={styles.v45MoodCtaArrow}>→</Text>
            </Pressable>
            <V45Skyline />
          </View>
        )}

        {(stage === 'preparing' || stage === 'ready') && (
          directStartActive ? (
            <View style={styles.v45PrintingScreen}>
              <View style={styles.v48PrintingTopBar}>
                <View style={{ width: 36 }} />
                <Text style={styles.v45PrintingBrand}>DETOUR</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
                <Text style={styles.v45PrintingTitle}>正在找一條可以走的路⋯</Text>
                <Text style={[styles.v48RetryBody, { textAlign: 'center', marginTop: 16 }]}>
                  不用選擇，找到後直接出發。
                </Text>
              </View>
              <Modal visible={Boolean(ticketBuildError)} transparent animationType="fade" onRequestClose={goBack}>
                <View style={styles.v48RetryOverlay}>
                  <View style={styles.v48RetryCard}>
                    <Text style={styles.v48RetryEyebrow}>找路失敗</Text>
                    <Text style={styles.v48RetryTitle}>這趟還沒準備好。</Text>
                    <Text style={styles.v48RetryBody}>{ticketBuildError}</Text>
                    <Pressable
                      onPress={() => {
                        routeProgress.setValue(0);
                        setTicketBuildError(null);
                        void prepareDetourTicket();
                      }}
                      style={styles.v48RetryPrimary}
                    >
                      <Text style={styles.v48RetryPrimaryText}>再試一次</Text>
                      <Text style={styles.v48RetryPrimaryArrow}>→</Text>
                    </Pressable>
                  </View>
                </View>
              </Modal>
            </View>
          ) : (
          <View
            style={[
              styles.v45PrintingScreen,
              {
                paddingTop: printingLayout.topPadding,
                paddingLeft: printingLayout.leftPadding,
                paddingRight: printingLayout.rightPadding,
              },
            ]}
          >
            <View style={styles.v48PrintingTopBar}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v48PrintingBack}>
                <Text style={styles.v48PrintingBackText}>‹</Text>
              </Pressable>
              <Text style={styles.v45PrintingBrand}>DETOUR</Text>
            </View>
            <View
              style={[
                styles.v45PrintingTitleWrap,
                styles.v48PrintingTitleWrap,
                { minHeight: 72 },
              ]}
            >
              <Text style={styles.v45PrintingTitle}>
                {stage === 'ready' ? '車票完成' : '出票中⋯'}
              </Text>
              <DetourAccentStroke width={180} style={styles.v45PrintingUnderline} />
            </View>

            <View
              style={[
                styles.v48PrinterAssembly,
                {
                  width: printingLayout.printerWidth,
                  height: printingLayout.assemblyHeight,
                  alignSelf: 'center',
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.v50PrinterRearRail,
                  { width: printingLayout.railWidth },
                ]}
              />
              <Animated.View
                style={[
                  styles.v48PaperViewport,
                  {
                    top: printingLayout.paperExitTop,
                    width: printingLayout.railWidth,
                    height: routeProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, printingLayout.paperViewportHeight],
                    }),
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.v48PaperTrack,
                    {
                      width: printingLayout.railWidth,
                      alignItems: 'center',
                      opacity: ticketDisplayReady ? 1 : 0,
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 0.72, 1],
                            outputRange: [0, 0, 2],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <V45Ticket
                    timeLabel={selectedTime ?? '10'}
                    moodId={selectedMood ?? 'wander'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                    stamped={stage === 'ready'}
                    stampProgress={ticketStamp}
                    renderWidth={printingLayout.ticketWidth}
                    onVisualReady={handleTicketVisualReady}
                  />
                </Animated.View>
              </Animated.View>
              <View
                pointerEvents="none"
                style={[
                  styles.v50PrinterSlotOnly,
                  { width: printingLayout.railWidth },
                ]}
              />
            </View>

            {stage === 'ready' && ticketReadyUnlocked && (
              <Pressable
                onPress={() => void startDetour()}
                style={[
                  styles.v48DepartButton,
                  {
                    left: printingLayout.leftPadding,
                    right: printingLayout.rightPadding,
                    bottom: printingLayout.bottomPadding,
                  },
                ]}
              >
                <Text style={styles.v48DepartButtonText}>出發</Text>
                <Text style={styles.v48DepartButtonArrow}>→</Text>
              </Pressable>
            )}

            <Modal visible={Boolean(ticketBuildError)} transparent animationType="fade" onRequestClose={goBack}>
              <View style={styles.v48RetryOverlay}>
                <View style={styles.v48RetryCard}>
                  <Text style={styles.v48RetryEyebrow}>出票失敗</Text>
                  <Text style={styles.v48RetryTitle}>這張票卡住了。</Text>
                  <Text style={styles.v48RetryBody}>{ticketBuildError}</Text>
                  <Pressable
                    onPress={() => {
                      routeProgress.setValue(0);
                      setTicketBuildError(null);
                      void prepareDetourTicket();
                    }}
                    style={styles.v48RetryPrimary}
                  >
                    <Text style={styles.v48RetryPrimaryText}>再試一次</Text>
                    <Text style={styles.v48RetryPrimaryArrow}>→</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </View>
          )
        )}

        {stage === 'journey' && plan && navigationRoute && currentNavigationBeat && (
          <View style={styles.v35JourneyScreen}>
            <View style={styles.v35JourneyTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v35JourneyBack}>
                <Text style={styles.v35JourneyBackText}>←</Text>
              </Pressable>
              <Text style={styles.v35JourneyBrand}>DETOUR</Text>
              <Text style={styles.v35JourneyTimer}>
                {formatElapsedJourneyTime(elapsedJourneySeconds)}
              </Text>
            </View>

            <View style={styles.v35JourneyHero}>
              {selectedMood !== 'color' && activeSideEvent && (
                <View style={styles.v35JourneySideEventWrap}>
                  <SideEventPaper
                    event={activeSideEvent}
                    onFound={() => openCamera('side')}
                    onCompleted={acknowledgeActiveSideEvent}
                    photoConfirmed={sideEventPhotoConfirmed}
                    onReplace={replaceActiveSideEvent}
                  />
                </View>
              )}

              <View style={styles.v35JourneyInstructionBlock}>
                <View style={styles.v35JourneyInstructionRule} />
                <View style={styles.v35JourneyInstructionCopy}>
                  <Text style={styles.v35JourneyInstructionEyebrow}>接下來</Text>
                  <Text style={styles.v35JourneyInstruction}>
                    {navigationInstructionLabel(currentNavigationBeat.turn)}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="查看路線"
                onPress={() => setJourneyMapVisible(true)}
                style={({ pressed }) => [
                  styles.nextBeatMapButton,
                  pressed && styles.nextBeatMapButtonPressed,
                ]}
              >
                <View style={styles.nextBeatMapButtonCopy}>
                  <Text style={styles.nextBeatMapButtonEyebrow}>需要方向？</Text>
                  <Text style={styles.nextBeatMapButtonText}>查看路線</Text>
                </View>
                <Text style={styles.nextBeatMapButtonArrow}>↗</Text>
              </Pressable>

              {selectedMood === 'color' && selectedColor && (
                <View style={styles.v35JourneyColorHint}>
                  <View
                    style={[
                      styles.v35JourneyColorDot,
                      { backgroundColor: selectedColor.hex },
                    ]}
                  />
                  <Text style={styles.v35JourneyColorText}>
                    今天找{selectedColor.label} · 看到就拍
                  </Text>
                </View>
              )}
                {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}
            </View>

            {questPulse === 'final' && (
              <View pointerEvents="none" style={styles.v35QuestPulse}>
                <Text style={styles.v35QuestPulseText}>
                  到終點了
                </Text>
              </View>
            )}

            <View style={styles.v35JourneyBottom}>
              <Pressable onPress={() => openCamera('free')} style={styles.v35JourneyCamera}>
                <Text style={styles.v35JourneyCameraIcon}>📷</Text>
                <Text style={styles.v35JourneyCameraText}>拍照</Text>
                <Text style={styles.v35JourneyCameraArrow}>→</Text>
              </Pressable>
              {photos.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="開啟即時相簿"
                  onPress={() => setLiveAlbumVisible(true)}
                  style={({ pressed }) => [
                    styles.v35JourneyAlbum,
                    pressed && styles.v35JourneyAlbumPressed,
                  ]}
                >
                  <Image
                    source={{ uri: photos[photos.length - 1].uri }}
                    style={styles.v35JourneyAlbumImage}
                  />
                  {photos.length > 1 && (
                    <View style={styles.v35JourneyAlbumCount}>
                      <Text style={styles.v35JourneyAlbumCountText}>{photos.length}</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>

            {devMode && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="室內模式，走一段路"
                onPress={() => void simulateNextBeat()}
                style={({ pressed }) => [
                  styles.v35DevAdvance,
                  pressed && styles.v35JourneyPressed,
                ]}
              >
                <Text style={styles.v35DevAdvanceText}>室內模式，走一段路</Text>
              </Pressable>
            )}

            <Modal
              visible={liveAlbumVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setLiveAlbumVisible(false)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉即時相簿"
                onPress={() => setLiveAlbumVisible(false)}
                style={styles.v35JourneyAlbumOverlay}
              >
                <Pressable
                  onPress={(event) => event.stopPropagation()}
                  style={styles.v35JourneyAlbumCard}
                >
                  <View style={styles.v35JourneyAlbumHeader}>
                    <View>
                      <Text style={styles.v35JourneyAlbumTitle}>即時相簿</Text>
                      <Text style={styles.v35JourneyAlbumMeta}>{photos.length} 張照片</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="關閉"
                      onPress={() => setLiveAlbumVisible(false)}
                      style={styles.v35JourneyAlbumClose}
                    >
                      <Text style={styles.v35JourneyAlbumCloseText}>×</Text>
                    </Pressable>
                  </View>
                  <View style={styles.v35JourneyAlbumGrid}>
                    {photos
                      .slice(-6)
                      .reverse()
                      .map((photo) => (
                        <Image
                          key={photo.id}
                          source={{ uri: photo.uri }}
                          style={styles.v35JourneyAlbumGridImage}
                        />
                      ))}
                    {Array.from({ length: Math.max(0, 6 - photos.length) }).map((_, index) => (
                      <View key={`empty-${index}`} style={styles.v35JourneyAlbumGridEmpty} />
                    ))}
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            <Modal
              visible={journeyMapVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setJourneyMapVisible(false)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉路線地圖"
                onPress={() => setJourneyMapVisible(false)}
                style={styles.v35JourneyAlbumOverlay}
              >
                <Pressable
                  onPress={(event) => event.stopPropagation()}
                  style={styles.v35JourneyAlbumCard}
                >
                  <View style={styles.v35JourneyAlbumHeader}>
                    <View>
                      <Text style={styles.v35JourneyAlbumTitle}>這一段路線</Text>
                      <Text style={styles.v35JourneyAlbumMeta}>
                        {navigationInstructionLabel(currentNavigationBeat.turn)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="關閉路線地圖"
                      onPress={() => setJourneyMapVisible(false)}
                      style={styles.v35JourneyAlbumClose}
                    >
                      <Text style={styles.v35JourneyAlbumCloseText}>×</Text>
                    </Pressable>
                  </View>

                  {latitude !== null && longitude !== null ? (
                    <View
                      style={[
                        styles.v35JourneyMapWrap,
                        { height: 360, marginBottom: 0, borderRadius: 16 },
                      ]}
                    >
                      <MapView
                        style={styles.v35JourneyMap}
                        mapType="standard"
                        initialRegion={{
                          latitude: (latitude + currentNavigationBeat.point.latitude) / 2,
                          longitude: (longitude + currentNavigationBeat.point.longitude) / 2,
                          latitudeDelta: 0.0022,
                          longitudeDelta: 0.0022,
                        }}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                      >
                        <Polygon
                          coordinates={headingSectorCoordinates(
                            { latitude, longitude },
                            deviceHeading
                          )}
                          fillColor="rgba(30, 135, 255, 0.28)"
                          strokeColor="rgba(30, 135, 255, 0.5)"
                          strokeWidth={1}
                        />
                        <Circle
                          center={{ latitude, longitude }}
                          radius={8}
                          strokeColor="#FFFFFF"
                          strokeWidth={2}
                          fillColor="#1683FF"
                        />
                        <Polyline
                          coordinates={nextBeatSegment}
                          strokeColor={SIGNAL}
                          strokeWidth={5}
                          lineCap="round"
                        />
                        <Circle
                          center={currentNavigationBeat.point}
                          radius={10}
                          strokeColor={BONE}
                          strokeWidth={1}
                          fillColor={SIGNAL}
                        />
                      </MapView>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.v35JourneyMapPlaceholder,
                        { height: 360, marginBottom: 0, borderRadius: 16 },
                      ]}
                    />
                  )}
                </Pressable>
              </Pressable>
            </Modal>
          </View>
        )}

        {stage === 'arrival' && plan && (
          <View style={styles.cleanArrivalScreen}>
            <View style={styles.cleanArrivalTop}>
              <Text style={styles.brand}>DETOUR</Text>
              <Text style={[styles.cleanArrivalMeta, styles.v41ReadableMeta]}>
                {selectedScene?.label ?? '抵達'}
              </Text>
            </View>
            <View style={styles.cleanArrivalHero}>
              <Text style={[styles.cleanArrivalKicker, styles.v41ReadableKicker]}>到了</Text>
              <Text style={styles.cleanArrivalPlace}>{selectedScene?.name ?? '終點'}</Text>
              <Text style={styles.cleanArrivalMission}>{plan.arrivalMission.title}</Text>
              <Text style={[styles.cleanArrivalInstruction, styles.v41ReadableBody]}>
                {plan.arrivalMission.instruction}
              </Text>
            </View>

            <View style={styles.cleanArrivalBottom}>
              <View style={styles.cleanArrivalActions}>
                <Pressable
                  onPress={() => {
                    arrivalPhotoStartCountRef.current = photos.length;
                    setArrivalPhotoFinishPending(true);
                    void openCamera('arrival');
                  }}
                  style={[styles.cleanArrivalPrimary, styles.cleanArrivalPrimaryFlexible]}
                >
                  <Text style={styles.cleanArrivalPrimaryText}>拍最後一張</Text>
                  <Text style={{ fontSize: 23 }}>📷</Text>
                </Pressable>

                <Pressable
                  onPress={() => void finishDetourWithIris()}
                  style={[
                    styles.cleanArrivalCamera,
                    {
                      width: 112,
                      paddingHorizontal: 13,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderColor: INK,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '900',
                      color: INK,
                    }}
                  >
                    完成
                  </Text>
                  <Text
                    style={{
                      fontSize: 24,
                      lineHeight: 26,
                      color: INK,
                    }}
                  >
                    →
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={() => transitionTo('sceneIssue')} style={styles.cleanArrivalProblem}>
                <Text style={styles.cleanArrivalProblemText}>這裡不行</Text>
                <Text style={styles.cleanArrivalProblemArrow}>→</Text>
              </Pressable>
              <Text style={[styles.cleanArrivalSource, styles.v41ReadableMeta]}>地圖資料：OpenStreetMap</Text>
            </View>
          </View>
        )}

        {stage === 'sceneIssue' && (
          <View style={styles.reissueScreen}>
            <View style={styles.reissueTop}>
              <Pressable disabled={replacementLoading} onPress={goBack} hitSlop={16} style={styles.reissueBack}>
                <Text style={styles.reissueBackText}>←</Text>
              </Pressable>
              <Text style={styles.reissueBrand}>DETOUR</Text>
              <Text style={styles.reissueMeta}>換一條</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reissueScroll}>
              <View style={styles.reissueHero}>
                <Text style={styles.reissueEyebrow}>這個終點不行</Text>
                <Text style={styles.reissueTitle}>沒關係。{`\n`}改走另一條。</Text>
                <Text style={styles.reissueBody}>從你現在的位置換一個終點；已走過的路和照片都會保留。</Text>
              </View>

              <Text style={styles.reissueChoiceLabel}>為什麼要換？</Text>
              <View style={styles.reissueGrid}>
                {([
                  ['closed', '01', '沒開 / 已打烊', '這個時間不成立', '○'],
                  ['inaccessible', '02', '找不到 / 進不去', '現場無法抵達', '↗'],
                  ['not-worth-it', '03', '到現場覺得不值得', '這裡不夠有趣', '−'],
                  ['wrong-now', '04', '我現在不想去這裡', '不是現在想要的', '↝'],
                ] as Array<[SceneIssueReason, string, string, string, string]>).map(
                  ([id, index, title, note, mark]) => (
                    <Pressable
                      key={id}
                      disabled={replacementLoading}
                      onPress={() => replaceFailedDestination(id)}
                      style={styles.reissueChoice}
                    >
                      <View style={styles.reissueChoiceTop}>
                        <Text style={styles.reissueChoiceMark}>{mark}</Text>
                        <Text style={styles.reissueChoiceIndex}>{index}</Text>
                      </View>
                      <Text style={styles.reissueChoiceTitle}>{title}</Text>
                      <Text style={styles.reissueChoiceNote}>{note}</Text>
                    </Pressable>
                  ))}
              </View>

              {replacementLoading && (
                <View style={styles.reissueLoadingCard}>
                  <View style={styles.reissueLoadingDot} />
                  <Text style={styles.reissueLoadingText}>正在重新派發一條能在剩餘時間內完成的路線…</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        <CollectionStages controller={controller} />
      </Animated.View>

      {completionIrisActive && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 9999,
          }}
        >
          <Animated.View
            style={{
              width: irisDiameter,
              height: irisDiameter,
              borderRadius: irisRadius,
              borderColor: INK,
              borderWidth: irisBorderWidth,
              backgroundColor: 'transparent',
            }}
          />
        </View>
      )}
    </View>
  );
}
