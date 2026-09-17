import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLightContext, type GeoPoint } from '../lib/journey-engine';
import { fetchWalkingRoute } from '../lib/routing-engine';
import { BONE, INK, MUTED, SIGNAL } from '../theme/detour-theme';

export type SlowDestinationChoice = {
  id: string;
  label: string;
  subtitle: string;
  geocodeText: string;
  latitude: number;
  longitude: number;
  estimatedWalkMinutes: number;
  routeVerified?: boolean;
};

type NominatimResult = {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
};

function distanceBetween(a: GeoPoint, b: GeoPoint) {
  const radians = Math.PI / 180;
  const radius = 6371000;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimatedWalkMinutes(start: GeoPoint, destination: GeoPoint) {
  const straightMeters = distanceBetween(start, destination);

  // This is intentionally a little conservative. It is only a pre-selection
  // hint; the routing engine still calculates the real pedestrian route after
  // the user chooses a destination.
  return Math.max(2, Math.ceil((straightMeters * 1.28) / 72));
}

function resultName(result: NominatimResult) {
  return (
    result.namedetails?.['name:zh'] ||
    result.namedetails?.name ||
    result.name ||
    result.display_name?.split(',')[0]?.trim() ||
    '目的地'
  );
}

function resultSubtitle(result: NominatimResult) {
  const parts = (result.display_name ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(1, 4).join(' · ');
}

function taiwanCoordinate(point: GeoPoint) {
  return (
    point.latitude >= 21.5 &&
    point.latitude <= 26.5 &&
    point.longitude >= 119 &&
    point.longitude <= 123
  );
}

async function currentPoint() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== 'granted') {
    throw new Error('需要定位才能搜尋你附近的分店或地標。');
  }

  let location = await Location.getLastKnownPositionAsync({
    maxAge: 3 * 60 * 1000,
    requiredAccuracy: 250,
  });

  if (!location) {
    location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  }

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  } satisfies GeoPoint;
}

async function searchWithNominatim(query: string, start: GeoPoint) {
  // Bias rather than hard-bound the search around a coarse location. A user
  // can type just a brand name (for example SUKIYA) and still get nearby
  // branches without knowing the exact store name.
  const centerLat = Number(start.latitude.toFixed(2));
  const centerLon = Number(start.longitude.toFixed(2));
  const viewbox = [
    centerLon - 0.08,
    centerLat + 0.08,
    centerLon + 0.08,
    centerLat - 0.08,
  ].join(',');
  const params = [
    ['format', 'jsonv2'],
    ['q', query],
    ['countrycodes', 'tw'],
    ['limit', '8'],
    ['addressdetails', '1'],
    ['namedetails', '1'],
    ['dedupe', '1'],
    ['accept-language', 'zh-TW'],
    ['viewbox', viewbox],
    ['bounded', '1'],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'zh-TW',
        'User-Agent': 'Detour/0.46.4',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Destination search ${response.status}`);
  }

  const raw = (await response.json()) as NominatimResult[];
  const normalized = raw
    .map((result, index): SlowDestinationChoice | null => {
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);
      const point = { latitude, longitude };
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      if (!taiwanCoordinate(point)) return null;

      const label = resultName(result);
      const displayName = result.display_name?.trim() || label;

      return {
        id: String(result.place_id ?? `${latitude},${longitude},${index}`),
        label,
        subtitle: resultSubtitle(result),
        geocodeText: displayName,
        latitude,
        longitude,
        estimatedWalkMinutes: estimatedWalkMinutes(start, point),
      };
    })
    .filter((item): item is SlowDestinationChoice => item !== null);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  return normalized.sort((a, b) => {
    const aName = a.label.toLocaleLowerCase();
    const bName = b.label.toLocaleLowerCase();
    const aMatch = aName === normalizedQuery ? 0 : aName.includes(normalizedQuery) ? 1 : 2;
    const bMatch = bName === normalizedQuery ? 0 : bName.includes(normalizedQuery) ? 1 : 2;

    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.estimatedWalkMinutes - b.estimatedWalkMinutes;
  });
}

async function fallbackGeocode(query: string, start: GeoPoint) {
  const geocoded = await Location.geocodeAsync(query);

  return geocoded
    .slice(0, 6)
    .map((result, index): SlowDestinationChoice | null => {
      const point = {
        latitude: result.latitude,
        longitude: result.longitude,
      };
      if (!taiwanCoordinate(point)) return null;

      return {
        id: `device-geocode-${index}-${result.latitude},${result.longitude}`,
        label: query,
        subtitle: '系統搜尋結果',
        geocodeText: query,
        latitude: result.latitude,
        longitude: result.longitude,
        estimatedWalkMinutes: estimatedWalkMinutes(start, point),
      };
    })
    .filter((item): item is SlowDestinationChoice => item !== null)
    .sort((a, b) => a.estimatedWalkMinutes - b.estimatedWalkMinutes);
}

function recommendedMinutes(selectedMinutes: number, estimatedMinutes: number) {
  if (estimatedMinutes <= selectedMinutes) return selectedMinutes;
  return Math.ceil((estimatedMinutes + 2) / 5) * 5;
}

export function SlowDestinationPicker({
  visible,
  selectedMinutes,
  onDismiss,
  onConfirm,
}: {
  visible: boolean;
  selectedMinutes: number;
  onDismiss: () => void;
  onConfirm: (choice: SlowDestinationChoice, minutes: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SlowDestinationChoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<GeoPoint | null>(null);
  const [routeCheckingId, setRouteCheckingId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const selectionRequestRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSelectedId(null);
      setSearching(false);
      setError(null);
      setSearchOrigin(null);
      setRouteCheckingId(null);
      setRouteError(null);
      selectionRequestRef.current += 1;
    }
  }, [visible]);

  const selected = useMemo(
    () => results.find((item) => item.id === selectedId) ?? null,
    [results, selectedId]
  );
  const selectedRouteReady = Boolean(
    selected?.routeVerified && routeCheckingId !== selected?.id && !routeError
  );
  const suggestedMinutes = selectedRouteReady && selected
    ? recommendedMinutes(selectedMinutes, selected.estimatedWalkMinutes)
    : selectedMinutes;
  const selectedIsTooFar = Boolean(
    selectedRouteReady && selected && suggestedMinutes > 60
  );

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || searching) return;

    setSearching(true);
    selectionRequestRef.current += 1;
    setSelectedId(null);
    setRouteCheckingId(null);
    setRouteError(null);
    setError(null);

    try {
      const start = await currentPoint();
      setSearchOrigin(start);
      let next: SlowDestinationChoice[] = [];

      try {
        next = await searchWithNominatim(trimmed, start);
      } catch {
        // Device geocoding remains a fallback when the POI search service is
        // unavailable. It is less branch-aware, but it keeps slow-walk usable.
      }

      if (next.length === 0) {
        next = await fallbackGeocode(trimmed, start);
      }

      if (next.length === 0) {
        setResults([]);
        setError('附近沒有找到符合的地點。試試店名、地標名或地址。');
        return;
      }

      setResults(
        next.slice(0, 6).map((item) => ({ ...item, routeVerified: false }))
      );
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : '目的地搜尋暫時失敗，請再試一次。'
      );
    } finally {
      setSearching(false);
    }
  };

  const selectDestination = async (item: SlowDestinationChoice) => {
    setSelectedId(item.id);
    setRouteError(null);

    if (item.routeVerified) {
      setRouteCheckingId(null);
      return;
    }

    if (!searchOrigin) {
      setRouteError('找不到目前位置，請重新搜尋一次。');
      return;
    }

    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setRouteCheckingId(item.id);

    try {
      const route = await fetchWalkingRoute(
        searchOrigin,
        { latitude: item.latitude, longitude: item.longitude },
        6500,
        {
          purpose: 'interactive',
          context: getLightContext(searchOrigin, new Date()),
        }
      );
      if (selectionRequestRef.current !== requestId) return;

      const routeMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
      setResults((current) =>
        current.map((result) =>
          result.id === item.id
            ? {
                ...result,
                estimatedWalkMinutes: routeMinutes,
                routeVerified: true,
              }
            : result
        )
      );
      setRouteCheckingId(null);
    } catch {
      if (selectionRequestRef.current !== requestId) return;
      setRouteCheckingId(null);
      setRouteError('暫時算不出這個地點的步行路線。點選它可以再試一次。');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 14) }]}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.eyebrow}>慢慢走</Text>
              <Text style={styles.title}>你要去哪？</Text>
            </View>
            <Pressable onPress={onDismiss} hitSlop={12} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.body}>
            不用知道完整分店名。輸入「SUKIYA」、公園名或地標，先從附近結果選一個。
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              autoFocus
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setError(null);
              }}
              onSubmitEditing={() => void runSearch()}
              placeholder="例如：SUKIYA、新埔捷運站"
              placeholderTextColor="#8F8B82"
              returnKeyType="search"
              style={styles.input}
            />
            <Pressable
              disabled={!query.trim() || searching}
              onPress={() => void runSearch()}
              style={[
                styles.searchButton,
                (!query.trim() || searching) && styles.searchButtonDisabled,
              ]}
            >
              <Text style={styles.searchButtonText}>{searching ? '找…' : '搜尋'}</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {results.length > 0 && (
            <ScrollView
              style={styles.results}
              contentContainerStyle={styles.resultsContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {results.map((item) => {
                const active = item.id === selectedId;
                const fit = item.estimatedWalkMinutes <= selectedMinutes;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => void selectDestination(item)}
                    style={[styles.resultCard, active && styles.resultCardActive]}
                  >
                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.resultSubtitle} numberOfLines={2}>
                        {item.subtitle || item.geocodeText}
                      </Text>
                    </View>
                    <View style={styles.timeColumn}>
                      <Text style={[styles.timeValue, !fit && styles.timeValueLong]}>
                        約 {item.estimatedWalkMinutes} 分
                      </Text>
                      <Text style={styles.timeNote}>
                        {routeCheckingId === item.id
                          ? '算路線中'
                          : item.routeVerified
                            ? fit
                              ? '時間內'
                              : '需要加時間'
                            : '距離預估'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {selected && (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionLabel}>這趟目前有 {selectedMinutes} 分鐘</Text>
              <Text style={styles.selectionText}>
                {routeCheckingId === selected.id
                  ? `正在確認到「${selected.label}」真正可走的步行路線…`
                  : routeError
                    ? routeError
                    : selectedIsTooFar
                      ? `「${selected.label}」最快步行超過 60 分鐘，超出目前 DETOUR 上限。`
                      : suggestedMinutes > selectedMinutes
                        ? `「${selected.label}」最快約 ${selected.estimatedWalkMinutes} 分，這趟會調整成 ${suggestedMinutes} 分鐘。`
                        : `「${selected.label}」最快約 ${selected.estimatedWalkMinutes} 分，剩下的時間再拿來慢慢繞。`}
              </Text>
            </View>
          )}

          <Pressable
            disabled={!selected || !selectedRouteReady || selectedIsTooFar}
            onPress={() => {
              if (!selected || !selectedRouteReady || selectedIsTooFar) return;
              onConfirm(selected, suggestedMinutes);
            }}
            style={[
              styles.primary,
              (!selected || !selectedRouteReady || selectedIsTooFar) &&
                styles.primaryDisabled,
            ]}
          >
            <Text style={styles.primaryText}>
              {!selected
                ? '先選一個目的地'
                : routeCheckingId === selected.id
                  ? '正在確認步行路線…'
                  : routeError
                    ? '再點一次重新確認'
                    : !selectedRouteReady
                      ? '先確認步行路線'
                      : selectedIsTooFar
                  ? '這個目的地太遠'
                  : suggestedMinutes > selectedMinutes
                    ? `改成 ${suggestedMinutes} 分鐘並出發`
                    : '就去這裡'}
            </Text>
            <Text style={styles.primaryArrow}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,17,15,0.52)',
  },
  sheet: {
    maxHeight: '88%',
    paddingTop: 24,
    paddingHorizontal: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: BONE,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: SIGNAL,
  },
  title: {
    marginTop: 6,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: INK,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE5DB',
  },
  closeText: {
    marginTop: -2,
    fontSize: 28,
    lineHeight: 30,
    color: INK,
  },
  body: {
    marginTop: 8,
    maxWidth: 560,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: MUTED,
  },
  searchRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 6,
    backgroundColor: '#FFFDF7',
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },
  searchButton: {
    minWidth: 74,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK,
  },
  searchButtonDisabled: {
    opacity: 0.38,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: BONE,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: SIGNAL,
  },
  results: {
    marginTop: 14,
    maxHeight: 310,
  },
  resultsContent: {
    gap: 8,
    paddingBottom: 2,
  },
  resultCard: {
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#CFC9BE',
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFDF7',
  },
  resultCardActive: {
    borderWidth: 2,
    borderColor: SIGNAL,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    color: INK,
  },
  resultSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: MUTED,
  },
  timeColumn: {
    alignItems: 'flex-end',
  },
  timeValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    color: INK,
  },
  timeValueLong: {
    color: SIGNAL,
  },
  timeNote: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    color: MUTED,
  },
  selectionSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#CFC9BE',
  },
  selectionLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: MUTED,
  },
  selectionText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: INK,
  },
  primary: {
    minHeight: 60,
    marginTop: 14,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryDisabled: {
    opacity: 0.42,
  },
  primaryText: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: INK,
  },
  primaryArrow: {
    marginLeft: 12,
    fontSize: 28,
    lineHeight: 30,
    color: INK,
  },
});
