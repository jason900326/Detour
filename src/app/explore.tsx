import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

type Cell = { row: number; col: number; explored: boolean };

const CENTER = { latitude: 24.9937, longitude: 121.3010 };
const LAT_STEP = 0.0045;
const LNG_STEP = 0.00495;

// Prototype data only. The real version will be derived from completed Detour GPS tracks.
const exploredKeys = new Set([
  '0:1', '0:2', '1:0', '1:1', '1:2', '1:3', '2:1', '2:2', '2:3',
  '3:2', '3:3', '3:4', '4:3', '4:4', '5:4',
]);

export default function ExploreScreen() {
  const [scope, setScope] = useState<'me' | 'team'>('me');
  const cells = useMemo<Cell[]>(() => {
    const result: Cell[] = [];
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        result.push({ row, col, explored: exploredKeys.has(`${row}:${col}`) });
      }
    }
    return result;
  }, []);

  const explored = cells.filter((cell) => cell.explored).length;
  const percent = Math.round((explored / cells.length) * 100);

  const cellCoordinates = (cell: Cell) => {
    const north = CENTER.latitude + LAT_STEP * 3 - cell.row * LAT_STEP;
    const west = CENTER.longitude - LNG_STEP * 3 + cell.col * LNG_STEP;
    return [
      { latitude: north, longitude: west },
      { latitude: north, longitude: west + LNG_STEP },
      { latitude: north - LAT_STEP, longitude: west + LNG_STEP },
      { latitude: north - LAT_STEP, longitude: west },
    ];
  };

  return (
    <View style={styles.root}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          ...CENTER,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        }}
        showsCompass={false}
        showsPointsOfInterest={false}
        showsUserLocation
      >
        {cells.map((cell) => (
          <Polygon
            key={`${cell.row}:${cell.col}`}
            coordinates={cellCoordinates(cell)}
            fillColor={cell.explored ? 'rgba(232, 91, 62, 0.46)' : 'rgba(255,255,255,0.05)'}
            strokeColor={cell.explored ? 'rgba(173, 58, 37, 0.72)' : 'rgba(61,58,53,0.18)'}
            strokeWidth={0.8}
          />
        ))}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.circleButton}>
            <SymbolView name="chevron.left" size={18} tintColor="#27231F" />
          </Pressable>
          <View style={styles.titlePill}>
            <Text style={styles.eyebrow}>探索地圖</Text>
            <Text style={styles.title}>桃園市 · 桃園區</Text>
          </View>
          <View style={styles.circleButton}>
            <SymbolView name="location.fill" size={17} tintColor="#27231F" />
          </View>
        </View>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setScope('me')}
            style={[styles.segmentButton, scope === 'me' && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, scope === 'me' && styles.segmentTextActive]}>我的探索</Text>
          </Pressable>
          <Pressable
            onPress={() => setScope('team')}
            style={[styles.segmentButton, scope === 'team' && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, scope === 'team' && styles.segmentTextActive]}>團隊探索</Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        <View style={styles.card}>
          {scope === 'me' ? (
            <>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardLabel}>桃園區探索度</Text>
                  <Text style={styles.cardHint}>走進沒去過的地方，讓地圖慢慢亮起來</Text>
                </View>
                <Text style={styles.percent}>{percent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent}%` }]} />
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{explored}</Text>
                  <Text style={styles.statLabel}>已探索區域</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{cells.length - explored}</Text>
                  <Text style={styles.statLabel}>還沒走過</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>500m</Text>
                  <Text style={styles.statLabel}>MVP 探索格</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.teamEmpty}>
              <SymbolView name="person.2.fill" size={24} tintColor="#D45B3D" />
              <View style={styles.teamCopy}>
                <Text style={styles.cardLabel}>團隊探索，下一階段</Text>
                <Text style={styles.cardHint}>之後可以邀請朋友，一起從 0% 點亮同一張地圖。</Text>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAE6DE' },
  overlay: { flex: 1, paddingHorizontal: 18, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circleButton: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(250,248,243,0.94)', borderWidth: 1, borderColor: 'rgba(55,48,41,0.10)',
  },
  titlePill: {
    flex: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: 'rgba(250,248,243,0.94)', borderWidth: 1, borderColor: 'rgba(55,48,41,0.10)',
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#8D857B' },
  title: { marginTop: 2, fontSize: 16, fontWeight: '800', color: '#27231F' },
  segment: {
    alignSelf: 'center', flexDirection: 'row', marginTop: 12, padding: 4, borderRadius: 18,
    backgroundColor: 'rgba(250,248,243,0.94)', borderWidth: 1, borderColor: 'rgba(55,48,41,0.10)',
  },
  segmentButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 14 },
  segmentButtonActive: { backgroundColor: '#2D2925' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#7B746C' },
  segmentTextActive: { color: '#FFFDF8' },
  spacer: { flex: 1 },
  card: {
    padding: 18, borderRadius: 24, backgroundColor: 'rgba(250,248,243,0.97)',
    borderWidth: 1, borderColor: 'rgba(55,48,41,0.10)',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardLabel: { fontSize: 16, fontWeight: '800', color: '#2D2925' },
  cardHint: { marginTop: 5, fontSize: 12, lineHeight: 17, color: '#81796F', maxWidth: 240 },
  percent: { fontSize: 31, lineHeight: 34, fontWeight: '900', color: '#D45B3D' },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: '#E3DDD4', overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#D45B3D' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '900', color: '#302B27' },
  statLabel: { marginTop: 3, fontSize: 10, fontWeight: '600', color: '#938A80' },
  divider: { width: 1, height: 28, backgroundColor: '#DED8CF' },
  teamEmpty: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 3 },
  teamCopy: { flex: 1 },
});
