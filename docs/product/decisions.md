# Product Decisions

Record changed product or operational assumptions here. Architectural decisions
belong in an ADR under `docs/architecture/`.

## 2026-08-17 — Repository baseline

- The canonical repository and Vercel project name is `elward-flow-v1`.
- Bun is the repository package manager.
- The initial repository is a platform baseline only. PostgreSQL, Drizzle,
  Auth.js, FileStore, the job worker, and test tooling remain future milestones.

## 2026-08-17 — Foundation authentication

- Auth.js Credentials is used for local password sign-in with encrypted JWT sessions because Auth.js does not support Credentials with database sessions.
- Users, organization/site membership, authorization, password hashes, and disabled state remain PostgreSQL-backed.
- The product owner selected this supported design over an unsupported custom database-session bridge.
