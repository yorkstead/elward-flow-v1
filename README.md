# Elward Flow

Elward Flow is Elward Systems' operational source of truth from release intake through shipment.

[![CI Quality Gate](https://github.com/4twentydev/elward-flow-v1/actions/workflows/ci.yml/badge.svg)](https://github.com/4twentydev/elward-flow-v1/actions/workflows/ci.yml)

The repository is an integrated operational MVP approaching internal-pilot readiness. It implements the connected chain from authenticated release-package intake through inventory, production, QC, palletizing, shipping, reporting, and administration. It is not yet represented as production-ready: operational acceptance, deployment configuration, backup/restore rehearsal, and production data migration remain environment-specific launch work.

## Implemented scope

- Authenticated, tenant-scoped ZIP/PDF release intake with immutable originals, SHA-256 verification, deterministic document classification, CSV panel-mark extraction, revision publishing, and controlled packet generation
- Active-release command center and shop-floor scanning with obsolete-revision blocking and append-only movement history
- Production dispatch, permitted next actions, first-off inspection, downtime recording, and printable contingency queues
- Transaction-led inventory demand, allocation, receiving, issuing, adjustment, and blind cycle counts
- QC inspections, holds, rework, scrap, and configurable RMK/RME remake sequences
- Pallet construction and limits, shipment load planning, dispatch, CSV exports, reports, RBAC administration, audit history, background jobs, and recovery utilities

## Stack

Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, repository-owned shadcn/ui components, PostgreSQL 16 with Drizzle, Auth.js, MinIO through FileStore, a PostgreSQL job worker, Vitest, and Playwright.

## Start locally

```powershell
Copy-Item .env.example .env.local
# Generate AUTH_SECRET with `openssl rand -base64 32` and put it in .env.local.
bun install
bun run setup
bun run dev
```

Run `bun run worker` in a second terminal. Seed prints a fictional administrator password once. Public registration does not exist.

See [local development](docs/operations/local-development.md) and [environment configuration](docs/operations/environment.md).

## Commands

- `bun run deps:up` / `bun run deps:down` — local PostgreSQL and MinIO
- `bun run db:generate` / `bun run db:migrate` — migrations
- `bun run seed` / `bun run admin:create -- email@example.test` — local identities
- `bun run worker` / `bun run worker:smoke` — background work
- `bun run backup` / `bun run restore:verify` — recovery utilities
- `bun run test:all` — formatting, lint, typecheck, dependency audit, unit and database integration tests, production build, and Playwright browser flows

## Verification and documentation

The hosted quality gate provisions PostgreSQL and MinIO, applies all migrations, verifies seed data, audits production dependencies, runs formatting, linting, strict type checking, 60 unit tests, database integration tests, a production build, and 13 Chromium workflow tests. Local execution requires the dependencies and generated credentials described in the setup guides.

- [System architecture](docs/architecture.md)
- [End-to-end release lifecycle](docs/guides/end-to-end-release-lifecycle.md)
- [Local development](docs/operations/local-development.md)
- [Environment configuration](docs/operations/environment.md)
- [Product decisions](docs/product/decisions.md)
- [Architecture decision records](docs/adr/)
- [Binding project constitution](AGENTS.md)
