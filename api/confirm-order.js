import { sql } from "../src/lib/db.js";
import { confirmOrderPayment, toPublicOrder } from "../src/lib/checkout.js";

/* =========================
   Called by the "thanks" page after Square redirects the customer back.
   The token in the URL only identifies which order to look at — whether it
   was actually paid is always checked with Square (confirmOrderPayment), so
   visiting the return URL without paying never confirms anything.

   Returns { status: "paid", order } or { status: "pending" } (payment not
   seen yet — the page retries briefly, since Square can take a moment).
========================= */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { token } = req.body || {};
  if (typeof token !== "string" || !UUID_RE.test(token)) {
    return res.status(400).json({ error: "Invalid order link." });
  }

  const rows = await sql`SELECT * FROM orders WHERE checkout_token = ${token}`;
  if (rows.length === 0) {
    return res.status(404).json({ error: "We couldn't find that order." });
  }

  try {
    const { row, paid } = await confirmOrderPayment(rows[0]);
    if (!paid) return res.status(200).json({ status: "pending" });
    return res.status(200).json({ status: "paid", order: toPublicOrder(row) });
  } catch (err) {
    console.error("Confirm order error:", err);
    return res.status(502).json({ error: "Couldn't check your payment with Square. Please refresh in a moment." });
  }
}
