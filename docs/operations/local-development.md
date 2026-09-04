# Local development

Prerequisites: Git, Bun 1.3+, Docker Desktop with Compose, and Chromium for Playwright.

```powershell
Copy-Item .env.example .env.local
$authSecret = openssl rand -base64 32
# Put $authSecret in AUTH_SECRET inside .env.local; do not commit the file.
bun install
bun run deps:up
bun run db:migrate
bun run seed
```

Record the one-time fictional administrator password. Run `bun run dev` and `bun run worker` in separate terminals, then open `http://localhost:3000`.

Seeding is explicit: opening application pages never creates showcase records or changes the schema. Start MinIO before running seed; failed object uploads now fail the seed instead of leaving document records without files. Synthetic seed commands reject production mode. Keep fixtures in an isolated local database and bucket.

Passkeys use `APP_URL` as the trusted origin. Use `http://localhost:3000` locally and HTTPS for a hosted environment. `AUTH_SECRET` has no fallback and must be configured before starting or building the app. Local Playwright runs load `.env.local`; CI supplies its own environment and secrets.

Stop PostgreSQL with `docker compose stop postgres`; live remains 200 while ready returns 503. Restart with `docker compose start postgres`. Use Dashboard → Immutable storage test with a fictional PDF. Run `bun run worker:smoke` with the worker active to observe retry and dead state.

```powershell
$env:E2E_ADMIN_PASSWORD = '<one-time seed password>'
bun run test:all
Remove-Item Env:E2E_ADMIN_PASSWORD
```

`bun run backup` writes under ignored `backups/`. Restore into an isolated database with `pg_restore`, point `DATABASE_URL` to it, and run `bun run restore:verify`. Never rehearse over the active database.
