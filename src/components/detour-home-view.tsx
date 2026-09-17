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
import MapView, { Circle, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useDetourHomeController } from '../hooks/use-detour-home-controller';
import type { SceneIssueReason, WalkingPace } from '../lib/app-model';
import { MOODS } from '../lib/app-model';
import { isAIEngineConfigured } from '../lib/ai-engine';
import { DETOUR_PLAYTEST_VERSION } from '../lib/playtest-analytics';
import { ticketSerial } from '../lib/detour-formatters';
import { styles } from '../styles/home-styles';
import { BONE, INK, MUTED, SIGNAL } from '../theme/detour-theme';
import { V45MoodIcon, V45Skyline } from './mood-visuals';
import {
  DetourAccentStroke,
  V45Ticket,
  DETOUR_TICKET_HEIGHT,
  DETOUR_TICKET_WIDTH,
} from './ticket-visuals';
import { CollectionStages } from './home/collection-stages';

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
    selectedTime,
    sliderDisplayMinutes,
    selectedMood,
    selectedColor,
    latitude,
    longitude,
    plan,
    selectedScene,
    navigationRoute,
    navigationBeatIndex,
    currentNavigationBeat,
    beatRemainingMeters,
    showNextBeatMap,
    setShowNextBeatMap,
    nextBeatSegment,
    arrowRotation,
    questPulse,
    isRerouting,
    replacementLoading,
    activeSideEvent,
    devMode,
    developerToolsUnlocked,
    photos,
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
    continueFromTime,
    chooseMood,
    continueFromMood,
    prepareDetourTicket,
    startDetour,
    simulateNextBeat,
    replaceActiveSideEvent,
    replaceFailedDestination,
    openCamera,
    completeDetour,
  } = controller;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const [ticketDisplayReady, setTicketDisplayReady] = useState(false);
  const completionIris = useRef(new Animated.Value(1)).current;
  const [completionIrisActive, setCompletionIrisActive] = useState(false);
  const [arrivalPhotoFinishPending, setArrivalPhotoFinishPending] = useState(false);
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

    await new Promise((resolve) => {
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
        {stage === 'boot' && (
          <View style={styles.bootScreen}>
            <Text style={styles.bootBrand}>DETOUR</Text>
          </View>
        )}

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

            <Text style={styles.v35HomeQuestion}>今天有多少時間，{`\n`}可以拿來偏離一下？</Text>
            <DetourAccentStroke width={126} style={styles.v35Underline} />
            <Animated.View
              style={[
                styles.v35MinuteReadout,
                {
                  paddingHorizontal: 18,
                  overflow: 'visible',
                  transform: [{ scale: minutePulse }],
                },
              ]}
            >
              <Text
                style={[
                  styles.v35MinuteNumber,
                  { letterSpacing: 0, paddingHorizontal: 5, overflow: 'visible' },
                ]}
              >
                {sliderDisplayMinutes}
              </Text>
              <Text style={styles.v35MinuteUnit}>分</Text>
            </Animated.View>

            <View
              style={[
                styles.v35SliderWrap,
                { height: 58, marginHorizontal: 20 },
              ]}
              onLayout={(event) => {
                timeSliderWidthRef.current = Math.max(1, event.nativeEvent.layout.width);
              }}
              {...timeSliderResponder.panHandlers}
            >
              <View
                style={[
                  styles.v35SliderRail,
                  { top: 15, height: 4, borderRadius: 2 },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v35SliderFill,
                  {
                    top: 15,
                    height: 4,
                    borderRadius: 2,
                    width: timeSliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
              <Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: -2,
                  top: 32,
                  fontSize: 12,
                  fontWeight: '800',
                  color: MUTED,
                }}
              >
                10
              </Text>
              <Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -2,
                  top: 32,
                  fontSize: 12,
                  fontWeight: '800',
                  color: MUTED,
                }}
              >
                60
              </Text>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v35SliderThumb,
                  {
                    top: 0,
                    width: 34,
                    height: 34,
                    marginLeft: -17,
                    borderRadius: 17,
                    borderWidth: 1,
                    shadowOpacity: 0.12,
                    left: timeSliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              >
                <View
                  style={[
                    styles.v35SliderThumbCore,
                    { width: 22, height: 22, borderRadius: 11 },
                  ]}
                />
              </Animated.View>
            </View>

            <Pressable onPress={continueFromTime} style={styles.v35TicketButton}>
              <View style={styles.v35TicketNotchLeft} />
              <View style={styles.v35TicketNotchRight} />
              <Text style={styles.v35TicketArrow}>→</Text>
              <Text style={styles.v35TicketText}>開始 {sliderDisplayMinutes} 分鐘的旅程</Text>
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
                onPress={startDetour}
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
        )}

        {stage === 'journey' && plan && navigationRoute && currentNavigationBeat && (
          <View style={styles.v35JourneyScreen}>
            <View style={styles.v35JourneyTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v35JourneyBack}>
                <Text style={styles.v35JourneyBackText}>←</Text>
              </Pressable>
              <Text style={styles.v35JourneyBrand}>DETOUR</Text>
              <View style={styles.v35JourneyProgress}>
                {Array.from({ length: 5 }, (_, index) => {
                  const progress =
                    navigationRoute.beats.length <= 1
                      ? 0
                      : navigationBeatIndex / (navigationRoute.beats.length - 1);
                  const current = Math.min(4, Math.round(progress * 4));
                  return (
                    <View key={index} style={styles.v35JourneyProgressItem}>
                      <View
                        style={[
                          styles.v35JourneyProgressDot,
                          index < current && styles.v35JourneyProgressDone,
                          index === current && styles.v35JourneyProgressCurrent,
                        ]}
                      />
                      {index < 4 && <View style={styles.v35JourneyProgressLine} />}
                    </View>
                  );
                })}
                <Text style={styles.v35JourneyFlag}>⚑</Text>
              </View>
            </View>

            {showNextBeatMap && latitude !== null && longitude !== null ? (
              <View style={styles.v35JourneyMapWrap}>
                <MapView
                  style={styles.v35JourneyMap}
                  initialRegion={{
                    latitude: (latitude + currentNavigationBeat.point.latitude) / 2,
                    longitude: (longitude + currentNavigationBeat.point.longitude) / 2,
                    latitudeDelta: 0.0022,
                    longitudeDelta: 0.0022,
                  }}
                  showsUserLocation
                  showsMyLocationButton={false}
                  showsCompass={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Polyline coordinates={nextBeatSegment} strokeColor={SIGNAL} strokeWidth={5} lineCap="round" />
                  <Circle center={currentNavigationBeat.point} radius={10} strokeColor={BONE} strokeWidth={1} fillColor={SIGNAL} />
                </MapView>
                <Pressable onPress={() => setShowNextBeatMap(false)} style={styles.v35JourneyMapClose}>
                  <Text style={styles.v35JourneyMapCloseText}>×</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.v35JourneyHero}>
                <Pressable onPress={() => setShowNextBeatMap(true)} style={styles.v35Compass}>
                  <View style={styles.v35CompassTicks} />
                  <View style={{ transform: [{ rotate: `${arrowRotation}deg` }] }}>
                    <Text style={styles.v35CompassArrow}>↑</Text>
                  </View>
                </Pressable>
                <Text style={styles.v35JourneyDistance}>
                  {Math.round(beatRemainingMeters)}
                  <Text style={styles.v35JourneyDistanceUnit}> m</Text>
                </Text>
                <Text style={styles.v35JourneyInstruction}>
                  {currentNavigationBeat.instruction || '先走這一段。'}
                </Text>

                {selectedMood !== 'color' && activeSideEvent && (
                  <View style={[styles.v41ActiveFind, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
                    <View style={styles.v41ActiveFindCopy}>
                      <Text style={styles.v41ActiveFindLabel}>
                        {activeSideEvent.kind === 'context' ? '小插曲' : '路上找找看'}
                      </Text>
                      <Text style={styles.v41ActiveFindTitle}>{activeSideEvent.title}</Text>
                      {activeSideEvent.instruction ? (
                        <Text style={{ marginTop: 5, color: BONE, opacity: 0.72, fontSize: 13 }}>
                          {activeSideEvent.instruction}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      {activeSideEvent.photoSuggested && (
                        <Pressable onPress={() => openCamera('side')}>
                          <Text style={styles.v41ActiveFindAction}>拍下來 →</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={replaceActiveSideEvent}>
                        <Text style={{ color: BONE, opacity: 0.72, fontSize: 13, fontWeight: '700' }}>
                          沒感覺，換一個
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {selectedMood === 'color' && selectedColor && (
                  <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: selectedColor.hex, borderRadius: 999 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selectedColor.hex }} />
                    <Text style={{ color: BONE, fontSize: 15, fontWeight: '800' }}>
                      今天找{selectedColor.label} · 看到就拍
                    </Text>
                  </View>
                )}
                {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}
              </View>
            )}

            {questPulse && (
              <View pointerEvents="none" style={styles.v35QuestPulse}>
                <Text style={styles.v35QuestPulseText}>
                  {questPulse === 'side' ? '新的小插曲' : '到終點了'}
                </Text>
              </View>
            )}

            <View style={styles.v35JourneyBottom}>
              <Pressable
                onPress={() => setShowNextBeatMap((value) => !value)}
                style={styles.v35JourneyPrimary}
              >
                <Text style={styles.v35JourneyPrimaryArrow}>{showNextBeatMap ? '↙' : '↗'}</Text>
                <View style={styles.v35JourneyPrimaryDivider} />
                <Text style={styles.v35JourneyPrimaryText}>{showNextBeatMap ? '收起地圖' : '小地圖'}</Text>
              </Pressable>
              <Pressable onPress={() => openCamera('free')} style={styles.v35JourneyCamera}>
                <Text style={styles.v35JourneyCameraText}>◎</Text>
              </Pressable>
              {devMode && (
                <Pressable onPress={simulateNextBeat} style={styles.v41DevAdvance}>
                  <Text style={styles.v41DevAdvanceText}>室內測試 · 下一段 →</Text>
                </Pressable>
              )}
            </View>
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
