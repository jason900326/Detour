const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'src/app/index.tsx');
const sourceText = fs.readFileSync(indexPath, 'utf8');
const sf = ts.createSourceFile(indexPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const homeFn = sf.statements.find((stmt) =>
  ts.isFunctionDeclaration(stmt) &&
  stmt.name?.text === 'HomeScreen' &&
  stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
);

if (!homeFn || !homeFn.body) {
  throw new Error('HomeScreen default function not found');
}

const bodyStatements = [...homeFn.body.statements];
const finalStatement = bodyStatements.at(-1);
if (!finalStatement || !ts.isReturnStatement(finalStatement) || !finalStatement.expression) {
  throw new Error('HomeScreen must end with a return statement');
}

const importsText = sourceText.slice(0, homeFn.getFullStart()).trimEnd();
const logicStart = homeFn.body.getStart(sf) + 1;
const logicEnd = finalStatement.getFullStart();
const logicText = sourceText.slice(logicStart, logicEnd).trimEnd();
const viewExpression = finalStatement.expression.getFullText(sf).trim();

const bindings = [];
const seen = new Set();
function addBinding(name) {
  if (!name || seen.has(name)) return;
  seen.add(name);
  bindings.push(name);
}
function collectBindingName(name) {
  if (ts.isIdentifier(name)) {
    addBinding(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element)) continue;
      if (ts.isBindingElement(element)) collectBindingName(element.name);
    }
  }
}

for (const stmt of bodyStatements.slice(0, -1)) {
  if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) {
      collectBindingName(decl.name);
    }
  } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
    addBinding(stmt.name.text);
  } else if (ts.isClassDeclaration(stmt) && stmt.name) {
    addBinding(stmt.name.text);
  }
}

if (bindings.length < 40) {
  throw new Error(`unexpectedly few controller bindings: ${bindings.length}`);
}

const bindingLines = bindings.map((name) => `    ${name},`).join('\n');
const destructureLines = bindings.map((name) => `    ${name},`).join('\n');

const hookDir = path.join(root, 'src/hooks');
const componentDir = path.join(root, 'src/components');
fs.mkdirSync(hookDir, { recursive: true });
fs.mkdirSync(componentDir, { recursive: true });

const hookText = `${importsText}\n\nexport function useDetourHomeController() {\n${logicText}\n\n  return {\n${bindingLines}\n  };\n}\n`;
fs.writeFileSync(path.join(hookDir, 'use-detour-home-controller.ts'), hookText);

const viewText = `${importsText}\nimport type { useDetourHomeController } from '../hooks/use-detour-home-controller';\n\nexport function DetourHomeView({\n  controller,\n}: {\n  controller: ReturnType<typeof useDetourHomeController>;\n}) {\n  const {\n${destructureLines}\n  } = controller;\n\n  return ${viewExpression};\n}\n`;
fs.writeFileSync(path.join(componentDir, 'detour-home-view.tsx'), viewText);

const routeText = `import { DetourHomeView } from '../components/detour-home-view';\nimport { useDetourHomeController } from '../hooks/use-detour-home-controller';\n\nexport default function HomeScreen() {\n  const controller = useDetourHomeController();\n  return <DetourHomeView controller={controller} />;\n}\n`;
fs.writeFileSync(indexPath, routeText);

const routeSize = fs.statSync(indexPath).size;
const hookSize = fs.statSync(path.join(hookDir, 'use-detour-home-controller.ts')).size;
const viewSize = fs.statSync(path.join(componentDir, 'detour-home-view.tsx')).size;

if (routeSize > 1000) throw new Error(`route file still too large: ${routeSize}`);
if (hookSize < 20000 || viewSize < 20000) throw new Error('controller/view extraction looks incomplete');

console.log(`bindings: ${bindings.length}`);
console.log(`index.tsx: ${routeSize} bytes`);
console.log(`controller: ${hookSize} bytes`);
console.log(`view: ${viewSize} bytes`);
