# MIRROR Analytics

Offline analytics toolkit for MIRROR chess PWA backup data. Reads exported MIRROR
backup JSON files and produces player summaries, imported-game coverage,
puzzle performance reports, analysis quality metrics, and training recommendations.

## Quickstart

```bash
cd python
pip install -e ".[dev]"

# Run against the sample data
python -m mirror_analytics.cli \
  --backup ../samples/anonymized-mirror-backup.sample.json \
  --out ../analytics_output

# Run tests
pytest
```

## What it does

| Module | Purpose |
|--------|---------|
| `loaders.py` | Parse and validate MIRROR backup JSON |
| `models.py` | Python dataclasses mirroring the MIRROR schema |
| `features.py` | Extract player, imported-game, puzzle, analysis, and StyleVector features |
| `metrics.py` | Compute aggregated analytics metrics |
| `reports.py` | Generate CSV exports and Markdown insight reports |
| `cli.py` | Command-line interface orchestrating the full pipeline |

## Output files

| File | Contents |
|------|----------|
| `player_summary.csv` | Per-player game counts, imported-game counts, solve rates, streaks |
| `puzzle_performance.csv` | Per-motif solve rates and weakness detection |
| `story_progress.csv` | Chapter completion and attempt counts |
| `analysis_quality.csv` | CP-loss, accuracy, blunder counts per analysis |
| `mirror_insights.md` | Human-readable training recommendations |
| `mirror_features.json` | Machine-readable feature vectors for downstream ML |

## Zero external dependencies

The package uses only the Python standard library (`json`, `csv`, `dataclasses`,
`argparse`, `pathlib`, `statistics`, `datetime`). No NumPy, Pandas, or other
third-party packages required.
