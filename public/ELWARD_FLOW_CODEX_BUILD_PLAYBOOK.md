# Elward Flow — Codex Build Playbook

Prepared for 4TWENTY.DEV

## The Product

Elward Flow is the purpose-built operating system for Elward Systems. It connects the real manufacturing chain:

**Customer → Project → Job → Release → Revision → Panel Mark → Work Step → QC → Pallet → Shipment**

It replaces scattered production boards, release folders, spreadsheets, paper status updates, and tribal knowledge without attempting to rebuild accounting, payroll, tax, or banking.

The app must win on five things:

1. **Immediate clarity:** every person sees the work, documents, exceptions, and decisions relevant to their role.
2. **Shop-floor speed:** common actions take two or three taps after a scan and never require operators to interpret workflow logic.
3. **Revision safety:** the current revision is unmistakable; superseded documents cannot silently remain in use.
4. **Traceability:** every consequential action retains who, what, when, where, why, quantity, condition, and source revision.
5. **Elward ownership:** source, database, files, accounts, backups, exports, configuration, deployment instructions, and operating documentation belong to Elward.

## Non-Negotiable Product Rules

- A job uses a five-digit Elward job number.
- A release is identified by **Job + Release**. Never treat release number alone as globally unique.
- A release may have multiple revisions, panels/marks, operations, pallets, and shipments.
- Every production view displays the job, release, current revision, mark, material, color, quantity, and status where applicable.
- Barcodes and QR codes are stable identifiers, not the place where business logic lives.
- Scan actions must be idempotent. Double scans must not double-issue material or double-complete work.
- Every movement records user, timestamp, workstation/device, source status, destination status, quantity, condition, revision, and exception.
- History is append-only. Corrections create compensating events rather than rewriting history.
- Elevated overrides require a reason and are retained in the audit log.
- Old revisions remain available but clearly marked **SUPERSEDED**.
- Scanning an old code shows a blocking revision warning and the current revision.
- Revision approval identifies affected in-process work.
- Inventory distinguishes required, available, allocated, issued, consumed, short, on order, and expected.
- Open purchase-order quantity is never presented as physically available material.
- QC supports pass, pass with note, hold, rework, remake, and scrap.
- Remakes support Elward's RMK/RME naming and numbering rules, including sequences beginning at 51 when configured.
- Pallet rules are configuration, not hard-coded conditionals.
- Initial pallet rules include Swisspearl/Trespa 1.5-inch border, SRS 2-inch border, Dry/Wet/Per 4-inch border, 3,500-pound maximum target, and under-five-foot target height except approved exceptions.
- A pallet may contain multiple elevations; an elevation may span multiple pallets.
- Truck planning supports 53-foot full truck × 100-inch width, 48-foot hot shot × 100-inch width, and configurable LTL dimensions.
- Accounting, payroll, tax, and banking remain integrated external systems during phase one.
- No feature is complete without permissions, audit events, validation, empty/loading/error states, tests, documentation, and exports where applicable.
- No customer data or real employee information belongs in development seed data.

## Opinionated Technical Foundation

Use this foundation unless a measured discovery finding requires a written architecture decision to change it.

### Application

- Next.js 16 App Router
- React 19
- TypeScript with strict mode
- Tailwind CSS 4
- shadcn/ui components copied into the repository
- Server Components by default
- Client Components only for interaction requiring browser state
- Server Actions for trusted internal form mutations
- Route Handlers for scanner/device APIs, imports, exports, webhooks, and health endpoints
- Progressive Web App manifest and a deliberately small service worker for cached shell/offline scan queue

### Data

- PostgreSQL 16+
- Drizzle ORM and versioned SQL migrations
- Decimal database columns for measurements, weights, quantities, and cost
- Explicit units on every physical measurement
- UTC timestamps in storage; display in `America/Denver`
- PostgreSQL transactions for inventory, scan, QC, pallet, and shipping mutations
- Row version numbers for optimistic concurrency
- Idempotency keys for scanner actions, imports, jobs, and external callbacks

### Authentication and authorization

- Auth.js with database-backed users, sessions, and customer-controlled administrator accounts
- Role templates plus explicit permissions
- Permission checks in server-side service functions, never only in the UI
- Optional Microsoft/Google identity providers can be added later without making them mandatory

### Files

- A small `FileStore` interface owned by the repository
- Local MinIO for development
- Any S3-compatible production provider selected by Elward
- Original uploads are immutable
- Derived packets, thumbnails, manifests, and exports reference the original source and generation version
- Files have hashes, MIME types, size, uploader, source, classification, and retention metadata

### Background work

- PostgreSQL-backed job table in phase one
- One worker command/process in the same repository
- Jobs include release parsing, thumbnails, packet generation, large exports, notifications, and scheduled backups
- No Redis, Kafka, or external workflow platform until measured load proves it necessary

### Testing and operations

- Vitest for unit and service tests
- Playwright for critical end-to-end flows
- axe checks in Playwright for accessibility
- Docker Compose for local PostgreSQL and MinIO
- Structured JSON logs with request, user, job, release, and trace identifiers
- `/api/health/live` and `/api/health/ready`
- Nightly PostgreSQL backup plus object-storage inventory/export procedure
- Restore rehearsal documented and tested before production acceptance

## Repository Shape

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
  ui/
  domain/
db/
  schema/
  migrations/
  seeds/
docs/
  adr/
  operations/
  product/
  runbooks/
lib/
  auth/
  files/
  jobs/
  permissions/
  validation/
modules/
  releases/
  documents/
  production/
  inventory/
  quality/
  pallets/
  shipping/
  reporting/
public/
scripts/
tests/
  e2e/
  fixtures/
worker/
```

Each module should contain its schema adapter, service functions, validation, queries, UI components, tests, and documentation close enough to be found without hunting through generic utility folders.

---

# How to Use the Prompts

1. Create or open the `elward-flow` repository in a Codex work session.
2. Give Codex the **Master Constitution** once.
3. Run prompts in numerical order. Do not paste all implementation prompts at once.
4. Let Codex inspect the repository before every milestone.
5. Require a working, tested commit-sized result from each prompt.
6. Open and use the feature before advancing.
7. Record changed assumptions in `docs/product/decisions.md`.
8. If a prompt uncovers an architectural conflict, stop feature work and require an ADR before proceeding.

---

# Prompt 00 — Master Product Constitution

Paste this at the beginning of the first Codex session and retain it in `AGENTS.md`.

```text
You are building Elward Flow for Elward Systems, an architectural panel and cladding manufacturer. This is not a generic ERP or a demonstration. It must become a dependable operational source of truth from release intake through shipment.

The connected operating chain is:
Customer → Project → Job → Release → Revision → Panel Mark → Work Step → QC → Pallet → Shipment.

Binding operational rules:
- Job numbers are five digits.
- Job + Release is the unique business key for a release.
- The current revision must always be unmistakable.
- Superseded revisions remain available but cannot silently drive production.
- Scanning an obsolete identifier must produce a blocking warning and direct the user to the current revision.
- Every consequential event records user, timestamp, device/workstation, prior state, new state, quantity, condition, revision, and reason/exception where applicable.
- Audit history is append-only. Corrections create compensating events.
- Common shop-floor actions require no more than two or three taps after scanning.
- Operators should not be required to decide the next valid stage; the system presents permitted actions.
- Inventory distinguishes required, available, allocated, issued, consumed, short, on order, and expected.
- QC supports pass, pass with note, hold, rework, remake, and scrap.
- RMK/RME identifiers and numbering are configurable, including sequences beginning at 51.
- Pallet borders, limits, elevation grouping, truck constraints, and approval exceptions are configuration.
- Accounting, payroll, tax, and banking remain outside the initial system boundary.
- Elward owns all source, data, files, accounts, exports, backups, configuration, and documentation.

Technical rules:
- One Next.js 16 App Router application and one repository.
- React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui, PostgreSQL, Drizzle, Auth.js.
- Server Components by default. Permission enforcement occurs in server-side services.
- Use a repository-owned FileStore interface with local MinIO and S3-compatible production storage.
- Use PostgreSQL transactions, optimistic concurrency, and idempotency keys for consequential mutations.
- Use a PostgreSQL-backed job table and one worker process. Do not introduce microservices, Redis, Kafka, or provider-specific business logic without a documented measured need.
- Store timestamps in UTC and display America/Denver.
- Use explicit units and decimal fields for quantities, dimensions, weights, and cost.
- Preserve immutable original uploads. Derived files retain lineage and generation version.
- No real Elward customer, employee, project, or production data in fixtures.

Quality definition:
A feature is not complete until it includes authorization, validation, audit events, transactional safety, loading/empty/error states, responsive touch-friendly UI, keyboard accessibility, tests, documentation, and relevant exports. Never hide unfinished behavior behind a button. Never add a dependency before checking whether the platform or current stack already provides the capability.

Working behavior:
- Inspect the repository and existing docs before changing anything.
- Preserve good existing work and user changes.
- Keep implementation increments small and demonstrable.
- Update migrations, seed data, tests, docs, and acceptance evidence together.
- Run formatting, type checking, unit tests, and relevant Playwright tests before reporting completion.
- Report what changed, how to run it, exact tests run, remaining risks, and the next recommended prompt.
- Do not claim a feature works unless you exercised its critical path.
```

---

# Prompt 01 — Foundation and Local Development

```text
Implement the production-quality foundation for Elward Flow according to AGENTS.md.

First inspect the repository, package manager, current Next.js version, existing components, configuration, and uncommitted changes. Reuse sound work. Then create the smallest maintainable foundation that supports the full product.

Required result:
1. Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4, and shadcn/ui.
2. PostgreSQL and MinIO through Docker Compose with health checks and named volumes.
3. Drizzle configuration, migration commands, and a first migration.
4. Environment parsing with Zod and a documented `.env.example` containing no secrets.
5. Auth.js database sessions, password sign-in for local development, secure password hashing, and an initial admin creation command. Do not expose public self-registration.
6. Organization and Site foundations even though the initial deployment has one Elward organization and one primary site.
7. Structured logging, request correlation, health live/readiness endpoints, and an application error boundary.
8. FileStore interface with local MinIO adapter, upload hash verification, and immutable-object convention.
9. PostgreSQL job table and worker skeleton with retry, dead-letter state, idempotency key, timestamps, and structured errors.
10. PWA manifest, install metadata, and an offline status indicator. Do not cache authenticated business data yet.
11. Vitest and Playwright setup with one database-backed smoke test and one authenticated browser smoke test.
12. `README.md`, `docs/operations/local-development.md`, `docs/operations/environment.md`, and ADRs for architecture, authentication, database, file storage, and background work.

Create scripts for setup, migration, seed, test, worker, backup, and restore verification. A new maintainer should be able to clone the repository, copy `.env.example`, start dependencies, migrate, seed, run the app, run the worker, and execute tests using only the documentation.

Seed only fictional data and one local administrator. Print the generated development password once; do not commit it.

Acceptance:
- Fresh clone walkthrough succeeds.
- Health readiness fails when PostgreSQL or object storage is unavailable.
- Unauthorized dashboard access redirects to sign-in.
- File upload and retrieval work through FileStore, not provider calls in application modules.
- Worker claims one job safely and retries a forced failure.
- Typecheck, unit tests, and Playwright smoke test pass.

After implementation, provide exact commands and stop. Do not begin feature modules.
```

## Walkthrough 01

1. Clone into an empty directory.
2. Copy `.env.example` to `.env.local` and fill generated local secrets.
3. Start PostgreSQL and MinIO.
4. Run migrations and seed.
5. Start the web app and worker in separate terminals.
6. Sign in as the local administrator.
7. Open `/api/health/live` and `/api/health/ready`.
8. Stop PostgreSQL and confirm readiness fails without falsely reporting the app healthy.
9. Restart it, upload a test PDF through the storage test screen, and verify download/hash.
10. Run the complete test command from a clean terminal.

Gate: do not advance until another developer can follow the written setup without verbal help.

---

# Prompt 02 — Domain Model, Audit, Permissions, and Configuration

```text
Build the Elward Flow domain foundation. Do not build full workflow screens yet.

Create normalized PostgreSQL/Drizzle models, services, migrations, fixtures, and tests for:
- Organization, Site, User, Role, Permission, UserRole.
- Customer, Project, Job.
- Release and ReleaseRevision with unique business key organization + job + release number.
- PanelMark and required quantity.
- Document, DocumentRevision, DocumentClassification, StoredFile, DerivedFile.
- OperationDefinition, OperationRoute, OperationInstance.
- Workstation and Device.
- ActivityEvent and immutable AuditEvent.
- Attachment and Comment.
- ConfigurationRule with effective dates, version, scope, and approval metadata.

Use UUID primary keys and separate human-readable identifiers. Add created/updated metadata, row version for optimistic concurrency, archived state where appropriate, and database constraints for business invariants.

Create service boundaries so UI and route handlers never mutate tables directly. Every service mutation receives an actor context, authorization is checked server-side, transactional work is atomic, and an audit event is written in the same transaction.

Initial role templates:
- Executive
- Operations Manager
- Production Manager
- Project Manager
- Drafting/Engineering
- Production Administration
- Purchasing
- Receiving
- CNC Lead
- CNC Operator
- ELU Lead
- ELU Operator
- Parts Preparation
- Assembly Lead
- Assembly Operator
- QC
- Shipping Lead
- Pallet Builder/Packager
- Forklift Operator
- Accounting Read/Export
- System Administrator

Create an explicit permission matrix. Include separate permissions for view, create, edit, approve, override, export, configure, and administer. Elevated overrides require a non-empty reason.

Add a configuration registry for:
- job number validation
- release numbering
- revision labels
- RMK/RME prefixes and starting sequence
- production operation route
- pallet border rules
- pallet weight and height limits
- truck dimension templates
- units and timezone

Provide admin screens to inspect, not casually edit, current configuration. Editing configuration must create a proposed version requiring approval before becoming effective.

Acceptance tests must prove uniqueness, permissions, audit immutability, transactional rollback, optimistic concurrency conflict, required override reason, configuration versioning, and timezone presentation.
```

## Walkthrough 02

- Create a fictional job and two releases with the same release number under different jobs; both succeed.
- Attempt a duplicate Job + Release; it fails with a useful message.
- Give an operator view/scan permissions but no override permission.
- Attempt an override as the operator; it is blocked server-side.
- Perform the override as Operations Manager with a reason; audit history captures it.
- Propose a new pallet weight rule and verify it does not affect production until approved.
- Attempt to update a stale record version and confirm the app shows a conflict rather than overwriting another user's change.

---

# Prompt 03 — Application Shell and Active Release Command Center

```text
Build the Elward Flow application shell and the primary Active Release Workspace.

The first useful screen after sign-in is a pinned active-release command center, not a generic dashboard. It must work on desktop, tablets, and phones.

Navigation:
- Active Release
- Releases
- Search
- Scan
- Production
- Inventory
- Quality
- Pallets
- Shipping
- Reports
- Administration, permission-gated

Active Release Workspace must show:
- job, release, project/customer, current revision
- release status, production priority, required date, planned ship date
- revision warning state
- blockers and owned exceptions
- material readiness
- mark/panel completion by operation
- pallet completion and shipping readiness
- department packet links
- original package and controlled documents
- recent activity
- assigned people/stations where applicable
- quick actions permitted for the signed-in role

Prominent shop actions:
- Scan
- Record production
- Add note/photo
- Report issue
- Open current drawings
- Open CNC files
- Open department packet
- Place/release hold, permission controlled

Add global search by job, release, revision, project, customer, mark, pallet, shipment, PO, remake ID, and barcode. Search results must explain why they matched and show current status.

Design requirements:
- Large touch targets and obvious scan focus.
- No horizontal scrolling for primary tablet workflows.
- Status cannot be communicated by color alone.
- Dense desktop tables may have configurable columns, filters, saved views, and CSV export.
- Mobile cards expose the same decisions without duplicating page logic.
- Empty, loading, offline, stale, permission-denied, conflict, and failure states are first-class.

Use fictional seed data representing a release with multiple marks, a material shortage, one CNC-complete mark, one QC hold, two pallets, and an upcoming shipment.

Add Playwright tests for desktop and tablet widths, keyboard access, role-restricted actions, global search, pinned release persistence, and deep links.
```

## Walkthrough 03

1. Sign in as Production Manager and pin the seeded active release.
2. Read the release's current revision, due date, material shortage, QC hold, completion, pallet state, and latest activity without navigating away.
3. Switch to CNC Operator; confirm management and shipping actions disappear and direct URLs remain blocked.
4. Scan or search the job/release, a mark, and a pallet.
5. Test at 1280-pixel desktop, 768-pixel tablet, and narrow phone widths.
6. Use only the keyboard to open search, select a result, and reach current drawings.

---

# Prompt 04 — Release Intake, Document Control, and Packet Generation MVP

```text
Build the first production MVP: release intake, review, revision control, document classification, department packets, and active-release publishing.

Release intake flow:
1. Upload a ZIP or PDF package.
2. Preserve the immutable original immediately with SHA-256 hash.
3. Collect or infer job number, release number, proposed revision, customer/project, material families, marks, quantities, and source metadata.
4. Extract ZIP contents safely. Prevent path traversal, decompression bombs, executable files, and unsupported types.
5. Classify files using deterministic filename/folder rules first. Put uncertain files in a human review queue; do not silently trust AI classification.
6. Show extracted metadata and document classifications in one review screen.
7. Require an authorized administrator to correct and approve the revision.
8. Publish a revision atomically.
9. Generate controlled complete, CNC, ELU, parts, assembly, QC, shipping, and archive packets according to approved configuration.
10. Record packet generation version, source files, ordering, page rotations, hashes, and generator logs.

Expected release document categories include packing lists, table/CNC layouts, cut drawings, assembly drawings, extrusion cut lists, accessory lists, elevations, shipping information, and other controlled documents. Support configurable expected-document rules by product/material family. Flag missing expected documents before approval.

Revision behavior:
- Never overwrite a prior revision.
- Only one revision is current.
- Publish requires permission and a review summary.
- Superseded packets receive a visible watermark/status.
- Old QR/barcodes resolve to the historical record and display a blocking current-revision warning.
- Before approving a new revision, calculate affected marks and operations already started, completed, held, palletized, or shipped.
- Require an impact disposition for affected in-process work.
- Notify responsible roles in-app.

Create packet preview, page reorder/rotation, classification correction, missing-document resolution, and regeneration actions. Regeneration never changes the historical packet; it creates a new derived version.

Add downloadable complete and department ZIP/PDF packets and structured release JSON/CSV exports.

Acceptance scenarios:
- standard ACM package
- Swisspearl or Trespa package with different expected documents
- missing extrusion list
- duplicate file names
- mixed page orientation
- new revision after CNC begins
- old barcode scan
- failed packet generation and safe retry
- unauthorized approval
- concurrent reviewers
```

## Walkthrough 04 — The First Winning Demo

1. Drag a fictional release ZIP onto the intake screen.
2. Watch the original become preserved before processing.
3. Review extracted Job + Release, marks, quantities, and document classifications.
4. Resolve one intentionally uncertain classification and one missing-document warning.
5. Preview complete and department-specific packet order.
6. Approve and publish the release.
7. Open Active Release and show current packets instantly.
8. Create a new revision after one mark has started CNC.
9. Show the impact list, enter dispositions, approve, then scan the old code.
10. Export the release record and packet ZIP.

This is the MVP sales proof: one upload becomes controlled, searchable, department-ready work without losing the original.

---

# Prompt 05 — Scanner, Barcode, Offline Queue, and Movement Ledger

```text
Build the scanner-first transaction system used throughout Elward Flow.

Support keyboard-wedge scanners, device camera scanning, and manual code entry. Codes must identify record type and stable record ID but must not embed mutable workflow state.

Scanner resolution supports release, revision, mark, batch/cart, inventory item/lot, location, workstation, pallet, shipment, employee badge, remake, and document packet.

After a valid scan:
1. Resolve the record and current revision.
2. Show identity and any blocking warning.
3. Determine permitted actions from workflow, role, prerequisites, and current state.
4. Ask only for data required for the selected action.
5. Confirm the resulting quantity/condition/destination.
6. Commit one transactional, idempotent event.
7. Show a large success/failure result and remain ready for the next scan.

Every movement event includes actor, acting role, device, workstation, timestamp, client timestamp, server timestamp, record, source state, destination state, revision, quantity, unit, condition, reason, notes, attachments, and idempotency key.

Offline behavior:
- Cache only the application shell, role-safe reference data, and explicitly prepared offline work queues.
- Queue signed local actions with unique idempotency keys.
- Clearly display offline state and pending action count.
- Never imply a queued action is server-confirmed.
- On reconnect, submit in order, display accepted/conflicted/rejected results, and require human resolution for conflicts.
- Prevent sensitive data from remaining indefinitely in browser storage.

Create a reusable scanning route and components rather than separate ad hoc scanners in every module. Add device registration and optional workstation binding.

Test double scans, rapid scans, wrong revision, partial quantity, over-completion, unauthorized destination, offline/reconnect, stale workflow, and lost response after successful server commit.
```

## Walkthrough 05

- Scan a current mark and complete a partial CNC quantity.
- Scan it again with the same idempotency key; no duplicate event is created.
- Scan an obsolete revision; the workflow blocks and identifies the current revision.
- Disconnect the browser, queue two permitted actions, reconnect, and inspect reconciliation.
- Attempt to over-complete quantity and move directly past a required QC step; both fail usefully.
- Open the movement ledger and trace the mark from its release through every event.

---

# Prompt 06 — Production Planning and Department Execution

```text
Build production planning and execution for CNC, ELU, parts preparation, panel preparation, assembly, and QC handoff.

Use configurable operation routes. Do not hard-code one universal route because product families differ. Each operation instance tracks prerequisites, planned quantity, completed quantity, scrap, hold quantity, priority, station/machine, assigned team, start/stop events, downtime, materials, documents, and exceptions.

Production planning:
- active release schedule
- department capacity board
- ready/not-ready reason
- priority and target date
- material readiness
- document readiness
- predecessor readiness
- assigned station/machine/team
- holds and exceptions
- configurable saved views and printable downtime queues

CNC captures:
- CNT machine/workstation
- WinCNC/program reference
- layout/table reference
- current revision
- material, color, thickness, sheet/lot where available
- orientation
- first-off inspection
- expected, completed, scrap, and remaining quantity
- operator and start/stop time
- downtime reason
- notes/photos for drawing conflict, damage, machine problem, or quality issue

ELU and parts preparation capture:
- extrusion/part type
- cut-list revision
- expected/completed/scrap quantities
- workstation/operator
- material issue and shortage
- cart/batch/destination

Assembly captures:
- station among the configured assembly stations
- operator pair/team
- mark and quantity
- current drawings and required parts
- priority
- start/stop/completion
- exceptions
- QC requirement and handoff

The UI must show only valid work and valid next actions for the department. Managers can see why work is not ready. Operators should not navigate a project-management board to find work.

Add release, department, machine, station, operator, and mark histories. Include CSV/XLSX exports and printable daily department queues for downtime contingency.

Test partial completion, split batches, scrap, rework return, station reassignment, material shortage, missing document, revision impact, downtime, and concurrent scans.
```

## Walkthrough 06

1. Production Manager opens the active schedule and sees readiness reasons.
2. Assign a ready batch to CNC 2 and an assembly station.
3. CNC Operator opens one focused queue, current documents, and allowed actions.
4. Record first-off pass, partial completion, one scrap panel, and remaining quantity.
5. ELU receives only the eligible downstream quantity.
6. Assembly sees parts readiness and cannot start a held mark.
7. Manager opens the complete event and downtime history without assembling information from multiple screens.

---

# Prompt 07 — Inventory, Purchasing, Receiving, Allocation, and Consumption

```text
Build transaction-led inventory and purchasing readiness.

Model item, material family, description, manufacturer, color/finish, thickness, dimensions, unit, lot/heat/batch, location, status, on-hand quantity, reserved/allocated quantity, available quantity, expected quantity, reorder settings, and cost visibility permission.

Inventory is derived from an immutable transaction ledger. Supported transactions:
- opening balance
- receipt
- transfer
- allocation and deallocation
- issue to release/mark/operation
- return
- consumption
- scrap
- adjustment with approval
- cycle count and reconciliation

Purchasing includes vendor, PO, PO line, ordered quantity, received quantity, expected date, receiving status, attachments, and link to release demand. Do not build accounts payable.

Receiving flow:
1. Scan PO or search.
2. Select line.
3. Enter/scan received material, quantity, condition, lot, dimensions, and location.
4. Record damage or discrepancy with photos.
5. Print label/barcode where configured.
6. Update physical on hand and release readiness transactionally.

Allocation:
- allocate material to release, mark, or operation
- prevent over-allocation
- allow authorized substitution with documented reason
- show shortage separately from on-order and expected
- preserve original demand when substituted

Counts:
- blind count mode
- count session and frozen scope
- discrepancies require review
- adjustment creates compensating transaction and approval audit

Create on-hand, transaction, shortage, expected-receipt, allocation, count, and release-material exports.

Test unit handling, concurrent allocation, partial receipt, damaged receipt, return, substitution, negative-stock prevention, approved adjustment, physical-count reconciliation, and reversal.
```

## Walkthrough 07

- Open a release and compare required, available, allocated, issued, consumed, short, and expected quantities.
- Receive part of an open PO into a location and record one damaged sheet.
- Allocate usable material to the release.
- Show that the remaining PO quantity is expected but not available.
- Issue material to CNC, return an unused quantity, and scrap a damaged quantity with approval.
- Run a blind count and reconcile the discrepancy through an auditable adjustment.

---

# Prompt 08 — Quality, Holds, Rework, RMK/RME Remakes, and Cost Trace

```text
Build quality management as owned workflow, not a notes field.

Inspection records link to release, revision, mark, operation, quantity, inspector, specification/checklist version, measurements, photos, notes, disposition, and destination.

Dispositions:
- Pass
- Pass with note
- Hold
- Rework
- Remake
- Scrap

An issue includes category, severity, detection point, suspected cause, responsibility, owner, due date, affected quantity, containment, photos/files, disposition, resolution, verification, and timestamps.

Hold behavior:
- A hold blocks configured downstream movement.
- Partial quantities may be held while accepted quantities continue.
- Releasing a hold requires permission, result, and reason.
- Revision holds and quality holds remain distinguishable.

Rework returns affected quantity to a configured prior operation and retains the original execution history.

Remakes:
- Create RMK or RME according to configurable responsibility rules.
- Generate the next configured sequence, including beginning at 51.
- Link original and replacement marks.
- Carry forward correct job/release/current revision/material/color/dimensions while requiring confirmation.
- Create required operation route and priority.
- Track cause, responsible area, material, labor/time, outside cost, approval, completion, QC, pallet, and shipment.
- Never silently count the replacement as additional contract quantity.

Provide issue board, aging, ownership, root-cause, remake cost, source department, and recurring-category reports. Protect sensitive cost data with permissions.

Test pass-with-note, partial hold, rework loop, RMK, RME, duplicate sequence protection, revision change during remake, scrap, hold override, and original-to-replacement shipping trace.
```

## Walkthrough 08

1. QC inspects a completed mark and places part of the quantity on hold.
2. Assign the issue and due date with photos.
3. Send one item to rework and verify its operation history remains intact.
4. Create an RME beginning with the configured 51 sequence.
5. Follow the replacement through production and QC.
6. Show the original/replacement relationship, responsibility, material/time cost, pallet, and shipment.

---

# Prompt 09 — Pallets, Packaging, Labels, Load Planning, and Shipping

```text
Build palletization and shipping around physical verification.

Pallet records include identifier, type, status, dimensions, border, tare weight, calculated contents weight, measured weight, total height, elevations, destination, contents, accessories, packaging materials, builder, verifier, photos, labels, exceptions, and timestamps.

Initial configurable rules:
- Swisspearl/Trespa border: 1.5 inches
- SRS border: 2 inches
- Dry/Wet/Per border: 4 inches
- target maximum weight: 3,500 pounds
- target height: under 5 feet except configured weld/approved exceptions
- one pallet may contain multiple elevations
- one elevation may be split across multiple pallets

Adding an item verifies current revision, eligible status, unpalletized quantity, destination, and compatibility rules. Removing or moving contents creates events. Closing a pallet requires content verification, dimensions, weight, condition, and current revision check.

Generate pallet label, manifest, packing list, elevation breakdown, QR/barcode, and photo record. Documents retain generation version and source data hash.

Shipping includes carrier, truck type, trailer, driver/contact where authorized, pickup appointment, destination, shipment sequence, load plan, pallets, loose accessories/extrusions, total dimensions/weight, paperwork, verification, dispatch, delivery status, and proof of delivery.

Truck templates:
- Full truck: 53-foot usable length × 100-inch width
- Hot shot: 48-foot usable length × 100-inch width
- LTL: configurable per shipment

Load planning should provide a reliable two-dimensional planning aid and constraint warnings without pretending to be a structural or legal load-certification system. Permit authorized manual placement with reason.

Shipment verification:
1. Confirm release completion and current revision.
2. Scan every pallet/accessory onto the shipment.
3. Detect missing, duplicate, held, wrong-destination, or already-shipped contents.
4. Verify dimensions, weight, condition, and sequence.
5. Select carrier/truck configuration.
6. Generate packing list, manifest, load plan, and BOL-support data.
7. Require Shipping Lead/Admin final verification.
8. Record pickup, dispatch, tracking, arrival, and POD where available.

Test split shipment, mixed elevations, multiple pallets per elevation, partial mark quantities, overweight/overheight warning, approved exception, duplicate pallet scan, wrong destination, current-revision failure, loose accessories, dispatch reversal, and POD.
```

## Walkthrough 09

- Build a pallet containing multiple elevations.
- Split one elevation across a second pallet.
- Trigger and resolve a border or weight warning.
- Verify and close both pallets.
- Create a full-truck shipment and place pallets in load sequence.
- Scan every pallet and one accessory bundle.
- Show detection of a duplicate and a held item.
- Generate the manifest/load plan and perform final shipping verification.
- Dispatch, then attach fictional POD.

---

# Prompt 10 — Reporting, Exports, Management Decisions, and Notifications

```text
Build decision-specific reporting and portability. Do not create a wall of vanity charts.

Each dashboard answers named operational questions and links every number to source records.

Executive:
- What is late or at risk?
- Which releases are blocked and why?
- What is shipping this week?
- Where are quality/remake cost and throughput changing?

Operations:
- Which releases are ready, blocked, late, or missing documents/material?
- What is today's department load and capacity risk?
- Which exceptions have no owner or are overdue?

Production Manager:
- What runs next by department/machine/station?
- What is partially completed?
- Where are scrap, downtime, rework, and shortages affecting plan?

Project Manager:
- What is the current release/revision, progress, blockers, pallet state, and ship plan for assigned jobs?

Purchasing/Inventory:
- What is required, available, allocated, short, expected, late, or discrepant?

Quality:
- What is held, aging, recurring, awaiting disposition, under rework, or remade?

Shipping:
- What is complete enough to palletize, verified, scheduled, dispatched, or missing paperwork?

Every KPI must define purpose, formula, source, refresh behavior, filters, owner, exclusions, and known limitations in the UI and `docs/product/kpis.md`.

Required exports:
- active release schedule: CSV/XLSX/PDF
- department work queue: CSV/PDF
- complete and department release packets: PDF/ZIP
- panel master: CSV/XLSX
- inventory on hand and transactions: CSV/XLSX
- shortages and expected receipts: CSV/XLSX/PDF
- production event history: CSV/XLSX
- QC/remake register: CSV/XLSX
- pallet manifest/load plan: PDF/XLSX
- shipment history: CSV/XLSX
- audit log: CSV
- complete customer data export: ZIP containing documented CSV/JSON and file manifest
- PostgreSQL backup and restore instructions

Exports are asynchronous when large, permission checked, auditable, reproducible, and include filter/as-of metadata. Formula injection in CSV/XLSX must be neutralized.

Build in-app notification inbox for assigned issues, holds, revision impacts, overdue approvals, shortages, failed jobs, and shipping exceptions. Add email later only through a notification adapter.

Test KPI formulas against fixtures, authorization, empty data, filter reproducibility, large export job, CSV injection, export manifest, and drill-through.
```

## Walkthrough 10

- Start on the Operations dashboard and identify the top three blockers.
- Drill into each source record.
- Export the filtered active-release schedule and verify its as-of/filter metadata.
- Generate the complete customer portability export.
- Open its manifest and locate jobs, releases, revisions, inventory events, QC/remakes, pallets, shipments, audit history, and files.

---

# Prompt 11 — Administration, Import, Migration, Backup, and Independent Handoff

```text
Build the administration and ownership layer that proves Elward is not captive to 4TWENTY.DEV.

Administration screens:
- users, role assignments, active sessions, password reset, account disable
- permission matrix and role-template comparison
- sites, workstations, devices, printers, and scanner registrations
- operation routes and workflow configuration
- numbering rules
- pallet/truck rules
- document classification and packet rules
- integration adapters and credentials status without revealing secrets
- job queue, failed jobs, retry, and dead-letter inspection
- audit/event search
- backup status, export status, and restore-test evidence
- application version, migration version, release notes, and health

Import framework:
- preserve untouched original source exports
- define versioned mapping specifications
- stage records before production import
- profile counts, duplicates, missing values, invalid references, and value distributions
- produce validation and exception reports
- require business-owner signoff
- import with idempotency and reconciliation totals
- retain source row identifier and transformation lineage

Provide templates for customers, vendors, users, jobs, releases, revisions, marks, inventory, open POs, pallets, shipments, and useful recent history. Do not import obsolete noise simply because it exists.

Backup and recovery:
- documented database backup command
- object-storage inventory and verification
- encrypted secret/configuration recovery process
- automated backup status record
- restore into an isolated environment
- post-restore verification script checking counts, hashes, recent events, files, and login
- recovery point and recovery time evidence recorded during rehearsal

Independent maintainer handoff test:
1. A developer unfamiliar with the project receives repository access and documentation.
2. They provision local dependencies.
3. They configure environment from examples.
4. They migrate and seed.
5. They run app and worker.
6. They execute tests.
7. They restore a backup.
8. They import a sample release.
9. They generate/export a packet.
10. They deploy a staging build using Elward-controlled accounts.

Write `MAINTAINER.md`, an architecture map, data dictionary, permission catalog, workflow configuration guide, backup/restore runbook, incident runbook, deployment runbook, upgrade guide, dependency inventory, and common-task recipes.

Add an automated handoff verification command that checks documentation-linked commands, environment keys, migrations, tests, backup/restore scripts, and sample export.
```

## Walkthrough 11

- Disable a fictional user and confirm active sessions are revoked.
- Change a role assignment and inspect the audit event.
- Import a deliberately dirty CSV into staging and review its exception report.
- Approve a corrected mapping, import, and reconcile counts.
- Run backup, restore to an isolated database, and execute verification.
- Give a clean-machine maintainer the repository and written instructions only.
- Record every unclear step as a documentation defect and repeat until the handoff succeeds unaided.

---

# Prompt 12 — End-to-End Acceptance, Security, Performance, and Launch Readiness

```text
Prepare Elward Flow for controlled pilot and production acceptance. This prompt is verification and repair, not feature expansion.

Create a requirements-to-evidence matrix linking every required capability to automated tests, manual scenario, documentation, responsible Elward owner, and acceptance status.

Required end-to-end scenarios:
1. Standard ACM release intake through packet publishing.
2. Swisspearl/Trespa release with configured material/document/pallet rules.
3. Missing required release document.
4. Revision change after CNC begins with affected-work disposition.
5. Old barcode scan after revision change.
6. Partial CNC completion, scrap, and downstream quantity.
7. Material shortage, partial PO receipt, allocation, issue, return, and consumption.
8. Quality hold, rework, RMK, and RME.
9. Multi-elevation pallet and split elevation.
10. Split shipment with remaining quantity accurate.
11. Offline scans and reconnect conflicts.
12. Unauthorized override and permission escalation attempt.
13. Concurrent updates and optimistic conflict.
14. Large export and complete customer portability package.
15. Backup and isolated restore.
16. New-maintainer clean setup and staging deployment.

Security review:
- authentication/session handling
- authorization on every mutation and sensitive query
- CSRF, XSS, SQL injection, path traversal, unsafe archive extraction, upload validation
- rate limiting on auth, upload, scan, export, and administrative actions
- secret handling and log redaction
- object-storage access control
- formula injection in exports
- dependency audit and license inventory
- secure headers and cookie settings

Performance budgets on representative seeded data:
- authenticated shell usable within 2 seconds on normal shop Wi-Fi after initial load
- scan resolution visible within 500 ms p95 when online on local/nearby deployment
- common transaction confirmed within 1 second p95 excluding file processing
- active-release workspace within 2 seconds p95
- search first page within 750 ms p95
- long document/export work is asynchronous and never blocks request workers

Reliability:
- retry safe jobs
- idempotent mutations
- graceful dependency failures
- visible failed-job ownership
- recovery from lost response after commit
- database and object-storage readiness
- restore evidence

Accessibility and usability:
- keyboard navigation
- visible focus
- scanner-first focus behavior
- status not color-only
- touch targets
- screen-reader names
- zoom/reflow
- shop tablet sunlight/high-contrast review
- gloves/dirty-hands practical review

Produce:
- pilot go/no-go checklist
- cutover plan and rollback triggers
- downtime procedure and printable queues
- training plan by role
- support/escalation matrix
- known limitations register
- release notes
- signed acceptance template

Run all automated checks and critical manual scenarios. Fix discovered defects within existing scope. Do not declare launch-ready while critical or high-severity evidence is missing.
```

## Walkthrough 12 — The Full Product Demo

Run this as a coherent story, not a feature tour:

1. **The problem:** open one active release and show current truth, priority, revision, material, progress, blocker, pallet, and shipment.
2. **Intake:** upload the fictional release package and publish controlled packets.
3. **Revision:** introduce a drawing change after CNC starts and protect in-process work.
4. **Production:** scan through CNC, ELU/parts, assembly, and QC with partial quantities and one exception.
5. **Inventory:** receive and allocate missing material; watch release readiness change.
6. **Quality:** create an RME, trace responsibility and cost, then complete the replacement.
7. **Packaging:** build and verify multi-elevation pallets with rules and labels.
8. **Shipping:** plan the truck, scan-load it, generate documents, and dispatch.
9. **Management:** drill from a blocker/KPI into the exact source events.
10. **Ownership:** export all customer data, show backup/restore evidence, and open the independent-maintainer runbook.

The final line of the demonstration is: **“This system follows Elward's work, proves what happened, and remains Elward's system whether or not 4TWENTY.DEV is in the room.”**

---

# Prompt 13 — Codex Repository Review After Every Major Phase

Use this after Prompts 04, 06, 09, and 12.

```text
Perform a skeptical release review of the current Elward Flow repository. Do not add features until the review is complete.

Inspect implementation, schema, migrations, services, authorization, audit events, transaction boundaries, idempotency, file lineage, UI states, tests, documentation, dependency additions, and operational scripts.

Review specifically for:
- business logic duplicated in components or route handlers
- permission checks existing only in the UI
- mutations without audit events
- multi-record changes outside a transaction
- scan/import/export operations without idempotency
- editable history
- incorrect Job + Release uniqueness
- silent revision replacement
- on-order inventory counted as available
- quantity drift across partial production, QC, pallets, or shipments
- hard-coded product, pallet, route, or truck rules that belong in configuration
- provider lock-in leaking into business modules
- missing empty/loading/error/offline/conflict states
- inaccessible touch/keyboard behavior
- fixtures containing real information
- undocumented environment variables or commands
- dependencies that duplicate platform/current-stack capability
- tests that assert mocks rather than observable outcomes

Run the application and exercise the critical path for the phase. Run typecheck, lint, unit tests, end-to-end tests, migration from a fresh database, and production build.

Write `docs/reviews/<date>-phase-review.md` with:
1. executive verdict
2. evidence
3. critical/high/medium/low findings
4. exact reproduction
5. recommended repair order
6. requirements without evidence
7. go/no-go recommendation

Repair critical and high findings that are clearly within current scope, rerun verification, and report the remaining risk honestly.
```

---

# Day-to-Day Codex Prompt Template

Use this for individual tickets after the foundation exists.

```text
Task: [one concrete user-visible outcome]

Business context:
[who needs this, what decision/action it supports, and relevant Elward rule]

Acceptance examples:
- Given [...], when [...], then [...].
- Given [...], when [...], then [...].
- Permission failure: [...].
- Conflict/offline/failure behavior: [...].

Before coding:
- Inspect AGENTS.md, relevant module, schema, migrations, tests, docs, and uncommitted changes.
- Identify affected permissions, audit events, transaction boundaries, exports, and configuration.
- State the smallest coherent implementation plan.

Implementation requirements:
- Keep business logic in typed server-side services.
- Validate all external input.
- Enforce permissions server-side.
- Use transaction/idempotency/concurrency controls where consequential.
- Add loading, empty, error, permission, and conflict states.
- Add unit/service and Playwright coverage at the appropriate level.
- Update documentation and acceptance evidence.
- Add no dependency unless its need and maintenance cost are justified.

Verification:
- Run typecheck, relevant tests, production build when affected, and the user-visible workflow.
- Report files changed, migration impact, exact commands, evidence, risks, and rollback.
- Do not claim completion if the acceptance examples were not exercised.
```

---

# Recommended Build Order and Gates

| Gate                  | Prompts | Product proof                                      | Do not advance until                                                                   |
| --------------------- | ------: | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Foundation            |   00–02 | Maintainable system skeleton                       | Clean setup, auth, database, files, worker, audit, permissions, and configuration pass |
| Sales MVP             |   03–04 | Release package becomes controlled production work | Realistic fictional release publishes correct packets and survives revision test       |
| Shop pilot            |   05–06 | Scanner-driven production execution                | CNC/ELU/assembly users complete representative work in two or three taps               |
| Material control      |      07 | Release material readiness is trustworthy          | Count, receipt, allocation, issue, return, consumption, and shortage reconcile         |
| Close the loop        |   08–09 | QC through shipment is traceable                   | RMK/RME, pallets, split shipments, manifests, and dispatch pass                        |
| Operational ownership |   10–11 | Decisions, exports, recovery, handoff              | KPIs drill through, portability export works, restore and new-maintainer test pass     |
| Launch                |   12–13 | Evidence-backed production readiness               | No critical/high unresolved defects and Elward owners sign scenarios                   |

## What Not to Build First

- General ledger, payroll, tax, or banking
- Customer CRM and marketing automation
- A drag-and-drop workflow builder
- AI scheduling before clean operational data exists
- Predictive maintenance before machine/downtime history is reliable
- Native mobile apps before the responsive scanner PWA is proven
- Microservices
- A data warehouse
- Kafka, Redis, Kubernetes, or a distributed cache
- A universal report builder
- An elaborate 3D truck optimizer
- Direct machine control

These may become justified later. None should delay release control, shop execution, inventory truth, quality traceability, pallets, shipping, exports, or recovery.

## The Product Standard

Elward Flow wins when a person can start with a five-digit job number and answer, with evidence:

- What is the current release and revision?
- What documents are valid right now?
- What must be produced next?
- What material is physically available and allocated?
- Where is every mark and quantity?
- What is blocked, why, since when, and who owns it?
- What passed QC, what requires rework, and what was remade?
- What is on each pallet?
- What has shipped, what remains, and where is the proof?
- Can Elward export, restore, operate, and maintain the system without its original developer?

If the system answers those questions quickly, accurately, and independently, it is the product Elward needs.
