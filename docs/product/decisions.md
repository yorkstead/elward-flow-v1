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

- Browser intake accepts authenticated ZIP or PDF packages up to 100 MB and preserves both the original package and extracted files through the repository-owned FileStore.
- Packages above 4 MB bypass the hosted function body by using a five-minute, user- and organization-scoped presigned upload to the private FileStore staging namespace. Finalization rechecks ownership, byte size, SHA-256, file type, permission, and operational intake fields before immutable processing, then deletes the staged object.
- ZIP packages are the production-ready path for publishing when they contain a CSV panel takeoff; the system no longer fabricates panel marks when no takeoff data is present.
- Packages above 100 MB still require a future resumable multipart design and are not represented as supported by the current UI.

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

## 2026-08-22 — Hosted PostgreSQL environment

- Selected Neon Postgres for hosted production and preview data while retaining Docker PostgreSQL for deterministic local development.
- Production uses the Neon `main` branch. Vercel previews use a separate Neon `preview` branch so preview activity cannot alter production records.
- Kept the existing `pg` and Drizzle implementation. Vercel receives Neon's pooled, TLS-required connection URLs as sensitive environment variables; no provider-specific business logic was introduced.
- Repository-owned Drizzle migrations remain the schema source of truth. Production data and administrator provisioning are intentionally separate from fictional development seed data.

## 2026-08-22 — Hosted object storage

- Selected Cloudflare R2 for production because its S3-compatible API preserves the repository-owned FileStore and existing AWS SDK adapter without provider-specific business logic.
- Created the private `elward-flow-production` bucket with Standard storage and automatic placement. Public access remains disabled.
- Production credentials are limited to object read/write on that bucket; they do not grant bucket administration or access to future buckets.
- Retained MinIO for local development. Preview deployments must use separate storage and cannot share the production bucket.
- Verified upload, SHA-256 metadata, head, download integrity, and cleanup through the same path-style S3 client configuration used by the application.

## 2026-08-22 — Production dashboard selection and first-run state

- Removed the seeded `54120-1` release as the implicit dashboard default. Without an explicit job and release in the URL, the dashboard now selects the organization's most recently updated real release.
- An organization with no releases receives a guided first-run state linking to controlled release intake and the releases register; it does not display a fictional job error.
- Explicit links to missing jobs or releases continue to show a scoped not-found state rather than silently selecting different production work.
- Removed fictional blocker, activity, and panel-count fallbacks from the active-release command center. Empty operational sections now report only the absence of recorded data and never infer readiness from missing records.

## 2026-08-22 — Facility model

- Elward Systems has two operating sites: `Shop` and `Office`.
- `Shop` is the only production facility. Release publishing and downstream manufacturing execution must resolve a site explicitly marked for production and must never fall back to an arbitrary first site or an organization identifier.
- `Office` is a non-production site. Office users may perform authorized planning, administration, reporting, and other non-manufacturing work, but Office cannot be selected as the facility that executes production.
- Street addresses and any finer department or workstation assignments remain unverified and are not invented here.

## 2026-08-22 — Application launch and mobile viewport behavior

- The initial App Router loading state uses the authentic local Elward lockup and Elward Flow's dark industrial presentation. It communicates workspace preparation without implying that operational data is ready before authentication and server data resolve.
- Phone layouts constrain the document and application shell to the viewport so the primary page moves vertically only. Wide operational tables may retain contained horizontal scrolling inside their own labeled data region where collapsing columns would obscure quantities, revisions, or status.
- The mobile header reduces the global search control to its accessible icon action and hides the Flow suffix at narrow breakpoints while preserving the authentic Elward logo proportions.

## 2026-08-22 — Panel takeoff CSV compatibility

- Release intake resolves panel schedules by normalized header names instead of requiring one fixed column order.
- The supported JADE export maps `Count` to quantity, `ESC Mark Number` to mark, `Family` to description, and `Material` to color/finish while retaining the operator-selected material family.
- JADE's explicitly metric material thickness is converted to inches before storage because the current panel dimension record uses one explicit unit for thickness, width, and length. Stretch-out height and width remain inches as supplied by the JADE schedule.
- Title rows, blank rows, UTF-8 byte-order marks, and quoted comma-containing values are accepted. Invalid quantities, thicknesses, and duplicate marks remain blocking errors.
