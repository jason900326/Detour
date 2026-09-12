from pathlib import Path

path = Path('src/app/index.tsx')
text = path.read_text()

active_camera = """\n  const activeCameraMission: Mission | null =\n    cameraSource === 'arrival'\n      ? plan?.arrivalMission ?? null\n      : cameraSource === 'free'\n        ? FREE_CAMERA_MISSION\n        : currentMission;\n"""
if active_camera not in text:
    raise SystemExit('activeCameraMission block missing')
text = text.replace(active_camera, '', 1)

old_dark = """  const darkStage =\n    stage === 'camera' ||\n    stage === 'developing' ||\n    stage === 'journey';\n"""
new_dark = """  const darkStage =\n    stage === 'developing' ||\n    stage === 'journey';\n"""
if old_dark not in text:
    raise SystemExit('darkStage camera branch missing')
text = text.replace(old_dark, new_dark, 1)

text = text.replace(
    ".filter((route) => route.length >= 2);",
    ".filter((route): route is GeoPoint[] => Array.isArray(route) && route.length >= 2);",
)
text = text.replace(
    "].filter((route) => route.length >= 2),",
    "].filter((route): route is GeoPoint[] => Array.isArray(route) && route.length >= 2),",
)

path.write_text(text)

foundation = Path('PRODUCT_FOUNDATION.md')
foundation.write_text(foundation.read_text().rstrip() + '\n')

if 'activeCameraMission' in text:
    raise SystemExit('activeCameraMission still present')
if "stage === 'camera'" in text:
    raise SystemExit('legacy camera stage still present')
