/**
 * Equity Work Flow — Form Submission API (Cloudflare Pages Function)
 * Route: POST /api/submit
 *
 * Binds: env.DB (D1), env.RESEND_API_KEY, env.FROM_EMAIL
 */

import { emailTemplate, sendEmail, escHtml } from "../../packages/email-templates/index.js";

const CORS = {
  "Access-Control-Allow-Origin":  "https://equityworkflow.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, CORS);
  }

  const { formType } = body;

  if (formType === "signin") {
    return handleSignIn(body, env, waitUntil, CORS);
  } else if (formType === "request") {
    return handleBetaRequest(body, env, waitUntil, CORS);
  } else {
    return jsonResponse({ ok: false, error: "Unknown form type" }, 400, CORS);
  }
}

async function handleSignIn(body, env, waitUntil, CORS) {
  const { email } = body;

  if (!email || !email.includes("@")) {
    return jsonResponse({ ok: false, error: "Valid email required" }, 400, CORS);
  }

  waitUntil(sendEmail(env, {
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
  }));

  if (env.DB) {
    waitUntil(
      env.DB.prepare(
        "INSERT INTO signins (email, created_at) VALUES (?, ?)"
      ).bind(email, new Date().toISOString()).run().catch(() => {})
    );
  }

  return jsonResponse({ ok: true, redirect: "https://app.equityworkflow.com" }, 200, CORS);
}

async function handleBetaRequest(body, env, waitUntil, CORS) {
  const { firstName, lastName, email, firm, role, dealSize } = body;

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

  waitUntil(sendEmail(env, {
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
  }));

  waitUntil(sendEmail(env, {
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
  }));

  if (env.DB) {
    waitUntil(
      env.DB.prepare(`
        INSERT INTO beta_requests (first_name, last_name, email, firm, role, deal_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        firstName.trim(), lastName?.trim() || "", email,
        firm.trim(), role.trim(), dealSize || "", new Date().toISOString()
      ).run().catch(console.error)
    );
  }

  return jsonResponse({ ok: true }, 200, CORS);
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
