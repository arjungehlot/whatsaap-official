# wacrm Node backend

This service replaces Supabase Auth, Postgres tables, RLS and Storage with Express and MongoDB. The React/Next application talks to it through `NEXT_PUBLIC_API_URL`; Next rewrites existing `/api/*` requests to this service, so the current UI keeps its routes while all business work runs in Node.

## Start

```powershell
Set-Location 'E:\smartitbox\wacrm\node backend'
Copy-Item .env.example .env
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api` in the root `.env.local`, then run the frontend from `E:\smartitbox\wacrm` using `npm run dev`.

For a real deployment, put **all** production values from `.env.example` in `backend/.env` (or the host's environment settings). Keep the same `ENCRYPTION_KEY` that encrypted existing WhatsApp/AI settings. The temporary root `.env.local` fallback exists only to make the migration safe; the running Node backend does not consume Supabase variables.

## What the Node backend owns

- JWT sessions, accounts, members, invitations and API keys
- contacts, tags, conversations, messages, pipelines and broadcasts
- WhatsApp configuration, encrypted Meta credentials, sends, reactions, templates, media proxy and webhook ingestion
- automations, flows, quick replies, AI configuration, knowledge documents, drafts and playground requests
- versioned API-key endpoints under `/api/v1`

Run `npm run check` before deploying; it syntax-checks every backend module. Run `npm run typecheck` at the project root to validate the React/Next side.

The database is tenant-scoped on every request. A JWT identifies the current user and account; a record cannot be queried, changed, or removed outside that account. Files are placed under `uploads/` and served at `/uploads/...`; use object storage and a CDN in production by replacing the upload controller, not by exposing MongoDB directly.

## Importing existing Supabase data

The included one-time importer copies every CRM table, preserves IDs and account ownership, and mirrors Supabase Storage objects to `uploads/`. Its first run is read-only.

```powershell
Set-Location 'E:\smartitbox\wacrm\node backend'
Copy-Item .env.migration.example .env.migration
# Put the old Supabase URL and service-role key in .env.migration only.
npm run migrate:supabase
$env:MIGRATION_TEMP_PASSWORD = 'choose-a-strong-one-time-password'
npm run migrate:supabase -- --execute
Remove-Item -LiteralPath .env.migration
```

Supabase Auth passwords cannot be exported as reusable Node passwords. Every imported user receives `MIGRATION_TEMP_PASSWORD` and must change it after first login. Keep Supabase available until the preview counts, MongoDB records, imported files, and a real login/workflow test are confirmed. After that, remove Supabase keys from the root environment and stop using Supabase; do not remove `ENCRYPTION_KEY`, `META_APP_SECRET`, MongoDB or Node API settings.
