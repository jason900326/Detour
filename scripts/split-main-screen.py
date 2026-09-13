from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'src/app/index.tsx'
text = INDEX.read_text()

def marker(value: str) -> int:
    pos = text.find(value)
    if pos < 0:
        raise RuntimeError(f'missing marker: {value}')
    return pos

theme_start = marker('const INK =')
mood_start = marker('type MoodGlyphProps')
helper_start = marker('function moodHint')
ticket_start = marker('const DETOUR_TICKET_BARS')
home_start = marker('export default function HomeScreen')
styles_start = marker('const styles = StyleSheet.create({')

if not (theme_start < mood_start < helper_start < ticket_start < home_start < styles_start):
    raise RuntimeError('unexpected index.tsx section order')

mood_block = text[mood_start:helper_start].strip()
helper_block = text[helper_start:ticket_start].strip()
visual_block = text[ticket_start:home_start].strip()
styles_block = text[styles_start:].strip()

# 1) Shared theme tokens used by both the orchestration screen and extracted styles/components.
theme_path = ROOT / 'src/theme/detour-theme.ts'
theme_path.parent.mkdir(parents=True, exist_ok=True)
theme_path.write_text("""export const INK = '#11110F';
export const BONE = '#F1EFE7';
export const MUTED = '#77736B';
export const LINE = '#C9C5B8';
export const SIGNAL = '#FF5A36';
export const SOFT = '#E5E1D6';

export const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
""")

# 2) Pure helpers / formatters / geometry helpers.
helper_block = re.sub(r'(?m)^function ', 'export function ', helper_block)
helpers_path = ROOT / 'src/lib/home-helpers.ts'
helpers_path.write_text("""import type { GeoPoint, LightContext, MoodId } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

""" + helper_block + '\n')

# 3) Ticket, mood, share and recap presentation components.
mood_block = re.sub(r'(?m)^function ', 'export function ', mood_block)
visual_block = re.sub(r'(?m)^function ', 'export function ', visual_block)
visual_block = re.sub(r'(?m)^type DetourTicketProps', 'export type DetourTicketProps', visual_block)
visuals_path = ROOT / 'src/components/detour-visuals.tsx'
visuals_path.parent.mkdir(parents=True, exist_ok=True)
visuals_path.write_text("""import { useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';

import MoodWanderIcon from '../../assets/mood/wander.svg';
import MoodFoodIcon from '../../assets/mood/food.svg';
import MoodQuietIcon from '../../assets/mood/quiet.svg';
import MoodWeirdIcon from '../../assets/mood/weird.svg';
import MoodColorIcon from '../../assets/mood/color.svg';
import MoodSurpriseIcon from '../../assets/mood/surprise.svg';

import type { MoodId } from '../lib/journey-engine';
import type { PassportEntry, SessionPhoto } from '../lib/app-model';
import { formatPassportDate } from '../lib/home-helpers';
import { styles } from '../styles/home-styles';
import { SIGNAL } from '../theme/detour-theme';

let ticketArtworkDecoded = false;

""" + mood_block + '\n\n' + visual_block + '\n')

# 4) The enormous StyleSheet moves wholesale so index.tsx becomes orchestration-first.
styles_block = styles_block.replace('const styles = StyleSheet.create({', 'export const styles = StyleSheet.create({', 1)
styles_path = ROOT / 'src/styles/home-styles.ts'
styles_path.parent.mkdir(parents=True, exist_ok=True)
styles_path.write_text("""import { Platform, StyleSheet } from 'react-native';
import { ABSOLUTE_FILL, BONE, INK, LINE, MUTED, SIGNAL, SOFT } from '../theme/detour-theme';

""" + styles_block + '\n')

# 5) Rebuild index.tsx as imports + HomeScreen orchestration only.
new_imports = """import { styles } from '../styles/home-styles';
import { BONE, INK, LINE, MUTED, SIGNAL, SOFT } from '../theme/detour-theme';
import {
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
import {
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

head = text[:theme_start]
body = text[home_start:styles_start].rstrip() + '\n'
new_text = head + new_imports + body

# Remove imports that now belong exclusively to detour-visuals/home-styles.
new_text = new_text.replace("import Svg, { Path as SvgPath } from 'react-native-svg';\n", '')
for icon in ['wander', 'food', 'quiet', 'weird', 'color', 'surprise']:
    class_name = {
        'wander': 'MoodWanderIcon',
        'food': 'MoodFoodIcon',
        'quiet': 'MoodQuietIcon',
        'weird': 'MoodWeirdIcon',
        'color': 'MoodColorIcon',
        'surprise': 'MoodSurpriseIcon',
    }[icon]
    new_text = new_text.replace(f"import {class_name} from '../../assets/mood/{icon}.svg';\n", '')
new_text = new_text.replace('  StyleSheet,\n', '')

INDEX.write_text(new_text)

# Basic guardrails before TypeScript gets a say.
for required in [
    ROOT / 'src/theme/detour-theme.ts',
    ROOT / 'src/lib/home-helpers.ts',
    ROOT / 'src/components/detour-visuals.tsx',
    ROOT / 'src/styles/home-styles.ts',
]:
    if not required.exists() or required.stat().st_size < 100:
        raise RuntimeError(f'failed to create {required}')

if 'const styles = StyleSheet.create({' in INDEX.read_text():
    raise RuntimeError('styles were not removed from index.tsx')
if INDEX.stat().st_size >= 200_000:
    raise RuntimeError(f'index.tsx still unexpectedly large: {INDEX.stat().st_size} bytes')

print(f'index.tsx: {INDEX.stat().st_size} bytes')
print(f'home-styles.ts: {styles_path.stat().st_size} bytes')
print(f'detour-visuals.tsx: {visuals_path.stat().st_size} bytes')
print(f'home-helpers.ts: {helpers_path.stat().st_size} bytes')
