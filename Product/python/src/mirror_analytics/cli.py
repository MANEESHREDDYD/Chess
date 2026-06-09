"""Command-line entry point for MIRROR analytics."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .loaders import BackupValidationError, load_backup
from .reports import generate_reports


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mirror-analytics",
        description="Generate analytics reports from an exported MIRROR backup JSON file.",
    )
    parser.add_argument("--backup", required=True, help="Path to MIRROR backup JSON")
    parser.add_argument("--out", required=True, help="Directory for generated analytics outputs")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        backup = load_backup(args.backup)
        outputs = generate_reports(backup, args.out)
    except (BackupValidationError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"mirror-analytics: {exc}", file=sys.stderr)
        return 2

    for name, path in outputs.items():
        print(f"{name}: {Path(path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
