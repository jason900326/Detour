import fs from 'node:fs';

const path = 'src/app/index.tsx';
let source = fs.readFileSync(path, 'utf8');

const accentView = "                        <View style={[styles.v35MoodAccent, active && styles.v35MoodAccentActive]} />\n";
if (!source.includes(accentView)) {
  throw new Error('Mood accent view not found; aborting to avoid an unsafe edit.');
}
source = source.replace(accentView, '');

source = source.replace(
  "  v35MoodAccent: { position: 'absolute', right: 4, bottom: 8, width: 25, height: 6, borderRadius: 3, backgroundColor: '#BFBAB1', transform: [{ rotate: '-18deg' }] },\n",
  ''
);
source = source.replace(
  "  v35MoodAccentActive: { backgroundColor: SIGNAL },\n",
  ''
);

fs.writeFileSync(path, source);
console.log('Removed mood-card accent strokes.');
