# ADR 0005: PostgreSQL-backed worker

Status: Accepted — 2026-08-17

One worker process claims jobs using a short PostgreSQL transaction and `FOR UPDATE SKIP LOCKED`. Jobs have unique idempotency keys, bounded attempts, exponential delay, structured errors, and terminal dead state. Redis, Kafka, and external workflow platforms are excluded until measured need justifies another ADR.
