import json
from pathlib import Path

class FixtureMissingError(RuntimeError):
    def __init__(self, path: Path) -> None:
        super().__init__(
            f"USE_FIXTURES=true but no fixture at {path}. "
            "Run once with USE_FIXTURES=false against the real API to record it."
        )
        self.path = path

def load(fixtures_dir: Path, relative_path: str) -> dict:
    path = fixtures_dir / relative_path
    if not path.exists():
        raise FixtureMissingError(path)
    return json.loads(path.read_text(encoding="utf-8"))

def save(fixtures_dir: Path, relative_path: str, data: dict) -> None:
    path = fixtures_dir / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
