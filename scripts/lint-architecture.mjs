import fs from 'node:fs';

const failures = [];

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function forbid(path, pattern, message) {
  if (pattern.test(read(path))) {
    failures.push(`${path}: ${message}`);
  }
}

for (const path of [
  '.github/workflows/apply-v45-ui.yml',
  'scripts/apply-v45-ui.py',
]) {
  if (fs.existsSync(path)) {
    failures.push(`${path}: obsolete V45 patch must stay deleted`);
  }
}

const packageVersion = JSON.parse(read('package.json')).version;
if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  failures.push('package.json: version must be a semantic x.y.z value');
}

forbid(
  'src/lib/build-info.ts',
  /DETOUR_BUILD_VERSION\s*=\s*['"]/,
  'build version must come from Expo config'
);
forbid(
  'src/lib/playtest-analytics.ts',
  /DETOUR_PLAYTEST_VERSION\s*=\s*['"]/,
  'playtest version must come from build-info'
);
forbid(
  'src/hooks/use-detour-home-controller.ts',
  /['"]recovery['"]/,
  'stale recovery stage must not return'
);

for (const path of [
  'src/lib/ai-engine.ts',
  'src/lib/scene-engine.ts',
  'src/lib/playtest-analytics.ts',
]) {
  forbid(
    path,
    /https:\/\/[^'"]+\.supabase\.co/,
    'public Supabase endpoints belong in app-config.ts'
  );
  forbid(
    path,
    /sb_publishable_/,
    'publishable key belongs in app-config.ts'
  );
}

if (failures.length > 0) {
  console.error('Architecture lint failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Architecture lint passed for Detour ${packageVersion}.`
);
