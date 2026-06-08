"""Export the FastAPI OpenAPI document to contracts/openapi.json.

The contract is the single source of truth (backend + frontend + cross-session),
so it is committed to the repo. Run after any router/schema change:

    cd backend && .venv/bin/python scripts/export_openapi.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Make `app` importable regardless of how this file is invoked.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402


def main() -> None:
    contracts_dir = Path(__file__).resolve().parents[2] / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    out = contracts_dir / "openapi.json"

    schema = app.openapi()
    out.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    ops = sum(1 for item in schema["paths"].values() for m in item
              if m in ("get", "post", "put", "patch", "delete"))
    print(f"Wrote {out}")
    print(f"  OpenAPI {schema['openapi']} · {len(schema['paths'])} paths · "
          f"{ops} operations · {len(schema['components']['schemas'])} schemas")


if __name__ == "__main__":
    main()
