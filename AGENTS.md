<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Elward Flow Master Constitution

Elward Flow is Elward Systems' dependable operational source of truth from
release intake through shipment. It is not a generic ERP or a demonstration.

The connected operating chain is:

Customer → Project → Job → Release → Revision → Panel Mark → Work Step → QC →
Pallet → Shipment.

## Binding operational rules

- Job numbers are five digits.
- Job + Release is the unique business key for a release.
- The current revision must always be unmistakable.
- Superseded revisions remain available but cannot silently drive production.
- Scanning an obsolete identifier must produce a blocking warning and direct
  the user to the current revision.
- Every consequential event records user, timestamp, device/workstation, prior
  state, new state, quantity, condition, revision, and reason/exception where
  applicable.
- Audit history is append-only. Corrections create compensating events.
- Common shop-floor actions require no more than two or three taps after
  scanning.
- Operators do not decide the next valid stage; the system presents permitted
  actions.
- Inventory distinguishes required, available, allocated, issued, consumed,
  short, on order, and expected.
- QC supports pass, pass with note, hold, rework, remake, and scrap.
- RMK/RME identifiers and numbering are configurable, including sequences
  beginning at 51.
- Pallet borders, limits, elevation grouping, truck constraints, and approval
  exceptions are configuration.
- Accounting, payroll, tax, and banking remain outside the initial system
  boundary.
- Elward owns all source, data, files, accounts, exports, backups,
  configuration, and documentation.

## Technical rules

- Use one Next.js 16 App Router application and one repository.
- Use React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui, PostgreSQL,
  Drizzle, and Auth.js.
- Prefer Server Components. Enforce permissions in server-side services.
- Use a repository-owned FileStore interface with local MinIO and
  S3-compatible production storage.
- Use PostgreSQL transactions, optimistic concurrency, and idempotency keys
  for consequential mutations.
- Use a PostgreSQL-backed job table and one worker process. Do not introduce
  microservices, Redis, Kafka, or provider-specific business logic without a
  documented measured need.
- Store timestamps in UTC and display America/Denver.
- Use explicit units and decimal fields for quantities, dimensions, weights,
  and cost.
- Preserve immutable original uploads. Derived files retain lineage and
  generation version.
- Never use real Elward customer, employee, project, or production data in
  fixtures.

## Definition of done

A feature is complete only when it includes authorization, validation, audit
events, transactional safety, loading/empty/error states, responsive
touch-friendly UI, keyboard accessibility, tests, documentation, and relevant
exports. Never hide unfinished behavior behind a button. Before adding a
dependency, verify the platform or current stack does not already provide the
capability.

Inspect the repository and existing docs before every milestone. Preserve good
existing work and user changes. Keep increments small and demonstrable. Update
migrations, seed data, tests, docs, and acceptance evidence together. Run
formatting, type checking, unit tests, and relevant Playwright tests before
reporting completion. Exercise the critical path before claiming a feature
works.

Record changed assumptions in `docs/product/decisions.md`. If work uncovers an
architectural conflict, stop feature work and require an ADR before proceeding.
