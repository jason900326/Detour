from pathlib import Path

path = Path('scripts/v041_ux_flow.py')
text = path.read_text()
old = '    (index, "留下這張"),\n'
new = '    (camera, "留下這張"),\n'
if old not in text:
    raise SystemExit('bad invariant not found')
path.write_text(text.replace(old, new, 1))
