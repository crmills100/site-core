# site-core

Cloudflare Pages project for equityworkflow.com. Root is the Pages deployment boundary.

## Structure

```
apps/www/public/       Static site assets (index.html, etc.)
functions/api/         Pages Functions — route to URL mapping
packages/              Shared modules imported by functions
  email-templates/     Email HTML template + sendEmail helper
  db-schema/           D1 schema (equityworkflow-d1-schema.sql)
```

## Commands (run at root)

```
npm run dev           # npx wrangler pages dev (local with functions + assets)
npm run deploy        # npx wrangler pages deploy (production)
npm run db:apply      # Apply D1 schema from packages/db-schema/
npm run db:query      # Query D1 (pass --command="SELECT ..." after)
```

## Pages Functions

- **Route mapping:** file path → URL path. `functions/api/submit.js` handles `/api/submit`
- **Exports:** use `onRequestPost`, `onRequestOptions`, or `onRequest` from the module
- **Context:** `context.env` has bindings (D1, vars), `context.waitUntil()` for background work
- **Imports:** functions can import from `packages/` via relative paths (e.g., `../../packages/email-templates/index.js`)

## D1 Database

- **Name:** `equityworkflow-forms`, binding `DB`
- **Tables:** `beta_requests`, `signins`
- **Schema:** `packages/db-schema/equityworkflow-d1-schema.sql`
- **Apply:** `npm run db:apply` or `npx wrangler d1 execute equityworkflow-forms --file=packages/db-schema/equityworkflow-d1-schema.sql`

## Form Submission API (`/api/submit`)

- **Form types:** `signin` (email validation + notification) and `request` (beta access with email + D1 storage)
- **CORS:** allows `https://equityworkflow.com` only
- **Email:** Resend API via raw `fetch` (no SDK at runtime)
- **Template:** `packages/email-templates/index.js` exports `emailTemplate()`, `sendEmail()`, `escHtml()`

## Quirks & Gotchas

- **Secrets in wrangler.jsonc:** `RESEND_API_KEY` and email addresses stored as plaintext `vars`. Migrate to `wrangler secret put` before any sharing or commits to public repos.
- **Compatibility flags:** `nodejs_compat` enabled — Node.js built-ins available.
- **`upload_source_maps`: true** — source maps uploaded on deploy.
- **No TypeScript at root:** functions are JavaScript. The `packages/` modules are also JavaScript.
