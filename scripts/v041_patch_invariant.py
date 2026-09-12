from pathlib import Path

path = Path('scripts/v041_ux_flow.py')
text = path.read_text()

old = '    (index, "留下這張"),\n'
new = '    (camera, "留下這張"),\n'
if old not in text:
    raise SystemExit('bad invariant not found')
text = text.replace(old, new, 1)

old_foundation = '\"\"\" + "\\n"\nwrite(\'PRODUCT_FOUNDATION.md\', foundation)'
new_foundation = '\"\"\"\nwrite(\'PRODUCT_FOUNDATION.md\', foundation)'
if old_foundation not in text:
    raise SystemExit('foundation trailing newline block not found')
text = text.replace(old_foundation, new_foundation, 1)

path.write_text(text)
