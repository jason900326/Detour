#!/usr/bin/env python3
"""Import preprocessed Detour Scene candidates into Supabase.

The expensive, place-level work happens once in this importer:

1. reject places Detour must never ticket to,
2. classify the remaining OSM objects,
3. calculate explainable Scene V2 traits and scores,
4. upsert only accepted rows,
5. emit an auditable import report.

Journey-specific facts (distance from the user, route duration, history and
current opening state) deliberately stay out of this file.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time
from typing import Any, Iterable
import urllib.error
import urllib.request
import uuid


BATCH_SIZE = 400
SCORING_VERSION = 2

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

INTRINSIC_ODDITY = {
    "mural": 64,
    "street-art": 70,
    "artwork": 55,
    "statue": 54,
    "public-bookcase": 78,
    "fountain": 46,
    "viewpoint": 38,
    "historic": 58,
    "square": 35,
    "heritage-tree": 62,
    "steps": 72,
    "footbridge": 68,
    "pedestrian": 42,
    "culture": 30,
    "green-space": 24,
    "market": 0,
    "food": 0,
}

INTRINSIC_VISUAL = {
    "mural": 82,
    "street-art": 82,
    "artwork": 70,
    "statue": 76,
    "public-bookcase": 44,
    "fountain": 58,
    "viewpoint": 72,
    "historic": 48,
    "square": 44,
    "heritage-tree": 62,
    "steps": 45,
    "footbridge": 52,
    "pedestrian": 34,
    "culture": 54,
    "green-space": 46,
    "market": 30,
    "food": 22,
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
    "steps": "階梯",
    "footbridge": "人行橋",
    "pedestrian": "步行街段",
    "heritage-tree": "老樹",
    "culture": "文化空間",
    "green-space": "戶外空間",
}

ART_KINDS = {"mural", "street-art", "artwork", "statue"}
STRUCTURE_KINDS = {"steps", "footbridge", "pedestrian"}
FOOD_KINDS = {"food", "market"}


def clamp_score(value: int) -> int:
    return max(0, min(100, int(value)))


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
        or tags.get("amenity")
        in {
            "arts_centre",
            "community_centre",
            "library",
            "marketplace",
            "public_bookcase",
        }
        or tags.get("leisure") in {"park", "garden"}
        or tags.get("place") == "square"
    )


def hard_reject_reason(tags: dict[str, str]) -> str | None:
    """Return a stable audit reason when a place must never enter Scenes."""

    if tags.get("detour:generated") == "route-anchor":
        return "synthetic_anchor"

    if tags.get("access") in {"private", "no"}:
        return "restricted_access"

    if (
        tags.get("amenity") == "place_of_worship"
        or "religion" in tags
        or tags.get("building") in {"temple", "shrine", "church", "chapel", "mosque"}
        or tags.get("historic") == "wayside_shrine"
    ):
        return "religious"

    amenity = tags.get("amenity", "")
    building = tags.get("building", "")
    healthcare = tags.get("healthcare", "")
    emergency = tags.get("emergency", "")
    office = tags.get("office", "")
    landuse = tags.get("landuse", "")
    text = normalized_scene_text(tags)

    if (
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
    ):
        return "healthcare"

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
        return "police_fire_emergency"

    if (
        amenity == "prison"
        or landuse == "military"
        or "military" in tags
        or building == "military"
    ):
        return "military_prison"

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
        return "government"

    if (
        amenity in {"school", "kindergarten", "college", "university", "childcare"}
        or landuse == "education"
        or building in {"school", "kindergarten", "college", "university"}
    ) and not is_clearly_public_destination(tags):
        return "education"

    if (
        amenity in {"grave_yard", "funeral_hall"}
        or landuse == "cemetery"
        or tags.get("shop") == "funeral_directors"
        or tags.get("historic") in {"tomb", "wayside_cross"}
    ):
        return "cemetery_funeral"

    return None


def is_religious(tags: dict[str, str]) -> bool:
    return hard_reject_reason(tags) == "religious"


def is_unsafe_or_restricted_scene(tags: dict[str, str]) -> bool:
    return hard_reject_reason(tags) is not None


def is_heritage_tree(tags: dict[str, str]) -> bool:
    if tags.get("natural") != "tree":
        return False
    return bool(
        tags.get("heritage")
        or tags.get("denotation") in {"natural_monument", "landmark"}
        or tags.get("protection_title") == "natural_monument"
    )


def is_footbridge(tags: dict[str, str]) -> bool:
    highway = tags.get("highway", "")
    bridge = tags.get("bridge", "")
    return (
        bridge == "footbridge"
        or (
            bridge not in {"", "no"}
            and highway in {"footway", "pedestrian", "path", "steps", "cycleway"}
        )
    )


def classify(tags: dict[str, str]) -> tuple[str, str] | None:
    if hard_reject_reason(tags):
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

    if is_heritage_tree(tags):
        return "heritage-tree", "老樹"

    if tags.get("highway") == "steps":
        return "steps", "階梯"

    if is_footbridge(tags):
        return "footbridge", "人行橋"

    if tags.get("highway") == "pedestrian":
        return "pedestrian", "步行街段"

    if tags.get("historic") == "memorial" and tags.get("memorial") in {
        "statue",
        "sculpture",
        "bust",
    }:
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
    return clamp_score(score)


def oddity_score(kind: str, tags: dict[str, str]) -> int:
    score = INTRINSIC_ODDITY.get(kind, 0)
    if tags.get("description") or tags.get("inscription"):
        score += 5
    if tags.get("heritage"):
        score += 5
    if tags.get("wikipedia") or tags.get("wikidata"):
        score -= 8
    if tags.get("tourism") == "attraction":
        score -= 6
    if kind in STRUCTURE_KINDS and not tags.get("name"):
        score += 5
    return clamp_score(score)


def visual_score(kind: str, tags: dict[str, str]) -> int:
    score = INTRINSIC_VISUAL.get(kind, 0)
    if tags.get("image"):
        score += 15
    if tags.get("wikimedia_commons"):
        score += 12
    if tags.get("artist_name"):
        score += 6
    if tags.get("description") or tags.get("inscription"):
        score += 5
    if tags.get("lit") == "yes":
        score += 4
    return clamp_score(score)


def food_commitment_score(kind: str, tags: dict[str, str]) -> int | None:
    if kind == "market":
        return 50
    if kind != "food":
        return None

    amenity = tags.get("amenity", "")
    shop = tags.get("shop", "")
    values = {
        "ice_cream": 96,
        "cafe": 84,
        "fast_food": 74,
        "food_court": 52,
        "restaurant": 36,
        "bakery": 92,
        "confectionery": 94,
        "pastry": 92,
        "beverages": 96,
        "coffee": 94,
        "tea": 96,
        "deli": 62,
    }
    score = values.get(amenity, values.get(shop, 50))
    if tags.get("takeaway") == "yes":
        score += 5
    return clamp_score(score)


def scene_traits(kind: str, tags: dict[str, str]) -> list[str]:
    traits: set[str] = set()

    if kind in ART_KINDS:
        traits.add("art")
    if kind in {"historic", "statue"} or tags.get("heritage"):
        traits.add("historic")
    if kind in {"public-bookcase", "fountain", "square"}:
        traits.add("tiny-public-space")
    if kind in STRUCTURE_KINDS:
        traits.add("structure")
    if kind in {"heritage-tree", "green-space", "viewpoint"}:
        traits.add("outdoor")
    if kind in {"culture", "public-bookcase"}:
        traits.add("culture")
    if kind in FOOD_KINDS:
        traits.add("food")
    if kind in {
        "street-art",
        "public-bookcase",
        "steps",
        "footbridge",
        "heritage-tree",
        "historic",
    }:
        traits.add("odd")
    if tags.get("lit") == "yes":
        traits.add("lit")
    if tags.get("image") or tags.get("wikimedia_commons"):
        traits.add("has-image")
    if tags.get("opening_hours"):
        traits.add("has-opening-hours")
    if tags.get("wheelchair") == "yes":
        traits.add("wheelchair-accessible")

    return sorted(traits)


def scene_family(kind: str) -> str:
    return "food" if kind in FOOD_KINDS else "detour"


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


def evaluate_feature(
    feature: dict[str, Any],
    batch: str,
) -> tuple[dict[str, Any] | None, str | None]:
    properties = feature.get("properties") or {}
    if not isinstance(properties, dict):
        return None, "invalid_properties"

    osm_type = properties.get("@type")
    osm_id = properties.get("@id")
    if osm_type not in {"node", "way", "relation"}:
        return None, "invalid_osm_reference"

    try:
        numeric_id = int(osm_id)
    except (TypeError, ValueError):
        return None, "invalid_osm_reference"

    point = representative_point(feature.get("geometry"))
    if not point:
        return None, "invalid_geometry"
    latitude, longitude = point
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None, "out_of_bounds"

    tags = tags_from_properties(properties)
    rejection = hard_reject_reason(tags)
    if rejection:
        return None, rejection

    classification = classify(tags)
    if not classification:
        return None, "unclassified"
    kind, label = classification

    source_id = f"{osm_type}/{numeric_id}"
    return (
        {
            "id": f"osm-{osm_type}-{numeric_id}",
            "source": "osm",
            "source_id": source_id,
            "osm_type": osm_type,
            "osm_id": numeric_id,
            "kind": kind,
            "scene_family": scene_family(kind),
            "name": tags.get("name"),
            "label": label,
            "latitude": latitude,
            "longitude": longitude,
            "tags": tags,
            "quality_score": quality_score(kind, tags),
            "oddity_score": oddity_score(kind, tags),
            "visual_score": visual_score(kind, tags),
            "food_commitment_score": food_commitment_score(kind, tags),
            "traits": scene_traits(kind, tags),
            "scoring_version": SCORING_VERSION,
            "active": True,
            "import_batch": batch,
            "source_updated_at": normalize_osm_timestamp(properties.get("@timestamp")),
            "imported_at": datetime.now(timezone.utc).isoformat(),
        },
        None,
    )


def normalize_feature(feature: dict[str, Any], batch: str) -> dict[str, Any] | None:
    row, _ = evaluate_feature(feature, batch)
    return row


@dataclass
class ScoreSummary:
    count: int = 0
    total: int = 0
    minimum: int | None = None
    maximum: int | None = None

    def add(self, value: int | None) -> None:
        if value is None:
            return
        self.count += 1
        self.total += value
        self.minimum = value if self.minimum is None else min(self.minimum, value)
        self.maximum = value if self.maximum is None else max(self.maximum, value)

    def to_dict(self) -> dict[str, int | float | None]:
        return {
            "count": self.count,
            "min": self.minimum,
            "max": self.maximum,
            "average": round(self.total / self.count, 1) if self.count else None,
        }


@dataclass
class ImportReport:
    batch: str
    dry_run: bool
    scanned: int = 0
    accepted: int = 0
    uploaded: int = 0
    deactivated_old_rows: int = 0
    rejected_by_reason: Counter[str] = field(default_factory=Counter)
    accepted_by_kind: Counter[str] = field(default_factory=Counter)
    accepted_by_family: Counter[str] = field(default_factory=Counter)
    scores: dict[str, ScoreSummary] = field(
        default_factory=lambda: {
            "quality": ScoreSummary(),
            "oddity": ScoreSummary(),
            "visual": ScoreSummary(),
            "food_commitment": ScoreSummary(),
        }
    )

    def record_row(self, row: dict[str, Any]) -> None:
        self.accepted += 1
        self.accepted_by_kind[row["kind"]] += 1
        self.accepted_by_family[row["scene_family"]] += 1
        self.scores["quality"].add(row["quality_score"])
        self.scores["oddity"].add(row["oddity_score"])
        self.scores["visual"].add(row["visual_score"])
        self.scores["food_commitment"].add(row["food_commitment_score"])

    def reject(self, reason: str) -> None:
        self.rejected_by_reason[reason] += 1

    def to_dict(self, elapsed_seconds: float) -> dict[str, Any]:
        return {
            "schema": "detour-scene-import-report/v2",
            "batch": self.batch,
            "scoring_version": SCORING_VERSION,
            "dry_run": self.dry_run,
            "scanned": self.scanned,
            "accepted": self.accepted,
            "uploaded": self.uploaded,
            "rejected": sum(self.rejected_by_reason.values()),
            "rejected_by_reason": dict(sorted(self.rejected_by_reason.items())),
            "accepted_by_family": dict(sorted(self.accepted_by_family.items())),
            "accepted_by_kind": dict(sorted(self.accepted_by_kind.items())),
            "score_summary": {
                key: summary.to_dict()
                for key, summary in self.scores.items()
            },
            "deactivated_old_rows": self.deactivated_old_rows,
            "elapsed_seconds": round(elapsed_seconds, 1),
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


def write_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--report-output", type=Path)
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
    report = ImportReport(batch=batch, dry_run=args.dry_run)
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []
    started_at = time.time()

    for feature in iter_features(args.input):
        report.scanned += 1
        row, rejection = evaluate_feature(feature, batch)
        if not row:
            report.reject(rejection or "unknown")
            continue
        if row["id"] in seen:
            report.reject("duplicate")
            continue

        seen.add(row["id"])
        report.record_row(row)
        pending.append(row)

        if len(pending) >= BATCH_SIZE:
            if not args.dry_run:
                upload_batch(supabase_url, secret_key, pending)
                report.uploaded += len(pending)
            print(
                f"processed {report.accepted} accepted scenes "
                f"(scanned {report.scanned})",
                flush=True,
            )
            pending.clear()

        if args.limit and report.accepted >= args.limit:
            break

    if pending:
        if not args.dry_run:
            upload_batch(supabase_url, secret_key, pending)
            report.uploaded += len(pending)

    if not args.dry_run:
        report.deactivated_old_rows = finalize_import(
            supabase_url,
            secret_key,
            batch,
        )

    payload = report.to_dict(time.time() - started_at)
    if args.report_output:
        write_report(args.report_output, payload)

    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
