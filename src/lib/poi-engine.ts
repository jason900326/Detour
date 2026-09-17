import { DETOUR_API_CONFIG } from './app-config';
import type { GeoPoint } from './journey-engine';

export type PoiSearchResult = {
  id: string;
  name: string;
  brandName: string | null;
  category: string | null;
  address: string | null;
  locality: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

type PoiApiRow = {
  id?: string;
  name?: string;
  brand_name?: string | null;
  category?: string | null;
  address?: string | null;
  locality?: string | null;
  region?: string | null;
  latitude?: number;
  longitude?: number;
  distance_m?: number;
};

type PoiApiResponse = {
  results?: PoiApiRow[];
};

export async function searchCachedPois(
  query: string,
  origin: GeoPoint,
  limit = 30
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const response = await fetch(DETOUR_API_CONFIG.poiEndpoint, {
      method: 'POST',
      headers: {
        apikey: DETOUR_API_CONFIG.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        latitude: origin.latitude,
        longitude: origin.longitude,
        limit,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`POI search ${response.status}`);
    }

    const payload = (await response.json()) as PoiApiResponse;
    return (payload.results ?? [])
      .map((row): PoiSearchResult | null => {
        if (
          !row.id ||
          !row.name?.trim() ||
          !Number.isFinite(row.latitude) ||
          !Number.isFinite(row.longitude) ||
          !Number.isFinite(row.distance_m)
        ) {
          return null;
        }

        return {
          id: row.id,
          name: row.name.trim(),
          brandName: row.brand_name?.trim() || null,
          category: row.category?.trim() || null,
          address: row.address?.trim() || null,
          locality: row.locality?.trim() || null,
          region: row.region?.trim() || null,
          latitude: row.latitude as number,
          longitude: row.longitude as number,
          distanceMeters: row.distance_m as number,
        };
      })
      .filter((row): row is PoiSearchResult => row !== null);
  } finally {
    clearTimeout(timeout);
  }
}
