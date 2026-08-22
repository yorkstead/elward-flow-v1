# Product Decisions

Record changed product or operational assumptions here. Architectural decisions
belong in an ADR under `docs/architecture/`.

## 2026-08-17 — Repository baseline

- The canonical repository and Vercel project name is `elward-flow-v1`.
- Bun is the repository package manager.
- The initial repository is a platform baseline only. PostgreSQL, Drizzle,
  Auth.js, FileStore, the job worker, and test tooling remain future milestones.

## 2026-08-19 — Prompt 02: Domain model, permissions matrix, and schema unification

- Unified the PostgreSQL Drizzle schema into canonical `db/schema.ts` and eliminated duplicate schema files.
- Implemented the 21 standard role templates and discrete permissions matrix (`view`, `create`, `edit`, `approve`, `override`, `export`, `configure`, `administer`).
- Production job numbers strictly enforce 5-digit validation (`^\d{5}$`).
- Releases use the compound business key `organization + job_id + release_number`.
- Implemented staged configuration registry where proposed changes require explicit approval before activating.
- Elevated overrides mandate an explanation (minimum 5 characters) and write immutable records to `audit_events`.

## 2026-08-22 — Authenticated release-package intake boundary

- Browser intake accepts authenticated ZIP or PDF packages up to 10 MB and preserves both the original package and extracted files through the repository-owned FileStore.
- ZIP packages are the production-ready path for publishing when they contain a CSV panel takeoff; the system no longer fabricates panel marks when no takeoff data is present.
- Larger release packages require a future resumable direct-to-object-storage design and are not represented as supported by the current UI.
