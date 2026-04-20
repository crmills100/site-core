/**
 * Equity Work Flow — Form Submission Worker
 * Deploy to: Cloudflare Workers
 * Email provider: Resend (resend.com — free tier: 3,000/month)
 *
 * Environment variables required (set in Cloudflare dashboard → Workers → Settings → Variables):
 *   RESEND_API_KEY   — from resend.com/api-keys
 *   TO_EMAIL         — where you want submissions delivered, e.g. hello@equityworkflow.com
 *   FROM_EMAIL       — verified sender, e.g. noreply@equityworkflow.com
 */

export default {
  async fetch(request, env) {

    // ── CORS headers — allow your domain to POST here ──────────────
    const CORS = {
      "Access-Control-Allow-Origin":  "https://equityworkflow.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle pre-flight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS });
    }

    // ── Parse request body ─────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { formType } = body;

    // ── Route to correct handler ───────────────────────────────────
    if (formType === "signin") {
      return handleSignIn(body, env, CORS);
    } else if (formType === "request") {
      return handleBetaRequest(body, env, CORS);
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Unknown form type" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  },
};

/* ══════════════════════════════════════════════════════
   SIGN IN HANDLER
   Validates email format and logs the attempt.
   In production: replace with your auth provider check.
══════════════════════════════════════════════════════ */
async function handleSignIn(body, env, CORS) {
  const { email } = body;

  if (!email || !email.includes("@")) {
    return jsonResponse({ ok: false, error: "Valid email required" }, 400, CORS);
  }

  // Notify GP team of sign-in attempt (optional — remove if noisy)
  await sendEmail(env, {
    to:      ["cmills@equityworkflow.com", "dmcphedran@equityworkflow.com"],
    subject: `Sign-in attempt — ${email}`,
    html: emailTemplate("Sign-in attempt", `
      <p>A user attempted to sign in to the Equity Work Flow beta.</p>
      <table>
        <tr><td><strong>Email:</strong></td><td>${escHtml(email)}</td></tr>
        <tr><td><strong>Time:</strong></td><td>${new Date().toUTCString()}</td></tr>
      </table>
      <p>If this user should have access, invite them from your dashboard.</p>
    `),
  });

  // Optional: store in D1 if binding is configured
  if (env.DB) {
    await env.DB.prepare(
      "INSERT INTO signins (email, created_at) VALUES (?, ?)"
    ).bind(email, new Date().toISOString()).run().catch(() => {});
  }

  return jsonResponse({ ok: true, redirect: "https://app.equityworkflow.com" }, 200, CORS);
}

/* ══════════════════════════════════════════════════════
   BETA REQUEST HANDLER
   Captures and emails full submission, stores in D1.
══════════════════════════════════════════════════════ */
async function handleBetaRequest(body, env, CORS) {
  const { firstName, lastName, email, firm, role, dealSize } = body;

  // Validate required fields
  const missing = [];
  if (!firstName?.trim()) missing.push("First name");
  if (!email?.includes("@")) missing.push("Valid email");
  if (!firm?.trim())  missing.push("Firm name");
  if (!role?.trim())  missing.push("Role");
  if (missing.length) {
    return jsonResponse({ ok: false, error: `Missing: ${missing.join(", ")}` }, 400, CORS);
  }

  const fullName = `${firstName.trim()} ${lastName?.trim() || ""}`.trim();
  const ts       = new Date().toUTCString();

  // 1 ── Email the GP team with full submission details
  await sendEmail(env, {
    to:      ["cmills@equityworkflow.com", "dmcphedran@equityworkflow.com"],
    subject: `New beta request — ${fullName} · ${firm}`,
    html: emailTemplate("New beta access request", `
      <p>A new GP has requested beta access to Equity Work Flow.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f5f3ef;"><td style="padding:8px 12px;font-weight:600;width:140px;">Name</td><td style="padding:8px 12px;">${escHtml(fullName)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Email</td><td style="padding:8px 12px;"><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></td></tr>
        <tr style="background:#f5f3ef;"><td style="padding:8px 12px;font-weight:600;">Firm</td><td style="padding:8px 12px;">${escHtml(firm)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Role</td><td style="padding:8px 12px;">${escHtml(role)}</td></tr>
        <tr style="background:#f5f3ef;"><td style="padding:8px 12px;font-weight:600;">Deal size</td><td style="padding:8px 12px;">${escHtml(dealSize || "Not specified")}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Submitted</td><td style="padding:8px 12px;">${ts}</td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="mailto:${escHtml(email)}?subject=Your Equity Work Flow Beta Access" style="background:#0d1e3d;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Reply to ${escHtml(firstName)}</a>
      </p>
    `),
  });

  // 2 ── Confirmation email to the applicant
  await sendEmail(env, {
    to:      [email],
    subject: "Your Equity Work Flow beta request — we'll be in touch",
    html: emailTemplate("Thanks for your interest", `
      <p>Hi ${escHtml(firstName)},</p>
      <p>Thanks for requesting beta access to <strong>Equity Work Flow</strong>. We've received your application and will review it within <strong>1 business day</strong>.</p>
      <p>Here's a summary of what you submitted:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f5f3ef;"><td style="padding:8px 12px;font-weight:600;width:120px;">Firm</td><td style="padding:8px 12px;">${escHtml(firm)}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;">Role</td><td style="padding:8px 12px;">${escHtml(role)}</td></tr>
        <tr style="background:#f5f3ef;"><td style="padding:8px 12px;font-weight:600;">Deal size</td><td style="padding:8px 12px;">${escHtml(dealSize || "Not specified")}</td></tr>
      </table>
      <p>When we approve your access we'll send you credentials and a calendar link for your onboarding call with our team.</p>
      <p>If you have any questions in the meantime, just reply to this email.</p>
      <p style="margin-top:24px;">Best regards,<br><strong>The Equity Work Flow Team</strong><br><a href="https://equityworkflow.com">equityworkflow.com</a></p>
    `),
  });

  // 3 ── Store in D1 database (if configured)
  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO beta_requests (first_name, last_name, email, firm, role, deal_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      firstName.trim(), lastName?.trim() || "", email,
      firm.trim(), role.trim(), dealSize || "", new Date().toISOString()
    ).run().catch(console.error);
  }

  return jsonResponse({ ok: true }, 200, CORS);
}

/* ══════════════════════════════════════════════════════
   RESEND EMAIL HELPER
   Uses fetch directly — no SDK needed in Workers.
══════════════════════════════════════════════════════ */
async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    env.FROM_EMAIL || "Equity Work Flow <noreply@equityworkflow.com>",
      to:      to,
      subject: subject,
      html:    html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error ${res.status}:`, err);
  }
  return res;
}

/* ══════════════════════════════════════════════════════
   EMAIL TEMPLATE — branded HTML email wrapper
══════════════════════════════════════════════════════ */
function emailTemplate(heading, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#faf9f7;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,25,22,.1);">
        <!-- Header -->
        <tr>
          <td style="background:#0d1e3d;padding:28px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <table cellpadding="0" cellspacing="0" style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.25);border-radius:6px;width:36px;height:36px;">
                    <tr><td align="center" valign="middle" style="font-family:monospace;font-size:16px;font-weight:700;color:#c9a84c;">E</td></tr>
                  </table>
                </td>
                <td>
                  <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:2px;">EQUITY</div>
                  <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#c9a84c;margin-top:2px;">WORK · FLOW</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Heading band -->
        <tr>
          <td style="background:#162d55;padding:18px 32px;">
            <div style="font-family:Georgia,serif;font-size:20px;font-weight:500;color:#ffffff;">${escHtml(heading)}</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;font-size:14px;line-height:1.7;color:#3d3b35;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f5f3ef;padding:20px 32px;border-top:1px solid rgba(26,25,22,.09);">
            <div style="font-size:11px;color:#9e9a91;line-height:1.6;">
              Equity Work Flow · equityworkflow.com<br>
              You're receiving this because of an action on our website.
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ─── Utilities ────────────────────────────────────── */
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
