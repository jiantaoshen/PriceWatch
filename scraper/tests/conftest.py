"""Allow pytest to import the standalone scraper package from the project root."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
