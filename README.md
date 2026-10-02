# Tu-valu

Vue application for student observations and evaluation.

## Start a fresh clone

Use Node.js 22.12 or newer and npm. Run these commands from the repository root:

```sh
npm ci
```

Copy `.env.example` to `.env.local` in the repository root. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS/Linux, use `cp .env.example .env.local`.

Replace both placeholders with the Supabase project URL and publishable (or legacy anon) key for the team's development database. Ask the project owner for these values. Keep the existing variable name `VITE_SUPABASE_ANON_KEY` even when using a publishable key. The example values cannot connect to a database.

All `VITE_` variables are included in browser code: never put a Supabase secret key, service-role key, database password, or storage credentials there. Actual `.env` and `.env.local` files are intentionally excluded from Git, so cloning does not copy them.

Start only the frontend, without requiring PHP:

```sh
npx vite --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173/tu-valu/ (or the port printed by Vite). Restart Vite after changing environment variables. Signing in requires an account with access to the selected project.

For Google sign-in and magic links, add `http://localhost:5173/tu-valu/` and `http://127.0.0.1:5173/tu-valu/` to Supabase Authentication → URL Configuration → Redirect URLs. Include the trailing slash and use your actual Vite port. The app derives its return URL from Vite's configured base path. Google's authorized redirect URI remains the Supabase project's `/auth/v1/callback` URL.

## Enable student photos

Photo display and uploads also require PHP 8.1 or newer, Composer, and development object-storage credentials:

```sh
composer install --working-dir=api
```

Copy `api/.env.example` to `api/.env`, then fill in the storage settings supplied privately by the project owner. Keep these credentials in `api/.env`, never in `VITE_` variables. See [API setup](api/README.md).

Stop the frontend-only server, then run both Vite and the PHP API:

```sh
npm run dev
```

## Review branch database

The `feat/issue-review-batch` changes require the matching database migration before the new features work. Configure a staging database with the existing application schema and have the project maintainer validate and apply the migration there. This repository does not yet contain the complete original schema, so the migrations alone cannot bootstrap an empty database. See [the review report](docs/ISSUE_REVIEW.md) for details.

## Checks

```sh
npm test
npm run build
```
