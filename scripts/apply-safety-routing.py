#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# 1) Runtime Scene safety gate. This is intentionally before scoring: unsafe
# candidates never enter ranking, routing, ticket issue, or arrival missions.
replace_once(
    "src/lib/scene-engine.ts",
    """function classifyScene(\n  tags: Record<string, string>\n): { kind: SceneKind; label: string } | null {\n  if (isReligious(tags)) return null;\n""",
    """function normalizedSceneText(tags: Record<string, string>) {\n  return [\n    tags.name,\n    tags['name:zh'],\n    tags.official_name,\n    tags.operator,\n    tags.description,\n  ]\n    .filter(Boolean)\n    .join(' ')\n    .toLowerCase();\n}\n\nfunction hasAnySceneKeyword(text: string, keywords: string[]) {\n  return keywords.some((keyword) => text.includes(keyword));\n}\n\nfunction isClearlyPublicDestination(tags: Record<string, string>) {\n  return (\n    ['museum', 'gallery'].includes(tags.tourism ?? '') ||\n    [\n      'arts_centre',\n      'community_centre',\n      'library',\n      'marketplace',\n      'public_bookcase',\n    ].includes(tags.amenity ?? '') ||\n    ['park', 'garden'].includes(tags.leisure ?? '') ||\n    tags.place === 'square'\n  );\n}\n\nexport function isUnsafeOrRestrictedScene(tags: Record<string, string>) {\n  const access = tags.access ?? '';\n  if (['private', 'no'].includes(access)) return true;\n\n  const amenity = tags.amenity ?? '';\n  const building = tags.building ?? '';\n  const healthcare = tags.healthcare ?? '';\n  const emergency = tags.emergency ?? '';\n  const office = tags.office ?? '';\n  const text = normalizedSceneText(tags);\n\n  // Hospitals and clinical grounds are a hard exclusion. A public lobby,\n  // artwork tag, or access=yes must never turn them into a Detour destination.\n  const isHealthcare =\n    ['hospital', 'clinic', 'doctors', 'dentist'].includes(amenity) ||\n    ['hospital', 'clinic', 'doctor', 'dentist', 'centre', 'center'].includes(healthcare) ||\n    building === 'hospital' ||\n    emergency === 'emergency_ward' ||\n    hasAnySceneKeyword(text, [\n      '醫院',\n      '醫學中心',\n      '醫療中心',\n      '診所',\n      ' hospital',\n      'hospital ',\n      'medical center',\n      'medical centre',\n      ' clinic',\n      'clinic ',\n    ]);\n\n  if (isHealthcare) return true;\n\n  const isPoliceOrFire =\n    ['police', 'fire_station'].includes(amenity) ||\n    ['police', 'fire_station'].includes(building) ||\n    ['fire_station', 'ambulance_station'].includes(emergency) ||\n    hasAnySceneKeyword(text, [\n      '警察局',\n      '派出所',\n      '分局',\n      '警察隊',\n      '消防局',\n      '消防隊',\n      '消防分隊',\n      'police station',\n      'fire station',\n    ]);\n\n  // Police/fire museums are legitimate public attractions. Operational\n  // stations are not, even though members of the public can enter for service.\n  if (\n    isPoliceOrFire &&\n    !['museum', 'gallery'].includes(tags.tourism ?? '')\n  ) {\n    return true;\n  }\n\n  const isSecure =\n    amenity === 'prison' ||\n    tags.landuse === 'military' ||\n    tags.military !== undefined ||\n    building === 'military';\n\n  if (isSecure) return true;\n\n  const isGovernment =\n    office === 'government' ||\n    tags.government !== undefined ||\n    ['townhall', 'courthouse', 'embassy'].includes(amenity) ||\n    ['government', 'civic'].includes(building) ||\n    hasAnySceneKeyword(text, [\n      '市政府',\n      '縣政府',\n      '區公所',\n      '鄉公所',\n      '鎮公所',\n      '戶政事務所',\n      '地政事務所',\n      '稅捐處',\n      '稅務局',\n      '法院',\n      '檢察署',\n      'government office',\n      'city hall',\n      'district office',\n      'courthouse',\n    ]);\n\n  // Government-operated spaces are allowed only when the OSM feature itself\n  // is clearly a public destination (museum, library, park, square, etc.).\n  if (isGovernment && !isClearlyPublicDestination(tags)) return true;\n\n  return false;\n}\n\nfunction classifyScene(\n  tags: Record<string, string>\n): { kind: SceneKind; label: string } | null {\n  if (isReligious(tags) || isUnsafeOrRestrictedScene(tags)) return null;\n""",
)

# 2) Import-time copy of the safety rules so future Taiwan Scene refreshes do
# not persist obviously restricted rows in the database.
replace_once(
    "scripts/import_osm_scenes.py",
    """def classify(tags: dict[str, str]) -> tuple[str, str] | None:\n    if is_religious(tags):\n        return None\n""",
    """def normalized_scene_text(tags: dict[str, str]) -> str:\n    return \" \".join(\n        str(tags.get(key, \"\"))\n        for key in (\"name\", \"name:zh\", \"official_name\", \"operator\", \"description\")\n        if tags.get(key)\n    ).lower()\n\n\ndef has_any_scene_keyword(text: str, keywords: set[str]) -> bool:\n    return any(keyword in text for keyword in keywords)\n\n\ndef is_clearly_public_destination(tags: dict[str, str]) -> bool:\n    return (\n        tags.get(\"tourism\") in {\"museum\", \"gallery\"}\n        or tags.get(\"amenity\") in {\n            \"arts_centre\",\n            \"community_centre\",\n            \"library\",\n            \"marketplace\",\n            \"public_bookcase\",\n        }\n        or tags.get(\"leisure\") in {\"park\", \"garden\"}\n        or tags.get(\"place\") == \"square\"\n    )\n\n\ndef is_unsafe_or_restricted_scene(tags: dict[str, str]) -> bool:\n    if tags.get(\"access\") in {\"private\", \"no\"}:\n        return True\n\n    amenity = tags.get(\"amenity\", \"\")\n    building = tags.get(\"building\", \"\")\n    healthcare = tags.get(\"healthcare\", \"\")\n    emergency = tags.get(\"emergency\", \"\")\n    office = tags.get(\"office\", \"\")\n    text = normalized_scene_text(tags)\n\n    is_healthcare = (\n        amenity in {\"hospital\", \"clinic\", \"doctors\", \"dentist\"}\n        or healthcare in {\"hospital\", \"clinic\", \"doctor\", \"dentist\", \"centre\", \"center\"}\n        or building == \"hospital\"\n        or emergency == \"emergency_ward\"\n        or has_any_scene_keyword(\n            text,\n            {\n                \"醫院\",\n                \"醫學中心\",\n                \"醫療中心\",\n                \"診所\",\n                \" hospital\",\n                \"hospital \",\n                \"medical center\",\n                \"medical centre\",\n                \" clinic\",\n                \"clinic \",\n            },\n        )\n    )\n    if is_healthcare:\n        return True\n\n    is_police_or_fire = (\n        amenity in {\"police\", \"fire_station\"}\n        or building in {\"police\", \"fire_station\"}\n        or emergency in {\"fire_station\", \"ambulance_station\"}\n        or has_any_scene_keyword(\n            text,\n            {\n                \"警察局\",\n                \"派出所\",\n                \"分局\",\n                \"警察隊\",\n                \"消防局\",\n                \"消防隊\",\n                \"消防分隊\",\n                \"police station\",\n                \"fire station\",\n            },\n        )\n    )\n    if is_police_or_fire and tags.get(\"tourism\") not in {\"museum\", \"gallery\"}:\n        return True\n\n    if (\n        amenity == \"prison\"\n        or tags.get(\"landuse\") == \"military\"\n        or \"military\" in tags\n        or building == \"military\"\n    ):\n        return True\n\n    is_government = (\n        office == \"government\"\n        or \"government\" in tags\n        or amenity in {\"townhall\", \"courthouse\", \"embassy\"}\n        or building in {\"government\", \"civic\"}\n        or has_any_scene_keyword(\n            text,\n            {\n                \"市政府\",\n                \"縣政府\",\n                \"區公所\",\n                \"鄉公所\",\n                \"鎮公所\",\n                \"戶政事務所\",\n                \"地政事務所\",\n                \"稅捐處\",\n                \"稅務局\",\n                \"法院\",\n                \"檢察署\",\n                \"government office\",\n                \"city hall\",\n                \"district office\",\n                \"courthouse\",\n            },\n        )\n    )\n    if is_government and not is_clearly_public_destination(tags):\n        return True\n\n    return False\n\n\ndef classify(tags: dict[str, str]) -> tuple[str, str] | None:\n    if is_religious(tags) or is_unsafe_or_restricted_scene(tags):\n        return None\n""",
)

replace_once(
    "scripts/import_osm_scenes.py",
    """    tags = tags_from_properties(properties)\n    if tags.get(\"access\") in {\"private\", \"no\"}:\n        return None\n\n    classification = classify(tags)\n""",
    """    tags = tags_from_properties(properties)\n    if is_unsafe_or_restricted_scene(tags):\n        return None\n\n    classification = classify(tags)\n""",
)

# 3) Server-side defensive filter. Client filtering remains authoritative for
# old/cached rows, but a deployed gateway should not send restricted rows at all.
replace_once(
    "backend/detour-scene/index.ts",
    "const QUERY_VERSION = 4;",
    "const QUERY_VERSION = 5;",
)

replace_once(
    "backend/detour-scene/index.ts",
    """function sceneRowsToElements(rows: SceneRow[]): OverpassElement[] {\n  const elements: OverpassElement[] = [];\n\n  for (const row of rows) {\n    if (!row.osm_type || row.osm_id === null) continue;\n\n    const id = Number(row.osm_id);\n    if (!Number.isFinite(id)) continue;\n\n    elements.push({\n      type: row.osm_type,\n      id,\n      lat: Number(row.latitude),\n      lon: Number(row.longitude),\n      tags: row.tags ?? {},\n    });\n  }\n\n  return elements;\n}\n""",
    """function normalizedSceneText(tags: Record<string, string>) {\n  return [\n    tags.name,\n    tags[\"name:zh\"],\n    tags.official_name,\n    tags.operator,\n    tags.description,\n  ]\n    .filter(Boolean)\n    .join(\" \")\n    .toLowerCase();\n}\n\nfunction hasAnySceneKeyword(text: string, keywords: string[]) {\n  return keywords.some((keyword) => text.includes(keyword));\n}\n\nfunction isClearlyPublicDestination(tags: Record<string, string>) {\n  return (\n    [\"museum\", \"gallery\"].includes(tags.tourism ?? \"\") ||\n    [\n      \"arts_centre\",\n      \"community_centre\",\n      \"library\",\n      \"marketplace\",\n      \"public_bookcase\",\n    ].includes(tags.amenity ?? \"\") ||\n    [\"park\", \"garden\"].includes(tags.leisure ?? \"\") ||\n    tags.place === \"square\"\n  );\n}\n\nfunction isUnsafeOrRestrictedScene(tags: Record<string, string>) {\n  if ([\"private\", \"no\"].includes(tags.access ?? \"\")) return true;\n\n  const amenity = tags.amenity ?? \"\";\n  const building = tags.building ?? \"\";\n  const healthcare = tags.healthcare ?? \"\";\n  const emergency = tags.emergency ?? \"\";\n  const office = tags.office ?? \"\";\n  const text = normalizedSceneText(tags);\n\n  if (\n    [\"hospital\", \"clinic\", \"doctors\", \"dentist\"].includes(amenity) ||\n    [\"hospital\", \"clinic\", \"doctor\", \"dentist\", \"centre\", \"center\"].includes(healthcare) ||\n    building === \"hospital\" ||\n    emergency === \"emergency_ward\" ||\n    hasAnySceneKeyword(text, [\n      \"醫院\", \"醫學中心\", \"醫療中心\", \"診所\",\n      \" hospital\", \"hospital \", \"medical center\", \"medical centre\",\n      \" clinic\", \"clinic \",\n    ])\n  ) {\n    return true;\n  }\n\n  const policeOrFire =\n    [\"police\", \"fire_station\"].includes(amenity) ||\n    [\"police\", \"fire_station\"].includes(building) ||\n    [\"fire_station\", \"ambulance_station\"].includes(emergency) ||\n    hasAnySceneKeyword(text, [\n      \"警察局\", \"派出所\", \"分局\", \"警察隊\",\n      \"消防局\", \"消防隊\", \"消防分隊\",\n      \"police station\", \"fire station\",\n    ]);\n\n  if (policeOrFire && ![\"museum\", \"gallery\"].includes(tags.tourism ?? \"\")) {\n    return true;\n  }\n\n  if (\n    amenity === \"prison\" ||\n    tags.landuse === \"military\" ||\n    tags.military !== undefined ||\n    building === \"military\"\n  ) {\n    return true;\n  }\n\n  const government =\n    office === \"government\" ||\n    tags.government !== undefined ||\n    [\"townhall\", \"courthouse\", \"embassy\"].includes(amenity) ||\n    [\"government\", \"civic\"].includes(building) ||\n    hasAnySceneKeyword(text, [\n      \"市政府\", \"縣政府\", \"區公所\", \"鄉公所\", \"鎮公所\",\n      \"戶政事務所\", \"地政事務所\", \"稅捐處\", \"稅務局\",\n      \"法院\", \"檢察署\", \"government office\", \"city hall\",\n      \"district office\", \"courthouse\",\n    ]);\n\n  return government && !isClearlyPublicDestination(tags);\n}\n\nfunction sceneRowsToElements(rows: SceneRow[]): OverpassElement[] {\n  const elements: OverpassElement[] = [];\n\n  for (const row of rows) {\n    if (!row.osm_type || row.osm_id === null) continue;\n\n    const id = Number(row.osm_id);\n    if (!Number.isFinite(id)) continue;\n\n    const tags = row.tags ?? {};\n    if (isUnsafeOrRestrictedScene(tags)) continue;\n\n    elements.push({\n      type: row.osm_type,\n      id,\n      lat: Number(row.latitude),\n      lon: Number(row.longitude),\n      tags,\n    });\n  }\n\n  return elements;\n}\n""",
)

# 4) Remove the active manhole mission and tighten nearby visual prompts so
# nothing suggests stepping toward the carriageway.
replace_once(
    "src/lib/journey-engine.ts",
    """    {\n      code: 'MANHOLE',\n      family: 'boundary',\n      title: '拍一個人孔蓋。',\n      instruction: `${nightNote} 不用走到馬路中央；只拍安全可見的人孔蓋或排水蓋。找不到就跳過。`,\n      completion: '拍到一個地面金屬蓋。',\n      photo: true,\n      portable: true,\n    },\n""",
    """    {\n      code: 'ONE TILE',\n      family: 'texture',\n      title: '拍一塊磁磚。',\n      instruction: `${nightNote} 牆面、騎樓柱面或公開空間的磁磚都可以；不用靠近車道或私人入口。`,\n      completion: '照片裡有一塊清楚可辨的磁磚或磁磚紋理。',\n      photo: true,\n      portable: true,\n    },\n""",
)

replace_once(
    "src/lib/journey-engine.ts",
    """      instruction: `${nightNote} 招牌、輪子、蓋子、燈或圖案都可以；只要一眼看得出是圓的。`,\n""",
    """      instruction: `${nightNote} 招牌、輪子、燈或圖案都可以；不要為了找圓形靠近車道。`,\n""",
)

replace_once(
    "src/lib/journey-engine.ts",
    """      instruction: `${nightNote} 地面、路牌、貼紙或標示都算；不要為了找它繞路。`,\n""",
    """      instruction: `${nightNote} 人行空間的地面標示、路牌、貼紙或告示都算；不要為了找它靠近車道或繞路。`,\n""",
)

replace_once(
    "src/lib/journey-engine.ts",
    """      instruction: `${nightNote} 牆邊、欄杆、磁磚縫、路面標線都可以。`,\n""",
    """      instruction: `${nightNote} 牆邊、欄杆、磁磚縫或人行空間的地面線都可以；不要走進車道。`,\n""",
)

# 5) Route novelty: the router still requests a single shortest foot route to
# each destination. We choose a different destination when that shortest route
# substantially repeats recent walking, instead of manufacturing a scenic loop.
replace_once(
    "src/lib/routing-engine.ts",
    """const MAX_TICKET_NETWORK_ATTEMPTS = 2;\n""",
    """const MAX_TICKET_NETWORK_ATTEMPTS = 2;\nconst ROUTE_REPEAT_MATCH_METERS = 18;\nconst ROUTE_REPEAT_START_IGNORE_METERS = 55;\nconst ROUTE_OVERLAP_PREFERRED_MAX = 0.12;\nconst ROUTE_OVERLAP_FALLBACK_MAX = 0.22;\nconst ROUTE_OVERLAP_EMERGENCY_MAX = 0.42;\nconst ROUTE_DIRECTNESS_PREFERRED_MAX = 1.85;\nconst ROUTE_DIRECTNESS_FALLBACK_MAX = 2.2;\nconst ROUTE_DIRECTNESS_EMERGENCY_MAX = 2.7;\n""",
)

old_overlap = """function routeOverlapRatio(route: GeoPoint[], avoidRoutes: GeoPoint[][]) {\n  if (route.length < 4 || avoidRoutes.length === 0) return 0;\n\n  // Every Detour from the same starting point naturally shares its first few\n  // metres. Novelty matters after the route has actually left the origin.\n  const startIndex = Math.min(route.length - 1, Math.floor(route.length * 0.18));\n  const usable = route.slice(startIndex);\n  const step = Math.max(1, Math.floor(usable.length / 20));\n  const samples = usable.filter((_, index) => index % step === 0).slice(0, 24);\n  if (samples.length === 0) return 0;\n\n  const historical = avoidRoutes\n    .filter((item) => item.length >= 2)\n    .slice(0, 6)\n    .flatMap((item) => {\n      const historyStep = Math.max(1, Math.floor(item.length / 90));\n      return item.filter((_, index) => index % historyStep === 0);\n    });\n\n  if (historical.length === 0) return 0;\n\n  let overlapping = 0;\n  for (const point of samples) {\n    if (historical.some((oldPoint) => distanceBetweenPoints(point, oldPoint) <= 35)) {\n      overlapping += 1;\n    }\n  }\n\n  return overlapping / samples.length;\n}\n"""

new_overlap = """function routeAfterInitialMeters(route: GeoPoint[], ignoreMeters: number) {\n  if (route.length < 2 || ignoreMeters <= 0) return route;\n\n  let walked = 0;\n  for (let index = 1; index < route.length; index += 1) {\n    walked += distanceBetweenPoints(route[index - 1], route[index]);\n    if (walked >= ignoreMeters) {\n      return route.slice(index);\n    }\n  }\n\n  return route.slice(-1);\n}\n\nfunction routeOverlapRatio(route: GeoPoint[], avoidRoutes: GeoPoint[][]) {\n  if (route.length < 4 || avoidRoutes.length === 0) return 0;\n\n  // The first few metres out of the user's current position are often\n  // unavoidable. Ignore a fixed walking distance, not a percentage of points,\n  // then treat actual same-street reuse as expensive.\n  const usable = routeAfterInitialMeters(\n    route,\n    ROUTE_REPEAT_START_IGNORE_METERS\n  );\n  const step = Math.max(1, Math.floor(usable.length / 24));\n  const samples = usable\n    .filter((_, index) => index % step === 0)\n    .slice(0, 28);\n  if (samples.length === 0) return 0;\n\n  const historical = avoidRoutes\n    .filter((item) => item.length >= 2)\n    .slice(0, 6)\n    .flatMap((item) => {\n      const historyStep = Math.max(1, Math.floor(item.length / 110));\n      return item.filter((_, index) => index % historyStep === 0);\n    });\n\n  if (historical.length === 0) return 0;\n\n  let overlapping = 0;\n  for (const point of samples) {\n    if (\n      historical.some(\n        (oldPoint) =>\n          distanceBetweenPoints(point, oldPoint) <= ROUTE_REPEAT_MATCH_METERS\n      )\n    ) {\n      overlapping += 1;\n    }\n  }\n\n  return overlapping / samples.length;\n}\n"""
replace_once("src/lib/routing-engine.ts", old_overlap, new_overlap)

replace_once(
    "src/lib/routing-engine.ts",
    """type RouteAssessment = {\n  score: number;\n  preferred: boolean;\n  fallback: boolean;\n  emergency: boolean;\n};\n""",
    """type RouteAssessment = {\n  score: number;\n  preferred: boolean;\n  fallback: boolean;\n  emergency: boolean;\n  overlapRatio: number;\n  directnessRatio: number;\n};\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """  minutes: number;\n  avoidRoutes: GeoPoint[][];\n}): RouteAssessment {\n  const overlap = routeOverlapRatio(args.route.coordinates, args.avoidRoutes);\n""",
    """  minutes: number;\n  avoidRoutes: GeoPoint[][];\n  straightDistanceMeters: number;\n}): RouteAssessment {\n  const overlap = routeOverlapRatio(args.route.coordinates, args.avoidRoutes);\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """  const distanceDelta = Math.abs(args.route.distanceMeters - args.profile.target);\n\n  // History overlap is a preference, never a blocker. A repeated route should\n  // lose against an equally fast fresh route, but it must not stop ticket issue.\n  const noveltyPenalty = overlap * args.profile.target * 0.95;\n  const overtimePenalty = overtimeSeconds * 1.4;\n  const score = distanceDelta + noveltyPenalty + overtimePenalty;\n\n  const distanceFits =\n    args.route.distanceMeters >= args.profile.min &&\n    args.route.distanceMeters <= args.maxDistance;\n  const timeFits = estimatedSeconds <= args.timeBudgetSeconds;\n\n  return {\n    score,\n    preferred: distanceFits && timeFits,\n    fallback:\n      args.route.distanceMeters >= 70 &&\n      estimatedSeconds <= args.timeBudgetSeconds * 1.12,\n    emergency:\n      args.route.distanceMeters >= 70 &&\n      estimatedSeconds <= args.timeBudgetSeconds * 1.3,\n  };\n""",
    """  const distanceDelta = Math.abs(args.route.distanceMeters - args.profile.target);\n  const directnessRatio =\n    args.route.distanceMeters / Math.max(80, args.straightDistanceMeters);\n\n  // Detour should come from the destination, not from deliberately inefficient\n  // routing. OSRM supplies the shortest foot leg; if that leg substantially\n  // repeats recent walking or is very circuitous, prefer another Scene.\n  const noveltyPenalty = overlap * args.profile.target * 2.4;\n  const circuitPenalty =\n    Math.max(0, directnessRatio - 1.45) * args.profile.target * 0.9;\n  const overtimePenalty = overtimeSeconds * 1.4;\n  const score =\n    distanceDelta + noveltyPenalty + circuitPenalty + overtimePenalty;\n\n  const distanceFits =\n    args.route.distanceMeters >= args.profile.min &&\n    args.route.distanceMeters <= args.maxDistance;\n  const timeFits = estimatedSeconds <= args.timeBudgetSeconds;\n\n  return {\n    score,\n    preferred:\n      distanceFits &&\n      timeFits &&\n      overlap <= ROUTE_OVERLAP_PREFERRED_MAX &&\n      directnessRatio <= ROUTE_DIRECTNESS_PREFERRED_MAX,\n    fallback:\n      args.route.distanceMeters >= 70 &&\n      estimatedSeconds <= args.timeBudgetSeconds * 1.12 &&\n      overlap <= ROUTE_OVERLAP_FALLBACK_MAX &&\n      directnessRatio <= ROUTE_DIRECTNESS_FALLBACK_MAX,\n    emergency:\n      args.route.distanceMeters >= 70 &&\n      estimatedSeconds <= args.timeBudgetSeconds * 1.3 &&\n      overlap <= ROUTE_OVERLAP_EMERGENCY_MAX &&\n      directnessRatio <= ROUTE_DIRECTNESS_EMERGENCY_MAX,\n    overlapRatio: overlap,\n    directnessRatio,\n  };\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """      minutes: args.minutes,\n      avoidRoutes: args.avoidRoutes,\n    }),\n""",
    """      minutes: args.minutes,\n      avoidRoutes: args.avoidRoutes,\n      straightDistanceMeters:\n        args.scene.straightDistanceMeters,\n    }),\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """    distanceScale,\n    3\n  );\n\n  let bestCached: RoutedScene | null = null;\n  let bestCachedScore = Number.POSITIVE_INFINITY;\n  let bestEmergency: RoutedScene | null = null;\n  let bestEmergencyScore = Number.POSITIVE_INFINITY;\n""",
    """    distanceScale,\n    4\n  );\n\n  let bestCached: RoutedScene | null = null;\n  let bestCachedScore = Number.POSITIVE_INFINITY;\n  let bestFallback: RoutedScene | null = null;\n  let bestFallbackScore = Number.POSITIVE_INFINITY;\n  let bestEmergency: RoutedScene | null = null;\n  let bestEmergencyScore = Number.POSITIVE_INFINITY;\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """    if (\n      (assessment.preferred || assessment.fallback) &&\n      assessment.score < bestCachedScore\n    ) {\n      bestCached = routed;\n      bestCachedScore = assessment.score;\n    }\n\n    if (\n      assessment.emergency &&\n""",
    """    if (\n      assessment.preferred &&\n      assessment.score < bestCachedScore\n    ) {\n      bestCached = routed;\n      bestCachedScore = assessment.score;\n    }\n\n    if (\n      assessment.fallback &&\n      assessment.score < bestFallbackScore\n    ) {\n      bestFallback = routed;\n      bestFallbackScore = assessment.score;\n    }\n\n    if (\n      assessment.emergency &&\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """      if (assessment.preferred || assessment.fallback) {\n        console.log(\n          `[DETOUR ROUTE] in-flight hint won in ${Date.now() - routingStartedAt}ms`\n        );\n        return routed;\n      }\n\n      if (\n        assessment.emergency &&\n""",
    """      if (assessment.preferred) {\n        console.log(\n          `[DETOUR ROUTE] fresh in-flight hint won in ${Date.now() - routingStartedAt}ms`\n        );\n        return routed;\n      }\n\n      if (\n        assessment.fallback &&\n        assessment.score < bestFallbackScore\n      ) {\n        bestFallback = routed;\n        bestFallbackScore = assessment.score;\n      }\n\n      if (\n        assessment.emergency &&\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """      if (assessment.preferred || assessment.fallback) {\n        console.log(\n          `[DETOUR ROUTE] late cache hit in ${Date.now() - routingStartedAt}ms`\n        );\n        return routed;\n      }\n\n      if (\n        assessment.emergency &&\n""",
    """      if (assessment.preferred) {\n        console.log(\n          `[DETOUR ROUTE] fresh late cache hit in ${Date.now() - routingStartedAt}ms`\n        );\n        return routed;\n      }\n\n      if (\n        assessment.fallback &&\n        assessment.score < bestFallbackScore\n      ) {\n        bestFallback = routed;\n        bestFallbackScore = assessment.score;\n      }\n\n      if (\n        assessment.emergency &&\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """      if (assessment.fallback) {\n        console.log(\n          `[DETOUR ROUTE] soft fallback ${networkAttempts} in ${Date.now() - routingStartedAt}ms`\n        );\n        return routed;\n      }\n\n      if (\n        assessment.emergency &&\n""",
    """      if (\n        assessment.fallback &&\n        assessment.score < bestFallbackScore\n      ) {\n        bestFallback = routed;\n        bestFallbackScore = assessment.score;\n        console.log(\n          `[DETOUR ROUTE] kept fallback ${networkAttempts}; checking for a fresher shortest leg`\n        );\n      }\n\n      if (\n        assessment.emergency &&\n""",
)

replace_once(
    "src/lib/routing-engine.ts",
    """  if (bestEmergency) {\n    console.log(\n      `[DETOUR ROUTE] emergency fallback in ${Date.now() - routingStartedAt}ms`\n    );\n    return bestEmergency;\n  }\n""",
    """  if (bestFallback) {\n    console.log(\n      `[DETOUR ROUTE] best acceptable fallback in ${Date.now() - routingStartedAt}ms`\n    );\n    return bestFallback;\n  }\n\n  if (bestEmergency) {\n    console.log(\n      `[DETOUR ROUTE] emergency fallback in ${Date.now() - routingStartedAt}ms`\n    );\n    return bestEmergency;\n  }\n""",
)

print("Applied Detour safety and fresh-route policy.")
