const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src/styles/home-styles.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const sf = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

let objectLiteral = null;
for (const stmt of sf.statements) {
  if (!ts.isVariableStatement(stmt)) continue;
  for (const decl of stmt.declarationList.declarations) {
    if (!ts.isIdentifier(decl.name) || decl.name.text !== 'styles') continue;
    if (!decl.initializer || !ts.isCallExpression(decl.initializer)) continue;
    const arg = decl.initializer.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) objectLiteral = arg;
  }
}

if (!objectLiteral) throw new Error('StyleSheet.create object not found');

const categories = {
  base: [],
  setup: [],
  journey: [],
  collection: [],
  legacy: [],
  ticketRecap: [],
};

function nameOf(prop) {
  if (!prop.name) return '';
  if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)) {
    return prop.name.text;
  }
  return prop.name.getText(sf);
}

function categoryFor(name) {
  if (/^v4[4-9]/i.test(name)) return 'ticketRecap';
  if (/^v(?:3[0-9]|4[0-3])/i.test(name)) return 'legacy';

  const key = name.toLowerCase();
  if (/(passport|postcard|playtest|collection|detail|finish|complete|poster|share)/.test(key)) {
    return 'collection';
  }
  if (/(journey|navigation|nav|beat|quest|mission|arrival|route|camera|reroute|scene|develop|map|trace|checkpoint|direction|distance)/.test(key)) {
    return 'journey';
  }
  if (/(home|time|mood|onboard|setting|color|prepar|ready|slider|start|landing|hero)/.test(key)) {
    return 'setup';
  }
  return 'base';
}

for (const prop of objectLiteral.properties) {
  const name = nameOf(prop);
  const category = categoryFor(name);
  categories[category].push(prop.getFullText(sf).trim());
}

const outDir = path.join(root, 'src/styles/home');
fs.mkdirSync(outDir, { recursive: true });
const commonImports = `import { Platform, StyleSheet } from 'react-native';\nimport { ABSOLUTE_FILL, BONE, INK, LINE, MUTED, SIGNAL, SOFT } from '../../theme/detour-theme';\n\n`;

const names = {
  base: 'baseStyles',
  setup: 'setupStyles',
  journey: 'journeyStyles',
  collection: 'collectionStyles',
  legacy: 'legacyStyles',
  ticketRecap: 'ticketRecapStyles',
};

for (const [category, props] of Object.entries(categories)) {
  if (props.length === 0) throw new Error(`empty style category: ${category}`);
  const body = props.map((p) => `  ${p}`).join(',\n');
  fs.writeFileSync(
    path.join(outDir, `${category.replace(/([A-Z])/g, '-$1').toLowerCase()}-styles.ts`),
    `${commonImports}export const ${names[category]} = StyleSheet.create({\n${body}\n});\n`
  );
}

const aggregator = `import { baseStyles } from './home/base-styles';\nimport { setupStyles } from './home/setup-styles';\nimport { journeyStyles } from './home/journey-styles';\nimport { collectionStyles } from './home/collection-styles';\nimport { legacyStyles } from './home/legacy-styles';\nimport { ticketRecapStyles } from './home/ticket-recap-styles';\n\nexport const styles = {\n  ...baseStyles,\n  ...setupStyles,\n  ...journeyStyles,\n  ...collectionStyles,\n  ...legacyStyles,\n  ...ticketRecapStyles,\n};\n`;
fs.writeFileSync(sourcePath, aggregator);

const originalCount = objectLiteral.properties.length;
const splitCount = Object.values(categories).reduce((sum, props) => sum + props.length, 0);
if (originalCount !== splitCount) throw new Error(`style count mismatch: ${originalCount} vs ${splitCount}`);
if (fs.statSync(sourcePath).size > 2000) throw new Error('style aggregator unexpectedly large');

console.log(`split ${splitCount} style entries`);
for (const [category, props] of Object.entries(categories)) {
  console.log(`${category}: ${props.length}`);
}
