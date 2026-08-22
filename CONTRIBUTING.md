# Contributing to Racecraft Analytics

Read [AGENTS.md](AGENTS.md) before changing the web app, ingestion worker, database migrations, or provider adapters. It defines the project layout, provider ownership, style, and required validation.

## Local checks

Run these before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For changes under `services/ingest/`, create a Python 3.11+ virtual environment and run `python -m pip install -e ".[test]"` followed by `pytest -q` in that directory.

## Pull requests

Keep each pull request focused. Explain provider/schema effects, add tests for changed analytics or adapters, and attach desktop and mobile screenshots for UI changes. Never commit credentials, database dumps, FastF1 cache, or generated telemetry artifacts.
