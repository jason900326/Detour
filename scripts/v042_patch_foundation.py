from pathlib import Path

path = Path('scripts/v042_ticket_ritual.py')
text = path.read_text()
old = "FOUNDATION.write_text(foundation + '\\n')"
new = "FOUNDATION.write_text(foundation.rstrip() + '\\n')"
if old not in text:
    raise SystemExit('foundation write marker missing')
path.write_text(text.replace(old, new, 1))
