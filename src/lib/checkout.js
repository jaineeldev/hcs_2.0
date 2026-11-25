// SERVER-ONLY. Shared by api/create-checkout.js, api/confirm-order.js and
// api/square-webhook.js. Never import this from client code: it uses the
// Square access token and the Resend API key.
import { SquareClient, SquareEnvironment } from "square";
import { Resend } from "resend";
import { PRODUCTS, formatPrice, flavoursFor, priceFor } from "../data/products.js";
import { STORE, SITE_URL } from "./store.js";
import { EMAIL_FONT, escapeHtml } from "./email.js";
import { sql } from "./db.js";

export const PENDING_STATUS = "pending_payment";

export function isSquareConfigured() {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

// Server-side switch for the whole Click & Collect checkout. The same env var
// hides /order in the browser (store.js ORDERING_ENABLED), but the page is
// only UX — this is what actually stops orders when ordering isn't live.
// Defaults to OFF: unset or anything but "true" = no new checkouts.
export function isOrderingEnabled() {
  return process.env.VITE_ORDERING_ENABLED === "true";
}

export function isSandbox() {
  return process.env.SQUARE_ENV !== "production";
}

export function squareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment: isSandbox() ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
  });
}

/* Looks a cart line up against the real catalog. Returns null for anything
   that isn't an exact product/size (and, where the product has flavours, an
   exact flavour), so a tampered cart can't invent items or prices. */
export function findVariant(productId, size, flavour) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;
  const hasFlavours = Boolean(flavoursFor(product, size));
  const price = priceFor(product, size, hasFlavours ? flavour : null);
  if (price == null) return null;
  return { product, price, flavour: hasFlavours ? flavour : null };
}

const toCents = (dollars) => BigInt(Math.round(Number(dollars) * 100));

/* =========================
   Payment verification
   The only thing that ever moves an order from pending_payment to 'new'.
   It never trusts the browser (the return URL can be typed by anyone) or the
   webhook body alone: it asks Square directly whether this exact order, at
   this store, for this exact total, has completed payment(s) covering it.
   source = who's asking, recorded in order_events: "square_return",
   "square_webhook" or "cleanup".
========================= */
export async function confirmOrderPayment(row, source = "square_return") {
  if (row.status !== PENDING_STATUS) return { row, paid: true };
  if (!row.square_order_id || !isSquareConfigured()) return { row, paid: false };

  const client = squareClient();
  const { order } = await client.orders.get({ orderId: row.square_order_id });

  if (
    !order ||
    order.state === "CANCELED" ||
    order.locationId !== process.env.SQUARE_LOCATION_ID ||
    order.referenceId !== row.order_number
  ) {
    return { row, paid: false };
  }

  const expected = toCents(row.total);
  if (order.totalMoney?.amount !== expected) {
    console.error(`Order ${row.order_number}: Square total ${order.totalMoney?.amount} does not match expected ${expected}.`);
    return { row, paid: false };
  }

  let paidCents = 0n;
  let paymentId = null;
  for (const tender of order.tenders || []) {
    if (!tender.paymentId) continue;
    const { payment } = await client.payments.get({ paymentId: tender.paymentId });
    if (payment?.status === "COMPLETED" && payment.orderId === order.id) {
      paidCents += payment.amountMoney?.amount ?? 0n;
      paymentId ||= payment.id;
    }
  }
  if (paidCents < expected) return { row, paid: false };

  // Atomic flip: only one caller (return page, webhook or cleanup) ever wins
  // this, so the receipt email — and the "new" history entry — happen once.
  const updated = await sql`
    WITH u AS (
      UPDATE orders
      SET status = 'new', payment_id = ${paymentId}, received_at = now()
      WHERE order_number = ${row.order_number} AND status = ${PENDING_STATUS}
      RETURNING *
    ), e AS (
      INSERT INTO order_events (order_number, status, source)
      SELECT order_number, status, ${source} FROM u
    )
    SELECT * FROM u
  `;
  if (updated.length === 0) {
    const [current] = await sql`SELECT * FROM orders WHERE order_number = ${row.order_number}`;
    return { row: current || row, paid: true };
  }

  const confirmed = updated[0];
  if (await sendReceiptEmail(confirmed)) {
    await sql`UPDATE orders SET email_sent = true WHERE order_number = ${confirmed.order_number}`.catch((err) =>
      console.error("Order email_sent update error:", err),
    );
    confirmed.email_sent = true;
  }
  return { row: confirmed, paid: true };
}

/* =========================
   Abandoned-checkout cleanup (run daily by api/cleanup-checkouts.js).
   A pending_payment order older than `olderThanDays` holds a customer's name,
   phone and email for an order that was never paid. For each one:
     1. ask Square whether it was actually paid — if so, rescue it ('new',
        receipt sent) instead of deleting it;
     2. switch off its Square payment link, so it can't be paid later for an
        order that no longer exists;
     3. only then delete the row (its order_events go with it).
   Any Square error leaves that row for the next run rather than guessing.
========================= */
export async function cleanupAbandonedCheckouts({ olderThanDays = 7 } = {}) {
  const stale = await sql`
    SELECT * FROM orders
    WHERE status = ${PENDING_STATUS}
      AND received_at < now() - make_interval(days => ${olderThanDays})
  `;
  const result = { checked: stale.length, rescued: [], deleted: [], skipped: [] };
  if (stale.length === 0) return result;
  if (!isSquareConfigured()) {
    result.skipped = stale.map((r) => r.order_number);
    return result;
  }

  const client = squareClient();
  for (const row of stale) {
    try {
      const { paid } = await confirmOrderPayment(row, "cleanup");
      if (paid) {
        result.rescued.push(row.order_number);
        continue;
      }
      if (row.payment_link_id) {
        try {
          await client.checkout.paymentLinks.delete({ id: row.payment_link_id });
        } catch (err) {
          if (err?.statusCode !== 404) throw err; // 404 = link already gone, fine
        }
      }
      const deleted = await sql`
        DELETE FROM orders WHERE order_number = ${row.order_number} AND status = ${PENDING_STATUS}
        RETURNING order_number
      `;
      if (deleted.length) result.deleted.push(row.order_number);
    } catch (err) {
      console.error(`Cleanup skipped ${row.order_number}:`, err);
      result.skipped.push(row.order_number);
    }
  }
  return result;
}

/* Public, customer-facing view of an order: what the "thanks" page shows. */
export function toPublicOrder(row) {
  return {
    orderNumber: row.order_number,
    items: (row.items || []).map((i) => ({ label: i.label, qty: i.qty, amount: Number(i.unitPrice) * i.qty })),
    subtotal: Number(row.subtotal),
    packingFee: Number(row.packing_fee),
    total: Number(row.total),
    name: row.name,
    phone: row.phone,
    email: row.email,
    note: row.note,
    pickupLabel: row.pickup_label,
    emailSent: row.email_sent,
    paymentId: row.payment_id,
  };
}

/* =========================
   Receipt email (best-effort: a failure is logged, never fails the order)
========================= */
async function sendReceiptEmail(row) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("Receipt email skipped: RESEND_API_KEY is not configured.");
    return false;
  }
  if (!row.email) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Hawthorne Corner Store <onboarding@resend.dev>",
      to: [row.email],
      subject: `Your order ${row.order_number} — ${STORE.name}`,
      html: receiptHtml(toPublicOrder(row)),
    });
    if (error) {
      console.error("Receipt email error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Receipt email error:", err);
    return false;
  }
}

function receiptHtml({ orderNumber, items, subtotal, packingFee, total, name, pickupLabel, note }) {
  const safeName = escapeHtml(name);
  const safePickup = escapeHtml(pickupLabel || "—");
  const safeNote = note ? escapeHtml(note) : "";
  const font = EMAIL_FONT;

  const rows = items.map((l) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;font-size:14px;line-height:1.4;color:#1c1917;font-family:${font};">
                  <span style="color:#a8a29e;">${l.qty}×</span> ${escapeHtml(l.label)}
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;font-size:14px;line-height:1.4;color:#1c1917;font-family:${font};text-align:right;white-space:nowrap;">
                  ${formatPrice(l.amount)}
                </td>
              </tr>`).join("");

  const sandboxNote = isSandbox()
    ? `
            <tr>
              <td style="padding:24px 40px 0;">
                <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#a8a29e;">This is a demo receipt from a Click &amp; Collect test build — Square sandbox, no real card was charged.</p>
              </td>
            </tr>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="format-detection" content="telephone=no, address=no, email=no, date=no" />
    <title>Your order ${orderNumber}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background-color:#f6f0e6;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${orderNumber} confirmed — ${formatPrice(total)} total, ready for pickup ${safePickup}.</span>
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
                <p style="margin:0 0 4px;font-size:14px;color:#1c1917;">Hi ${safeName}, thanks for your order.</p>
                <p style="margin:0;font-size:13px;color:#57534e;">Order <strong style="color:#1c1917;">${orderNumber}</strong> &nbsp;·&nbsp; Pickup ${safePickup}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 40px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${rows}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${font};">
                  <tr>
                    <td style="padding:10px 0 2px;font-size:13px;color:#57534e;">Subtotal</td>
                    <td style="padding:10px 0 2px;font-size:13px;color:#57534e;text-align:right;">${formatPrice(subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:2px 0;font-size:13px;color:#57534e;">Packing fee</td>
                    <td style="padding:2px 0;font-size:13px;color:#57534e;text-align:right;">${formatPrice(packingFee)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;border-top:1px solid #1c1917;font-size:15px;font-weight:700;color:#1c1917;">Total</td>
                    <td style="padding:12px 0 0;border-top:1px solid #1c1917;font-size:15px;font-weight:700;color:#1c1917;text-align:right;">${formatPrice(total)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            ${safeNote ? `
            <tr>
              <td style="padding:16px 40px 0;">
                <p style="margin:0;font-family:${font};font-size:13px;color:#57534e;font-style:italic;">Note: ${safeNote}</p>
              </td>
            </tr>` : ""}

            <tr><td style="padding:28px 40px 0;"><div style="border-top:1px solid #e7e5e4;"></div></td></tr>

            <tr>
              <td style="padding:20px 40px 0;font-family:${font};">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">
                  Ready for collection at the counter — just give us your name.
                  &nbsp;<a href="${SITE_URL}/order" style="color:#1c1917;font-weight:600;text-decoration:underline;text-decoration-color:#d6d3d1;">Order again →</a>
                </p>
              </td>
            </tr>
            ${sandboxNote}
            <tr><td style="padding:0 0 40px;"></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
