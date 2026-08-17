# ADR 0003: PostgreSQL and Drizzle

Status: Accepted — 2026-08-17

PostgreSQL 16 is the system of record. Drizzle owns typed schema and versioned SQL migrations. Consequential multi-row work must use database transactions, idempotency keys, and optimistic concurrency where applicable. All timestamps are timezone-aware UTC values and display in America/Denver.
