import { Resend } from "resend";
import { STORE, SITE_URL } from "../src/lib/store.js";
import { EMAIL_FONT, escapeHtml } from "../src/lib/email.js";
import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";

/* =========================
   Sent when staff mark an order "ready" on the staff board. The client
   only sends the order number — name and email are looked up here from
   the orders table rather than trusted from the client.
========================= */

function readyHtml({ orderNumber, name }) {
  const safeName = escapeHtml(name);
  const font = EMAIL_FONT;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="format-detection" content="telephone=no, address=no, email=no, date=no" />
    <title>Your order ${orderNumber} is ready</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background-color:#f6f0e6;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${orderNumber} is ready for pickup at ${STORE.name}.</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f0e6;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#fbf6ee;border:1px solid #e7e5e4;border-radius:12px;">
            <tr>
              <td style="padding:40px 40px 0;">
                <p style="margin:0;font-family:${font};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#78716c;">Click &amp; Collect receipt</p>
                <h1 style="margin:8px 0 0;font-family:${font};font-size:25px;line-height:1.25;color:#1c1917;font-weight:800;letter-spacing:-0.01em;">${STORE.name}</h1>
                <p style="margin:6px 0 0;font-family:${font};font-size:13px;color:#78716c;">${STORE.suburb} &nbsp;·&nbsp; ${STORE.phoneDisplay}</p>
              </td>
            </tr>

            <tr><td style="padding:24px 40px 0;"><div style="border-top:1px solid #e7e5e4;"></div></td></tr>

            <tr>
              <td style="padding:24px 40px 0;font-family:${font};">
                <p style="margin:0 0 4px;font-size:14px;color:#1c1917;">Hi ${safeName}, your order's ready.</p>
                <p style="margin:0;font-size:13px;color:#57534e;">Order <strong style="color:#1c1917;">${orderNumber}</strong> is ready for pickup at the counter — just give us your name.</p>
              </td>
            </tr>

            <tr><td style="padding:28px 40px 0;"><div style="border-top:1px solid #e7e5e4;"></div></td></tr>

            <tr>
              <td style="padding:20px 40px 0;font-family:${font};">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">
                  <a href="${SITE_URL}/order" style="color:#1c1917;font-weight:600;text-decoration:underline;text-decoration-color:#d6d3d1;">Order again →</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 40px 40px;">
                <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#a8a29e;">This is a demo notification from a Click &amp; Collect test build — Square sandbox, no real card was charged.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!isStaffAuthorized(req)) {
    return res.status(401).json({ error: "Staff login required." });
  }

  const { orderNumber } = req.body || {};

  if (!orderNumber || typeof orderNumber !== "string" || orderNumber.length > 40) {
    return res.status(400).json({ error: "Missing or invalid order reference." });
  }

  const rows = await sql`SELECT name, email FROM orders WHERE order_number = ${orderNumber} AND status <> 'pending_payment'`;
  const order = rows[0];
  if (!order) {
    return res.status(404).json({ error: "Order not found." });
  }
  if (!order.email) {
    return res.status(200).json({ success: true, emailSent: false });
  }
  const { name, email } = order;

  if (!process.env.RESEND_API_KEY) {
    console.warn("Ready email skipped: RESEND_API_KEY is not configured.");
    return res.status(200).json({ success: true, emailSent: false });
  }

  let emailSent = false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Hawthorne Corner Store <onboarding@resend.dev>",
      to: [email],
      subject: `Order ${orderNumber} is ready for pickup — ${STORE.name}`,
      html: readyHtml({ orderNumber, name }),
    });
    if (error) {
      console.error("Ready email error:", error);
    } else {
      emailSent = true;
    }
  } catch (err) {
    console.error("Ready email error:", err);
  }

  return res.status(200).json({ success: true, emailSent });
}
