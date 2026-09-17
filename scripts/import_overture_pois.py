#!/usr/bin/env python3
"""Normalize and import Taiwan Overture Places into Detour's POI index."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time
from typing import Any, Iterable
import unicodedata
import urllib.error
import urllib.request
import uuid


BATCH_SIZE = 400
MIN_CONFIDENCE = 0.45

BRAND_ALIAS_GROUPS = (
    {"starbucks", "星巴克"},
    {"mcdonald's", "mcdonalds", "麥當勞"},
    {"7-eleven", "7-11", "統一超商"},
    {"familymart", "全家", "全家便利商店"},
    {"sukiya", "すき家", "食其家"},
    {"land bank of taiwan", "土地銀行", "臺灣土地銀行", "台灣土地銀行"},
)

CATEGORY_ALIASES = {
    "bank": {"銀行", "分行"},
    "convenience_store": {"便利商店", "超商"},
    "cafe": {"咖啡店", "咖啡"},
    "coffee_shop": {"咖啡店", "咖啡"},
    "fast_food_restaurant": {"速食店", "餐廳"},
    "restaurant": {"餐廳"},
    "train_station": {"車站", "火車站"},
    "metro_station": {"捷運站", "車站"},
    "pharmacy": {"藥局"},
    "hospital": {"醫院"},
    "clinic": {"診所"},
}


def clean_text(value: Any, limit: int = 500) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).strip()
    return " ".join(text.split())[:limit]


def strings_from(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        text = clean_text(value)
        if text:
            yield text
        return
    if isinstance(value, list):
        for item in value:
            yield from strings_from(item)
        return
    if isinstance(value, dict):
        for item in value.values():
            yield from strings_from(item)


def unique_strings(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = clean_text(value)
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result


def preferred_name(names: Any) -> str:
    if not isinstance(names, dict):
        return ""
    primary = clean_text(names.get("primary"), 200)
    if primary:
        return primary

    common = names.get("common")
    if isinstance(common, dict):
        for language in ("zh-Hant", "zh-TW", "zh", "en"):
            candidates = unique_strings(strings_from(common.get(language)))
            if candidates:
                return candidates[0][:200]

    candidates = unique_strings(strings_from(common))
    return candidates[0][:200] if candidates else ""


def all_names(names: Any) -> list[str]:
    if not isinstance(names, dict):
        return []
    return unique_strings(strings_from(names))


def first_address(addresses: Any) -> dict[str, Any]:
    if not isinstance(addresses, list):
        return {}
    return next((item for item in addresses if isinstance(item, dict)), {})


def latest_source_update(sources: Any) -> str | None:
    updates: list[str] = []
    if isinstance(sources, list):
        for source in sources:
            if isinstance(source, dict):
                value = clean_text(source.get("update_time"), 80)
                if value:
                    updates.append(value)
    return max(updates) if updates else None


def primary_category(properties: dict[str, Any]) -> str:
    basic = clean_text(properties.get("basic_category"), 120)
    if basic:
        return basic
    taxonomy = properties.get("taxonomy")
    if isinstance(taxonomy, dict):
        return clean_text(taxonomy.get("primary"), 120)
    categories = properties.get("categories")
    if isinstance(categories, dict):
        return clean_text(categories.get("primary"), 120)
    return ""


def canonical_aliases(values: Iterable[str], category: str) -> list[str]:
    normalized = " ".join(values).casefold()
    aliases: set[str] = set(CATEGORY_ALIASES.get(category, set()))
    for group in BRAND_ALIAS_GROUPS:
        if any(alias.casefold() in normalized for alias in group):
            aliases.update(group)
    return sorted(aliases)


def build_search_text(values: Iterable[str]) -> str:
    text = " ".join(unique_strings(values)).casefold()
    # Taiwan users commonly alternate between 台 and 臺. Store both forms so
    # the database remains a simple, indexable substring search.
    variants = unique_strings((text, text.replace("台", "臺"), text.replace("臺", "台")))
    return " ".join(variants)[:4000]


def evaluate_feature(
    feature: dict[str, Any],
    batch: str,
) -> tuple[dict[str, Any] | None, str | None]:
    properties = feature.get("properties") or {}
    if not isinstance(properties, dict):
        return None, "invalid_properties"

    source_id = clean_text(feature.get("id") or properties.get("id"), 200)
    if not source_id:
        return None, "missing_id"

    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if (
        not isinstance(coordinates, list)
        or len(coordinates) < 2
        or not isinstance(coordinates[0], (int, float))
        or not isinstance(coordinates[1], (int, float))
    ):
        return None, "invalid_geometry"
    longitude = float(coordinates[0])
    latitude = float(coordinates[1])
    if not (18 <= latitude <= 27 and 117 <= longitude <= 124):
        return None, "outside_taiwan_area"

    confidence_raw = properties.get("confidence")
    confidence = float(confidence_raw) if isinstance(confidence_raw, (int, float)) else None
    if confidence is not None and confidence < MIN_CONFIDENCE:
        return None, "low_confidence"

    operating_status = clean_text(properties.get("operating_status"), 80) or None
    if operating_status == "permanently_closed":
        return None, "permanently_closed"

    names = properties.get("names")
    name = preferred_name(names)
    if not name:
        return None, "missing_name"

    brand = properties.get("brand")
    brand_names = brand.get("names") if isinstance(brand, dict) else None
    brand_name = preferred_name(brand_names) or None
    address = first_address(properties.get("addresses"))
    freeform = clean_text(address.get("freeform"), 500) or None
    locality = clean_text(address.get("locality"), 160) or None
    region = clean_text(address.get("region"), 160) or None
    country = clean_text(address.get("country"), 8).upper() or "TW"
    if country not in {"TW", "TWN"}:
        return None, "outside_taiwan_country"

    category = primary_category(properties) or None
    raw_names = unique_strings((*all_names(names), *all_names(brand_names)))
    aliases = canonical_aliases(raw_names, category or "")
    taxonomy_values = unique_strings(strings_from(properties.get("taxonomy")))
    search_text = build_search_text(
        (
            name,
            brand_name or "",
            *raw_names,
            *aliases,
            category or "",
            *taxonomy_values,
            freeform or "",
            locality or "",
            region or "",
        )
    )

    now = datetime.now(timezone.utc).isoformat()
    return (
        {
            "id": f"overture-{source_id}",
            "source": "overture",
            "source_id": source_id,
            "name": name,
            "brand_name": brand_name,
            "category": category,
            "address": freeform,
            "locality": locality,
            "region": region,
            "country_code": "TW",
            "latitude": latitude,
            "longitude": longitude,
            "confidence": confidence,
            "operating_status": operating_status,
            "aliases": aliases,
            "search_text": search_text,
            "active": True,
            "import_batch": batch,
            "source_updated_at": latest_source_update(properties.get("sources")),
            "imported_at": now,
        },
        None,
    )


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
    headers = {"apikey": secret_key, "Content-Type": "application/json"}
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
        "/rest/v1/pois?on_conflict=id",
        rows,
        prefer="resolution=merge-duplicates,return=minimal",
    )


def finalize_import(supabase_url: str, secret_key: str, batch: str) -> int:
    raw = request_supabase(
        supabase_url,
        secret_key,
        "/rest/v1/rpc/finalize_overture_poi_import",
        {"p_batch": batch},
    )
    try:
        return int(json.loads(raw.decode("utf-8")))
    except (ValueError, json.JSONDecodeError):
        return 0


def iter_features(paths: list[Path]) -> Iterable[dict[str, Any]]:
    for path in paths:
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
    parser.add_argument("--input", required=True, type=Path, action="append")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--report-output", type=Path)
    args = parser.parse_args()

    missing = [path for path in args.input if not path.exists()]
    if missing:
        print(f"Input file does not exist: {missing[0]}", file=sys.stderr)
        return 2

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    secret_key = (
        os.environ.get("SUPABASE_SECRET_KEY", "").strip()
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    if not args.dry_run and (not supabase_url or not secret_key):
        print("SUPABASE_URL and SUPABASE_SECRET_KEY are required.", file=sys.stderr)
        return 2

    batch = f"overture-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    started_at = time.time()
    counters: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    seen: set[str] = set()
    pending: list[dict[str, Any]] = []
    uploaded = 0

    for feature in iter_features(args.input):
        counters["scanned"] += 1
        row, rejection = evaluate_feature(feature, batch)
        if not row:
            counters[f"rejected:{rejection or 'unknown'}"] += 1
            continue
        if row["id"] in seen:
            counters["rejected:duplicate"] += 1
            continue

        seen.add(row["id"])
        counters["accepted"] += 1
        categories[row.get("category") or "uncategorized"] += 1
        pending.append(row)

        if len(pending) >= BATCH_SIZE:
            if not args.dry_run:
                upload_batch(supabase_url, secret_key, pending)
                uploaded += len(pending)
            print(f"processed {counters['accepted']} accepted POIs", flush=True)
            pending.clear()
        if args.limit and counters["accepted"] >= args.limit:
            break

    if pending and not args.dry_run:
        upload_batch(supabase_url, secret_key, pending)
        uploaded += len(pending)

    deactivated = 0
    if not args.dry_run:
        deactivated = finalize_import(supabase_url, secret_key, batch)

    report = {
        "schema": "detour-poi-import-report/v1",
        "batch": batch,
        "dry_run": args.dry_run,
        "scanned": counters["scanned"],
        "accepted": counters["accepted"],
        "uploaded": uploaded,
        "deactivated_old_rows": deactivated,
        "rejected_by_reason": {
            key.removeprefix("rejected:"): value
            for key, value in sorted(counters.items())
            if key.startswith("rejected:")
        },
        "top_categories": dict(categories.most_common(30)),
        "elapsed_seconds": round(time.time() - started_at, 1),
    }
    if args.report_output:
        args.report_output.parent.mkdir(parents=True, exist_ok=True)
        args.report_output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
