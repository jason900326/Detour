import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Directory, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Circle, Polyline } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';

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
import { DetourAccentStroke, DetourTicket, V45Ticket } from '../components/ticket-visuals';
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
                      <View style={styles.settingsChoiceText}>
                        <Text style={styles.settingsChoiceTitle}>
                          {pace.label}
                        </Text>
                        <Text style={styles.settingsChoiceNote}>
                          {pace.note}
                        </Text>
                      </View>
                      <Text style={styles.settingsChoiceMeta}>
                        {pace.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>導航</Text>
                <View style={styles.settingsChoice}>
                  <View style={styles.settingsChoiceText}>
                    <Text style={styles.settingsChoiceTitle}>迷路時再給地圖</Text>
                    <Text style={styles.settingsChoiceNote}>
                      平常只給方向；真的走歪了，再自己打開小地圖。
                    </Text>
                  </View>
                  <Text style={styles.settingsChoiceMeta}>預設</Text>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>鏡頭</Text>
                <View style={styles.settingsChoice}>
                  <View style={styles.settingsChoiceText}>
                    <Text style={styles.settingsChoiceTitle}>旅程底片</Text>
                    <Text style={styles.settingsChoiceNote}>
                      每趟最多保留 {getFilmRollCapacity(selectedMinutes)} 張。
                    </Text>
                  </View>
                  <Text style={styles.settingsChoiceMeta}>
                    {getFilmRollCapacity(selectedMinutes)} 張
                  </Text>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>教學</Text>
                <Pressable
                  onPress={replayOnboarding}
                  style={({ pressed }) => [
                    styles.settingsChoice,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <View style={styles.settingsChoiceText}>
                    <Text style={styles.settingsChoiceTitle}>再看一次</Text>
                    <Text style={styles.settingsChoiceNote}>
                      重新看三張新手提示。
                    </Text>
                  </View>
                  <Text style={styles.settingsChoiceMeta}>→</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={toggleDevMode}
                onLongPress={toggleDeveloperTools}
                delayLongPress={900}
                style={({ pressed }) => [
                  styles.settingsDeveloperToggle,
                  devMode && styles.settingsDeveloperToggleActive,
                  pressed && styles.pressedLight,
                ]}
              >
                <View>
                  <Text style={styles.settingsDeveloperTitle}>開發測試</Text>
                  <Text style={styles.settingsDeveloperNote}>
                    {developerToolsUnlocked
                      ? devMode
                        ? '已顯示室內測試工具與 AI 狀態。'
                        : '長按這列可再次解鎖；點一下切換顯示。'
                      : '一般使用不需要開啟。'}
                  </Text>
                </View>
                <Text style={styles.settingsDeveloperMeta}>
                  {devMode ? 'ON' : 'OFF'}
                </Text>
              </Pressable>

              {developerToolsUnlocked && (
              <View style={styles.settingsDeveloperPanel}>
                <View style={styles.settingsDeveloperHeader}>
                  <Text style={styles.settingsDeveloperHeading}>開發工具</Text>
                  <Text style={styles.settingsDeveloperEyebrow}>DEV</Text>
                </View>

                <View style={styles.settingsDeveloperRow}>
                  <View style={styles.settingsDeveloperCopy}>
                    <Text style={styles.settingsDeveloperLabel}>AI 引擎</Text>
                    <Text style={styles.settingsDeveloperValue}>
                      {isAIEngineConfigured()
                        ? '已設定 API key'
                        : '未設定 API key，使用本機規則'}
                    </Text>
                    {lastAIResult ? (
                      <Text style={styles.settingsDeveloperMetaLine}>
                        上次結果：{lastAIResult}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    disabled={aiConnectionTesting}
                    onPress={() => void runAIConnectionTest()}
                    style={({ pressed }) => [
                      styles.settingsDeveloperButton,
                      pressed && styles.pressedLight,
                      aiConnectionTesting && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.settingsDeveloperButtonText}>
                      {aiConnectionTesting ? '測試中…' : '測試連線'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.settingsDeveloperRow}>
                  <View style={styles.settingsDeveloperCopy}>
                    <Text style={styles.settingsDeveloperLabel}>遊玩測試</Text>
                    <Text style={styles.settingsDeveloperValue}>
                      {playtestSessions.length} 筆 session
                    </Text>
                    <Text style={styles.settingsDeveloperMetaLine}>
                      Tester {playtestTesterId || '—'} · v{DETOUR_PLAYTEST_VERSION}
                    </Text>
                  </View>
                  <Pressable
                    disabled={playtestSyncing}
                    onPress={() => void syncPlaytestDataNow()}
                    style={({ pressed }) => [
                      styles.settingsDeveloperButton,
                      pressed && styles.pressedLight,
                      playtestSyncing && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.settingsDeveloperButtonText}>
                      {playtestSyncing ? '同步中…' : '同步'}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => void sharePlaytestData()}
                  style={({ pressed }) => [
                    styles.settingsDeveloperShare,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={styles.settingsDeveloperShareText}>
                    匯出測試報告
                  </Text>
                </Pressable>

                <Pressable
                  onPress={clearPlaytestData}
                  style={({ pressed }) => [
                    styles.settingsDanger,
                    pressed && styles.pressedLight,
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
          <View style={styles.v45PrintingScreen}>
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

            <View style={styles.v48PrinterAssembly}>
              <View pointerEvents="none" style={styles.v50PrinterBody}>
                <View style={styles.v50PrinterHighlight} />
                <View style={styles.v50PrinterSlotShell}>
                  <View style={styles.v50PrinterSlot} />
                </View>
              </View>

              <View style={styles.v48PaperViewport}>
                <Animated.View
                  style={[
                    styles.v48PaperTrack,
                    {
                      transform: [
                        {
                          translateY: routeProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-405, 0],
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

            <View style={styles.v41MissionBody}>
              <Text style={styles.v41MissionEyebrow}>路上任務</Text>
              <Text style={styles.v41MissionTitle}>{currentMission.title}</Text>
              <View style={styles.v41MissionUnderline} />
              <View style={styles.v41MissionRule} />
              <Text style={styles.v41MissionMeta}>看到就拍 · 最多 {rollCapacity} 張</Text>
            </View>

            <View style={styles.v41MissionBottom}>
              <Pressable onPress={() => openCamera('side')} style={({ pressed }) => [styles.v41MissionPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v41MissionPrimaryText}>打開相機</Text><Text style={styles.v41MissionPrimaryArrow}>→</Text></Pressable>
              <Pressable onPress={skipCurrentRequiredMission} style={({ pressed }) => [styles.v41MissionSkip, pressed && styles.v35JourneyPressed]}><Text style={styles.v41MissionSkipText}>先跳過</Text></Pressable>
              {devMode && (
                <Pressable onPress={completeSideMissionWithoutPhoto} style={({ pressed }) => [styles.v41DevAdvance, pressed && styles.v35JourneyPressed]}>
                  <Text style={styles.v41DevAdvanceText}>室內測試 · 完成這個任務 →</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {stage === 'arrival' && plan && (
          <View style={styles.v41ArrivalScreen}>
            <View style={styles.v41ArrivalTop}>
              <Text style={styles.v41ArrivalBrand}>DETOUR</Text>
              <Text style={styles.v41ArrivalMeta}>到了</Text>
            </View>
            <View style={styles.v41ArrivalHero}>
              <View style={styles.v41ArrivalPin}><View style={styles.v41ArrivalPinCore} /></View>
              <Text style={styles.v41ArrivalEyebrow}>ARRIVAL</Text>
              <Text style={styles.v41ArrivalTitle}>{plan.arrivalMission?.title ?? '找一個你想記住的畫面'}</Text>
              <View style={styles.v41ArrivalUnderline} />
              <Text style={styles.v41ArrivalBody}>不用找最佳角度。你停下來的那一刻，就算到了。</Text>
            </View>
            <View style={styles.v41ArrivalBottom}>
              <Pressable onPress={() => openCamera('arrival')} style={({ pressed }) => [styles.v41ArrivalPrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v41ArrivalPrimaryText}>拍下這一站</Text><Text style={styles.v41ArrivalPrimaryArrow}>→</Text></Pressable>
              <Pressable onPress={skipArrivalRequiredMission} style={({ pressed }) => [styles.v41MissionSkip, pressed && styles.v35JourneyPressed]}><Text style={styles.v41MissionSkipText}>這次不拍</Text></Pressable>
              {devMode && (
                <Pressable onPress={completeArrivalWithoutPhoto} style={({ pressed }) => [styles.v41DevAdvance, pressed && styles.v35JourneyPressed]}>
                  <Text style={styles.v41DevAdvanceText}>室內測試 · 直接完成旅程 →</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {stage === 'complete' && plan && (
          <View style={styles.v46CompleteScreen}>
            <View style={styles.v46CompleteHeader}>
              <Text style={styles.v46CompleteBrand}>DETOUR</Text>
              <Text style={styles.v46CompleteMeta}>旅程完成</Text>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.v46CompleteScroll}
            >
              <V46CompleteArtwork
                moodId={plan.moodId}
                moodLabel={mood?.label ?? '—'}
                durationMinutes={plan.durationMinutes}
                serial={ticketSerial(String(plan.durationMinutes), plan.moodId)}
              />
              <View style={styles.v46CompleteCopy}>
                <Text style={styles.v46CompleteEyebrow}>DETOUR COMPLETE</Text>
                <Text style={styles.v46CompleteTitle}>這一趟，{`\n`}你真的走完了。</Text>
              </View>
              <View style={styles.v46CompleteStats}>
                <View style={styles.v46CompleteStat}>
                  <Text style={styles.v46CompleteStatLabel}>距離</Text>
                  <Text style={styles.v46CompleteStatValue}>{traveledMeters >= 1000 ? `${(traveledMeters / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(traveledMeters))} m`}</Text>
                </View>
                <View style={styles.v46CompleteStat}>
                  <Text style={styles.v46CompleteStatLabel}>照片</Text>
                  <Text style={styles.v46CompleteStatValue}>{photos.length} 張</Text>
                </View>
              </View>
              <Pressable onPress={() => transitionTo('review')} style={({ pressed }) => [styles.v46CompletePrimary, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v46CompletePrimaryText}>看看這趟</Text><Text style={styles.v46CompletePrimaryArrow}>→</Text></Pressable>
            </ScrollView>
          </View>
        )}

        {stage === 'review' && plan && (
          <View style={styles.v46ReviewScreen}>
            <View style={styles.v46ReviewHeader}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v46ReviewBack}><Text style={styles.v46ReviewBackText}>‹</Text></Pressable>
              <Text style={styles.v46ReviewBrand}>旅程回顧</Text>
              <Text style={styles.v46ReviewMeta}>DETOUR</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v46ReviewScroll}>
              <V46ReviewArtwork
                moodId={plan.moodId}
                moodLabel={mood?.label ?? '—'}
                durationMinutes={plan.durationMinutes}
                serial={ticketSerial(String(plan.durationMinutes), plan.moodId)}
                photos={photos}
              />
              <Pressable onPress={shareJourney} style={({ pressed }) => [styles.v46ReviewShare, pressed && styles.v35JourneyPrimaryPressed]}><Text style={styles.v46ReviewShareText}>分享這趟旅程</Text><Text style={styles.v46ReviewShareArrow}>↗</Text></Pressable>
              <Pressable onPress={resetDetour} style={({ pressed }) => [styles.v46ReviewAgain, pressed && styles.v35JourneyPressed]}><Text style={styles.v46ReviewAgainText}>再來一趟</Text></Pressable>
            </ScrollView>
          </View>
        )}

        {stage === 'passport' && (
          <View style={styles.v46PassportScreen}>
            <View style={styles.v46PassportHeader}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v46PassportBack}><Text style={styles.v46PassportBackText}>‹</Text></Pressable>
              <Text style={styles.v46PassportBrand}>已完成的旅程</Text>
              <Text style={styles.v46PassportMeta}>DETOUR</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v46PassportScroll}>
              {passport.length > 0 ? (
                <>
                  <View style={styles.v46PassportSummary}>
                    <Text style={styles.v46PassportSummaryLabel}>旅程收藏</Text>
                    <Text style={styles.v46PassportSummaryCount}>{passport.length}</Text>
                    <Text style={styles.v46PassportSummaryNote}>趟 DETOUR</Text>
                  </View>
                  <View style={styles.v46PassportTotals}>
                    <View style={styles.v46PassportTotalItem}><Text style={styles.v46PassportTotalValue}>{totalDistanceMeters >= 1000 ? `${(totalDistanceMeters / 1000).toFixed(1)} km` : `${Math.round(totalDistanceMeters)} m`}</Text><Text style={styles.v46PassportTotalLabel}>走過</Text></View>
                    <View style={styles.v46PassportTotalItem}><Text style={styles.v46PassportTotalValue}>{totalDiscoveries}</Text><Text style={styles.v46PassportTotalLabel}>張照片</Text></View>
                  </View>
                  <View style={styles.v46PassportList}>
                    {passport.map((entry, index) => (
                      <Pressable key={entry.id} onPress={() => openPassportEntry(entry.id)} style={({ pressed }) => [styles.v46PassportTicket, pressed && styles.v35JourneyPressed]}>
                        <View style={styles.v46PassportTicketTop}>
                          <View><Text style={styles.v46PassportTicketNo}>DTR-{String(index + 1).padStart(3, '0')}</Text><Text style={styles.v46PassportTicketDate}>{formatPassportDate(entry.completedAt)}</Text></View>
                          <Text style={styles.v46PassportTicketArrow}>→</Text>
                        </View>
                        <Text style={styles.v46PassportTicketTitle}>{entry.destination.name}</Text>
                        <View style={styles.v46PassportTicketMeta}><Text style={styles.v46PassportTicketMetaText}>{entry.durationMinutes} 分</Text><Text style={styles.v46PassportTicketMetaText}>{entry.moodLabel}</Text><Text style={styles.v46PassportTicketMetaText}>{entry.photos.length} 張</Text></View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.v46PassportEmpty}><Text style={styles.v46PassportEmptyMark}>◌</Text><Text style={styles.v46PassportEmptyTitle}>還沒有走完的 DETOUR。</Text><Text style={styles.v46PassportEmptyBody}>第一張票，會從你真的出發之後開始。</Text></View>
              )}
            </ScrollView>
          </View>
        )}

        {stage === 'passport-detail' && selectedPassportEntry && (
          <View style={styles.v46PassportDetailScreen}>
            <View style={styles.v46PassportDetailHeader}>
              <Pressable onPress={goBack} hitSlop={16} style={styles.v46PassportBack}><Text style={styles.v46PassportBackText}>‹</Text></Pressable>
              <Text style={styles.v46PassportBrand}>旅程 #{String(selectedPassportNumber).padStart(3, '0')}</Text>
              <Text style={styles.v46PassportMeta}>{formatPassportDate(selectedPassportEntry.completedAt)}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v46PassportDetailScroll}>
              <View style={styles.v46PassportMapWrap}>
                {passportMapRegion ? (
                  <MapView style={styles.v46PassportMap} initialRegion={passportMapRegion} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} showsCompass={false} toolbarEnabled={false}>
                    {selectedPassportEntry.trace.length > 1 && <Polyline coordinates={selectedPassportEntry.trace} strokeColor={SIGNAL} strokeWidth={4} lineCap="round" />}
                    <Circle center={selectedPassportEntry.destination} radius={12} strokeColor={BONE} strokeWidth={1} fillColor={SIGNAL} />
                  </MapView>
                ) : <View style={styles.v46PassportMapFallback} />}
                <View style={styles.v46PassportMapStamp}><Text style={styles.v46PassportMapStampText}>走過</Text></View>
              </View>
              <View style={styles.v46PassportDetailCopy}>
                <Text style={styles.v46PassportDetailEyebrow}>{selectedPassportEntry.moodLabel} · {selectedPassportEntry.durationMinutes} 分</Text>
                <Text style={styles.v46PassportDetailTitle}>{selectedPassportEntry.destination.name}</Text>
              </View>
              {selectedPassportEntry.photos.length > 0 ? (
                <View style={styles.v46PassportPhotoStage}>
                  <Image source={{ uri: selectedPassportEntry.photos[Math.min(passportPhotoIndex, selectedPassportEntry.photos.length - 1)].uri }} style={styles.v46PassportPhoto} resizeMode="cover" />
                  <View style={styles.v46PassportPhotoMeta}><Text style={styles.v46PassportPhotoMetaText}>{Math.min(passportPhotoIndex + 1, selectedPassportEntry.photos.length)} / {selectedPassportEntry.photos.length}</Text></View>
                  {selectedPassportEntry.photos.length > 1 && <View style={styles.v46PassportPhotoControls}><Pressable onPress={() => setPassportPhotoIndex((index) => Math.max(0, index - 1))} disabled={passportPhotoIndex <= 0} style={[styles.v46PassportPhotoButton, passportPhotoIndex <= 0 && { opacity: 0.35 }]}><Text style={styles.v46PassportPhotoButtonText}>←</Text></Pressable><Pressable onPress={() => setPassportPhotoIndex((index) => Math.min(selectedPassportEntry.photos.length - 1, index + 1))} disabled={passportPhotoIndex >= selectedPassportEntry.photos.length - 1} style={[styles.v46PassportPhotoButton, passportPhotoIndex >= selectedPassportEntry.photos.length - 1 && { opacity: 0.35 }]}><Text style={styles.v46PassportPhotoButtonText}>→</Text></Pressable></View>}
                </View>
              ) : <View style={styles.v46PassportNoPhoto}><Text style={styles.v46PassportNoPhotoText}>這趟沒有留下照片。</Text></View>}
              <View style={styles.v46PassportDetailStats}><View style={styles.v46PassportDetailStat}><Text style={styles.v46PassportDetailStatLabel}>距離</Text><Text style={styles.v46PassportDetailStatValue}>{selectedPassportEntry.distanceMeters >= 1000 ? `${(selectedPassportEntry.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(selectedPassportEntry.distanceMeters)} m`}</Text></View><View style={styles.v46PassportDetailStat}><Text style={styles.v46PassportDetailStatLabel}>任務</Text><Text style={styles.v46PassportDetailStatValue}>{selectedPassportEntry.missions.length}</Text></View></View>
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
