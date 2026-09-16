import type { RefObject } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type { useDetourHomeController } from '../../hooks/use-detour-home-controller';
import { formatPassportDate } from '../../lib/detour-formatters';
import { styles } from '../../styles/home-styles';
import { DetourAccentStroke } from '../ticket-visuals';
import {
  V45SharePoster,
  V46CompleteArtwork,
  V46ReviewArtwork,
} from '../journey-recap-visuals';

type Controller = ReturnType<
  typeof useDetourHomeController
>;

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
    totalDiscoveries,
    totalDistanceMeters,
    transitionTo,
  } = controller;

  return (
    <>
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
    </>
  );
}
