import { WebhooksHelper } from "square";
import { sql } from "../src/lib/db.js";
import { confirmOrderPayment } from "../src/lib/checkout.js";

/* =========================
   Square webhook (payment.created / payment.updated).

   Backstop for customers who pay on Square's page but close the tab before
   being redirected back — without this their paid order would never reach
   the staff board. Confirmation still goes through confirmOrderPayment(),
   which re-checks the payment with Square rather than trusting this body.

   Setup (Square Developer Dashboard → Webhooks → Subscriptions):
     URL:    https://www.hawthornecornerstore.com.au/api/square-webhook
     Events: payment.created, payment.updated
   then set SQUARE_WEBHOOK_SIGNATURE_KEY (from that subscription) and
   SQUARE_WEBHOOK_URL (the exact URL above) in Vercel's env vars.

   Can't be reached on localhost — locally the return page does the job.
========================= */

// Signature verification needs the exact raw bytes Square sent, so Vercel's
// JSON body parser is switched off for this function.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL;
  if (!signatureKey || !notificationUrl) {
    console.error("Square webhook error: SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_URL is not configured.");
    return res.status(500).json({ error: "Webhook not configured." });
  }

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers["x-square-hmacsha256-signature"];
  const valid = typeof signatureHeader === "string" && await WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey,
    notificationUrl,
  });
  if (!valid) {
    return res.status(403).json({ error: "Invalid signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON." });
  }

  const payment = event?.data?.object?.payment;
  if (!["payment.created", "payment.updated"].includes(event?.type) || payment?.status !== "COMPLETED" || !payment.order_id) {
    return res.status(200).json({ ignored: true });
  }

  const rows = await sql`SELECT * FROM orders WHERE square_order_id = ${payment.order_id}`;
  if (rows.length === 0) {
    // Not one of ours (e.g. an in-store Square sale) — nothing to do.
    return res.status(200).json({ ignored: true });
  }

  try {
    const { paid } = await confirmOrderPayment(rows[0], "square_webhook");
    return res.status(200).json({ confirmed: paid });
  } catch (err) {
    // Non-2xx makes Square retry later, which is what we want here.
    console.error("Square webhook confirm error:", err);
    return res.status(500).json({ error: "Confirm failed." });
  }
}
