# Repository Guidelines

## Project Structure & Module Organization

The web application uses Next.js App Router. Put routes in `src/app/`, shared React components in `src/components/`, data access and types in `src/lib/`, and static assets in `public/`. API routes belong under `src/app/api/`.

The ingestion worker lives in `services/ingest/racecraft_ingest/`. Provider adapters handle Jolpica, OpenF1, FastF1, and RSS; deterministic formulas belong in `analytics.py`. Python tests are in `services/ingest/tests/`. PostgreSQL migrations are in `database/migrations/` and run alphabetically. Docker and Nginx configuration live in `docker-compose.yml` and `docker/nginx/`.

## Architecture & Data Boundaries

- Jolpica owns race results, championship standings, calendar, drivers, and constructors.
- OpenF1 supplies session context such as laps, weather, stints, race control, and positions after publication.
- FastF1 is the worker’s primary analysis engine. It writes validated JSON/Parquet artifacts to shared telemetry storage.
- RSS supplies attributed news items; do not call providers directly from browser components.

## Build, Test, and Development Commands

- `npm ci` installs locked dependencies reproducibly.
- `npm run dev` starts Next.js at `http://localhost:3000`.
- `npm run typecheck` runs strict TypeScript checks.
- `npm run lint` runs ESLint.
- `npm test` runs Vitest once.
- `npm run build` validates the production bundle.
- From `services/ingest/`, run `python -m pip install -e ".[test]"`, then `pytest` or `racecraft-ingest --once`.
- For an 8GB Debian host, build one image at a time with `COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file .env.docker build`, then start with `docker compose --env-file .env.docker up -d --no-build`.

## Coding Style & Naming Conventions

Use two-space indentation in TypeScript, TSX, CSS, and JSON; use four spaces in Python. Use `PascalCase` for React components, `camelCase` for TypeScript functions, `snake_case` for Python, and lowercase route directories. Prefer named exports and keep provider-specific transformations inside adapters.

## Testing Guidelines

Name TypeScript tests `*.test.ts` and Python tests `test_*.py`. Add focused cases for missing data, Sprint sessions, wet races, safety cars, DNS, DNF, and DSQ. No coverage threshold is enforced, but changed analytics and provider behavior must have regression tests.

## Commits, Pull Requests & Security

History mixes `first commit` with Conventional Commit style. Use concise Conventional Commit messages going forward, such as `feat: add stint comparison`. Pull requests should explain UI, provider, or schema effects, link issues, list validation commands, and include responsive screenshots for UI changes. Never commit `.env` files, credentials, FastF1 cache, telemetry, or generated Parquet files. Keep PostgreSQL port `5432` private and review `RISK_ACCEPTANCE.md` before changing commercial data usage.
