# Elward Flow

Elward Flow is Elward Systems' operational source of truth from release intake through shipment. This repository currently contains the production foundation only; feature modules intentionally begin in later milestones.

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
- `bun run test:all` — formatting, lint, typecheck, tests, browser smoke, and build

Architecture decisions are under `docs/adr/`. Binding rules are in `AGENTS.md`.
