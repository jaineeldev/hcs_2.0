import { SquareClient, SquareEnvironment } from "square";
import { Resend } from "resend";
import { PRODUCTS, PACKING_FEE, MIN_ORDER_AMOUNT, variantKey, variantLabel, formatPrice } from "../src/data/products.js";
import { isValidName, isValidAuPhone, isValidEmail } from "../src/lib/validate.js";
import { hasMailServer } from "../src/lib/emailDomain.js";
import { STORE, SITE_URL } from "../src/lib/store.js";
import { EMAIL_FONT, escapeHtml } from "../src/lib/email.js";
import { sql } from "../src/lib/db.js";
import { getOpenStatus } from "../src/lib/hours.js";
import { applyOrderingOverride } from "../src/lib/orderingOverride.js";

// The server runs in whatever timezone Vercel schedules it in (usually UTC),
// not Queensland's — so "now" has to be converted to Brisbane wall-clock
// time before checking it against the store's opening hours.
function nowInBrisbane() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Brisbane" }));
}

/* =========================
   Charges a card via Square and returns a server-computed total.
   The client sends cart line items (product/size/qty), never a dollar
   amount — prices are always looked up here against the real catalog,
   so a tampered client-side total can never change what gets charged.

   Uses the Orders API (not just Payments) so the flat packing fee is its
   own named service charge on the real Square order/receipt, matching what
   the customer saw at checkout, rather than being silently folded into one
   lump sum.

   Email receipt is sent after payment succeeds, and its failure never fails
   the request — the payment is the critical path, the email is a bonus.
========================= */

function findVariant(productId, size) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;
  const sizeEntry = product.sizes.find((s) => s.label === size);
  if (!sizeEntry) return null;
  return { product, price: sizeEntry.price };
}

function receiptHtml({ orderNumber, lines, subtotal, packingFee, total, name, pickupLabel, note }) {
  const safeName = escapeHtml(name);
  const safePickup = escapeHtml(pickupLabel);
  const safeNote = note ? escapeHtml(note) : "";

  const font = EMAIL_FONT;

  const rows = lines.map((l) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;font-size:14px;line-height:1.4;color:#1c1917;font-family:${font};">
                  <span style="color:#a8a29e;">${l.qty}×</span> ${escapeHtml(l.name)}
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;font-size:14px;line-height:1.4;color:#1c1917;font-family:${font};text-align:right;white-space:nowrap;">
                  ${formatPrice(l.amount)}
                </td>
              </tr>`).join("");

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

            <tr>
              <td style="padding:24px 40px 40px;">
                <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#a8a29e;">This is a demo receipt from a Click &amp; Collect test build — Square sandbox, no real card was charged.</p>
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

  const { sourceId, idempotencyKey, items, name, phone, email, pickupLabel, note } = req.body || {};

  if (!sourceId || typeof sourceId !== "string") {
    return res.status(400).json({ error: "Missing payment details." });
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 40) {
    return res.status(400).json({ error: "Missing or invalid order reference." });
  }
  if (!isValidName(name || "")) {
    return res.status(400).json({ error: "Enter a valid name." });
  }
  if (!isValidAuPhone(phone || "")) {
    return res.status(400).json({ error: "Enter a valid Australian phone number." });
  }
  if (!isValidEmail(email || "")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!(await hasMailServer(email))) {
    return res.status(400).json({ error: "That email address doesn't look like it can receive mail — please double-check it." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  const orderingModeRows = await sql`SELECT value FROM settings WHERE key = 'ordering_mode'`;
  const orderingMode = orderingModeRows[0]?.value || "auto";
  const openStatus = applyOrderingOverride(getOpenStatus(nowInBrisbane()), orderingMode);
  if (!openStatus.isOpen) {
    return res.status(400).json({ error: `${openStatus.label} — online ordering isn't available right now.` });
  }

  const outOfStockRows = await sql`SELECT product_id FROM stock_overrides WHERE out_of_stock = true`;
  const outOfStockIds = new Set(outOfStockRows.map((r) => r.product_id));

  let subtotal = 0;
  const lineItems = [];
  const receiptLines = [];
  const staffItems = [];
  for (const line of items) {
    const { productId, size, flavour, qty } = line || {};
    if (typeof productId !== "string" || typeof size !== "string" || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ error: "Invalid item in cart." });
    }
    if (outOfStockIds.has(productId)) {
      return res.status(400).json({ error: "An item in your cart just went out of stock. Please remove it and try again." });
    }
    const match = findVariant(productId, size);
    if (!match) {
      return res.status(400).json({ error: "An item in your cart is no longer available." });
    }
    const safeFlavour = typeof flavour === "string" ? flavour : null;
    const label = variantLabel(match.product, size, safeFlavour);
    subtotal += match.price * qty;
    lineItems.push({
      name: label,
      quantity: String(qty),
      basePriceMoney: { amount: BigInt(Math.round(match.price * 100)), currency: "AUD" },
    });
    receiptLines.push({ name: label, qty, amount: match.price * qty });
    staffItems.push({ key: variantKey(productId, size, safeFlavour), product: match.product, size, flavour: safeFlavour, qty });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  if (subtotal < MIN_ORDER_AMOUNT) {
    return res.status(400).json({ error: `The minimum order is ${formatPrice(MIN_ORDER_AMOUNT)} (before the packing fee).` });
  }

  const packingFeeCents = Math.round(PACKING_FEE * 100);
  const total = Math.round((subtotal + PACKING_FEE) * 100) / 100;

  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error("Square payment error: server is missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID.");
    return res.status(500).json({ error: "Payments aren't configured yet. Try again later or call the store." });
  }

  const client = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENV === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  const locationId = process.env.SQUARE_LOCATION_ID;

  let payment;
  try {
    const orderResponse = await client.orders.create({
      idempotencyKey: `${idempotencyKey}-order`,
      order: {
        locationId,
        referenceId: idempotencyKey,
        lineItems,
        serviceCharges: [{
          name: "Packing Fee",
          amountMoney: { amount: BigInt(packingFeeCents), currency: "AUD" },
          calculationPhase: "TOTAL_PHASE",
        }],
      },
    });

    const order = orderResponse.order;
    const dueAmount = order?.totalMoney?.amount ?? BigInt(Math.round(total * 100));

    const paymentResponse = await client.payments.create({
      sourceId,
      idempotencyKey: `${idempotencyKey}-payment`,
      amountMoney: { amount: dueAmount, currency: "AUD" },
      orderId: order?.id,
      locationId,
      buyerEmailAddress: email,
      note: `${STORE.name} — Click & Collect (${name})`,
    });

    payment = paymentResponse.payment;
  } catch (err) {
    console.error("Square payment error:", err);
    const detail = err?.errors?.[0]?.detail || err?.message || "The payment could not be processed.";
    return res.status(402).json({ success: false, error: detail });
  }

  // Payment succeeded — everything from here on is best-effort. The
  // response is final regardless of what happens with the staff-board
  // insert or the email; both failures are only ever logged.
  try {
    await sql`
      INSERT INTO orders (order_number, name, phone, email, note, pickup_label, items, subtotal, packing_fee, total, payment_id, status)
      VALUES (${idempotencyKey}, ${name}, ${phone}, ${email}, ${note || null}, ${pickupLabel || null}, ${JSON.stringify(staffItems)}, ${subtotal}, ${PACKING_FEE}, ${total}, ${payment?.id ?? null}, 'new')
    `;
  } catch (err) {
    console.error("Order save error:", err);
  }

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Hawthorne Corner Store <onboarding@resend.dev>",
        to: [email],
        subject: `Your order ${idempotencyKey} — ${STORE.name}`,
        html: receiptHtml({
          orderNumber: idempotencyKey,
          lines: receiptLines,
          subtotal,
          packingFee: PACKING_FEE,
          total,
          name,
          pickupLabel: pickupLabel || "—",
          note,
        }),
      });
      if (error) {
        console.error("Receipt email error:", error);
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.error("Receipt email error:", err);
    }
  } else {
    console.warn("Receipt email skipped: RESEND_API_KEY is not configured.");
  }

  if (emailSent) {
    try {
      await sql`UPDATE orders SET email_sent = true WHERE order_number = ${idempotencyKey}`;
    } catch (err) {
      console.error("Order email_sent update error:", err);
    }
  }

  return res.status(200).json({
    success: true,
    paymentId: payment?.id ?? null,
    status: payment?.status ?? null,
    subtotal,
    packingFee: PACKING_FEE,
    total,
    emailSent,
  });
}
