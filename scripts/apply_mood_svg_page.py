from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'src/app/index.tsx'
BUILD = ROOT / 'src/lib/build-info.ts'
ASSET_DIR = ROOT / 'assets/mood'
TYPE_DIR = ROOT / 'src/types'
ASSET_DIR.mkdir(parents=True, exist_ok=True)
TYPE_DIR.mkdir(parents=True, exist_ok=True)

SVG_FILES = {
    'wander.svg': '''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14 49C14 40.5 25.5 41 27.5 33.5C29.7 25.3 24.7 20.5 32.5 16.5C38.3 13.5 44.4 16.7 49.5 12.5" stroke="#11110F" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="14" cy="49" r="4.5" fill="#11110F"/>
<circle cx="50" cy="12" r="5.5" fill="#FF5A36"/>
<path d="M39 13.5C44 13 46.8 15.2 48.8 18.8" stroke="#11110F" stroke-width="3.5" stroke-linecap="round"/>
</svg>''',
    'food.svg': '''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="32" cy="32" r="15.5" stroke="#11110F" stroke-width="4.5"/>
<path d="M8.5 13V51" stroke="#11110F" stroke-width="4" stroke-linecap="round"/>
<path d="M4.5 13V24C4.5 28 12.5 28 12.5 24V13" stroke="#11110F" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M55 13C49.2 13 46.5 18.5 46.5 24.5C46.5 30 49.2 33 55 33V51" stroke="#11110F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M28.5 31.5C30.7 28.5 34.2 27.2 38 28.2" stroke="#FF5A36" stroke-width="4.5" stroke-linecap="round"/>
</svg>''',
    'quiet.svg': '''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M10 37C14.5 31.5 19 31.5 23.5 37C28 42.5 32.5 42.5 37 37C41.5 31.5 46 31.5 50.5 37" stroke="#11110F" stroke-width="4.5" stroke-linecap="round"/>
<path d="M14 25.5C17.5 21.5 21 21.5 24.5 25.5C28 29.5 31.5 29.5 35 25.5C38.5 21.5 42 21.5 45.5 25.5" stroke="#11110F" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
<circle cx="50" cy="20" r="5.5" fill="#FF5A36"/>
</svg>''',
    'weird.svg': '''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13 14L26 10L38 14L51 10V48L38 52L26 48L13 52V14Z" stroke="#11110F" stroke-width="4" stroke-linejoin="round"/>
<path d="M26 10V48M38 14V52" stroke="#11110F" stroke-width="3.2" stroke-linecap="round" opacity="0.7"/>
<path d="M35 28C35 24.1 38.1 21 42 21C45.9 21 49 24.1 49 28C49 33.3 42 40 42 40C42 40 35 33.3 35 28Z" fill="#FF5A36"/>
<circle cx="42" cy="28" r="2.5" fill="#F1EFE7"/>
</svg>''',
    'color.svg': '''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="10" y="16" width="28" height="34" rx="8" transform="rotate(-10 10 16)" stroke="#11110F" stroke-width="4"/>
<rect x="24" y="10" width="28" height="34" rx="8" transform="rotate(8 24 10)" fill="#FF5A36"/>
<rect x="27.5" y="13.5" width="21" height="27" rx="5" transform="rotate(8 27.5 13.5)" fill="#F1EFE7"/>
<circle cx="39" cy="27" r="5.5" fill="#11110F"/>
</svg>''',
    'surprise.svg': '''<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="12" y="12" width="40" height="40" rx="11" transform="rotate(-6 12 12)" stroke="#11110F" stroke-width="4.5"/>
<circle cx="25" cy="24" r="4" fill="#11110F"/>
<circle cx="40" cy="37" r="4" fill="#11110F"/>
<circle cx="33" cy="31" r="5" fill="#FF5A36"/>
<path d="M49 8V16M45 12H53" stroke="#FF5A36" stroke-width="3.5" stroke-linecap="round"/>
</svg>''',
}

for name, svg in SVG_FILES.items():
    (ASSET_DIR / name).write_text(svg.strip() + '\n', encoding='utf-8')

(ROOT / 'metro.config.js').write_text("""const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
""", encoding='utf-8')

(TYPE_DIR / 'svg.d.ts').write_text("""declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: FC<SvgProps>;
  export default content;
}
""", encoding='utf-8')

text = INDEX.read_text(encoding='utf-8')

import_anchor = "import { captureRef } from 'react-native-view-shot';\n"
svg_imports = """import MoodWanderIcon from '../../assets/mood/wander.svg';
import MoodFoodIcon from '../../assets/mood/food.svg';
import MoodQuietIcon from '../../assets/mood/quiet.svg';
import MoodWeirdIcon from '../../assets/mood/weird.svg';
import MoodColorIcon from '../../assets/mood/color.svg';
import MoodSurpriseIcon from '../../assets/mood/surprise.svg';
"""
if svg_imports not in text:
    if import_anchor not in text:
        raise SystemExit('Could not find SVG import anchor')
    text = text.replace(import_anchor, import_anchor + svg_imports, 1)

start = text.index('type MoodGlyphProps = {')
end = text.index('function moodHint', start)
replacement = """type MoodIconProps = {
  moodId: MoodId;
};

function MoodIcon({ moodId }: MoodIconProps) {
  const commonProps = { width: 76, height: 76 };

  if (moodId === 'wander') return <MoodWanderIcon {...commonProps} />;
  if (moodId === 'food') return <MoodFoodIcon {...commonProps} />;
  if (moodId === 'quiet') return <MoodQuietIcon {...commonProps} />;
  if (moodId === 'weird') return <MoodWeirdIcon {...commonProps} />;
  if (moodId === 'color') return <MoodColorIcon {...commonProps} />;
  return <MoodSurpriseIcon {...commonProps} />;
}

"""
text = text[:start] + replacement + text[end:]

old_usage = '<MoodGlyph moodId={item.id} active={active} />'
new_usage = '<MoodIcon moodId={item.id} />'
if old_usage not in text:
    raise SystemExit('Could not find MoodGlyph usage')
text = text.replace(old_usage, new_usage, 1)

# SVG artwork stays identical when selected; only the card communicates state.
text = text.replace(
    "v35MoodCardActive: { borderWidth: 2, borderColor: SIGNAL, backgroundColor: '#F8EFE6' },",
    "v35MoodCardActive: { borderWidth: 2.5, borderColor: SIGNAL, backgroundColor: '#FFF4EE' },",
)

INDEX.write_text(text, encoding='utf-8')

build = BUILD.read_text(encoding='utf-8')
build, count = re.subn(
    r"// v0\.45:.*?\nexport const DETOUR_BUILD_VERSION = '0\.45\.0';",
    "// v0.45.1: Mood page now uses six standalone SVG assets with stable selected-state rendering.\nexport const DETOUR_BUILD_VERSION = '0.45.1';",
    build,
    count=1,
)
if count != 1:
    raise SystemExit('Could not update build version')
BUILD.write_text(build, encoding='utf-8')
