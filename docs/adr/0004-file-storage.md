# ADR 0004: Repository-owned FileStore

Status: Accepted — 2026-08-17

Application modules depend on `FileStore`, not an S3 provider. Local development uses MinIO through the S3-compatible adapter. Original objects use the `originals/` namespace, immutable generated keys, SHA-256 metadata, and verification after upload and retrieval.
