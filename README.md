# site-core

Cloudflare Pages project for equityworkflow.com.

## Secrets

Set the Resend API key:

```bash
npx wrangler pages secret put RESEND_API_KEY
```

Then redeploy:

```bash
npm run deploy
```

## Testing the API

Mimic a "Request Access" form submission:

```bash
curl -X POST https://equityworkflow.pages.dev/api/submit \
  -H "Content-Type: application/json" \
  -H "Origin: https://equityworkflow.com" \
  -d '{"formType":"request","firstName":"Jane","lastName":"Doe","email":"jane@example.com","firm":"Acme Capital","role":"General Partner","dealSize":"$1M – $5M"}'
```

`lastName` and `dealSize` are optional. Required fields: `firstName`, `email`, `firm`, `role`.

The `Origin: https://equityworkflow.com` header is required — the API will reject any other origin.

## Database Queries

Query beta requests:

```bash
npm run db:query -- "SELECT * FROM beta_requests ORDER BY created_at DESC"
```

## Viewing Logs

Stream live function logs via the CLI:

```bash
npx wrangler pages deployment tail
```

Or in the Cloudflare dashboard: **Workers & Pages** → `equityworkflow` → **Functions** → **View logs** (or the **Observability** tab).

Useful log messages to look for:
- `RESEND_API_KEY not configured` — secret not set, emails silently skipped
- `Resend error 401:` — invalid API key
