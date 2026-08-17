# ADR 0001: Modular Next.js application

Status: Accepted — 2026-08-17

Elward Flow uses one Next.js 16 App Router application and repository. Server Components are the default; route handlers expose device, file, and health APIs. Business services live outside UI modules. PostgreSQL, object storage, and one worker remain deployment peers rather than microservices.
