# Authentication and operational mutation safety

Status: Accepted for the 2026-08-31 stabilization repair.

The existing single Next.js application, Auth.js, PostgreSQL and FileStore architecture remains unchanged. Authentication must fail closed: no embedded administrator credentials or default signing secret. Passkey challenges use the existing PostgreSQL verification token table, expire after five minutes, bind to an HttpOnly browser cookie and registration user, and are consumed atomically. The configured APP_URL is the sole relying-party origin.

Page reads must not provision organizations or seed showcase production records. Synthetic setup is an explicit development command, never a side effect of opening a page. Schema changes remain repository-owned migrations.

Scanner and shipment mutations validate organization ownership and permitted state on the server. Locked rows serialize competing writes; conditional updates reject stale state; database constraints enforce pallet uniqueness. Audit failures must roll back consequential changes. Existing duplicate shipment pallet rows must be reviewed and corrected explicitly before the new uniqueness migration can succeed; migrations must not silently delete operational history.

These repairs do not authorize production seeding, credential rotation, DNS changes or deployment. Production migration and live acceptance remain separate verification steps.
