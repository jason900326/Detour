from pathlib import Path
import re

INDEX = Path('src/app/index.tsx')
text = INDEX.read_text(encoding='utf-8')


def sub_once(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')


analytics_import = "} from '../lib/playtest-analytics';\n"
if analytics_import not in text:
    raise SystemExit('playtest analytics import marker not found')

app_model_import = """
import {
  CAMERA_RESULT_KEY,
  DEFAULT_PREFERENCES,
  FREE_CAMERA_MISSION,
  MOODS,
  PASSPORT_KEY,
  PREFERENCES_KEY,
  TIME_MAX,
  TIME_MIN,
  TIME_STEPS,
  getPaceDistanceScale,
  walkingPaceLabel,
  type CameraRouteResult,
  type CameraSource,
  type DetourPreferences,
  type DetourPrewarm,
  type PassportEntry,
  type PassportMission,
  type SceneIssueReason,
  type SessionPhoto,
  type SessionSceneFailure,
  type Stage,
  type WalkingPace,
} from '../lib/app-model';
"""

if "from '../lib/app-model';" not in text:
    text = text.replace(analytics_import, analytics_import + app_model_import, 1)

sub_once(
    r"type Stage =.*?const DEFAULT_PREFERENCES: DetourPreferences = \{.*?\n\};\n\n",
    '',
    'remove app stage/preferences model',
)

sub_once(
    r"type SceneIssueReason =.*?type PassportEntry = \{.*?\n\};\n\n",
    '',
    'remove journey/session model',
)

for line, label in [
    ("const PASSPORT_KEY = '@detour/passport/v1';\n", 'passport key'),
    ("const PREFERENCES_KEY = '@detour/preferences/v1';\n", 'preferences key'),
]:
    if text.count(line) != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {text.count(line)}')
    text = text.replace(line, '', 1)

sub_once(
    r"const TIME_STEPS = \[15, 30, 45, 60, 90\] as const;.*?function walkingPaceLabel\(\n  pace: WalkingPace\n\) \{.*?\n\}\n\n",
    '',
    'remove time/mood/static helpers',
)

# Guardrails: these must now come only from app-model.ts.
for forbidden in [
    'type Stage =',
    'type PassportEntry =',
    "const CAMERA_RESULT_KEY = '@detour/camera/result/v1'",
    'const TIME_STEPS = [15, 30, 45, 60, 90] as const',
    'const MOODS:',
    'const FREE_CAMERA_MISSION:',
    'function getPaceDistanceScale(',
    'function walkingPaceLabel(',
]:
    if forbidden in text:
        raise SystemExit(f'refactor incomplete: {forbidden}')

INDEX.write_text(text, encoding='utf-8')
