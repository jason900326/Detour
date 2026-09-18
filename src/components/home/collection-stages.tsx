import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type { useDetourHomeController } from '../../hooks/use-detour-home-controller';
import type { PassportEntry } from '../../lib/app-model';
import { styles } from '../../styles/home-styles';
import { DetourAccentStroke } from '../ticket-visuals';
import {
  JourneyHistoryTicket,
  V45SharePoster,
  V46CompleteArtwork,
  V46ReviewArtwork,
} from '../journey-recap-visuals';

type Controller = ReturnType<typeof useDetourHomeController>;

const SHARE_HEADLINES = [
  '出門的時候，\n我還不知道要去哪。',
  '只是跟著路走，\n就走到了這裡。',
  '不是為了抵達，\n才開始這趟路。',
] as const;

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

  const [shareEntry, setShareEntry] = useState<PassportEntry | null>(null);
  const [sharePhotoIndex, setSharePhotoIndex] = useState(0);
  const [shareHeadlineIndex, setShareHeadlineIndex] = useState(0);
  const [shareComposerVisible, setShareComposerVisible] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const sharePhotos = shareEntry?.photos ?? [];
  const safeSharePhotoIndex = Math.min(
    sharePhotoIndex,
    Math.max(0, sharePhotos.length - 1)
  );
  const sharePhotoUri = sharePhotos[safeSharePhotoIndex]?.uri;
  const shareHeadline = SHARE_HEADLINES[shareHeadlineIndex];

  function openShareComposer(entry: PassportEntry, preferredPhotoIndex = 0) {
    const photoCount = entry.photos?.length ?? 0;
    setShareEntry(entry);
    setSharePhotoIndex(
      photoCount > 0
        ? Math.min(Math.max(0, preferredPhotoIndex), photoCount - 1)
        : 0
    );
    setShareHeadlineIndex(0);
    setShareComposerVisible(true);
  }

  async function shareSelectedPoster() {
    if (!shareEntry || !sharePhotoUri || shareBusy) return;

    setShareBusy(true);
    try {
      await shareJourney(shareEntry, shareHeadline);
      setShareComposerVisible(false);
    } finally {
      setShareBusy(false);
    }
  }

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
                onPress={() => transitionTo('passport')}
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
                  if (lastCompletedEntry) openShareComposer(lastCompletedEntry);
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
              onPress={() =>
                openShareComposer(selectedPassportEntry, passportPhotoIndex)
              }
              style={({ pressed }) => [
                styles.v56DetailShareButton,
                pressed && { opacity: 0.78 },
              ]}
            >
              <Text style={styles.v56DetailShareIcon}>↗</Text>
              <Text style={styles.v56DetailShareText}>分享這趟旅程</Text>
            </Pressable>
          </ScrollView>

        </View>
      )}

      <Modal
        visible={shareComposerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!shareBusy) setShareComposerVisible(false);
        }}
      >
        <View style={styles.v57ComposerScreen}>
          <View style={styles.v57ComposerTop}>
            <Text style={styles.v57ComposerTitle}>分享這趟 DETOUR</Text>
            <Pressable
              disabled={shareBusy}
              onPress={() => setShareComposerVisible(false)}
              style={styles.v57ComposerClose}
              hitSlop={12}
            >
              <Text style={styles.v57ComposerCloseText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.v57ComposerScroll}
          >
            <Text style={styles.v57ComposerSectionLabel}>選一張代表照片</Text>

            <View style={styles.v57ComposerPhotoPreview}>
              {sharePhotoUri ? (
                <Image
                  source={{ uri: sharePhotoUri }}
                  style={styles.v57ComposerPhotoPreviewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.v57ComposerNoPhoto}>
                  <Text style={styles.v57ComposerNoPhotoText}>
                    這趟沒有可用照片。DETOUR 分享圖需要先選一張旅程照片。
                  </Text>
                </View>
              )}
            </View>

            {sharePhotos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.v57ComposerThumbScroller}
                contentContainerStyle={styles.v57ComposerThumbContent}
              >
                {sharePhotos.map((photo, index) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => setSharePhotoIndex(index)}
                    style={styles.v57ComposerThumbPress}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={[
                        styles.v57ComposerThumb,
                        index === safeSharePhotoIndex &&
                          styles.v57ComposerThumbActive,
                      ]}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.v57ComposerHeadlineSection}>
              <Text style={styles.v57ComposerSectionLabel}>選一句話</Text>
              {SHARE_HEADLINES.map((headline, index) => (
                <Pressable
                  key={headline}
                  onPress={() => setShareHeadlineIndex(index)}
                  style={[
                    styles.v57ComposerHeadlineOption,
                    index === shareHeadlineIndex &&
                      styles.v57ComposerHeadlineOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.v57ComposerHeadlineText,
                      index === shareHeadlineIndex &&
                        styles.v57ComposerHeadlineTextActive,
                    ]}
                  >
                    {headline}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={!sharePhotoUri || shareBusy}
              onPress={() => void shareSelectedPoster()}
              style={[
                styles.v57ComposerShareButton,
                (!sharePhotoUri || shareBusy) &&
                  styles.v57ComposerShareButtonDisabled,
              ]}
            >
              <Text style={styles.v57ComposerShareText}>
                {shareBusy ? '正在準備分享圖…' : '分享這張圖'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {shareEntry && (
        <View
          ref={shareTicketRef}
          collapsable={false}
          style={styles.v45SharePosterOffscreen}
        >
          <V45SharePoster
            entry={shareEntry}
            photoUri={sharePhotoUri}
            headline={shareHeadline}
          />
        </View>
      )}
    </>
  );
}
