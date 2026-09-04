# Security stabilization acceptance — 2026-08-31

Reviewed and repaired in `C:\Users\4twen\dev\elward-flow`, starting at local commit `9f8b350`, then fast-forwarding `main` to `5f667b7` before changes. The existing 37 unstaged screenshot deletions were preserved. No commit, push, production migration or deployment was performed.

## Changes verified

- Removed embedded administrator login and default signing-secret fallbacks. Password authentication fails closed for missing, disabled and invalid-password accounts and database outages. Existing sessions revalidate account status and current roles.
- Bound passkey challenges to browser, purpose and registration user using the existing PostgreSQL verification-token table. Enforced five-minute expiry, atomic single-use consumption, configured APP_URL origin/RP ID and required user verification. Passkey changes and audit events commit together.
- Added server-side scanner authorization, tenant and revision checks, operation ownership, predecessor and action validation, positive bounded quantities, stale-state rejection, serialized writes and transactional audit. Start actions do not increment completion. Ambiguous mark names fail safely; exact mark UUIDs resolve within the organization.
- Added shipment ownership checks, serialized loading/dispatch, repeated-request protection, staged-pallet checks and a database uniqueness constraint on pallet membership. Audit-write failure rolls back load membership and totals.
- Removed page-triggered showcase seeding and runtime DDL, including a hard-coded job deletion. Explicit synthetic seeding now requires working storage and does not suppress upload failure. Seeded object keys include organization and content hash. CI starts storage before seeding.
- Fixed passkey loading/error/accessibility issues and storage-upload error recovery. Updated browser selectors and fixture expectations to current UI, with independent scanner and receipt fixtures for repeatable execution.

## Local validation

| Check                                                  | Result                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Locked dependency installation                         | Passed                                                                       |
| Repository migrations through `0010_exotic_exodus.sql` | Passed against fresh local PostgreSQL                                        |
| Synthetic seed including original document uploads     | Passed                                                                       |
| `bun run format:check`                                 | Passed                                                                       |
| `bun run lint`                                         | Passed                                                                       |
| `bun run typecheck`                                    | Passed                                                                       |
| `bun audit --production`                               | No known vulnerabilities reported                                            |
| `bun run test:unit`                                    | 119 passed across 25 files                                                   |
| `bun run test:integration`                             | 8 passed across 2 files                                                      |
| `bun run build`                                        | Passed                                                                       |
| `bun x playwright test --workers=1`                    | All 16 Chromium workflows passed together against the final production build |
| `git diff --check`                                     | Passed                                                                       |

Browser coverage includes password login, rejection of the former owner fallback, passkey enrollment/sign-in/replay rejection/removal, desktop/tablet/phone shell, search, intake and publishing, direct object-storage upload, scanner movements and obsolete-revision blocking, inventory receiving/allocation/cycle counts, production, QC, pallets, shipping, administration and reports. The storage test downloads a seeded controlled drawing and verifies its SHA-256 against the stored record. Passkeys were exercised with Chromium's virtual authenticator; physical Windows Hello, phones and security keys were not tested.

Local acceptance uses the new synthetic database `elward_flow_ready_20260831` and private local MinIO bucket `elward-flow-review-20260831`. The earlier scratch database `elward_flow_review_20260831` remains available. Local configuration and generated credentials are in ignored `.env.local`; scratch logs are ignored under `.codex/`. Generated binary fixture changes were restored after testing. No production credentials or operational data were used.

## Release boundary

This is local acceptance for the repaired paths, not an exhaustive production security audit. Hosted CI has not run this uncommitted change set. Deployment, live-domain behavior, recovery rehearsal and physical passkey devices remain separate acceptance gates.

Before deploying the uniqueness migration, inspect existing pallet membership for duplicates. The migration intentionally fails rather than deleting or rewriting operational history. Before releasing auth changes, configure a strong unique AUTH_SECRET and the correct canonical APP_URL. Rotate any deployed signing secret that used a published/default value; rotation signs out existing sessions. Synthetic seeding must never target a live tenant.
