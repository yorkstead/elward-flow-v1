# Environment configuration

Copy `.env.example` to `.env.local`. The application validates server values with Zod and exits with a field-specific error when configuration is missing or invalid.

Generate `AUTH_SECRET` with `openssl rand -base64 32`. Local PostgreSQL and MinIO defaults are intentionally development-only; replace every `CHANGE_ME` and use managed secret storage outside development. Never commit `.env.local`.

`DATABASE_URL` connects the app, scripts, tests, and worker. `MINIO_*` configures only the FileStore adapter. `ADMIN_EMAIL` names the fictional local administrator. Set `E2E_ADMIN_PASSWORD` temporarily to the one-time seed password when running the authenticated browser test; do not store it in the example file.

## Hosted PostgreSQL

Production and preview deployments use the Neon project `elward-flow-v1`
(`sparkling-field-28712752`). Production targets the `main` branch; Vercel
previews target the isolated `preview` branch. Both use Neon's pooled,
TLS-required PostgreSQL connection string stored as a sensitive Vercel
`DATABASE_URL`. Passwords and full connection strings must never be committed.

Local development continues to use the Docker Compose PostgreSQL service by
default. This keeps local tests deterministic and prevents development work from
mutating hosted data.

Apply repository-owned migrations to a selected environment with:

```powershell
$env:DATABASE_URL = '<connection string from Neon>'
bun run db:migrate
Remove-Item Env:DATABASE_URL
```

Do not use `drizzle-kit push` against production. Migrations in `db/migrations`
are the schema source of truth. Create production administrators separately and
do not run the fictional development seed against production without an explicit
acceptance-data decision.

## Hosted object storage

Production uses the private Cloudflare R2 bucket `elward-flow-production`
through the repository-owned S3-compatible FileStore. The credential is an
account token restricted to object read/write access on that bucket only. It
cannot administer other buckets, and the bucket has no public access.

The existing `MINIO_*` variable names are retained for compatibility with the
provider-neutral adapter:

- `MINIO_ENDPOINT` — the account R2 S3 endpoint
- `MINIO_REGION` — `auto` for R2
- `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` — sensitive bucket-scoped S3 credentials
- `MINIO_BUCKET` — `elward-flow-production`

These values are sensitive production variables in Vercel and must not be
committed or copied into the local development environment. Local development
continues to use MinIO. Preview object storage remains intentionally separate
from production and must not point at the production bucket.
