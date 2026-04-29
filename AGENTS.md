# site-core

Cloudflare Pages project for equityworkflow.com. Root is the Pages deployment boundary.

## Structure

```
apps/www/public/       Static site assets (index.html) — no build step, plain HTML/CSS/JS
functions/api/         Pages Functions — file path = URL path
packages/
  email-templates/     emailTemplate(), sendEmail(), escHtml() — uses raw fetch, no Resend SDK
  db-schema/           equityworkflow-d1-schema.sql
```

`packages/` are **not npm packages** — no `package.json` inside them. Import by relative path only (e.g. `../../packages/email-templates/index.js`).

## Commands (run at root)

```
npm run dev           # npx wrangler pages dev (local D1 state in .wrangler/state/v3/d1/)
npm run deploy        # npx wrangler pages deploy → project named "equityworkflow"
npm run db:apply      # apply schema (idempotent — IF NOT EXISTS everywhere)
npm run db:query -- "SELECT ..."   # note: double-dash required to pass SQL through npm
```

No tests, no linter, no CI, no TypeScript anywhere.

## Pages Functions

- **Exports:** `onRequestPost` / `onRequestOptions` (not `onRequest`)
- **Imports:** relative paths from `functions/api/` e.g. `../../packages/email-templates/index.js`
- **Context:** `context.env` for bindings/vars, `context.waitUntil()` for background tasks

## D1 Database

- **Binding:** `DB`, database name `equityworkflow-forms`
- **Tables:** `beta_requests`, `signins` — timestamps stored as `TEXT` (ISO 8601), not integers
- **Schema columns not written by functions:** `status` (`pending|approved|declined`), `notes`, `updated_at` exist in schema but `submit.js` never sets them
- **Indexes:** `idx_beta_email`, `idx_beta_status`, `idx_signin_email`
- **Local dev:** D1 binding is available via wrangler pages dev (local SQLite); no `.dev.vars` file exists

## Environment Variables

| Variable | Where set | Notes |
|---|---|---|
| `RESEND_API_KEY` | `wrangler pages secret put RESEND_API_KEY` or `.dev.vars` | **Not** in wrangler.jsonc. No `.dev.vars` exists locally — email silently fails in dev (logs error, no throw). |
| `FROM_EMAIL` | wrangler.jsonc vars | Value: `info@equityworkflow.com` (no display name). Fallback in `sendEmail()`: `"Equity Work Flow <noreply@equityworkflow.com>"` |
| `TO_EMAIL` | wrangler.jsonc vars | **Dead config** — never read by any code; recipient list is hardcoded in `submit.js` |

Hardcoded recipients in `submit.js` (both form types): `["cmills@equityworkflow.com", "dmcphedran@equityworkflow.com"]`

**.dev.vars is NOT in .gitignore** — if you create it locally with `RESEND_API_KEY`, do not commit it.

## Form Submission API (`/api/submit`)

- **CORS:** hardcoded `Access-Control-Allow-Origin: https://equityworkflow.com` — localhost fetch calls will be CORS-blocked
- **Frontend endpoint:** `index.html` uses a relative `/api/submit` URL — no subdomain mismatch issues
- **Form types:** `signin` (validates email, notifies team, inserts into `signins`) and `request` (beta access, validates firstName/email/firm/role, sends two emails, inserts into `beta_requests`)
- **`signin` success** returns `{ ok: true, redirect: "https://app.equityworkflow.com" }` (note `app.` subdomain)
- **DB guard:** both handlers check `if (env.DB)` before writing — degrades gracefully without binding
- **DB error handling asymmetry:** `signins` insert swallows errors silently (`.catch(() => {})`); `beta_requests` insert logs them (`.catch(console.error)`)

## Auth quirk

The sign-in form has a password field and a "Continue with Google" button — **both are purely cosmetic**. The API only receives `email`; there is no backend authentication or OAuth.

## `packages/email-templates/index.js`

- `sendEmail(env, { to, subject, html })` — `to` must be an array. Returns silently (no throw) if `RESEND_API_KEY` is missing.
- `emailTemplate(heading, bodyHtml)` — escapes `heading` but injects `bodyHtml` raw; callers are responsible for escaping interpolated values.
- `escHtml(str)` — escapes `&`, `<`, `>`, `"` only (not `'`).

## Quirks & Gotchas

- **`RESEND_API_KEY` is not in wrangler.jsonc** — must be set as a Wrangler secret for production; for local dev create a `.dev.vars` file with `RESEND_API_KEY=...`
- **`pages_build_output_dir`: `apps/www/public`** — required in wrangler.jsonc for deploy to work; without it wrangler ignores the config file entirely
- **`nodejs_compat`** flag enabled — Node.js built-ins available in functions
- **`upload_source_maps: true`** — source maps uploaded on every deploy
- **`observability.enabled: true`** in wrangler.jsonc — Cloudflare Workers Observability is active
