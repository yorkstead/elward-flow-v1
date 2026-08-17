# Product Decisions

Record changed product or operational assumptions here. Architectural decisions
belong in an ADR under `docs/architecture/`.

## 2026-08-17 — Repository baseline

- The canonical repository and Vercel project name is `elward-flow-v1`.
- Bun is the repository package manager.
- The initial repository is a platform baseline only. PostgreSQL, Drizzle,
  Auth.js, FileStore, the job worker, and test tooling remain future milestones.
