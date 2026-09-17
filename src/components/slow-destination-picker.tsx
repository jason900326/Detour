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
  category?: string;
  type?: string;
  extratags?: Record<string, string>;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
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
  const candidates = [
    result.namedetails?.['official_name:zh'],
    result.namedetails?.official_name,
    result.namedetails?.['name:zh-Hant'],
    result.namedetails?.['name:zh'],
    result.namedetails?.name,
    result.name,
    result.display_name?.split(',')[0]?.trim(),
  ].filter((value): value is string => Boolean(value?.trim()));

  return (
    candidates.find((value) => /(分行|分店|門市|支店|branch)/i.test(value)) ||
    candidates[0] ||
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

const MEDICAL_DESTINATION_TERMS = [
  '醫院',
  '醫療中心',
  '診所',
  'hospital',
  'medical center',
  'clinic',
];

function normalizedSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function explicitlyRequestsMedicalDestination(query: string) {
  const normalized = normalizedSearchText(query);
  return MEDICAL_DESTINATION_TERMS.some((term) => normalized.includes(term));
}

function isUnexpectedMedicalContext(context: string, query: string) {
  if (explicitlyRequestsMedicalDestination(query)) return false;

  const normalized = context.toLocaleLowerCase();
  return MEDICAL_DESTINATION_TERMS.some((term) => normalized.includes(term));
}

function isUnexpectedMedicalInterior(result: NominatimResult, query: string) {
  return isUnexpectedMedicalContext(
    [
      result.display_name,
      ...Object.values(result.address ?? {}),
      ...Object.values(result.extratags ?? {}),
    ]
      .filter(Boolean)
      .join(' '),
    query
  );
}

function branchNameSpecificity(label: string, query: string) {
  const normalizedLabel = normalizedSearchText(label);
  const normalizedQuery = normalizedSearchText(query);
  let score = Math.min(label.length, 80);

  if (normalizedLabel !== normalizedQuery) score += 30;
  if (/(分行|分店|門市|支店|branch)/i.test(label)) score += 100;
  return score;
}

function mergeNearbyChoices(
  start: GeoPoint,
  query: string,
  groups: SlowDestinationChoice[][]
) {
  const merged: SlowDestinationChoice[] = [];

  for (const item of groups.flat()) {
    const duplicateIndex = merged.findIndex(
      (candidate) => distanceBetween(candidate, item) <= 45
    );

    if (duplicateIndex < 0) {
      merged.push(item);
      continue;
    }

    const previous = merged[duplicateIndex];
    if (
      branchNameSpecificity(item.label, query) >
      branchNameSpecificity(previous.label, query)
    ) {
      merged[duplicateIndex] = item;
    }
  }

  return merged.sort(
    (a, b) => distanceBetween(start, a) - distanceBetween(start, b)
  );
}

function escapeOverpassRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function overpassLabel(tags: Record<string, string>, query: string) {
  const base =
    tags['official_name:zh'] ||
    tags.official_name ||
    tags['name:zh-Hant'] ||
    tags['name:zh'] ||
    tags.name ||
    tags.brand ||
    tags.operator ||
    query;
  const branch =
    tags['branch:zh-Hant'] ||
    tags['branch:zh'] ||
    tags.branch ||
    tags['ref:branch'];

  if (branch && !normalizedSearchText(base).includes(normalizedSearchText(branch))) {
    return `${base} ${branch}`;
  }
  return base;
}

function overpassSubtitle(tags: Record<string, string>) {
  const streetAddress = [tags['addr:street'], tags['addr:housenumber']]
    .filter(Boolean)
    .join('');
  return [
    streetAddress,
    tags['addr:district'] || tags['addr:suburb'],
    tags['addr:city'],
  ]
    .filter(Boolean)
    .join(' · ');
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

async function searchWithOverpass(query: string, start: GeoPoint) {
  const escaped = escapeOverpassRegex(query);
  const matcher = JSON.stringify(escaped);
  const around = `around:30000,${start.latitude},${start.longitude}`;
  const normalized = normalizedSearchText(query);
  const categorySelectors =
    normalized === '便利商店'
      ? `nwr(${around})["shop"="convenience"];`
      : normalized === '銀行'
        ? `nwr(${around})["amenity"="bank"];`
        : '';
  const overpassQuery = `
    [out:json][timeout:12];
    (
      ${categorySelectors}
      nwr(${around})["name"~${matcher},i];
      nwr(${around})["name:zh"~${matcher},i];
      nwr(${around})["brand"~${matcher},i];
      nwr(${around})["operator"~${matcher},i];
    );
    out center tags;
  `;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let raw: OverpassResponse | null = null;
  let lastFailure = 'unavailable';

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Detour/0.46.4',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!response.ok) {
        lastFailure = `${response.status}`;
        continue;
      }

      raw = (await response.json()) as OverpassResponse;
      break;
    } catch (requestError) {
      lastFailure =
        requestError instanceof Error ? requestError.message : 'network error';
    }
  }

  if (!raw) {
    throw new Error(`Nearby destination search ${lastFailure}`);
  }
  return (raw.elements ?? [])
    .map((element): SlowDestinationChoice | null => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const tags = element.tags ?? {};
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

      const point = {
        latitude: latitude as number,
        longitude: longitude as number,
      };
      if (!taiwanCoordinate(point)) return null;

      const context = Object.values(tags).filter(Boolean).join(' ');
      if (isUnexpectedMedicalContext(context, query)) return null;

      const label = overpassLabel(tags, query);
      const subtitle = overpassSubtitle(tags);

      return {
        id: `osm-${element.type}-${element.id}`,
        label,
        subtitle,
        geocodeText: [label, subtitle].filter(Boolean).join(', '),
        latitude: point.latitude,
        longitude: point.longitude,
        estimatedWalkMinutes: estimatedWalkMinutes(start, point),
      };
    })
    .filter((item): item is SlowDestinationChoice => item !== null);
}

async function searchWithNominatim(query: string, start: GeoPoint) {
  // Keep the search local, then rank the complete nearby candidate set by
  // proximity. Nominatim's own relevance order is not a nearest-place order.
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
    ['limit', '40'],
    ['addressdetails', '1'],
    ['namedetails', '1'],
    ['extratags', '1'],
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
      if (isUnexpectedMedicalInterior(result, query)) return null;

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

  const normalizedQuery = normalizedSearchText(query);
  return normalized.sort((a, b) => {
    const distanceDifference =
      distanceBetween(start, a) - distanceBetween(start, b);
    if (Math.abs(distanceDifference) > 20) return distanceDifference;

    const aName = a.label.toLocaleLowerCase();
    const bName = b.label.toLocaleLowerCase();
    const aMatch =
      aName === normalizedQuery ? 0 : aName.includes(normalizedQuery) ? 1 : 2;
    const bMatch =
      bName === normalizedQuery ? 0 : bName.includes(normalizedQuery) ? 1 : 2;

    return aMatch - bMatch;
  });
}

async function searchWithDeviceGeocoder(query: string, start: GeoPoint) {
  const geocoded = await Location.geocodeAsync(query);

  return geocoded
    .slice(0, 12)
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
    .filter((item): item is SlowDestinationChoice => item !== null);
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
      const searches = await Promise.allSettled([
        searchWithOverpass(trimmed, start),
        searchWithNominatim(trimmed, start),
      ]);
      const failedSearches = searches.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      );
      if (failedSearches.length > 0) {
        console.warn(
          '[DETOUR DESTINATION] search source failed',
          failedSearches.map((result) =>
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          )
        );
      }

      const successfulGroups = searches
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<SlowDestinationChoice[]> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);
      let next = mergeNearbyChoices(start, trimmed, successfulGroups);

      if (next.length === 0 && searches.every((result) => result.status === 'rejected')) {
        next = await searchWithDeviceGeocoder(trimmed, start);
      }

      if (next.length === 0) {
        setResults([]);
        setError('附近沒有找到符合的地點。試試店名、地標名或地址。');
        return;
      }

      setResults(
        next.slice(0, 10).map((item) => ({ ...item, routeVerified: false }))
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

          <View style={styles.searchRow}>
            <TextInput
              autoFocus
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setError(null);
              }}
              onSubmitEditing={() => void runSearch()}
              placeholder="輸入地點或類型"
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
    marginTop: 14,
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
