DETOUR v0.7 — REAL CANDIDATES / ENGINE LAB

Affected files:
  src/app/index.tsx
  src/app/_layout.tsx
  src/lib/detour-engine.ts

Install:
1. Extract this ZIP into C:\Users\jason\detour
2. Allow Windows to replace src\app\index.tsx and src\app\_layout.tsx
3. The new src\lib\detour-engine.ts file will be created automatically.
4. No new npm package is required for v0.7.
5. Save/reload Expo. If needed, run: npx expo start -c

Testing:
1. Long-press DETOUR on Home to enable INDOOR TEST.
2. Pick a time and mood.
3. Tap 開始繞路.
4. DETOUR will get your real current location and query nearby real OpenStreetMap POIs.
5. ENGINE LAB shows ranked candidates and the three selected checkpoints.
6. Tap 用這 3 個點室內測試 to run the existing simulator.

Important:
This build validates candidate selection only. It does NOT yet validate walking routes, entrances, closures, opening hours, or live safety conditions. Real-world navigation stays locked; use Indoor Test for now.
