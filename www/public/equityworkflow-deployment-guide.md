# Equity Work Flow — Form Submission Setup Guide
## Cloudflare Workers + Resend

This guide connects the landing page contact forms to your email inbox using a Cloudflare Worker and Resend for email delivery.

---

## What you'll end up with

- **Beta access requests** → email to your inbox + confirmation email to applicant + saved to D1 database
- **Sign-in attempts** → notification email + redirect to your beta app
- **All submissions** → stored in Cloudflare D1 (your own database, free tier included)

---

## Step 1 — Create a Resend account

1. Go to **[resend.com](https://resend.com)** and sign up (free — 3,000 emails/month)
2. Navigate to **Domains** → **Add domain** → enter `equityworkflow.com`
3. Resend will give you DNS records to add — go to your Cloudflare DNS dashboard and add them (takes ~2 minutes to verify)
4. Navigate to **API Keys** → **Create API key** → name it `equityworkflow-worker` → copy the key

---

## Step 2 — Deploy the Worker

### Prerequisites
```bash
npm install -g wrangler
wrangler login   # opens browser to authenticate with your Cloudflare account
```

### Deploy
```bash
# From the folder containing equityworkflow-worker.js and wrangler.toml:

# 1. Deploy the Worker
npx wrangler deploy

# 2. Set your Resend API key as a secret (never stored in code)
npx wrangler secret put RESEND_API_KEY
# Paste your Resend API key when prompted

# 3. (Optional) Update the TO_EMAIL and FROM_EMAIL in wrangler.toml
#    then redeploy: npx wrangler deploy
```

### After deploying
Cloudflare will show you a Workers URL like:
`https://equityworkflow-forms.YOUR_SUBDOMAIN.workers.dev`

---

## Step 3 — Set up D1 database (optional but recommended)

```bash
# Create the database
npx wrangler d1 create equityworkflow-forms

# Copy the database_id from the output and paste it into wrangler.toml

# Create the tables
npx wrangler d1 execute equityworkflow-forms --file=equityworkflow-d1-schema.sql

# Redeploy with the database binding
npx wrangler deploy
```

### Query submissions anytime
```bash
# View all beta requests
npx wrangler d1 execute equityworkflow-forms \
  --command="SELECT * FROM beta_requests ORDER BY created_at DESC"

# View pending requests only
npx wrangler d1 execute equityworkflow-forms \
  --command="SELECT * FROM beta_requests WHERE status='pending'"

# Mark someone as approved
npx wrangler d1 execute equityworkflow-forms \
  --command="UPDATE beta_requests SET status='approved' WHERE email='someone@example.com'"
```

---

## Step 4 — Connect the landing page

In `equityworkflow-landing.html`, find this line near the top of the `<script>` section:

```js
const WORKER_URL = 'https://equityworkflow-forms.YOUR_SUBDOMAIN.workers.dev/api/submit';
```

Replace `YOUR_SUBDOMAIN` with your actual Cloudflare Workers subdomain (shown in your Workers dashboard under **Workers & Pages → Overview**).

**Example:**
```js
const WORKER_URL = 'https://equityworkflow-forms.acme.workers.dev/api/submit';
```

---

## Step 5 — Add a custom route (when ready)

Once you've deployed the landing page to `equityworkflow.com`, you can route the API call through your own domain instead of the `workers.dev` subdomain:

In `wrangler.toml`, the route is already configured:
```toml
routes = [
  { pattern = "equityworkflow.com/api/submit", zone_name = "equityworkflow.com" }
]
```

Then update `WORKER_URL` in the landing page:
```js
const WORKER_URL = 'https://equityworkflow.com/api/submit';
```

And update the CORS header in `equityworkflow-worker.js`:
```js
"Access-Control-Allow-Origin": "https://equityworkflow.com",
```

---

## Step 6 — Add DNS records for email (SPF/DKIM)

Resend will provide these during domain verification — add them in Cloudflare DNS:

| Type | Name | Value |
|------|------|-------|
| TXT  | `@` or `equityworkflow.com` | `v=spf1 include:spf.resend.com ~all` |
| TXT  | `resend._domainkey` | *(provided by Resend)* |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@equityworkflow.com` |

---

## File summary

| File | Purpose |
|------|---------|
| `equityworkflow-landing.html` | Landing page (forms wired to Worker) |
| `equityworkflow-worker.js` | Cloudflare Worker — handles POST, sends email via Resend |
| `wrangler.toml` | Worker deployment config |
| `equityworkflow-d1-schema.sql` | D1 database schema (run once) |

---

## Cost

| Service | Cost |
|---------|------|
| Cloudflare Workers | Free (100K requests/day) |
| Cloudflare D1 | Free (5GB storage, 5M reads/day) |
| Resend | Free (3,000 emails/month) |
| **Total for beta phase** | **$0** |

---

## Testing

Before going live, test the Worker directly:

```bash
curl -X POST https://equityworkflow-forms.YOUR_SUBDOMAIN.workers.dev/api/submit \
  -H "Content-Type: application/json" \
  -d '{"formType":"request","firstName":"Test","lastName":"User","email":"you@yourfund.com","firm":"Test Fund","role":"General Partner","dealSize":"$5M – $25M"}'
```

You should receive:
- `{"ok":true}` in the response
- An email to your `TO_EMAIL` inbox with the submission
- A confirmation email to `you@yourfund.com`
