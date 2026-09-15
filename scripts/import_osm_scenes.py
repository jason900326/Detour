#!/usr/bin/env python3
"""Import Detour Scene candidates from osmium GeoJSONSeq into Supabase.

The heavy OSM work happens before users open the app. This script receives a
small, tag-filtered GeoJSON sequence, classifies the objects with the same core
rules as the app, and upserts normalized Scene rows into PostGIS.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


BATCH_SIZE = 400

INTRINSIC_QUALITY = {
    "mural": 42,
    "street-art": 42,
    "artwork": 32,
    "statue": 48,
    "public-bookcase": 30,
    "market": 24,
    "food": 22,
    "fountain": 20,
    "viewpoint": 20,
    "historic": 18,
    "square": 18,
    "heritage-tree": 26,
    "steps": 8,
    "footbridge": 10,
    "pedestrian": 8,
    "culture": 28,
    "green-space": 18,
}

LABELS = {
    "mural": "壁畫",
    "street-art": "街頭藝術",
    "artwork": "公共藝術",
    "statue": "雕像",
    "historic": "歷史痕跡",
    "market": "市場",
    "food": "食物目的地",
    "square": "廣場",
    "fountain": "噴泉",
    "public-bookcase": "街頭書櫃",
    "viewpoint": "視野點",
    "culture": "文化空間",
    "green-space": "戶外空間",
}


def is_religious(tags: dict[str, str]) -> bool:
    return (
        tags.get("amenity") == "place_of_worship"
        or "religion" in tags
        or tags.get("building") in {"temple", "shrine", "church", "chapel", "mosque"}
        or tags.get("historic") == "wayside_shrine"
    )


def normalized_scene_text(tags: dict[str, str]) -> str:
    return " ".join(
        str(tags.get(key, ""))
        for key in ("name", "name:zh", "official_name", "operator", "description")
        if tags.get(key)
    ).lower()


def has_any_scene_keyword(text: str, keywords: set[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def is_clearly_public_destination(tags: dict[str, str]) -> bool:
    return (
        tags.get("tourism") in {"museum", "gallery"}
        or tags.get("amenity") in {
            "arts_centre",
            "community_centre",
            "library",
            "marketplace",
            "public_bookcase",
        }
        or tags.get("leisure") in {"park", "garden"}
        or tags.get("place") == "square"
    )


def is_unsafe_or_restricted_scene(tags: dict[str, str]) -> bool:
    if tags.get("access") in {"private", "no"}:
        return True

    amenity = tags.get("amenity", "")
    building = tags.get("building", "")
    healthcare = tags.get("healthcare", "")
    emergency = tags.get("emergency", "")
    office = tags.get("office", "")
    text = normalized_scene_text(tags)

    is_healthcare = (
        amenity in {"hospital", "clinic", "doctors", "dentist"}
        or healthcare in {"hospital", "clinic", "doctor", "dentist", "centre", "center"}
        or building == "hospital"
        or emergency == "emergency_ward"
        or has_any_scene_keyword(
            text,
            {
                "醫院",
                "醫學中心",
                "醫療中心",
                "診所",
                " hospital",
                "hospital ",
                "medical center",
                "medical centre",
                " clinic",
                "clinic ",
            },
        )
    )
    if is_healthcare:
        return True

    is_police_or_fire = (
        amenity in {"police", "fire_station"}
        or building in {"police", "fire_station"}
        or emergency in {"fire_station", "ambulance_station"}
        or has_any_scene_keyword(
            text,
            {
                "警察局",
                "派出所",
                "分局",
                "警察隊",
                "消防局",
                "消防隊",
                "消防分隊",
                "police station",
                "fire station",
            },
        )
    )
    if is_police_or_fire and tags.get("tourism") not in {"museum", "gallery"}:
        return True

    if (
        amenity == "prison"
        or tags.get("landuse") == "military"
        or "military" in tags
        or building == "military"
    ):
        return True

    is_government = (
        office == "government"
        or "government" in tags
        or amenity in {"townhall", "courthouse", "embassy"}
        or building in {"government", "civic"}
        or has_any_scene_keyword(
            text,
            {
                "市政府",
                "縣政府",
                "區公所",
                "鄉公所",
                "鎮公所",
                "戶政事務所",
                "地政事務所",
                "稅捐處",
                "稅務局",
                "法院",
                "檢察署",
                "government office",
                "city hall",
                "district office",
                "courthouse",
            },
        )
    )
    if is_government and not is_clearly_public_destination(tags):
        return True

    return False


def classify(tags: dict[str, str]) -> tuple[str, str] | None:
    if is_religious(tags) or is_unsafe_or_restricted_scene(tags):
        return None

    if tags.get("tourism") == "artwork":
        artwork_type = tags.get("artwork_type", "")
        if artwork_type in {"statue", "sculpture", "bust"}:
            return "statue", "雕像"
        if artwork_type == "mural":
            return "mural", "壁畫"
        if artwork_type in {"street_art", "graffiti"} or tags.get("artwork_subject") == "street_art":
            return "street-art", "街頭藝術"
        return "artwork", "公共藝術"

    if tags.get("amenity") == "marketplace":
        return "market", "市場"

    if tags.get("amenity") in {"restaurant", "fast_food", "cafe", "food_court", "ice_cream"}:
        return "food", "食物目的地"

    if tags.get("shop") in {"bakery", "confectionery", "deli", "pastry", "beverages", "coffee", "tea"}:
        return "food", "食物目的地"

    if tags.get("amenity") == "public_bookcase":
        return "public-bookcase", "街頭書櫃"

    if tags.get("tourism") in {"gallery", "museum"} or tags.get("amenity") == "arts_centre":
        return "culture", "文化空間"

    if tags.get("leisure") in {"park", "garden"}:
        return "green-space", "戶外空間"

    if tags.get("amenity") == "community_centre":
        return "culture", "公共空間"

    if tags.get("amenity") == "fountain":
        return "fountain", "噴泉"

    if tags.get("tourism") == "viewpoint":
        return "viewpoint", "視野點"

    if tags.get("place") == "square":
        return "square", "廣場"

    if tags.get("historic") == "memorial" and tags.get("memorial") in {"statue", "sculpture", "bust"}:
        return "statue", "紀念雕像"

    historic = tags.get("historic")
    if historic and historic not in {"memorial", "wayside_shrine"}:
        return "historic", "歷史痕跡"

    return None


def quality_score(kind: str, tags: dict[str, str]) -> int:
    score = INTRINSIC_QUALITY.get(kind, 0)
    if tags.get("name"):
        score += 8
    if tags.get("image"):
        score += 18
    if tags.get("wikimedia_commons"):
        score += 16
    if tags.get("wikipedia") or tags.get("wikidata"):
        score += 12
    if tags.get("artist_name"):
        score += 10
    if tags.get("heritage"):
        score += 10
    if tags.get("description") or tags.get("inscription"):
        score += 6
    if tags.get("lit") == "yes":
        score += 3
    return score


def flatten_coordinates(value: Any) -> Iterable[tuple[float, float]]:
    if not isinstance(value, list):
        return
    if len(value) >= 2 and isinstance(value[0], (int, float)) and isinstance(value[1], (int, float)):
        yield float(value[0]), float(value[1])
        return
    for item in value:
        yield from flatten_coordinates(item)


def representative_point(geometry: dict[str, Any] | None) -> tuple[float, float] | None:
    if not geometry:
        return None

    coordinates = geometry.get("coordinates")
    if geometry.get("type") == "Point" and isinstance(coordinates, list) and len(coordinates) >= 2:
        lon, lat = coordinates[0], coordinates[1]
        if isinstance(lon, (int, float)) and isinstance(lat, (int, float)):
            return float(lat), float(lon)

    points = list(flatten_coordinates(coordinates))
    if not points:
        return None

    min_lon = min(point[0] for point in points)
    max_lon = max(point[0] for point in points)
    min_lat = min(point[1] for point in points)
    max_lat = max(point[1] for point in points)
    return (min_lat + max_lat) / 2, (min_lon + max_lon) / 2


def tags_from_properties(properties: dict[str, Any]) -> dict[str, str]:
    tags: dict[str, str] = {}
    for key, value in properties.items():
        if key.startswith("@") or value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            tags[key] = str(value)
    return tags


def normalize_osm_timestamp(value: Any) -> str | None:
    """Return an ISO-8601 timestamp for osmium's @timestamp attribute.

    `osmium export --attributes ... timestamp` emits Unix epoch seconds in the
    GeoJSON properties. Postgres `timestamptz` does not interpret a bare value
    like `1735466949` as an epoch, so convert it before sending the batch.
    Keep already-ISO timestamps usable for local fixtures or future osmium
    output changes.
    """
    if value is None:
        return None

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None

    text = str(value).strip()
    if not text:
        return None

    try:
        epoch = float(text)
    except ValueError:
        epoch = None

    if epoch is not None:
        try:
            return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def normalize_feature(feature: dict[str, Any], batch: str) -> dict[str, Any] | None:
    properties = feature.get("properties") or {}
    if not isinstance(properties, dict):
        return None

    osm_type = properties.get("@type")
    osm_id = properties.get("@id")
    if osm_type not in {"node", "way", "relation"}:
        return None

    try:
        numeric_id = int(osm_id)
    except (TypeError, ValueError):
        return None

    point = representative_point(feature.get("geometry"))
    if not point:
        return None
    latitude, longitude = point
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None

    tags = tags_from_properties(properties)
    if is_unsafe_or_restricted_scene(tags):
        return None

    classification = classify(tags)
    if not classification:
        return None
    kind, label = classification

    source_id = f"{osm_type}/{numeric_id}"
    return {
        "id": f"osm-{osm_type}-{numeric_id}",
        "source": "osm",
        "source_id": source_id,
        "osm_type": osm_type,
        "osm_id": numeric_id,
        "kind": kind,
        "name": tags.get("name"),
        "label": label,
        "latitude": latitude,
        "longitude": longitude,
        "tags": tags,
        "quality_score": quality_score(kind, tags),
        "active": True,
        "import_batch": batch,
        "source_updated_at": normalize_osm_timestamp(properties.get("@timestamp")),
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }


def request_supabase(
    supabase_url: str,
    secret_key: str,
    path: str,
    payload: Any,
    *,
    prefer: str | None = None,
) -> bytes:
    url = f"{supabase_url.rstrip('/')}{path}"
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = {
        "apikey": secret_key,
        "Content-Type": "application/json",
    }

    # New Supabase `sb_secret_...` keys are API keys, not JWTs, and must not be
    # sent as a Bearer token. Keep Authorization only for legacy service_role
    # JWTs so existing local setups continue to work during the transition.
    if not secret_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {secret_key}"

    if prefer:
        headers["Prefer"] = prefer

    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=75) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {error.code}: {detail[:1000]}") from error


def upload_batch(supabase_url: str, secret_key: str, rows: list[dict[str, Any]]) -> None:
    request_supabase(
        supabase_url,
        secret_key,
        "/rest/v1/scenes?on_conflict=id",
        rows,
        prefer="resolution=merge-duplicates,return=minimal",
    )


def finalize_import(supabase_url: str, secret_key: str, batch: str) -> int:
    raw = request_supabase(
        supabase_url,
        secret_key,
        "/rest/v1/rpc/finalize_osm_scene_import",
        {"p_batch": batch},
    )
    try:
        return int(json.loads(raw.decode("utf-8")))
    except (ValueError, json.JSONDecodeError):
        return 0


def iter_features(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            payload = line.lstrip("\x1e").strip()
            if not payload:
                continue
            try:
                feature = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if isinstance(feature, dict):
                yield feature


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input file does not exist: {args.input}", file=sys.stderr)
        return 2

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    secret_key = (
        os.environ.get("SUPABASE_SECRET_KEY", "").strip()
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    if not args.dry_run and (not supabase_url or not secret_key):
        print("SUPABASE_URL and SUPABASE_SECRET_KEY are required.", file=sys.stderr)
        return 2

    batch = f"osm-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []
    scanned = 0
    accepted = 0
    uploaded = 0
    started_at = time.time()

    for feature in iter_features(args.input):
        scanned += 1
        row = normalize_feature(feature, batch)
        if not row or row["id"] in seen:
            continue
        seen.add(row["id"])
        accepted += 1
        pending.append(row)

        if len(pending) >= BATCH_SIZE:
            if not args.dry_run:
                upload_batch(supabase_url, secret_key, pending)
            uploaded += len(pending)
            print(f"uploaded {uploaded} scenes (scanned {scanned})", flush=True)
            pending.clear()

        if args.limit and accepted >= args.limit:
            break

    if pending:
        if not args.dry_run:
            upload_batch(supabase_url, secret_key, pending)
        uploaded += len(pending)

    deactivated = 0
    if not args.dry_run:
        deactivated = finalize_import(supabase_url, secret_key, batch)

    elapsed = time.time() - started_at
    print(
        json.dumps(
            {
                "batch": batch,
                "scanned": scanned,
                "accepted": accepted,
                "uploaded": uploaded,
                "deactivated_old_rows": deactivated,
                "dry_run": args.dry_run,
                "elapsed_seconds": round(elapsed, 1),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
