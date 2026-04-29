/**
 * Equity Work Flow — Email Template Module
 * Reusable email template and sendEmail helper for Cloudflare Workers/Pages.
 */

export function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailTemplate(heading, bodyHtml) {
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
                  <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#c9a84c;margin-top:2px;">WORK &middot; FLOW</div>
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
              Equity Work Flow &middot; equityworkflow.com<br>
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

export async function sendEmail(env, { to, subject, html }) {
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
