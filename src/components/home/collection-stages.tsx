import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type { useDetourHomeController } from '../../hooks/use-detour-home-controller';
import { styles } from '../../styles/home-styles';
import { DetourAccentStroke } from '../ticket-visuals';
import {
  JourneyHistoryTicket,
  V45SharePoster,
  V46CompleteArtwork,
  V46ReviewArtwork,
} from '../journey-recap-visuals';

type Controller = ReturnType<typeof useDetourHomeController>;

function CompletionTransition({ onComplete }: { onComplete: () => void }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    sweep.setValue(0);
    dot.setValue(0);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(250),
          Animated.spring(dot, {
            toValue: 1,
            speed: 24,
            bounciness: 7,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(90),
    ]);

    animation.start(({ finished }) => {
      if (finished) onCompleteRef.current();
    });

    return () => animation.stop();
  }, [dot, sweep]);

  return (
    <View style={styles.completionTransitionScreen}>
      <View style={styles.completionTransitionTrack}>
        <View style={styles.completionTransitionRail} />
        <Animated.View
          style={[
            styles.completionTransitionSweep,
            { transform: [{ scaleX: sweep }] },
          ]}
        />
        <Animated.View
          style={[
            styles.completionTransitionDot,
            {
              opacity: dot,
              transform: [
                {
                  scale: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

export function CollectionStages({
  controller,
}: {
  controller: Controller;
}) {
  const {
    clearPassport,
    developerToolsUnlocked,
    goBack,
    lastCompletedEntry,
    openPassportEntry,
    passport,
    passportLoaded,
    passportPhotoIndex,
    photos,
    resetDetour,
    selectedMinutes,
    selectedPassportEntry,
    selectedScene,
    setPassportPhotoIndex,
    shareJourney,
    shareTicketRef,
    stage,
    transitionTo,
  } = controller;

  return (
    <>
      {stage === 'developing' && (
        <CompletionTransition onComplete={() => transitionTo('finish')} />
      )}

      {stage === 'finish' && (
        <View style={styles.v45FinishScreen}>
          <View style={styles.v45FinishHeader}>
            <Text style={styles.v45FinishBrand}>DETOUR</Text>
            <Pressable
              onPress={() => transitionTo('settings')}
              style={styles.v45FinishMenu}
            >
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
              <DetourAccentStroke
                width={76}
                style={styles.v45FinishTitleUnderline}
              />
            </View>

            <V46CompleteArtwork
              entry={lastCompletedEntry}
              photos={photos}
              fallbackDestination={selectedScene?.name ?? '這趟的終點'}
              fallbackMinutes={selectedMinutes}
            />

            <View style={styles.v56FinishActions}>
              <Pressable
                onPress={() => {
                  if (lastCompletedEntry) openPassportEntry(lastCompletedEntry);
                  else transitionTo('passport');
                }}
                style={({ pressed }) => [
                  styles.v56FinishReviewButton,
                  pressed && { opacity: 0.72 },
                ]}
              >
                <Text style={styles.v56FinishReviewText}>查看旅程回顧</Text>
              </Pressable>

              <Pressable
                disabled={!lastCompletedEntry}
                onPress={() => {
                  if (lastCompletedEntry) void shareJourney(lastCompletedEntry);
                }}
                style={({ pressed }) => [
                  styles.v56FinishShareButton,
                  !lastCompletedEntry && { opacity: 0.45 },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Text style={styles.v56FinishShareText}>分享這趟旅程</Text>
              </Pressable>
            </View>

            <Pressable onPress={resetDetour} style={styles.v56FinishHomeLink}>
              <Text style={styles.v56FinishHomeLinkText}>回到首頁</Text>
            </Pressable>
          </ScrollView>

          {lastCompletedEntry && (
            <View
              ref={shareTicketRef}
              collapsable={false}
              style={styles.v45SharePosterOffscreen}
            >
              <V45SharePoster entry={lastCompletedEntry} />
            </View>
          )}
        </View>
      )}

      {stage === 'passport' && (
        <View style={styles.v56HistoryScreen}>
          <View style={styles.v56HistoryTop}>
            <Pressable onPress={goBack} hitSlop={16} style={styles.v56HistoryBack}>
              <Text style={styles.v56HistoryBackText}>←</Text>
            </Pressable>
            <Text style={styles.v56HistoryBrand}>DETOUR</Text>
            <View style={styles.v56HistoryMenu} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.v56HistoryScroll}
          >
            <Text style={styles.v56HistoryTitle}>旅程回顧</Text>
            <DetourAccentStroke width={96} style={{ marginTop: 2 }} />
            <Text style={styles.v56HistorySubtitle}>
              {passportLoaded
                ? `選擇一趟旅程 · 共 ${passport.length} 趟`
                : '正在載入旅程…'}
            </Text>

            {passport.length === 0 ? (
              <View style={styles.v56HistoryEmpty}>
                <Text style={styles.v56HistoryEmptyTitle}>
                  第一趟完成後，旅程票會留在這裡。
                </Text>
              </View>
            ) : (
              <View style={styles.v56HistoryList}>
                {passport.map((entry, index) => (
                  <Pressable
                    key={entry.id}
                    onPress={() => openPassportEntry(entry)}
                    style={({ pressed }) => [
                      pressed && { opacity: 0.8, transform: [{ scale: 0.992 }] },
                    ]}
                  >
                    <JourneyHistoryTicket entry={entry} featured={index === 0} />
                  </Pressable>
                ))}
              </View>
            )}

            {developerToolsUnlocked && passport.length > 0 && (
              <Pressable onPress={clearPassport} style={styles.v56HistoryClear}>
                <Text style={styles.v56HistoryClearText}>清除測試收藏</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      {stage === 'passportDetail' && selectedPassportEntry && (
        <View style={styles.v56DetailScreen}>
          <View style={styles.v56DetailTop}>
            <Pressable onPress={goBack} hitSlop={16} style={styles.v56DetailBack}>
              <Text style={styles.v56DetailBackText}>←</Text>
            </Pressable>
            <Text style={styles.v56DetailBrand}>DETOUR</Text>
            <View style={styles.v56DetailSpacer} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.v56DetailScroll}
          >
            <V46ReviewArtwork
              entry={selectedPassportEntry}
              photoIndex={passportPhotoIndex}
              onPhotoIndex={setPassportPhotoIndex}
            />

            <Pressable
              onPress={() => void shareJourney(selectedPassportEntry)}
              style={({ pressed }) => [
                styles.v56DetailShareButton,
                pressed && { opacity: 0.78 },
              ]}
            >
              <Text style={styles.v56DetailShareIcon}>↗</Text>
              <Text style={styles.v56DetailShareText}>分享這趟旅程</Text>
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
                  Math.min(
                    passportPhotoIndex,
                    Math.max(0, (selectedPassportEntry.photos?.length ?? 1) - 1)
                  )
                ]?.uri
              }
            />
          </View>
        </View>
      )}
    </>
  );
}
