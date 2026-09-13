from pathlib import Path

path = Path('PRODUCT_FOUNDATION.md')
path.write_text(path.read_text().rstrip() + '\n')
