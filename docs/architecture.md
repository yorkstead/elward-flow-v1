# Elward Flow System Architecture

Elward Flow is Elward Systems' dependable operational source of truth from release intake through shipment.

## Connected Operating Chain

```
Customer ➔ Project ➔ Job (5-Digit) ➔ Release ➔ Revision ➔ Panel Mark ➔ Work Step ➔ QC ➔ Pallet ➔ Shipment
```

## Core Architecture Principles

1. **Next.js 16 App Router & React 19**
   - Single full-stack repository with Server Components prioritizing fast initial load and server-side data security.
   - Client components localized to interactive shop-floor terminals and consoles.

2. **PostgreSQL & Drizzle ORM**
   - Canonical single-file schema `db/schema.ts` with strict relational constraints and foreign keys.
   - Consequential state changes run inside PostgreSQL ACID transactions with optimistic concurrency.

3. **Dynamic Role-Based Access Control (RBAC)**
   - 5 core base roles: `admin`, `manager`, `operator`, `QC`, `project manager`.
   - Dynamic custom roles and discrete permission capabilities (`view`, `create`, `edit`, `approve`, `override`, `export`, `configure`, `administer`) stored in the database and reconfigurable in real-time through the Admin UI without code changes.

4. **Append-Only Immutable Audit Ledger**
   - Every mutation records user, UTC timestamp, workstation/device, prior state, new state, quantity, condition, revision, and reason.
   - Corrections produce compensating events; rows are never updated or deleted from `audit_events`.

5. **Staged Manufacturing Configuration Registry**
   - Operational parameters (crane weight limits, Swisspearl/Trespa/SRS border offsets, truck flatbed dimensions, RMK/RME sequence starts) are maintained in `configuration_rules`.
   - Changes require explicit supervisor proposal and approval before activation.

6. **Storage & Documents**
   - Repository-owned `FileStore` interface backing local MinIO and production S3-compatible object storage.
   - Lineage and SHA-256 hash preservation for immutable original engineering packets and derived work instructions.
