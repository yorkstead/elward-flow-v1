# Environment configuration

Copy `.env.example` to `.env.local`. The application validates server values with Zod and exits with a field-specific error when configuration is missing or invalid.

Generate `AUTH_SECRET` with `openssl rand -base64 32`. Local PostgreSQL and MinIO defaults are intentionally development-only; replace every `CHANGE_ME` and use managed secret storage outside development. Never commit `.env.local`.

`DATABASE_URL` connects the app, scripts, tests, and worker. `MINIO_*` configures only the FileStore adapter. `ADMIN_EMAIL` names the fictional local administrator. Set `E2E_ADMIN_PASSWORD` temporarily to the one-time seed password when running the authenticated browser test; do not store it in the example file.
