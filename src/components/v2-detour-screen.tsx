import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Circle, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PassportEntry } from '../lib/app-model';
import type { NavigationTurn } from '../lib/navigation-engine';
import type { V2Phase } from '../hooks/use-v2-detour-controller';
import { useV2DetourController } from '../hooks/use-v2-detour-controller';

const COLORS = {
  ink: '#16130F',
  bone: '#F4F0E7',
  paper: '#FFFDF7',
  signal: '#FF5A36',
  muted: '#81796F',
  line: '#D8D0C3',
  paleSignal: '#FFE3D9',
  map: '#E4E8E0',
};

function elapsedLabel(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '剛剛';
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function navigationCopy(turn: NavigationTurn | undefined, closing: boolean) {
  if (turn === 'left') return '下一個路口左轉';
  if (turn === 'right') return '下一個路口右轉';
  if (turn === 'slight-left') return '往左前方續走';
  if (turn === 'slight-right') return '往右前方續走';
  if (turn === 'arrive') return closing ? '最後一小段。' : '沿這段路找找看。';
  return closing ? '往這邊走一小段。' : '沿這段路找找看。';
}

function routeRegion(point: { latitude: number; longitude: number } | null) {
  if (!point) return null;
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.0028,
    longitudeDelta: 0.0028,
  };
}

function routePreviewRegion(
  coordinates: { latitude: number; longitude: number }[]
) {
  if (coordinates.length === 0) return null;
  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.002, (maxLatitude - minLatitude) * 1.45),
    longitudeDelta: Math.max(0.002, (maxLongitude - minLongitude) * 1.45),
  };
}

function V2Ticket({
  serial,
  emojiTrail,
  compact = false,
}: {
  serial?: string;
  emojiTrail: string[];
  compact?: boolean;
}) {
  const trailScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (emojiTrail.length === 0) return;
    trailScale.setValue(0.78);
    Animated.spring(trailScale, {
      toValue: 1,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [emojiTrail.length, trailScale]);

  return (
    <View style={[styles.ticket, compact && styles.ticketCompact]}>
      <View style={styles.ticketTop}>
        <Text style={styles.ticketBrand}>DETOUR</Text>
        <Text style={styles.ticketSerial}>{serial ?? 'DETOUR'}</Text>
      </View>
      <View style={styles.ticketRule} />
      {!compact && (
        <>
          <Text style={styles.ticketEyebrow}>這趟留下的東西</Text>
          <Animated.Text style={[styles.ticketTitle, { transform: [{ scale: trailScale }] }]}>
            {emojiTrail.length > 0 ? emojiTrail.join(' ') : '還沒有'}
          </Animated.Text>
        </>
      )}
      {compact && (
        <Animated.Text style={[styles.ticketCompactEmoji, { transform: [{ scale: trailScale }] }]}>
          {emojiTrail.join(' ') || '—'}
        </Animated.Text>
      )}
      <View style={styles.ticketFooter}>
        <Text style={styles.ticketFooterText}>約 10 分鐘 · 自由探索</Text>
        <Text style={styles.ticketDots}>· · · · · · ·</Text>
      </View>
    </View>
  );
}

function JourneyMap({
  point,
  coordinates,
}: {
  point: { latitude: number; longitude: number } | null;
  coordinates: { latitude: number; longitude: number }[];
}) {
  const region = useMemo(() => routeRegion(point), [point]);
  if (!point || !region) return null;

  return (
    <View style={styles.mapFrame}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        region={region}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={COLORS.signal}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
        <Circle
          center={point}
          radius={12}
          strokeColor={COLORS.paper}
          strokeWidth={3}
          fillColor="#3C75E8"
        />
      </MapView>
      <View pointerEvents="none" style={styles.mapCaption}>
        <Text style={styles.mapCaptionText}>只看下一小段</Text>
      </View>
    </View>
  );
}

function RoutePreview({
  coordinates,
  label = '這趟走過的路',
}: {
  coordinates: { latitude: number; longitude: number }[];
  label?: string;
}) {
  const region = useMemo(() => routePreviewRegion(coordinates), [coordinates]);
  if (!region || coordinates.length < 2) return null;

  return (
    <View style={styles.routePreviewWrap}>
      <Text style={styles.routePreviewLabel}>{label}</Text>
      <View style={styles.routePreviewFrame}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          region={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
        >
          <Polyline
            coordinates={coordinates}
            strokeColor={COLORS.signal}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        </MapView>
      </View>
    </View>
  );
}

function HomePanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.homeHeader}>
        <Text style={styles.brand}>DETOUR</Text>
        <Pressable onPress={controller.openHistory} style={styles.historyButton}>
          <Text style={styles.historyButtonText}>紀錄 {controller.passport.length}</Text>
        </Pressable>
      </View>

      <View style={styles.homeCenter}>
        <Text style={styles.homeKicker}>不知道要幹嘛？</Text>
        <Text style={styles.homeTitle}>去繞一下</Text>
        <Text style={styles.homeSubline}>帶你走一段平常不會走的路，{`\n`}一路注意平常不會注意的東西。</Text>
        <Pressable
          accessibilityLabel="去繞一下"
          onPress={() => void controller.startJourney()}
          style={({ pressed }) => [styles.startButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.startButtonText}>去繞一下</Text>
          <Text style={styles.startButtonArrow}>→</Text>
        </Pressable>
        <Text style={styles.homeTime}>約 10 分鐘</Text>
        <Pressable
          accessibilityLabel="室內測試"
          onPress={controller.startIndoorJourney}
          style={({ pressed }) => [styles.homeTestButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.homeTestLabel}>室內測試</Text>
          <Text style={styles.homeTestCopy}>不需要 GPS · 模擬走路</Text>
        </Pressable>
      </View>

      <View style={styles.homeBottom}>
        <View style={styles.homeAccent} />
        <Text style={styles.homeFootnote}>不知道這次會找什麼，也不知道最後會停在哪裡。</Text>
        {controller.errorMessage && <Text style={styles.errorText}>{controller.errorMessage}</Text>}
      </View>
    </SafeAreaView>
  );
}

function StartingPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.startingHeader}>
        <Text style={styles.brand}>DETOUR</Text>
        <Text style={styles.smallLabel}>PLAYTEST BUILD</Text>
      </View>
      <View style={styles.startingContent}>
        <V2Ticket serial={controller.ticketSerial} emojiTrail={controller.emojiTrail} />
        <Text style={styles.startingTitle}>這趟路正在形成。</Text>
        <Text style={styles.startingCopy}>{controller.statusMessage || '正在找一條適合先走的小段。'}</Text>
        {controller.isPlanning && <View style={styles.loadingDot} />}
        {controller.errorMessage && (
          <View style={styles.inlineError}>
            <Text style={styles.errorText}>{controller.errorMessage}</Text>
            <Pressable
              onPress={controller.isIndoorMode ? controller.startIndoorJourney : () => void controller.startJourney()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>再試一次</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function IndoorPlaytestControls({
  controller,
}: {
  controller: ReturnType<typeof useV2DetourController>;
}) {
  if (!controller.isIndoorMode) return null;

  return (
    <View style={styles.indoorControls}>
      <View style={styles.indoorControlsHeader}>
        <Text style={styles.indoorControlsTitle}>室內測試控制</Text>
        <Text style={styles.indoorControlsCopy}>不讀 GPS、不呼叫路線服務</Text>
      </View>
      <Text style={styles.indoorStateLine}>
        {controller.phase === 'closing' ? 'Closing' : 'Exploration'} · {controller.discoveries} 個發現 · {elapsedLabel(controller.elapsedSeconds)}
      </Text>
      <Text style={styles.indoorTargetLine}>
        題目難度：{controller.activeTarget?.difficulty ?? '—'}
      </Text>
      <View style={styles.indoorButtonRow}>
        <Pressable
          disabled={controller.isPlanning}
          onPress={() => controller.simulateIndoorStep(35)}
          style={({ pressed }) => [
            styles.indoorButton,
            styles.indoorButtonPrimary,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonPrimaryText}>走 35m</Text>
        </Pressable>
        <Pressable
          disabled={controller.isPlanning}
          onPress={controller.simulateIndoorStepToEnd}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>走到這段結尾</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          disabled={controller.isPlanning}
          onPress={() => controller.simulateIndoorDeviation(100)}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>偏離 100m</Text>
        </Pressable>
        <Pressable
          disabled={controller.isPlanning}
          onPress={() => controller.simulateIndoorDeviation(500)}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || controller.isPlanning) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>遠偏離 500m</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(8 * 60 + 30)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 8:30</Text>
        </Pressable>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(10 * 60)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 10:00</Text>
        </Pressable>
        <Pressable
          onPress={() => controller.simulateIndoorFastForward(15 * 60)}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>快轉 15:00</Text>
        </Pressable>
      </View>
      <View style={styles.indoorButtonRow}>
        <Pressable
          disabled={!controller.activeTarget}
          onPress={() => controller.simulateIndoorTargetAge(120)}
          style={({ pressed }) => [
            styles.indoorButton,
            (pressed || !controller.activeTarget) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.indoorButtonText}>這題已找 2 分鐘</Text>
        </Pressable>
        <Pressable
          onPress={controller.simulateIndoorFinish}
          style={({ pressed }) => [styles.indoorButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.indoorButtonText}>直接完成 UI</Text>
        </Pressable>
      </View>
    </View>
  );
}

function JourneyPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const closing = controller.phase === 'closing';
  const beat = controller.currentNavigationBeat;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.journeyHeader}>
        <View>
          <Text style={styles.brand}>DETOUR</Text>
          <Text style={styles.journeyState}>{closing ? '差不多了' : '正在形成'}</Text>
        </View>
        <Text style={styles.elapsed}>{elapsedLabel(controller.elapsedSeconds)}</Text>
      </View>

      <JourneyMap point={controller.currentPoint} coordinates={controller.routeCoordinates} />

      <View style={styles.journeyContent}>
        <View style={styles.navigationHint}>
          <Text style={styles.navigationHintText}>{navigationCopy(beat?.turn, closing)}</Text>
          {controller.isPlanning && <Text style={styles.navigationSubHint}>下一小段正在形成</Text>}
          {!controller.isPlanning && beat?.turn === 'continue' && !closing && (
            <Text style={styles.navigationSubHint}>不用看地圖，先找眼前的東西</Text>
          )}
        </View>

        {closing ? (
          <View style={styles.closingCard}>
            <Text style={styles.closingEyebrow}>CLOSING</Text>
            <Text style={styles.closingTitle}>差不多了。</Text>
            <Text style={styles.closingCopy}>再往這邊走一小段，抵達之後才知道這趟停在哪裡。</Text>
          </View>
        ) : controller.activeTarget ? (
          <View style={styles.targetCard}>
            <View style={styles.targetEmojiBubble}>
              <Text style={styles.targetEmoji}>{controller.activeTarget.emoji}</Text>
            </View>
            <Text style={styles.targetEyebrow}>沿路找找看</Text>
            <Text style={styles.targetTitle}>{controller.activeTarget.title}</Text>
            <View style={styles.targetActions}>
              <Pressable onPress={controller.replaceTarget} style={styles.replaceButton}>
                <Text style={styles.replaceButtonText}>換一個</Text>
              </Pressable>
              <Pressable onPress={() => void controller.markFound()} style={styles.foundButton}>
                <Text style={styles.foundButtonText}>找到了</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>下一個正在形成。</Text>
            <Text style={styles.waitingCopy}>{controller.statusMessage}</Text>
          </View>
        )}

        <IndoorPlaytestControls controller={controller} />

        <View style={styles.journeyBottomRow}>
          <Pressable
            accessibilityLabel="想留就拍"
            onPress={controller.openCamera}
            style={({ pressed }) => [styles.cameraButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.cameraButtonIcon}>拍照</Text>
            <Text style={styles.cameraButtonText}>想留就拍</Text>
          </Pressable>
          <View style={styles.ticketMiniWrap}>
            <Text style={styles.ticketMiniLabel}>票上</Text>
            <Text style={styles.ticketMiniEmoji}>{controller.emojiTrail.join(' ') || '—'}</Text>
          </View>
        </View>
        {controller.errorMessage && (
          <View style={styles.journeyError}>
            <Text style={styles.errorText}>{controller.errorMessage}</Text>
            <Pressable onPress={() => void controller.retryCurrentRoute()}>
              <Text style={styles.retryLink}>重新安排</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function FinishPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.finishScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.finishHeader}>
          <Text style={styles.smallLabel}>DETOUR COMPLETE</Text>
          <Text style={styles.finishTitle}>這趟停在</Text>
          <Text style={styles.finishPlace}>{controller.endPlaceLabel ?? '附近的停留點'}</Text>
          <Text style={styles.finishCopy}>{controller.statusMessage || '這趟路留在票上了。'}</Text>
        </View>

        <V2Ticket serial={controller.ticketSerial} emojiTrail={controller.emojiTrail} />

        <View style={styles.finishMeta}>
          <Text style={styles.finishMetaText}>約 {elapsedLabel(controller.elapsedSeconds)} · {controller.discoveries} 個發現</Text>
          <Text style={styles.finishMetaText}>{controller.photos.length} 張照片</Text>
        </View>

        {controller.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {controller.photos.map((photo) => (
              <Image key={photo.id} source={{ uri: photo.uri }} style={styles.finishPhoto} />
            ))}
          </ScrollView>
        )}

        <RoutePreview coordinates={controller.trace} />

        <View style={styles.finishActions}>
          <Pressable onPress={controller.openCurrentShare} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>分享這趟</Text>
          </Pressable>
          <Pressable onPress={() => void controller.startOver()} style={styles.startAgainButton}>
            <Text style={styles.startAgainText}>{controller.isIndoorMode ? '再測一次' : '再繞一下'}</Text>
          </Pressable>
          <Pressable onPress={controller.openHistory} style={styles.historyLinkButton}>
            <Text style={styles.historyLinkText}>看紀錄</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HistoryEntryCard({
  entry,
  onPress,
}: {
  entry: PassportEntry;
  onPress: () => void;
}) {
  const photo = entry.photos?.[0];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.historyCard, pressed && styles.buttonPressed]}>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.historyPhoto} /> : <View style={styles.historyPhotoPlaceholder} />}
      <View style={styles.historyCardCopy}>
        <Text style={styles.historyEmoji}>{entry.emojiTrail?.join(' ') || '—'}</Text>
        <Text style={styles.historyDate}>{dateLabel(entry.completedAt)} · {entry.city}</Text>
        <Text style={styles.historyHint}>{entry.discoveries} 個發現</Text>
      </View>
    </Pressable>
  );
}

function HistoryPanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  if (controller.historyDetail) {
    const entry = controller.historyDetail;
    const coverPhoto = entry.photos?.[0];
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.historyDetailScroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => controller.showHistoryEntry(null)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← 所有紀錄</Text>
          </Pressable>

          <View style={styles.historyDetailHeading}>
            <View>
              <Text style={styles.smallLabel}>JOURNEY HISTORY</Text>
              <Text style={styles.historyDetailDate}>{dateLabel(entry.completedAt)}</Text>
            </View>
            <Text style={styles.historyDetailArea}>{entry.city}</Text>
          </View>

          {coverPhoto ? (
            <Image source={{ uri: coverPhoto.uri }} style={styles.historyDetailHero} />
          ) : (
            <View style={styles.historyDetailNoPhoto}>
              <Text style={styles.historyDetailNoPhotoEmoji}>{entry.emojiTrail?.join(' ') || '—'}</Text>
            </View>
          )}

          <View style={styles.historyArchiveCard}>
            <Text style={styles.historyArchiveLabel}>這趟留下的票</Text>
            <V2Ticket serial={entry.ticketSerial} emojiTrail={entry.emojiTrail ?? []} compact />
          </View>

          {entry.photos && entry.photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyPhotoStrip}>
              {entry.photos.slice(1).map((photo) => (
                <Image key={photo.id} source={{ uri: photo.uri }} style={styles.historyDetailThumb} />
              ))}
            </ScrollView>
          )}

          <RoutePreview coordinates={entry.route ?? []} label="當時走過的路" />

          <View style={styles.historyStatsCard}>
            <View>
              <Text style={styles.historyStatsValue}>{entry.discoveries}</Text>
              <Text style={styles.historyStatsLabel}>發現</Text>
            </View>
            <View>
              <Text style={styles.historyStatsValue}>{entry.photoCount ?? 0}</Text>
              <Text style={styles.historyStatsLabel}>照片</Text>
            </View>
            <View>
              <Text style={styles.historyStatsValue}>
                {Math.max(1, Math.round(entry.actualDurationMinutes ?? entry.minutes))}
              </Text>
              <Text style={styles.historyStatsLabel}>分鐘</Text>
            </View>
          </View>

          <Pressable onPress={() => controller.openHistoryShare(entry)} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>分享這趟</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.historyHeader}>
        <Pressable onPress={controller.goHome} style={styles.backLink}>
          <Text style={styles.backLinkText}>← 回首頁</Text>
        </Pressable>
        <Text style={styles.smallLabel}>JOURNEY HISTORY</Text>
        <Text style={styles.historyTitle}>留下來的路</Text>
      </View>
      <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
        {controller.passport.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryEmoji}>—</Text>
            <Text style={styles.emptyHistoryTitle}>還沒有票。</Text>
            <Text style={styles.emptyHistoryCopy}>出去繞一下，第一張票會從你現在的位置開始。</Text>
          </View>
        ) : (
          controller.passport.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} onPress={() => controller.showHistoryEntry(entry)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SharePanel({ controller }: { controller: ReturnType<typeof useV2DetourController> }) {
  const entry = controller.shareEntry;

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.shareEmpty}>
          <Text style={styles.finishTitle}>這趟還沒有可分享的內容。</Text>
          <Pressable onPress={controller.closeShare} style={styles.historyLinkButton}>
            <Text style={styles.historyLinkText}>返回</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const photo = entry.photos?.[0];
  const emojis = entry.emojiTrail ?? [];

  return (
    <SafeAreaView style={styles.shareSafe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shareHeader}>
        <Pressable onPress={controller.closeShare} style={styles.shareBackButton}>
          <Text style={styles.shareBackText}>← 返回</Text>
        </Pressable>
        <Text style={styles.shareHeaderLabel}>SHARE DETOUR</Text>
      </View>

      <ScrollView contentContainerStyle={styles.shareScroll} showsVerticalScrollIndicator={false}>
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={styles.shareHeroPhoto} />
            <View style={styles.shareIdentityBlock}>
              <Text style={styles.shareBrand}>DETOUR</Text>
              <Text style={styles.shareEmoji}>{emojis.join(' ') || '—'}</Text>
              <Text style={styles.sharePlace}>{entry.sceneName ?? entry.city}</Text>
            </View>
          </>
        ) : (
          <View style={styles.shareTicketWrap}>
            <V2Ticket serial={entry.ticketSerial} emojiTrail={emojis} />
          </View>
        )}

        <RoutePreview coordinates={entry.route ?? []} label="這趟的路" />

        <View style={styles.shareMetaRow}>
          <Text style={styles.shareMeta}>{entry.discoveries} 個發現</Text>
          <Text style={styles.shareMeta}>
            {Math.max(1, Math.round(entry.actualDurationMinutes ?? entry.minutes))} 分鐘
          </Text>
        </View>

        <Pressable onPress={() => void controller.performShare()} style={styles.sharePrimaryButton}>
          <Text style={styles.sharePrimaryText}>叫出分享選單</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function V2DetourScreen() {
  const controller = useV2DetourController();
  const panelByPhase: Record<V2Phase, ReactNode> = {
    home: <HomePanel controller={controller} />,
    starting: <StartingPanel controller={controller} />,
    exploration: <JourneyPanel controller={controller} />,
    closing: <JourneyPanel controller={controller} />,
    finish: <FinishPanel controller={controller} />,
    history: <HistoryPanel controller={controller} />,
    share: <SharePanel controller={controller} />,
  };
  return panelByPhase[controller.phase];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bone },
  brand: { color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: 2.4 },
  smallLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  homeHeader: { paddingHorizontal: 22, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyButton: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 },
  historyButtonText: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  homeCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  homeKicker: { color: COLORS.signal, fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },
  homeTitle: { marginTop: 10, color: COLORS.ink, fontSize: 56, lineHeight: 64, fontWeight: '900', letterSpacing: -2.5 },
  homeSubline: { marginTop: 20, color: COLORS.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' },
  startButton: { marginTop: 34, minWidth: 230, borderRadius: 22, paddingVertical: 19, paddingHorizontal: 22, backgroundColor: COLORS.signal, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonPressed: { opacity: 0.72 },
  startButtonText: { color: COLORS.paper, fontSize: 20, fontWeight: '900' },
  startButtonArrow: { color: COLORS.paper, fontSize: 25, fontWeight: '800' },
  homeTime: { marginTop: 12, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  homeTestButton: { marginTop: 20, minWidth: 230, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: 'rgba(255,253,247,0.56)', alignItems: 'center' },
  homeTestLabel: { color: COLORS.ink, fontSize: 13, fontWeight: '900' },
  homeTestCopy: { marginTop: 3, color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  homeBottom: { paddingHorizontal: 24, paddingBottom: 20, alignItems: 'center' },
  homeAccent: { width: 42, height: 5, borderRadius: 99, backgroundColor: COLORS.signal, marginBottom: 12 },
  homeFootnote: { color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  errorText: { marginTop: 10, color: '#B13D2C', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  startingHeader: { paddingHorizontal: 22, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startingContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  ticket: { width: '100%', maxWidth: 350, minHeight: 212, padding: 22, borderRadius: 4, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  ticketCompact: { minHeight: 0, padding: 16 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketBrand: { color: COLORS.ink, fontSize: 15, fontWeight: '900', letterSpacing: 2.2 },
  ticketSerial: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ticketRule: { height: 1, backgroundColor: COLORS.line, marginTop: 15, marginBottom: 20 },
  ticketEyebrow: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  ticketTitle: { marginTop: 12, color: COLORS.ink, fontSize: 30, lineHeight: 40, letterSpacing: 3 },
  ticketCompactEmoji: { color: COLORS.ink, fontSize: 22, letterSpacing: 3 },
  ticketFooter: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketFooterText: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  ticketDots: { color: COLORS.line, fontSize: 12, letterSpacing: 2 },
  startingTitle: { marginTop: 28, color: COLORS.ink, fontSize: 26, fontWeight: '900' },
  startingCopy: { marginTop: 10, color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  loadingDot: { width: 8, height: 8, marginTop: 18, borderRadius: 99, backgroundColor: COLORS.signal },
  inlineError: { alignItems: 'center', maxWidth: 320 },
  retryButton: { marginTop: 14, borderWidth: 1, borderColor: COLORS.signal, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: COLORS.signal, fontSize: 13, fontWeight: '800' },
  journeyHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  journeyState: { marginTop: 3, color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  elapsed: { color: COLORS.ink, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  mapFrame: { height: 215, marginHorizontal: 14, overflow: 'hidden', borderRadius: 22, backgroundColor: COLORS.map, borderWidth: 1, borderColor: COLORS.line },
  mapCaption: { position: 'absolute', left: 12, top: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(255,253,247,0.88)' },
  mapCaptionText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  journeyContent: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  navigationHint: { minHeight: 40, alignItems: 'center' },
  navigationHintText: { color: COLORS.ink, fontSize: 16, fontWeight: '900' },
  navigationSubHint: { marginTop: 4, color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  targetCard: { marginTop: 12, padding: 18, borderRadius: 24, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center' },
  targetEmojiBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.paleSignal, alignItems: 'center', justifyContent: 'center' },
  targetEmoji: { fontSize: 34 },
  targetEyebrow: { marginTop: 12, color: COLORS.signal, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  targetTitle: { marginTop: 7, color: COLORS.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  targetActions: { width: '100%', marginTop: 18, flexDirection: 'row', gap: 10 },
  replaceButton: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  replaceButtonText: { color: COLORS.muted, fontSize: 14, fontWeight: '800' },
  foundButton: { flex: 1.4, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.signal },
  foundButtonText: { color: COLORS.paper, fontSize: 15, fontWeight: '900' },
  closingCard: { marginTop: 12, padding: 22, borderRadius: 24, backgroundColor: COLORS.ink },
  closingEyebrow: { color: '#FFB29E', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  closingTitle: { marginTop: 12, color: COLORS.paper, fontSize: 28, fontWeight: '900' },
  closingCopy: { marginTop: 8, color: '#D4CDC1', fontSize: 14, lineHeight: 21 },
  waitingCard: { marginTop: 12, padding: 22, borderRadius: 24, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  waitingTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  waitingCopy: { marginTop: 7, color: COLORS.muted, fontSize: 13 },
  indoorControls: { marginTop: 10, padding: 10, borderRadius: 16, backgroundColor: '#EAE3D7', borderWidth: 1, borderColor: COLORS.line },
  indoorControlsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  indoorControlsTitle: { color: COLORS.ink, fontSize: 11, fontWeight: '900' },
  indoorControlsCopy: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  indoorStateLine: { marginTop: 6, color: COLORS.signal, fontSize: 10, fontWeight: '900' },
  indoorTargetLine: { marginTop: 3, color: COLORS.muted, fontSize: 9, fontWeight: '800' },
  indoorButtonRow: { marginTop: 8, flexDirection: 'row', gap: 7 },
  indoorButton: { flex: 1, minHeight: 32, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center' },
  indoorButtonPrimary: { backgroundColor: COLORS.signal, borderColor: COLORS.signal },
  indoorButtonText: { color: COLORS.ink, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  indoorButtonPrimaryText: { color: COLORS.paper, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  journeyBottomRow: { marginTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  cameraButtonIcon: { color: COLORS.signal, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  cameraButtonText: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  ticketMiniWrap: { alignItems: 'flex-end', maxWidth: '65%' },
  ticketMiniLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  ticketMiniEmoji: { marginTop: 2, color: COLORS.ink, fontSize: 17, letterSpacing: 2 },
  journeyError: { alignItems: 'center', paddingBottom: 8 },
  retryLink: { marginTop: 5, color: COLORS.signal, fontSize: 12, fontWeight: '900' },
  finishScroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 34 },
  finishHeader: { alignItems: 'center', marginBottom: 24 },
  finishTitle: { marginTop: 12, color: COLORS.ink, fontSize: 25, fontWeight: '900' },
  finishPlace: { marginTop: 4, color: COLORS.signal, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  finishCopy: { marginTop: 10, color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  finishMeta: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  finishMetaText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  photoRow: { gap: 10, paddingTop: 18, paddingBottom: 4 },
  finishPhoto: { width: 118, height: 118, borderRadius: 14, backgroundColor: COLORS.line },
  routePreviewWrap: { marginTop: 20 },
  routePreviewLabel: { marginBottom: 8, color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  routePreviewFrame: { height: 150, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.map },
  finishActions: { marginTop: 24, gap: 10 },
  shareButton: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.ink },
  shareButtonText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  startAgainButton: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.signal },
  startAgainText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  historyLinkButton: { alignItems: 'center', paddingVertical: 12 },
  historyLinkText: { color: COLORS.signal, fontSize: 13, fontWeight: '900' },
  historyHeader: { paddingHorizontal: 22, paddingTop: 10 },
  backLink: { paddingVertical: 8, alignSelf: 'flex-start' },
  backLinkText: { color: COLORS.signal, fontSize: 13, fontWeight: '900' },
  historyTitle: { marginTop: 10, color: COLORS.ink, fontSize: 32, fontWeight: '900' },
  historyList: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30, gap: 12 },
  historyCard: { minHeight: 104, flexDirection: 'row', overflow: 'hidden', borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line },
  historyPhoto: { width: 104, height: 104, backgroundColor: COLORS.line },
  historyPhotoPlaceholder: { width: 104, height: 104, backgroundColor: COLORS.paleSignal },
  historyCardCopy: { flex: 1, padding: 15, justifyContent: 'center' },
  historyEmoji: { color: COLORS.ink, fontSize: 21, letterSpacing: 2 },
  historyDate: { marginTop: 8, color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  historyHint: { marginTop: 4, color: COLORS.signal, fontSize: 11, fontWeight: '900' },
  emptyHistory: { alignItems: 'center', paddingTop: 110 },
  emptyHistoryEmoji: { color: COLORS.signal, fontSize: 38, fontWeight: '900' },
  emptyHistoryTitle: { marginTop: 18, color: COLORS.ink, fontSize: 22, fontWeight: '900' },
  emptyHistoryCopy: { marginTop: 8, color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  historyDetailMeta: { marginTop: 18, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  historyDetailScroll: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34 },
  historyDetailHeading: { marginTop: 8, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  historyDetailDate: { marginTop: 6, color: COLORS.ink, fontSize: 30, fontWeight: '900' },
  historyDetailArea: { flexShrink: 1, color: COLORS.signal, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  historyDetailHero: { width: '100%', aspectRatio: 1.35, borderRadius: 22, backgroundColor: COLORS.line },
  historyDetailNoPhoto: { minHeight: 150, borderRadius: 22, backgroundColor: COLORS.paleSignal, alignItems: 'center', justifyContent: 'center' },
  historyDetailNoPhotoEmoji: { color: COLORS.ink, fontSize: 34, letterSpacing: 4 },
  historyArchiveCard: { marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: '#EDE7DC', borderWidth: 1, borderColor: COLORS.line },
  historyArchiveLabel: { marginBottom: 10, color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  historyPhotoStrip: { gap: 9, paddingTop: 14 },
  historyDetailThumb: { width: 82, height: 82, borderRadius: 12, backgroundColor: COLORS.line },
  historyStatsCard: { marginTop: 18, marginBottom: 16, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', justifyContent: 'space-around' },
  historyStatsValue: { color: COLORS.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  historyStatsLabel: { marginTop: 3, color: COLORS.muted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  shareSafe: { flex: 1, backgroundColor: COLORS.ink },
  shareHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shareBackButton: { paddingVertical: 8, paddingRight: 12 },
  shareBackText: { color: COLORS.paper, fontSize: 13, fontWeight: '900' },
  shareHeaderLabel: { color: '#BDB5A8', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  shareScroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34 },
  shareHeroPhoto: { width: '100%', aspectRatio: 0.88, borderRadius: 24, backgroundColor: '#2D2924' },
  shareIdentityBlock: { paddingTop: 20, paddingBottom: 4 },
  shareBrand: { color: COLORS.signal, fontSize: 12, fontWeight: '900', letterSpacing: 2.4 },
  shareEmoji: { marginTop: 10, color: COLORS.paper, fontSize: 30, lineHeight: 42, letterSpacing: 4 },
  sharePlace: { marginTop: 7, color: '#BDB5A8', fontSize: 13, fontWeight: '700' },
  shareTicketWrap: { alignItems: 'center', paddingVertical: 14 },
  shareMetaRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  shareMeta: { color: '#BDB5A8', fontSize: 11, fontWeight: '800' },
  sharePrimaryButton: { marginTop: 22, borderRadius: 18, paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.signal },
  sharePrimaryText: { color: COLORS.paper, fontSize: 14, fontWeight: '900' },
  shareEmpty: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
});
