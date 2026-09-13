from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VISUALS = ROOT / 'src/components/detour-visuals.tsx'
HELPERS = ROOT / 'src/lib/home-helpers.ts'
CONTROLLER = ROOT / 'src/hooks/use-detour-home-controller.ts'
VIEW = ROOT / 'src/components/detour-home-view.tsx'

v = VISUALS.read_text()
h = HELPERS.read_text()

def pos(text: str, marker: str) -> int:
    value = text.find(marker)
    if value < 0:
        raise RuntimeError(f'missing marker: {marker}')
    return value

# --- Split visual presentation by domain -----------------------------------
mood_start = pos(v, 'type MoodGlyphProps')
ticket_start = pos(v, 'const DETOUR_TICKET_BARS')
skyline_start = pos(v, 'export function V45Skyline')
mood_icon_start = pos(v, 'export function V45MoodIcon')
art_ticket_start = pos(v, 'export function V45Ticket')
share_start = pos(v, 'export function V45SharePoster')

mood_glyph = v[mood_start:ticket_start].strip()
ticket_legacy = v[ticket_start:skyline_start].strip()
skyline = v[skyline_start:mood_icon_start].strip()
mood_icon = v[mood_icon_start:art_ticket_start].strip()
art_ticket = v[art_ticket_start:share_start].strip()
recap = v[share_start:].strip()

mood_file = ROOT / 'src/components/mood-visuals.tsx'
mood_file.write_text("""import { View } from 'react-native';
import MoodWanderIcon from '../../assets/mood/wander.svg';
import MoodFoodIcon from '../../assets/mood/food.svg';
import MoodQuietIcon from '../../assets/mood/quiet.svg';
import MoodWeirdIcon from '../../assets/mood/weird.svg';
import MoodColorIcon from '../../assets/mood/color.svg';
import MoodSurpriseIcon from '../../assets/mood/surprise.svg';
import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';

""" + mood_glyph + '\n\n' + skyline + '\n\n' + mood_icon + '\n')

ticket_file = ROOT / 'src/components/ticket-visuals.tsx'
ticket_file.write_text("""import { useState } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import type { MoodId } from '../lib/journey-engine';
import { styles } from '../styles/home-styles';
import { SIGNAL } from '../theme/detour-theme';
import { V45MoodIcon } from './mood-visuals';

let ticketArtworkDecoded = false;

""" + ticket_legacy + '\n\n' + art_ticket + '\n')

recap_file = ROOT / 'src/components/journey-recap-visuals.tsx'
recap_file.write_text("""import { Image, Pressable, Text, View } from 'react-native';
import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/detour-formatters';
import { styles } from '../styles/home-styles';

""" + recap + '\n')

# --- Split helper grab bag by responsibility -------------------------------
h_mood = pos(h, 'export function moodHint')
h_ticket = pos(h, 'export function ticketSerial')
h_film = pos(h, 'export function getFilmRollCapacity')
h_parse = pos(h, 'export function parseMinutes')
h_geo = pos(h, 'export function getDistanceInMeters')
h_date = pos(h, 'export function formatPassportDate')

selection_a = h[h_mood:h_ticket].strip()
serial = h[h_ticket:h_film].strip()
film = h[h_film:h_parse].strip()
parse_minutes = h[h_parse:h_geo].strip()
geo = h[h_geo:h_date].strip()
format_rest = h[h_date:].strip()

(ROOT / 'src/lib/journey-selection.ts').write_text("""import type { MoodId } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

""" + selection_a + '\n\n' + film + '\n')

(ROOT / 'src/lib/geo-utils.ts').write_text("""import type { GeoPoint } from './journey-engine';

""" + geo + '\n')

(ROOT / 'src/lib/detour-formatters.ts').write_text("""import type { LightContext, MoodId } from './journey-engine';

""" + serial + '\n\n' + parse_minutes + '\n\n' + format_rest + '\n')

old_visual_import = """import {
  DetourAccentStroke,
  DetourTicket,
  MoodGlyph,
  V45MoodIcon,
  V45SharePoster,
  V45Skyline,
  V45Ticket,
  V46CompleteArtwork,
  V46ReviewArtwork,
} from '../components/detour-visuals';
"""
new_visual_import = """import { MoodGlyph, V45MoodIcon, V45Skyline } from '../components/mood-visuals';
import { DetourAccentStroke, DetourTicket, V45Ticket } from '../components/ticket-visuals';
import {
  V45SharePoster,
  V46CompleteArtwork,
  V46ReviewArtwork,
} from '../components/journey-recap-visuals';
"""

old_helper_import = """import {
  applyFoodDestinationWeight,
  contextCode,
  formatClockTime,
  formatPassportDate,
  getDistanceInMeters,
  getFilmRollCapacity,
  getRouteDistance,
  moodHint,
  offsetPoint,
  parseMinutes,
  ticketSerial,
} from '../lib/home-helpers';
"""
new_helper_import = """import {
  applyFoodDestinationWeight,
  getFilmRollCapacity,
  moodHint,
} from '../lib/journey-selection';
import { getDistanceInMeters, getRouteDistance, offsetPoint } from '../lib/geo-utils';
import {
  contextCode,
  formatClockTime,
  formatPassportDate,
  parseMinutes,
  ticketSerial,
} from '../lib/detour-formatters';
"""

for target in [CONTROLLER, VIEW]:
    text = target.read_text()
    if old_visual_import not in text or old_helper_import not in text:
        raise RuntimeError(f'expected imports missing in {target}')
    text = text.replace(old_visual_import, new_visual_import)
    text = text.replace(old_helper_import, new_helper_import)
    target.write_text(text)

VISUALS.unlink()
HELPERS.unlink()

for required in [mood_file, ticket_file, recap_file, ROOT / 'src/lib/journey-selection.ts', ROOT / 'src/lib/geo-utils.ts', ROOT / 'src/lib/detour-formatters.ts']:
    if not required.exists() or required.stat().st_size < 200:
        raise RuntimeError(f'incomplete split: {required}')

print('visual/helper domain split complete')
