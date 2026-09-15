import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  PixelRatio,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Directory, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Circle, Polyline } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildJourneyPlan,
  COLORS,
  getJourneyProfile,
  getLightContext,
  type ColorChoice,
  type GeoPoint,
  type JourneyPlan,
  type LightContext,
  type Mission,
  type MoodId,
} from '../lib/journey-engine';

import {
  buildNavigationRouteFromPolyline,
  distanceToPolyline,
  guidanceBearingOnPolyline,
  moveToward,
  relativeArrowDegrees,
  remainingDistanceOnPolyline,
  type NavigationRoute,
} from '../lib/navigation-engine';

import {
  buildSceneArrivalMission,
  findSceneCandidates,
  type SceneCandidate,
} from '../lib/scene-engine';

import {
  generateJourneyWithAI,
  isAIEngineConfigured,
  rankSceneCandidatesWithAI,
  testAIEngineConnection,
} from '../lib/ai-engine';

import {
  fetchWalkingRoute,
  prewarmWalkingRoutes,
  resolveRoutedScene,
  type WalkingRoute,
} from '../lib/routing-engine';

import {
  loadSceneFeedback,
  saveSceneFeedback,
  type SceneFeedbackKind,
} from '../lib/scene-feedback';

import {
  buildPlaytestReport,
  clearPlaytestSessions,
  createPlaytestSession,
  DETOUR_PLAYTEST_VERSION,
  getPlaytestTesterId,
  loadPlaytestSessions,
  syncAllPlaytestSessions,
  updatePlaytestSession,
  type PlaytestFeedbackReason,
  type PlaytestRating,
  type PlaytestSession,
} from '../lib/playtest-analytics';

import {
  CAMERA_RESULT_KEY,
  DEFAULT_PREFERENCES,
  FREE_CAMERA_MISSION,
  MOODS,
  PASSPORT_KEY,
  PREFERENCES_KEY,
  TIME_MAX,
  TIME_MIN,
  TIME_STEPS,
  getPaceDistanceScale,
  walkingPaceLabel,
  type CameraRouteResult,
  type CameraSource,
  type DetourPreferences,
  type DetourPrewarm,
  type PassportEntry,
  type PassportMission,
  type MissionResult,
  type SceneIssueReason,
  type SessionPhoto,
  type SessionSceneFailure,
  type Stage,
  type WalkingPace,
} from '../lib/app-model';


import { styles } from '../styles/home-styles';
import { BONE, INK, LINE, MUTED, SIGNAL, SOFT } from '../theme/detour-theme';
import { MoodGlyph, V45MoodIcon, V45Skyline } from '../components/mood-visuals';
import {
  DetourAccentStroke,
  DetourTicket,
  V45Ticket,
  DETOUR_TICKET_HEIGHT,
  DETOUR_TICKET_WIDTH,
} from '../components/ticket-visuals';
import {
  V45SharePoster,
  V46CompleteArtwork,
  V46ReviewArtwork,
} from '../components/journey-recap-visuals';
import {
  applyFoodDestinationWeight,
  getFilmRollCapacity,
  moodHint,
} from '../lib/journey-selection';
import { getDistanceInMeters, getRouteDistance, offsetPoint } from '../lib/geo-utils';
import {
  contextCode,
  formatClockTime,
  formatPassportDate,
  parseMinutes,
  ticketSerial,
} from '../lib/detour-formatters';
import type { useDetourHomeController } from '../hooks/use-detour-home-controller';

export function DetourHomeView({
  controller,
}: {
  controller: ReturnType<typeof useDetourHomeController>;
}) {
  const {
    router,
    activeCameraRequestRef,
    stage,
    setStage,
    preferences,
    setPreferences,
    onboardingStep,
    setOnboardingStep,
    onboardingFromSettings,
    setOnboardingFromSettings,
    ticketBuildStatus,
    setTicketBuildStatus,
    ticketBuildError,
    setTicketBuildError,
    selectedTime,
    setSelectedTime,
    sliderDisplayMinutes,
    setSliderDisplayMinutes,
    selectedMood,
    setSelectedMood,
    selectedColor,
    setSelectedColor,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    detourStart,
    setDetourStart,
    activeTrace,
    setActiveTrace,
    plan,
    setPlan,
    selectedScene,
    setSelectedScene,
    walkingRoute,
    setWalkingRoute,
    navigationRoute,
    setNavigationRoute,
    navigationBeatIndex,
    setNavigationBeatIndex,
    beatRemainingMeters,
    setBeatRemainingMeters,
    deviceHeading,
    setDeviceHeading,
    showNextBeatMap,
    setShowNextBeatMap,
    questPulse,
    setQuestPulse,
    isRerouting,
    setIsRerouting,
    rerouteFailed,
    setRerouteFailed,
    rerouteCount,
    setRerouteCount,
    detourStartedAt,
    setDetourStartedAt,
    sceneFailures,
    setSceneFailures,
    replacementLoading,
    setReplacementLoading,
    sideMissionIndex,
    setSideMissionIndex,
    missionRevealedIndex,
    setMissionRevealedIndex,
    traveledMeters,
    setTraveledMeters,
    devMode,
    setDevMode,
    developerToolsUnlocked,
    setDeveloperToolsUnlocked,
    lightContext,
    setLightContext,
    photos,
    setPhotos,
    missionResults,
    setMissionResults,
    passport,
    setPassport,
    passportLoaded,
    setPassportLoaded,
    lastCompletedEntry,
    setLastCompletedEntry,
    selectedPassportId,
    setSelectedPassportId,
    passportPhotoIndex,
    setPassportPhotoIndex,
    playtestSessions,
    setPlaytestSessions,
    playtestTesterId,
    setPlaytestTesterId,
    lastCompletedPlaytestSessionId,
    setLastCompletedPlaytestSessionId,
    playtestRating,
    setPlaytestRating,
    playtestFeedbackReasons,
    setPlaytestFeedbackReasons,
    playtestSyncing,
    setPlaytestSyncing,
    lastAIResult,
    setLastAIResult,
    aiConnectionTesting,
    setAIConnectionTesting,
    locationWatcher,
    headingWatcher,
    missionResultsRef,
    lastTracePointRef,
    planRef,
    navigationRouteRef,
    navigationBeatIndexRef,
    beatRemainingMetersRef,
    selectedSceneRef,
    offRouteCountRef,
    rerouteInFlightRef,
    checkpointLockedRef,
    playtestSessionIdRef,
    rerouteCountRef,
    detourStartedAtRef,
    sceneFailuresRef,
    sideMissionIndexRef,
    traveledMetersRef,
    stageRef,
    prewarmRef,
    prewarmInFlightRef,
    shareTicketRef,
    screenOpacity,
    screenY,
    routeProgress,
    printerPulse,
    ticketStamp,
    ticketReadyUnlocked,
    setTicketReadyUnlocked,
    timeSliderProgress,
    timeSliderWidthRef,
    timeSliderStartProgressRef,
    timeSliderDisplayRef,
    minutePulse,
    homeEntrance,
    homeRouteMotion,
    mood,
    selectedMinutes,
    rollCapacity,
    previewProfile,
    timeIndexFromRatio,
    snapMinutesFromRatio,
    ratioForMinutes,
    pulseMinute,
    previewSliderRatio,
    finishSliderRatio,
    timeSliderResponder,
    currentMission,
    currentNavigationBeat,
    navigationProgressRatio,
    nextBeatMeters,
    nextBeatLabel,
    guidanceBearing,
    arrowRotation,
    nextBeatSegment,
    paceDistanceScale,
    darkStage,
    chromeDark,
    tracedPassport,
    totalDistanceMeters,
    totalDiscoveries,
    selectedPassportEntry,
    selectedPassportNumber,
    passportMapRegion,
    initializeApp,
    savePreferences,
    setWalkingPace,
    completeOnboarding,
    refreshPlaytestSessions,
    syncPlaytestDataNow,
    rateCompletedDetour,
    togglePlaytestFeedbackReason,
    runAIConnectionTest,
    sharePlaytestData,
    clearPlaytestData,
    replayOnboarding,
    nextOnboardingStep,
    loadPassport,
    savePassport,
    clearPassport,
    stopLocationWatcher,
    startHeadingWatcher,
    advanceTicketProgress,
    animateIn,
    transitionTo,
    toggleDeveloperTools,
    toggleDevMode,
    chooseTime,
    continueFromTime,
    chooseMood,
    continueFromMood,
    resetDetour,
    goBack,
    edgeBackResponder,
    remainingDetourMinutes,
    replacementDistanceBudget,
    feedbackKindForIssue,
    replaceFailedDestination,
    rerouteFromCurrentPosition,
    startTraceWatcher,
    prewarmDetour,
    applyCachedRanking,
    prepareDetourTicket,
    startDetour,
    setBeat,
    reachCurrentNavigationBeat,
    simulateWalk,
    simulateNextBeat,
    recordMissionResult,
    beginCurrentMissionSearch,
    advanceAfterSideMission,
    skipCurrentRequiredMission,
    skipArrivalRequiredMission,
    completeSideMissionWithoutPhoto,
    completeArrivalWithoutPhoto,
    openPassportEntry,
    shareJourney,
    reservedMissionPhotoCount,
    openCamera,
    handleCameraRouteResult,
    completeDetour,
  } = controller;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();

  const printingLayout = useMemo(() => {
    // Printer geometry is derived synchronously from the current window. The
    // artwork never needs to load or measure before the first frame can size it.
    const baseSidePadding = 30;
    const leftPadding = baseSidePadding + safeAreaInsets.left;
    const rightPadding = baseSidePadding + safeAreaInsets.right;
    const topPadding = Math.max(24, safeAreaInsets.top + 10);
    const bottomPadding = Math.max(24, safeAreaInsets.bottom + 12);
    const availableWidth = Math.max(1, windowWidth - leftPadding - rightPadding);
    const printerWidth = Math.min(availableWidth, 420);

    // The slot is only a physical ceiling. The intended ticket size comes
    // from ticket-base itself: 1122px rendered at the requested ~75%, then
    // converted from physical image pixels to React Native layout units.
    // No paper-to-slot tuning ratio is used.
    const slotWidth = Math.max(1, printerWidth - 6);
    const ticketArtworkWidthPx = 1122;
    const ticketArtworkRenderScale = 0.75;
    const ticketWidthFromArtwork =
      (ticketArtworkWidthPx * ticketArtworkRenderScale) / PixelRatio.get();

    // The artwork target normally wins. The slot and available vertical
    // space may only shrink the same aspect ratio; they never enlarge it.
    const chromeAndPrinterTop = 48 + 48 + 67 + 12 + 47;
    const tearHintReserve = 52 + bottomPadding;
    const maxPaperHeight = Math.max(1, windowHeight - topPadding - chromeAndPrinterTop - tearHintReserve);
    const ticketAspect = DETOUR_TICKET_HEIGHT / DETOUR_TICKET_WIDTH;
    const ticketWidthFromHeight = maxPaperHeight / ticketAspect;
    const ticketWidth = Math.max(
      1,
      Math.min(ticketWidthFromArtwork, slotWidth, ticketWidthFromHeight)
    );
    // ticketWidth is the single final rendered paper width. V45Ticket
    // derives its one visual scale from this value; the page does not
    // apply another ticket scale on top of it.
    const ticketHeight = ticketWidth * ticketAspect;

    return {
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      printerWidth,
      slotWidth,
      ticketWidth,
      ticketHeight,
      paperViewportHeight: ticketHeight + 2,
      assemblyHeight: 47 + ticketHeight + 2,
    };
  }, [
    safeAreaInsets.bottom,
    safeAreaInsets.left,
    safeAreaInsets.right,
    safeAreaInsets.top,
    windowHeight,
    windowWidth,
  ]);

  return (
    <View
      style={[
        styles.app,
        chromeDark ? styles.appDark : styles.appLight,
      ]}
    >
      <StatusBar
        barStyle={chromeDark ? 'light-content' : 'dark-content'}
      />


      <Animated.View
        {...edgeBackResponder.panHandlers}
        style={[
          styles.animatedRoot,
          {
            opacity: screenOpacity,
            transform: [{ translateY: screenY }],
          },
        ]}
      >
        {stage === 'boot' && (
          <View style={styles.bootScreen}>
            <Text style={styles.bootBrand}>
              DETOUR
            </Text>
          </View>
        )}

        {stage === 'onboarding' && (
          <View style={styles.onboardingScreen}>
            <View style={styles.onboardingTop}>
              {onboardingStep > 0 ||
              onboardingFromSettings ? (
                <Pressable
                  onPress={goBack}
                  hitSlop={16}
                  style={styles.onboardingBack}
                >
                  <Text style={styles.onboardingBackText}>
                    ←
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.onboardingBack} />
              )}

              <Text style={styles.onboardingBrand}>
                DETOUR
              </Text>

              <Text style={styles.onboardingCounter}>
                0{onboardingStep + 1} / 03
              </Text>
            </View>

            <View style={styles.onboardingHero}>
              {onboardingStep === 0 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    先選時間
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    給我一點時間。{`\n`}
                    剩下的我決定。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    你只要選時間，還有這次想怎麼晃。
                  </Text>
                </>
              )}

              {onboardingStep === 1 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    終點先保密
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    終點先藏起來。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    照方向走。真的看不懂，再打開那一小段地圖。
                  </Text>
                </>
              )}

              {onboardingStep === 2 && (
                <>
                  <Text style={styles.onboardingEyebrow}>
                    不對就換
                  </Text>
                  <Text style={styles.onboardingTitle}>
                    不對，{`\n`}
                    就換掉。
                  </Text>
                  <Text style={styles.onboardingBody}>
                    店沒開、進不去、不值得，就換下一個。
                  </Text>
                </>
              )}
            </View>

            <Pressable
              onPress={nextOnboardingStep}
              style={({ pressed }) => [
                styles.onboardingPrimary,
                pressed &&
                  styles.onboardingPrimaryPressed,
              ]}
            >
              <Text style={styles.onboardingPrimaryText}>
                {onboardingStep === 2
                  ? onboardingFromSettings
                    ? '回到設定'
                    : '開始 DETOUR'
                  : '繼續'}
              </Text>
              <Text style={styles.onboardingPrimaryArrow}>
                →
              </Text>
            </Pressable>
          </View>
        )}

        {stage === 'settings' && (
          <View style={styles.settingsScreen}>
            <View style={styles.settingsTop}>
              <Pressable
                onPress={goBack}
                hitSlop={16}
                style={styles.settingsBack}
              >
                <Text style={styles.settingsBackText}>
                  ←
                </Text>
              </Pressable>

              <Pressable
                onLongPress={toggleDeveloperTools}
                delayLongPress={900}
                hitSlop={10}
              >
                <Text style={styles.settingsBrand}>
                  設定
                </Text>
              </Pressable>

              <Text style={styles.settingsMeta}>
                DETOUR
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsScroll}
            >
              <View style={styles.settingsHero}>
                <Text style={styles.settingsEyebrow}>
                  調整步調
                </Text>
                <Text style={styles.settingsTitle}>
                  讓 DETOUR{`\n`}
                  更像你的步伐。
                </Text>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  步行節奏
                </Text>

                {([
                  {
                    id: 'relaxed' as WalkingPace,
                    label: '慢一點',
                    code: 'RELAXED',
                    note: '同樣的空檔，少走一點。',
                  },
                  {
                    id: 'normal' as WalkingPace,
                    label: '一般',
                    code: 'NORMAL',
                    note: '目前 DETOUR 的預設節奏。',
                  },
                  {
                    id: 'brisk' as WalkingPace,
                    label: '快一點',
                    code: 'BRISK',
                    note: '願意多走一點，換更多候選。',
                  },
                ]).map((pace) => {
                  const active =
                    preferences.walkingPace === pace.id;

                  return (
                    <Pressable
                      key={pace.id}
                      onPress={() =>
                        setWalkingPace(pace.id)
                      }
                      style={({ pressed }) => [
                        styles.settingsChoice,
                        active &&
                          styles.settingsChoiceActive,
                        pressed &&
                          styles.pressedLight,
                      ]}
                    >
                      <View>
                        <Text style={styles.settingsChoiceLabel}>
                          {pace.label}
                        </Text>
                        <Text style={styles.settingsChoiceNote}>
                          {pace.note}
                        </Text>
                      </View>

                      <View style={styles.settingsChoiceRight}>
                        <Text style={styles.settingsChoiceMark}>
                          {active ? '●' : '○'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {developerToolsUnlocked && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  開發者工具
                </Text>

                <Pressable
                  onPress={toggleDevMode}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      室內測試
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      用真實 Scene / route，
                      但按按鈕模擬前進。
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.settingsActionState,
                      devMode &&
                        styles.settingsActionStateOn,
                    ]}
                  >
                    {devMode ? '開' : '關'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={toggleDeveloperTools}
                  style={({ pressed }) => [
                    styles.v43DevClose,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={styles.v43DevCloseText}>隱藏開發者工具</Text>
                </Pressable>
              </View>
              )}

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  開始導覽
                </Text>

                <Pressable
                  onPress={replayOnboarding}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      再看一次開始導覽
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      不會清除旅程收藏或偏好。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    →
                  </Text>
                </Pressable>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  旅程資料
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    已完成旅程
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {passport.length} 趟
                  </Text>
                </View>

                <Pressable
                  onPress={clearPassport}
                  style={({ pressed }) => [
                    styles.settingsDanger,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <Text style={styles.settingsDangerText}>
                    清除已完成旅程
                  </Text>
                </Pressable>
              </View>

              {developerToolsUnlocked && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  AI 狀態
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    AI 後端
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {isAIEngineConfigured()
                      ? 'CONFIGURED'
                      : 'NOT CONNECTED'}
                  </Text>
                </View>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    上次執行
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {lastAIResult === 'ai'
                      ? 'AI'
                      : lastAIResult ===
                          'fallback'
                        ? 'FALLBACK'
                        : 'NOT RUN YET'}
                  </Text>
                </View>

                <Text style={styles.settingsActionNote}>
                  AI 失敗時會自動改用內建路線邏輯。
                </Text>

                <Pressable
                  onPress={runAIConnectionTest}
                  disabled={aiConnectionTesting}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      {aiConnectionTesting
                        ? '正在測試 AI…'
                        : '測試 AI 連線'}
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      測試目前的 AI 排序服務是否正常。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    ↗
                  </Text>
                </Pressable>
              </View>
              )}

              {developerToolsUnlocked && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>
                  測試資料
                </Text>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    測試裝置
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {playtestTesterId}
                  </Text>
                </View>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    測試次數
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    {
                      playtestSessions.filter(
                        (session) =>
                          !session.devMode
                      ).length
                    } REAL · {
                      playtestSessions.filter(
                        (session) =>
                          session.devMode
                      ).length
                    } INDOOR
                  </Text>
                </View>

                <View style={styles.settingsDataRow}>
                  <Text style={styles.settingsDataLabel}>
                    雲端同步
                  </Text>
                  <Text style={styles.settingsDataValue}>
                    ON · v{DETOUR_PLAYTEST_VERSION}
                  </Text>
                </View>

                <Pressable
                  onPress={syncPlaytestDataNow}
                  disabled={playtestSyncing}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      {playtestSyncing
                        ? '正在同步…'
                        : '立即同步測試資料'}
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      手動確認測試資料已同步。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    ↗
                  </Text>
                </Pressable>

                <Pressable
                  onPress={sharePlaytestData}
                  style={({ pressed }) => [
                    styles.settingsAction,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <View>
                    <Text style={styles.settingsActionTitle}>
                      分享測試報告
                    </Text>
                    <Text style={styles.settingsActionNote}>
                      匿名資料，不包含照片與完整定位軌跡。
                    </Text>
                  </View>

                  <Text style={styles.settingsActionArrow}>
                    ↗
                  </Text>
                </Pressable>

                <Pressable
                  onPress={clearPlaytestData}
                  style={({ pressed }) => [
                    styles.settingsDanger,
                    pressed &&
                      styles.pressedLight,
                  ]}
                >
                  <Text style={styles.settingsDangerText}>
                    清除測試統計
                  </Text>
                </Pressable>
              </View>
              )}

              <View style={styles.settingsPrivacy}>
                <Text style={styles.settingsPrivacyTitle}>
                  定位
                </Text>
                <Text style={styles.settingsPrivacyBody}>
                  DETOUR 會在首頁先用目前位置準備附近候選，
                  讓你選完時間和心情後不用從零開始等。
                  旅程中的定位軌跡仍只留在手機。
                </Text>
              </View>
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
              <Pressable
                onPress={() => transitionTo('settings')}
                accessibilityLabel="打開設定"
                style={({ pressed }) => [styles.v35MenuButton, pressed && styles.v35Pressed]}
              >
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLine} />
                <View style={styles.v35MenuLineShort} />
              </Pressable>
            </View>
            <Animated.View
              style={[
                styles.v35RouteSketch,
                {
                  opacity: homeEntrance,
                  transform: [
                    {
                      translateY: homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
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
                { transform: [{ scale: minutePulse }] },
              ]}
            >
              <Text style={styles.v35MinuteNumber}>{sliderDisplayMinutes}</Text>
              <Text style={styles.v35MinuteUnit}>分</Text>
            </Animated.View>
            <View
              style={styles.v35SliderWrap}
              onLayout={(event) => {
                timeSliderWidthRef.current = Math.max(
                  1,
                  event.nativeEvent.layout.width
                );
              }}
              {...timeSliderResponder.panHandlers}
            >
              <View style={styles.v35SliderRail} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v35SliderFill,
                  {
                    width: timeSliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
              {TIME_STEPS.map((minute, index) => {
                const progress = index / (TIME_STEPS.length - 1);
                return (
                  <View key={minute} pointerEvents="none" style={[styles.v35TickWrap, { left: `${progress * 100}%` }]}>
                    <View style={[styles.v35Tick, minute <= sliderDisplayMinutes && styles.v35TickActive]} />
                    <Text style={styles.v35TickLabel}>{minute}</Text>
                  </View>
                );
              })}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.v35SliderThumb,
                  {
                    left: timeSliderProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              >
                <View style={styles.v35SliderThumbCore} />
              </Animated.View>
            </View>
            <Animated.View
              style={{
                opacity: homeEntrance,
                transform: [
                  {
                    translateY: homeEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable onPress={continueFromTime} style={({ pressed }) => [styles.v35TicketButton, pressed && styles.v35TicketButtonPressed]}>
                <View style={styles.v35TicketNotchLeft} />
                <View style={styles.v35TicketNotchRight} />
                <Text style={styles.v35TicketArrow}>→</Text>
                <Text style={styles.v35TicketText}>開始 {sliderDisplayMinutes} 分鐘的旅程</Text>
                <View style={styles.v35TicketDivider} />
                <Text style={styles.v35TicketMark}>▰</Text>
              </Pressable>
              <Pressable onPress={() => transitionTo('passport')} style={({ pressed }) => [styles.v35CompletedButton, pressed && styles.v35Pressed]}>
                <Text style={styles.v35CompletedText}>已完成的旅程</Text>
                <View style={styles.v35CompletedCount}><Text style={styles.v35CompletedCountText}>{passport.length}</Text></View>
                <Text style={styles.v35CompletedArrow}>→</Text>
              </Pressable>
            </Animated.View>
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
              {MOODS.filter((item) => item.id !== 'surprise').map((item) => {
                const active = selectedMood === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => chooseMood(item.id)}
                    style={({ pressed }) => [
                      styles.v45MoodCard,
                      active && styles.v45MoodCardActive,
                      pressed && styles.v45MoodCardPressed,
                    ]}
                  >
                    <V45MoodIcon moodId={item.id} />
                    <Text style={styles.v45MoodLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}

            </View>

            <Pressable
              disabled={!selectedMood}
              onPress={continueFromMood}
              style={({ pressed }) => [
                styles.v45MoodCta,
                !selectedMood && styles.v45MoodCtaDisabled,
                pressed && selectedMood && styles.v45MoodCtaPressed,
              ]}
            >
              <View style={styles.v45TicketNotchLeft} />
              <View style={styles.v45TicketNotchRight} />
              <Text style={styles.v45MoodCtaText}>
                {selectedMood ? '出發吧！' : '選一個心情'}
              </Text>
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

            <View style={[styles.v45PrintingTitleWrap, styles.v48PrintingTitleWrap]}>
              <Text style={styles.v45PrintingTitle}>
                {stage === 'ready' ? '車票完成' : '正在印製車票…'}
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
              <View pointerEvents="none" style={styles.v50PrinterBody}>
                <View style={styles.v50PrinterHighlight} />
                <View style={styles.v50PrinterSlotShell}>
                  <View style={styles.v50PrinterSlot} />
                </View>
              </View>

              <View
                style={[
                  styles.v48PaperViewport,
                  {
                    width: printingLayout.slotWidth,
                    height: printingLayout.paperViewportHeight,
                  },
                ]}
                pointerEvents="none"
              >
                <Animated.View
                  style={[
                    styles.v48PaperTrack,
                    {
                      width: printingLayout.slotWidth,
                      alignItems: 'center',
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-printingLayout.ticketHeight, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <V45Ticket
                    timeLabel={selectedTime ?? '15'}
                    moodId={selectedMood ?? 'wander'}
                    moodLabel={mood?.label ?? '—'}
                    serial={ticketSerial(selectedTime, selectedMood)}
                    stamped={stage === 'ready'}
                    stampProgress={ticketStamp}
                    renderWidth={printingLayout.ticketWidth}
                  />
                </Animated.View>
              </View>

              <View pointerEvents="none" style={styles.v50PrinterFrontLip}>
                <View style={styles.v50PrinterFrontLipHighlight} />
              </View>
            </View>

            {stage === 'ready' && ticketReadyUnlocked && (
              <Pressable
                onPress={startDetour}
                style={({ pressed }) => [
                  styles.v48DepartButton,
                  {
                    left: printingLayout.leftPadding,
                    right: printingLayout.rightPadding,
                    bottom: printingLayout.bottomPadding,
                  },
                  pressed && styles.v48DepartButtonPressed,
                ]}
              >
                <Text style={styles.v48DepartButtonText}>出發</Text>
                <Text style={styles.v48DepartButtonArrow}>→</Text>
              </Pressable>
            )}

            <Modal
              visible={Boolean(ticketBuildError)}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={goBack}
            >
              <View style={styles.v48RetryOverlay}>
                <View style={styles.v48RetryCard}>
                  <Text style={styles.v48RetryEyebrow}>出票失敗</Text>
                  <Text style={styles.v48RetryTitle}>這張票卡住了。</Text>
                  <Text style={styles.v48RetryBody}>{ticketBuildError}</Text>
                  <Pressable
                    onPress={() => {
                      routeProgress.setValue(0);
                      setTicketBuildError(null);
                      setTicketBuildStatus('再試一次…');
                      void prepareDetourTicket();
                    }}
                    style={({ pressed }) => [
                      styles.v48RetryPrimary,
                      pressed && styles.v45MoodCardPressed,
                    ]}
                  >
                    <Text style={styles.v48RetryPrimaryText}>再試一次</Text>
                    <Text style={styles.v48RetryPrimaryArrow}>→</Text>
                  </Pressable>
                  <Pressable onPress={goBack} style={styles.v48RetrySecondary}>
                    <Text style={styles.v48RetrySecondaryText}>返回選心情</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </View>
        )}

        {stage === 'journey' &&
          plan &&
          navigationRoute &&
          currentNavigationBeat && (
            <View style={styles.v35JourneyScreen}>
              <View style={styles.v35JourneyTop}>
                <Pressable onPress={goBack} hitSlop={16} style={styles.v35JourneyBack}><Text style={styles.v35JourneyBackText}>←</Text></Pressable>
                <Text style={styles.v35JourneyBrand}>DETOUR</Text>
                <View style={styles.v35JourneyProgress}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const progress = navigationRoute.beats.length <= 1 ? 0 : navigationBeatIndex / (navigationRoute.beats.length - 1);
                    const current = Math.min(4, Math.round(progress * 4));
                    return (<View key={index} style={styles.v35JourneyProgressItem}><View style={[styles.v35JourneyProgressDot, index < current && styles.v35JourneyProgressDone, index === current && styles.v35JourneyProgressCurrent]} />{index < 4 && <View style={[styles.v35JourneyProgressLine, index < current && styles.v35JourneyProgressLineDone]} />}</View>);
                  })}<Text style={styles.v35JourneyFlag}>⚑</Text>
                </View>
              </View>
              {showNextBeatMap && latitude !== null && longitude !== null ? (
                <View style={styles.v35JourneyMapWrap}>
                  <MapView style={styles.v35JourneyMap} initialRegion={{ latitude: (latitude + currentNavigationBeat.point.latitude) / 2, longitude: (longitude + currentNavigationBeat.point.longitude) / 2, latitudeDelta: 0.0022, longitudeDelta: 0.0022 }} showsUserLocation showsMyLocationButton={false} showsCompass={false} pitchEnabled={false} rotateEnabled={false}>
                    <Polyline coordinates={nextBeatSegment} strokeColor={SIGNAL} strokeWidth={5} lineCap="round" /><Circle center={currentNavigationBeat.point} radius={10} strokeColor={BONE} strokeWidth={1} fillColor={SIGNAL} />
                  </MapView>
                  <Pressable onPress={() => setShowNextBeatMap(false)} style={styles.v35JourneyMapClose}><Text style={styles.v35JourneyMapCloseText}>×</Text></Pressable>
                </View>
              ) : (
                <View style={styles.v35JourneyHero}>
                  <Pressable onPress={() => setShowNextBeatMap(true)} style={({ pressed }) => [styles.v35Compass, pressed && styles.v35JourneyPressed]}><View style={styles.v35CompassTicks} /><View style={{ transform: [{ rotate: `${arrowRotation}deg` }] }}><Text style={styles.v35CompassArrow}>↑</Text></View></Pressable>
                  <Text style={styles.v35JourneyDistance}>{Math.round(nextBeatMeters)}<Text style={styles.v35JourneyDistanceUnit}> m</Text></Text>
                  <Text style={styles.v35JourneyInstruction}>{currentNavigationBeat.instruction || '先走這一段。'}</Text>
                  {selectedMood !== 'color' &&
                    currentMission &&
                    missionRevealedIndex === sideMissionIndex && (
                    <Pressable
                      onPress={() => openCamera('side')}
                      style={({ pressed }) => [styles.v41ActiveFind, pressed && styles.v35JourneyPressed]}
                    >
                      <View style={styles.v41ActiveFindCopy}>
                        <Text style={styles.v41ActiveFindLabel}>正在找</Text>
                        <Text numberOfLines={2} style={styles.v41ActiveFindTitle}>{currentMission.title}</Text>
                      </View>
                      <Text style={styles.v41ActiveFindAction}>拍照 →</Text>
                    </Pressable>
                  )}
                  {selectedMood === 'color' && selectedColor && (
                    <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: selectedColor.hex, borderRadius: 999 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selectedColor.hex }} />
                      <Text style={{ color: BONE, fontSize: 15, fontWeight: '800' }}>今天找{selectedColor.label} · 看到就拍</Text>
                    </View>
                  )}
                  {isRerouting && <Text style={styles.v35JourneyStatus}>正在重新找路…</Text>}
                </View>
              )}
              {questPulse && <View pointerEvents="none" style={styles.v35QuestPulse}><Text style={styles.v35QuestPulseText}>{questPulse === 'side' ? '新的尋找' : '到終點了'}</Text></View>}
              <View style={styles.v35JourneyBottom}>
                <Pressable onPress={() => setShowNextBeatMap((value) => !value)} style={({ pressed }) => [styles.v35JourneyPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v35JourneyPrimaryArrow}>{showNextBeatMap ? '↙' : '↗'}</Text><View style={styles.v35JourneyPrimaryDivider} /><Text style={styles.v35JourneyPrimaryText}>{showNextBeatMap ? '收起地圖' : '小地圖'}</Text></Pressable>
                <Pressable onPress={() => openCamera('free')} style={({ pressed }) => [styles.v35JourneyCamera, pressed && styles.v35JourneyPressed]}><Text style={styles.v35JourneyCameraText}>◎</Text></Pressable>
                {devMode && <Pressable onPress={simulateNextBeat} style={styles.v41DevAdvance}><Text style={styles.v41DevAdvanceText}>室內測試 · 下一段 →</Text></Pressable>}
              </View>
            </View>
          )}

        {stage === 'mission' && plan && currentMission && (
          <View style={styles.v41MissionScreen}>
            <View style={styles.v41MissionTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v41MissionBack}>
                <Text style={styles.v41MissionBackText}>←</Text>
              </Pressable>
              <Text style={styles.v41MissionBrand}>DETOUR</Text>
              <View style={styles.v41MissionBadge}><Text style={styles.v41MissionBadgeText}>✦</Text></View>
            </View>

            <View style={styles.v41MissionRoute}>
              <View style={styles.v41MissionRouteStart}><View style={styles.v41MissionRouteCore} /></View>
              <View style={styles.v41MissionRouteLine} />
              <View style={styles.v41MissionRouteQuest}><Text style={styles.v41MissionRouteQuestText}>✦</Text></View>
              <View style={styles.v41MissionRouteLineMuted} />
            </View>

            <View style={styles.v41MissionHero}>
              <Text style={styles.v41MissionCue}>新的尋找</Text>
              <Text style={styles.v41MissionTitle}>{currentMission.title}</Text>
              {plan.context !== 'day' && (
                <Text style={styles.v41MissionSafety}>只在有照明、公開可走的位置找。</Text>
              )}
            </View>

            <View style={styles.v41MissionBottom}>
              <Pressable onPress={beginCurrentMissionSearch} style={({ pressed }) => [styles.v41MissionPrimary, pressed && styles.pressedLight]}>
                <Text style={styles.v41MissionPrimaryText}>開始找</Text>
                <Text style={styles.v41MissionPrimaryArrow}>→</Text>
              </Pressable>
              <Pressable onPress={skipCurrentRequiredMission} style={({ pressed }) => [styles.v41MissionSkip, pressed && styles.pressedLight]}>
                <Text style={styles.v41MissionSkipText}>先跳過</Text>
              </Pressable>
            </View>
          </View>
        )}

        {stage === 'arrival' && plan && (
          <View style={styles.cleanArrivalScreen}>
            <View style={styles.cleanArrivalTop}>
              <Text style={[styles.brand]}>DETOUR</Text>
              <Text style={[styles.cleanArrivalMeta, styles.v41ReadableMeta]}>
                {selectedScene?.label ?? '抵達'}
              </Text>
            </View>

            <View style={styles.arrivalRevealStrip}>
              <View style={styles.arrivalRevealStart} />
              <View style={styles.arrivalRevealLine} />
              <View style={styles.arrivalRevealFlag}>
                <View style={styles.arrivalRevealFlagPole} />
                <View style={styles.arrivalRevealFlagShape} />
              </View>

              <Text style={styles.arrivalRevealLabel}>
                終點揭曉
              </Text>
            </View>

            <View style={styles.cleanArrivalHero}>
              <Text style={[styles.cleanArrivalKicker, styles.v41ReadableKicker]}>
                到了
              </Text>

              <Text style={styles.cleanArrivalPlace}>
                {selectedScene?.name ?? '終點'}
              </Text>


              <Text style={styles.cleanArrivalMission}>
                {plan.arrivalMission.title}
              </Text>

              <Text style={[styles.cleanArrivalInstruction, styles.v41ReadableBody]}>
                {plan.arrivalMission.instruction}
              </Text>

            </View>

            <View style={styles.cleanArrivalBottom}>
              {plan.arrivalMission.photo ? (
                <>
                  <Pressable
                    onPress={() => openCamera('arrival')}
                    style={({ pressed }) => [
                      styles.cleanArrivalPrimary,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalPrimaryText}>
                      拍下來
                    </Text>
                    <Text style={styles.cleanArrivalPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={skipArrivalRequiredMission}
                    style={({ pressed }) => [
                      styles.cleanArrivalSkip,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalSkipText}>
                      找不到，先完成這趟
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.cleanArrivalActions}>
                  <Pressable
                    onPress={completeArrivalWithoutPhoto}
                    style={({ pressed }) => [
                      styles.cleanArrivalPrimary,
                      styles.cleanArrivalPrimaryFlexible,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalPrimaryText}>
                      完成這次 DETOUR
                    </Text>
                    <Text style={styles.cleanArrivalPrimaryArrow}>
                      →
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openCamera('arrival')}
                    style={({ pressed }) => [
                      styles.cleanArrivalCamera,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Text style={styles.cleanArrivalCameraIcon}>
                      📷
                    </Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() =>
                  transitionTo('sceneIssue')
                }
                style={({ pressed }) => [
                  styles.cleanArrivalProblem,
                  pressed && styles.pressedLight,
                ]}
              >
                <Text style={styles.cleanArrivalProblemText}>
                  這裡不行
                </Text>
                <Text style={styles.cleanArrivalProblemArrow}>
                  →
                </Text>
              </Pressable>

              <Text style={[styles.cleanArrivalSource, styles.v41ReadableMeta]}>
                地圖資料：OpenStreetMap
              </Text>
            </View>
          </View>
        )}

        {stage === 'sceneIssue' && (
          <View
            style={[
              styles.reissueScreen,
            ]}
          >
            <View style={styles.reissueTop}>
              <Pressable
                disabled={replacementLoading}
                onPress={goBack}
                hitSlop={16}
                style={styles.reissueBack}
              >
                <Text
                  style={[
                    styles.reissueBackText,
                  ]}
                >
                  ←
                </Text>
              </Pressable>

              <Text
                style={[
                  styles.reissueBrand,
                ]}
              >
                DETOUR
              </Text>

              <Text style={styles.reissueMeta}>
                換一條
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.reissueScroll}
            >
              <View style={styles.reissueRouteCard}>
                <View style={styles.reissueRouteHeader}>
                  <Text
                    style={[
                      styles.reissueRouteLabel,
                    ]}
                  >
                    目前路線
                  </Text>

                  <Text style={styles.reissueRouteStatus}>
                    中斷
                  </Text>
                </View>

                <View style={styles.reissueRouteGraphic}>
                  <View style={styles.reissueRouteStart} />
                  <View style={styles.reissueRouteLineDone} />
                  <View style={styles.reissueRouteBreak}>
                    <Text style={styles.reissueRouteBreakText}>×</Text>
                  </View>
                  <View style={styles.reissueRouteLineNext} />
                  <View style={styles.reissueRouteQuestion}>
                    <Text style={styles.reissueRouteQuestionText}>?</Text>
                  </View>
                </View>

                <View style={styles.reissueRouteFoot}>
                  <Text
                    style={[
                      styles.reissueRouteFootText,
                    ]}
                  >
                    已走過的路和尋找會保留
                  </Text>
                  <Text style={styles.reissueRouteFootArrow}>→</Text>
                  <Text
                    style={[
                      styles.reissueRouteFootText,
                    ]}
                  >
                    換一個終點
                  </Text>
                </View>
              </View>

              <View style={styles.reissueHero}>
                <Text style={styles.reissueEyebrow}>
                  這個終點不行
                </Text>

                <Text
                  style={[
                    styles.reissueTitle,
                  ]}
                >
                  沒關係。{`\n`}
                  改走另一條。
                </Text>

                <Text
                  style={[
                    styles.reissueBody,
                  ]}
                >
                  從你現在的位置換一個終點；已完成的尋找會保留。
                </Text>
              </View>

              <Text
                style={[
                  styles.reissueChoiceLabel,
                ]}
              >
                為什麼要換？
              </Text>

              <View style={styles.reissueGrid}>
                {([
                  {
                    id: 'closed' as SceneIssueReason,
                    index: '01',
                    title: '沒開 / 已打烊',
                    note: '這個時間不成立',
                    mark: '○',
                  },
                  {
                    id: 'inaccessible' as SceneIssueReason,
                    index: '02',
                    title: '找不到 / 進不去',
                    note: '現場無法抵達',
                    mark: '↗',
                  },
                  {
                    id: 'not-worth-it' as SceneIssueReason,
                    index: '03',
                    title: '到現場覺得不值得',
                    note: '這裡不夠有趣',
                    mark: '−',
                  },
                  {
                    id: 'wrong-now' as SceneIssueReason,
                    index: '04',
                    title: '我現在不想去這裡',
                    note: '不是現在想要的',
                    mark: '↝',
                  },
                ]).map((reason) => (
                  <Pressable
                    key={reason.id}
                    disabled={replacementLoading}
                    onPress={() =>
                      replaceFailedDestination(reason.id)
                    }
                    style={({ pressed }) => [
                      styles.reissueChoice,
                      pressed && styles.reissueChoicePressed,
                    ]}
                  >
                    <View style={styles.reissueChoiceTop}>
                      <Text style={styles.reissueChoiceMark}>
                        {reason.mark}
                      </Text>
                      <Text
                        style={[
                          styles.reissueChoiceIndex,
                        ]}
                      >
                        {reason.index}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.reissueChoiceTitle,
                      ]}
                    >
                      {reason.title}
                    </Text>

                    <Text
                      style={[
                        styles.reissueChoiceNote,
                      ]}
                    >
                      {reason.note}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {replacementLoading && (
                <View
                  style={[
                    styles.reissueLoadingCard,
                  ]}
                >
                  <View style={styles.reissueLoadingDot} />
                  <Text
                    style={[
                      styles.reissueLoadingText,
                    ]}
                  >
                    正在重新派發一條能在剩餘時間內完成的路線…
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'developing' && (
          <View style={styles.developingScreen}>
            <View style={styles.developingTop}>
              <Text style={styles.brandLight}>DETOUR</Text>
              <Text style={styles.developingMeta}>
                第 {String(passport.length + 1).padStart(2, '0')} 趟
              </Text>
            </View>

            <View style={styles.developingHero}>
              <View style={styles.developingDot} />
<Text style={[styles.developingCode, styles.v41DevelopingCode]}>正在整理</Text>
              <Text style={styles.developingTitle}>
                先別看。{`\n`}
                這趟正在顯影。
              </Text>
              <Text style={[styles.developingBody, styles.v41DevelopingBody]}>
                {photos.length} 張照片
              </Text>
            </View>

            <View style={styles.developingTrack}>
              <View style={styles.developingTrackFill} />
            </View>
          </View>
        )}

        {stage === 'finish' && (
          <View style={styles.v45FinishScreen}>
            <View style={styles.v45FinishHeader}>
              <Text style={styles.v45FinishBrand}>DETOUR</Text>
              <Pressable onPress={() => transitionTo('settings')} style={styles.v45FinishMenu}>
                <View style={styles.v45FinishMenuLine} />
                <View style={styles.v45FinishMenuLine} />
                <View style={styles.v45FinishMenuLine} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.v45FinishScroll}
            >
              <View style={styles.v45FinishTitleWrap}>
                <Text style={styles.v45FinishTitle}>旅程完成</Text>
                <DetourAccentStroke width={76} style={styles.v45FinishTitleUnderline} />
              </View>

              <V46CompleteArtwork
                entry={lastCompletedEntry}
                photos={photos}
                fallbackDestination={selectedScene?.name ?? '這趟的終點'}
                fallbackMinutes={selectedMinutes}
              />

              <Pressable
                onPress={() => {
                  if (lastCompletedEntry) openPassportEntry(lastCompletedEntry);
                  else transitionTo('passport');
                }}
                style={({ pressed }) => [
                  styles.v45FinishPrimary,
                  pressed && styles.v45MoodCtaPressed,
                ]}
              >
                <Text style={styles.v45FinishPrimaryArrow}>→</Text>
                <Text style={styles.v45FinishPrimaryText}>照片回顧</Text>
              </Pressable>
              <Pressable
                onPress={resetDetour}
                style={({ pressed }) => [
                  styles.v45FinishSecondary,
                  pressed && styles.v45MoodCardPressed,
                ]}
              >
                <Text style={styles.v45FinishSecondaryText}>回到首頁</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        {stage === 'passport' && (
          <View style={styles.v41PassportScreen}>
            <View style={styles.v41PassportTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v41PassportBack}><Text style={styles.v41PassportBackText}>←</Text></Pressable>
              <Text style={styles.v41PassportHeader}>已完成的旅程</Text>
              <Text style={styles.v41PassportMeta}>收藏</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v41PassportScroll}>
              <Text style={styles.v41PassportKicker}>你的 DETOUR 收藏</Text>
              <Text style={styles.v41PassportTitle}>走過的路，{`
`}一趟一趟留下來。</Text>

              <View style={styles.v41PassportStats}>
                <View style={styles.v41PassportStat}><Text style={styles.v41PassportStatValue}>{passport.length}</Text><Text style={styles.v41PassportStatLabel}>趟旅程</Text></View>
                <View style={styles.v41PassportStat}><Text style={styles.v41PassportStatValue}>{(totalDistanceMeters / 1000).toFixed(1)}</Text><Text style={styles.v41PassportStatLabel}>公里</Text></View>
                <View style={styles.v41PassportStat}><Text style={styles.v41PassportStatValue}>{totalDiscoveries}</Text><Text style={styles.v41PassportStatLabel}>個發現</Text></View>
              </View>

              <View style={styles.v41PassportSectionRow}>
                <Text style={styles.v41PassportSectionTitle}>旅程收藏</Text>
                <Text style={styles.v41PassportSectionMeta}>{passportLoaded ? '存在這支手機' : '載入中'}</Text>
              </View>

              {passport.length === 0 ? (
                <View style={styles.v41PassportEmpty}>
                  <Text style={styles.v41PassportEmptyMark}>○ ─── ⚑</Text>
                  <Text style={styles.v41PassportEmptyTitle}>第一趟走完後，會留在這裡。</Text>
                </View>
              ) : (
                <View style={styles.v41PassportList}>
                  {passport.map((entry, index) => {
                    const coverUri = entry.photos?.[0]?.uri;
                    return (
                      <Pressable key={entry.id} onPress={() => openPassportEntry(entry)} style={({ pressed }) => [styles.v41PassportCard, pressed && styles.v35Pressed]}>
                        {coverUri ? (
                          <Image source={{ uri: coverUri }} style={styles.v41PassportPhoto} resizeMode="cover" />
                        ) : (
                          <View style={styles.v41PassportNoPhoto}>
                            <View style={styles.v41PassportNoPhotoLine} />
                            <View style={styles.v41PassportNoPhotoDot} />
                            <Text style={styles.v41PassportNoPhotoText}>{entry.moodLabel}</Text>
                          </View>
                        )}
                        <View style={styles.v41PassportCardBody}>
                          <View style={styles.v41PassportCardTop}>
                            <Text style={styles.v41PassportCardNumber}>{String(passport.length - index).padStart(2, '0')}</Text>
                            <Text style={styles.v41PassportCardDate}>{formatPassportDate(entry.completedAt)}</Text>
                          </View>
                          <Text style={styles.v41PassportCardMood}>{entry.moodLabel}</Text>
                          <Text style={styles.v41PassportCardDestination} numberOfLines={2}>{entry.sceneName ?? `${entry.city}的一趟 DETOUR`}</Text>
                          <View style={styles.v41PassportCardFacts}>
                            <Text style={styles.v41PassportCardFact}>{entry.minutes} 分鐘</Text>
                            <Text style={styles.v41PassportCardFact}>{entry.photoCount ?? 0} 張照片</Text>
                            <Text style={styles.v41PassportCardFact}>{entry.discoveries} 個發現</Text>
                          </View>
                          <View style={styles.v41PassportOpen}><Text style={styles.v41PassportOpenText}>打開這趟</Text><Text style={styles.v41PassportOpenArrow}>→</Text></View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {developerToolsUnlocked && passport.length > 0 && (
                <Pressable onPress={clearPassport} style={({ pressed }) => [styles.v41PassportClear, pressed && styles.pressedLight]}>
                  <Text style={styles.v41PassportClearText}>清除測試收藏</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'passportDetail' && selectedPassportEntry && (
          <View style={styles.v45DetailScreen}>
            <View style={styles.v45DetailTop}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v45BackButton}>
                <Text style={styles.v45BackText}>‹</Text>
              </Pressable>
              <View style={styles.v45DetailTitleWrap}>
                <Text style={styles.v45DetailTitle}>旅程回顧</Text>
                <DetourAccentStroke width={86} style={styles.v45DetailTitleUnderline} />
              </View>
              <View style={styles.v45DetailTopSpacer} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.v45DetailScroll}
            >
              <V46ReviewArtwork
                entry={selectedPassportEntry}
                photoIndex={passportPhotoIndex}
                onPhotoIndex={setPassportPhotoIndex}
              />

              {selectedPassportEntry.photos && selectedPassportEntry.photos.length > 3 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.v45DetailThumbRow}
                >
                  {selectedPassportEntry.photos.slice(3).map((photo, offset) => {
                    const index = offset + 3;
                    return (
                      <Pressable key={photo.id} onPress={() => setPassportPhotoIndex(index)}>
                        <Image
                          source={{ uri: photo.uri }}
                          style={[
                            styles.v45DetailThumb,
                            index === passportPhotoIndex && styles.v45DetailThumbActive,
                          ]}
                          resizeMode="cover"
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.v45RouteStrip}>
                <View style={styles.v45RouteEndpoint}>
                  <View style={styles.v45RouteCityIcon} />
                  <Text style={styles.v45RouteEndpointLabel}>出發</Text>
                  <Text style={styles.v45RouteEndpointValue} numberOfLines={1}>{selectedPassportEntry.city}</Text>
                </View>
                <View style={styles.v45RouteTrack}>
                  <View style={styles.v45RouteNode} />
                  <View style={styles.v45RouteDashLine} />
                  <View style={styles.v45RouteTree} />
                  <View style={styles.v45RouteDashLineB} />
                  <View style={styles.v45RouteNode} />
                </View>
                <View style={[styles.v45RouteEndpoint, styles.v45RouteEndpointRight]}>
                  <View style={styles.v45RouteFlag} />
                  <Text style={styles.v45RouteEndpointLabel}>抵達</Text>
                  <Text style={styles.v45RouteEndpointValue} numberOfLines={1}>
                    {selectedPassportEntry.sceneName ?? '這趟的終點'}
                  </Text>
                </View>
              </View>

              <View style={styles.v45NoteCard}>
                <Text style={styles.v45NoteTitle}>旅程筆記</Text>
                <Text style={styles.v45NoteBody}>
                  短短的 {selectedPassportEntry.actualDurationMinutes ?? selectedPassportEntry.minutes} 分鐘，走進熟悉又陌生的 {selectedPassportEntry.sceneName ?? selectedPassportEntry.city}。{`\n`}
                  留下 {selectedPassportEntry.photoCount ?? selectedPassportEntry.photos?.length ?? 0} 張照片，也把這次轉彎收進 DETOUR。
                </Text>
              </View>

              <Pressable
                onPress={() => shareJourney(selectedPassportEntry)}
                style={({ pressed }) => [
                  styles.v45ShareButton,
                  pressed && styles.v45MoodCtaPressed,
                ]}
              >
                <Text style={styles.v45ShareIcon}>↗</Text>
                <Text style={styles.v45ShareText}>分享這趟旅程</Text>
              </Pressable>
            </ScrollView>

            <View
              ref={shareTicketRef}
              collapsable={false}
              style={styles.v45SharePosterOffscreen}
            >
              <V45SharePoster
                entry={selectedPassportEntry}
                photoUri={
                  selectedPassportEntry.photos?.[
                    Math.min(passportPhotoIndex, Math.max(0, (selectedPassportEntry.photos?.length ?? 1) - 1))
                  ]?.uri
                }
              />
            </View>
          </View>
        )}

      </Animated.View>

    </View>
  );
}
