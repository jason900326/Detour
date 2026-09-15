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


replace_once(
    "src/lib/scene-engine.ts",
    """export function isUnsafeOrRestrictedScene(tags: Record<string, string>) {\n  const access = tags.access ?? '';\n  if (['private', 'no'].includes(access)) return true;\n\n  const amenity = tags.amenity ?? '';\n""",
    """export function isUnsafeOrRestrictedScene(tags: Record<string, string>) {\n  const access = tags.access ?? '';\n  if (['private', 'no'].includes(access)) return true;\n\n  // A synthetic coordinate has no place-level safety context. Never issue a\n  // ticket to one: failing safely is better than landing inside a hospital,\n  // government compound, private building, or other unknown parcel.\n  if (tags['detour:generated'] === 'route-anchor') return true;\n\n  const amenity = tags.amenity ?? '';\n""",
)

replace_once(
    "backend/detour-scene/index.ts",
    """function isUnsafeOrRestrictedScene(tags: Record<string, string>) {\n  if ([\"private\", \"no\"].includes(tags.access ?? \"\")) return true;\n\n  const amenity = tags.amenity ?? \"\";\n""",
    """function isUnsafeOrRestrictedScene(tags: Record<string, string>) {\n  if ([\"private\", \"no\"].includes(tags.access ?? \"\")) return true;\n  if (tags[\"detour:generated\"] === \"route-anchor\") return true;\n\n  const amenity = tags.amenity ?? \"\";\n""",
)

old_generated = """function generatedResponse(descriptor: QueryDescriptor, startedAt: number) {\n  const elements = generatedRouteAnchors(descriptor);\n\n  if (elements.length === 0) {\n    return json(\n      {\n        error: \"SCENE_DATABASE_EMPTY\",\n        detail: \"Food needs a real named place. Taiwan Scene import has not provided one here yet.\",\n      },\n      503,\n      { \"X-Detour-Scene-Source\": \"database-empty\" },\n    );\n  }\n\n  console.log(\n    `[DETOUR SCENE API] route-anchor fallback ${Date.now() - startedAt}ms · ${elements.length} anchors`,\n  );\n\n  return json(\n    {\n      elements,\n      detourCache: {\n        status: \"generated\",\n        ageMs: 0,\n        upstream: \"route-anchor\",\n      },\n    },\n    200,\n    { \"X-Detour-Scene-Source\": \"route-anchor\" },\n  );\n}\n"""

new_generated = """function generatedResponse(descriptor: QueryDescriptor, startedAt: number) {\n  console.log(\n    `[DETOUR SCENE API] database empty ${Date.now() - startedAt}ms · refusing unsafe synthetic anchor`,\n  );\n\n  return json(\n    {\n      error: \"SCENE_DATABASE_EMPTY\",\n      detail:\n        descriptor.family === \"food\"\n          ? \"Food needs a real named place. Taiwan Scene import has not provided one here yet.\"\n          : \"No verified public Scene is available in this area yet.\",\n    },\n    503,\n    { \"X-Detour-Scene-Source\": \"database-empty\" },\n  );\n}\n"""

replace_once("backend/detour-scene/index.ts", old_generated, new_generated)

print("Disabled unverified synthetic Scene anchors.")
