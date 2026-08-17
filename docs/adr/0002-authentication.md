# ADR 0002: Auth.js credentials with JWT sessions

Status: Accepted by product owner — 2026-08-17

Auth.js explicitly limits its Credentials provider to JWT sessions, so password sign-in and Auth.js database sessions cannot be combined through supported APIs. The product owner selected Auth.js Credentials with encrypted, HTTP-only JWT sessions.

Users, password hashes, organization/site membership, account status, and authorization remain PostgreSQL-backed. Passwords use bcrypt with cost 12. There is no public registration. Sessions expire after eight hours. Adding enterprise identity later may revisit database sessions in a superseding ADR.

Rejected: an unsupported bridge that manually creates Auth.js session rows, because it would depend on internal behavior and weaken upgrades and security review.
