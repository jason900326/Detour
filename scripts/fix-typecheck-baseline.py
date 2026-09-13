from pathlib import Path
import json

INDEX = Path('src/app/index.tsx')
CAMERA = Path('src/app/camera.tsx')
TSCONFIG = Path('tsconfig.json')
DECLARATIONS = Path('src/types/styles.d.ts')

absolute_fill = """const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
"""

# Main journey screen: restore the moved type import, fix nullable route narrowing,
# and replace RN style APIs / values that are valid at runtime but rejected by
# the current React Native TypeScript declarations.
index = INDEX.read_text(encoding='utf-8')
if 'type MissionResult,' not in index:
    marker = '  type PassportMission,\n'
    if index.count(marker) != 1:
        raise SystemExit('MissionResult import marker mismatch')
    index = index.replace(marker, marker + '  type MissionResult,\n', 1)

if 'const ABSOLUTE_FILL = {' not in index:
    marker = "const SOFT = '#E5E1D6';\n"
    if index.count(marker) != 1:
        raise SystemExit('index ABSOLUTE_FILL marker mismatch')
    index = index.replace(marker, marker + absolute_fill, 1)

index = index.replace('StyleSheet.absoluteFillObject', 'ABSOLUTE_FILL')
index = index.replace("fontWeight: '650'", "fontWeight: '600'")
index = index.replace('        if (!beat) return;\n', '        if (!route || !beat) return;\n', 1)
INDEX.write_text(index, encoding='utf-8')

# Camera: reuse shared session model and use a typed absolute-fill object.
camera = CAMERA.read_text(encoding='utf-8')
if "from '../lib/app-model';" not in camera:
    marker = "import { useLocalSearchParams, useRouter } from 'expo-router';\n"
    shared_import = """
import {
  CAMERA_RESULT_KEY,
  type CameraRouteResult,
  type CameraSource,
  type SessionPhoto,
} from '../lib/app-model';
"""
    if camera.count(marker) != 1:
        raise SystemExit('camera shared model import marker mismatch')
    camera = camera.replace(marker, marker + shared_import, 1)

start = camera.find("const CAMERA_RESULT_KEY = '@detour/camera/result/v1';")
end_marker = "function getParam(value: string | string[] | undefined, fallback = '') {"
end = camera.find(end_marker)
if start == -1 or end == -1 or start >= end:
    raise SystemExit('camera local model block mismatch')
local_block = camera[start:end]
# Preserve only the visual constants from the local block.
replacement = """const INK = '#11110F';
const BONE = '#F1EFE7';
const MUTED = '#B7B2A8';
const SIGNAL = '#FF5A36';
""" + absolute_fill + "\n"
camera = camera[:start] + replacement + camera[end:]
camera = camera.replace('StyleSheet.absoluteFillObject', 'ABSOLUTE_FILL')
CAMERA.write_text(camera, encoding='utf-8')

# The Supabase Edge Functions use Deno's type environment and should not be
# compiled by the Expo app's root TypeScript project.
tsconfig = json.loads(TSCONFIG.read_text(encoding='utf-8'))
tsconfig['exclude'] = ['backend']
TSCONFIG.write_text(json.dumps(tsconfig, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Expo starter web helpers import CSS directly. Declare those asset modules so
# the app typecheck can include the helpers without pretending they do not exist.
DECLARATIONS.parent.mkdir(parents=True, exist_ok=True)
DECLARATIONS.write_text(
    "declare module '*.css';\n"
    "declare module '*.module.css' {\n"
    "  const classes: Record<string, string>;\n"
    "  export default classes;\n"
    "}\n",
    encoding='utf-8',
)
