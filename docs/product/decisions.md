# Product Decisions

Record changed product or operational assumptions here. Architectural decisions
belong in an ADR under `docs/adr/`.

## 2026-08-17 — Repository baseline

- The canonical repository and Vercel project name is `elward-flow-v1`.
- Bun is the repository package manager.
- At this baseline date, the repository contained platform scaffolding only and
  PostgreSQL, Drizzle, Auth.js, FileStore, the job worker, and test tooling were
  planned milestones. The later entries below record their implementation; this
  statement is retained as historical context, not current project status.

## 2026-08-19 — Prompt 02: Domain model, permissions matrix, and schema unification

- Unified the PostgreSQL Drizzle schema into canonical `db/schema.ts` and eliminated duplicate schema files.
- Implemented the 21 standard role templates and discrete permissions matrix (`view`, `create`, `edit`, `approve`, `override`, `export`, `configure`, `administer`).
- Production job numbers strictly enforce 5-digit validation (`^\d{5}$`).
- Releases use the compound business key `organization + job_id + release_number`.
- Implemented staged configuration registry where proposed changes require explicit approval before activating.
- Elevated overrides mandate an explanation (minimum 5 characters) and write immutable records to `audit_events`.

## 2026-08-19 — Prompts 03–11: Integrated operating-chain MVP

- Implemented the application shell and active-release command center across the connected Customer → Project → Job → Release → Revision → Panel Mark → Work Step → QC → Pallet → Shipment chain.
- Added release intake and revision control, controlled documents and packets, shop-floor scanning and movement history, production planning and first-off controls, inventory and purchasing, QC and remakes, palletizing and shipping, reports and exports, RBAC administration, background jobs, and backup/restore utilities.
- Kept accounting, payroll, tax, and banking outside the system boundary.
- Classified the result as an integrated operational MVP. Feature presence does not by itself establish launch readiness; hosted verification, environment configuration, operational acceptance, recovery rehearsal, and production data migration remain separate gates.

## 2026-08-22 — Authenticated release-package intake boundary

- Browser intake accepts authenticated ZIP or PDF packages up to 10 MB and preserves both the original package and extracted files through the repository-owned FileStore.
- ZIP packages are the production-ready path for publishing when they contain a CSV panel takeoff; the system no longer fabricates panel marks when no takeoff data is present.
- Larger release packages require a future resumable direct-to-object-storage design and are not represented as supported by the current UI.

## 2026-08-22 — Stabilization and automated acceptance boundary

- Updated the framework and production dependency graph until the production audit reported no known vulnerabilities.
- Expanded the hosted quality gate to provision PostgreSQL and MinIO and run formatting, linting, strict type checking, migrations, seed verification, 60 unit tests, database integration tests, a production build, and 13 Chromium workflow tests.
- Replaced committed development authentication defaults and browser-test password fallbacks with generated local credentials and ephemeral masked CI credentials.
- Project status is "integrated MVP approaching internal pilot," not production-ready. A green repository quality gate does not replace deployment verification, production configuration review, backup/restore rehearsal, performance validation, or user acceptance in the target operating environment.

## 2026-08-22 — Elward Flow brand interpretation

- Adopted the authentic public-site navy, blue, orange, cool gray, Open Sans body typography, and DIN-like uppercase heading treatment documented in `docs/brand/elward-flow-brand-audit.md`.
- Preserved the application as a dark-first industrial operating product rather than reproducing the public marketing layout or its image-led presentation.
- Reserved corporate blue for primary actions and orange for branded emphasis and focus; operational pass, hold, warning, scrap, and obsolete-revision states retain their independent semantic colors, labels, and icons.
- Stored a byte-identical copy of the current public corporate PNG locally. Because no approved standalone reversed corporate logo or vector master was verified, dark-shell placements use the authentic full-color logo on a light plate and do not invent a white corporate variant.
- Selected open-source Roboto Condensed as an application-specific DIN-like heading alternative because reuse rights for the website's DINWeb files were not verified.
