import crypto from "node:crypto";
import { PACKING_FEE, MIN_ORDER_AMOUNT, MAX_ORDER_AMOUNT, variantKey, variantLabel, formatPrice, isItemOut } from "../src/data/products.js";
import { isValidName, isValidAuPhone, isValidEmail } from "../src/lib/validate.js";
import { hasMailServer } from "../src/lib/emailDomain.js";
import { STORE, SITE_URL } from "../src/lib/store.js";
import { sql } from "../src/lib/db.js";
import { getOpenStatus } from "../src/lib/hours.js";
import { applyOrderingOverride } from "../src/lib/orderingOverride.js";
import { findVariant, isSquareConfigured, squareClient, PENDING_STATUS, isOrderingEnabled } from "../src/lib/checkout.js";

/* =========================
   Starts a Square-hosted checkout.

   The customer never enters card details on our site: this builds the order
   (prices always recomputed from the real catalog, never taken from the
   client), asks Square for a payment link for it, saves the order as
   'pending_payment', and returns the link for the browser to redirect to.
   Square's page handles card / Apple Pay / Google Pay.

   The order only becomes real (staff board + receipt) once
   confirmOrderPayment() has verified with Square that it was paid — via the
   return page (api/confirm-order.js) or Square's webhook
   (api/square-webhook.js), whichever gets there first.
========================= */

// The server runs in whatever timezone Vercel schedules it in (usually UTC),
// not Queensland's — so "now" has to be converted to Brisbane wall-clock
// time before checking it against the store's opening hours.
function nowInBrisbane() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Brisbane" }));
}

// Unambiguous characters only (no 0/O, 1/I/L) — staff read these aloud.
const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function makeOrderNumber() {
  const bytes = crypto.randomBytes(6);
  return `HCS-${Array.from(bytes, (b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]).join("")}`;
}

// Where Square sends the customer back to. Production always uses the real
// domain (never a client-supplied Host header); local dev and Vercel previews
// use whatever host they're actually running on.
function siteOrigin(req) {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  // Ordering not live yet → refuse before touching the cart, Square or the DB,
  // even if someone calls this endpoint directly.
  if (!isOrderingEnabled()) {
    return res.status(403).json({ error: "Online ordering isn't open yet. Please visit us in store." });
  }

  const { items, name, phone, email, pickupLabel, note } = req.body || {};

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
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: "Your cart is empty." });
  }
  const safePickup = typeof pickupLabel === "string" ? pickupLabel.slice(0, 80) : null;
  const safeNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null;

  const orderingModeRows = await sql`SELECT value FROM settings WHERE key = 'ordering_mode'`;
  const orderingMode = orderingModeRows[0]?.value || "auto";
  const openStatus = applyOrderingOverride(getOpenStatus(nowInBrisbane()), orderingMode);
  if (!openStatus.isOpen) {
    return res.status(400).json({ error: `${openStatus.label} — online ordering isn't available right now.` });
  }

  const outOfStockRows = await sql`SELECT item_key FROM stock_overrides WHERE out_of_stock = true`;
  const outOfStock = new Set(outOfStockRows.map((r) => r.item_key));

  let subtotal = 0;
  const lineItems = [];
  const storedItems = [];
  for (const line of items) {
    const { productId, size, flavour, qty } = line || {};
    if (typeof productId !== "string" || typeof size !== "string" || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ error: "Invalid item in cart." });
    }
    const match = findVariant(productId, size, typeof flavour === "string" ? flavour : null);
    if (!match) {
      return res.status(400).json({ error: "An item in your cart is no longer available." });
    }
    const label = variantLabel(match.product, size, match.flavour);
    if (isItemOut(outOfStock, productId, size, match.flavour)) {
      return res.status(400).json({ error: `${label} just went out of stock. Please remove it and try again.` });
    }
    subtotal += match.price * qty;
    lineItems.push({
      name: label,
      quantity: String(qty),
      basePriceMoney: { amount: BigInt(Math.round(match.price * 100)), currency: "AUD" },
    });
    storedItems.push({
      key: variantKey(productId, size, match.flavour),
      product: { id: match.product.id, name: match.product.name, category: match.product.category },
      size,
      flavour: match.flavour,
      qty,
      label,
      unitPrice: match.price,
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  if (subtotal < MIN_ORDER_AMOUNT) {
    return res.status(400).json({ error: `The minimum order is ${formatPrice(MIN_ORDER_AMOUNT)} (before the packing fee).` });
  }
  if (subtotal > MAX_ORDER_AMOUNT) {
    return res.status(400).json({ error: `Online orders are limited to ${formatPrice(MAX_ORDER_AMOUNT)} (before the packing fee). For bigger orders, please call us on ${STORE.phoneDisplay}.` });
  }
  const total = Math.round((subtotal + PACKING_FEE) * 100) / 100;

  if (!isSquareConfigured()) {
    console.error("Checkout error: server is missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID.");
    return res.status(500).json({ error: "Payments aren't configured yet. Try again later or call the store." });
  }

  const orderNumber = makeOrderNumber();
  const checkoutToken = crypto.randomUUID();

  let paymentLink;
  try {
    const response = await squareClient().checkout.paymentLinks.create({
      idempotencyKey: checkoutToken,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        referenceId: orderNumber,
        lineItems,
        serviceCharges: [{
          name: "Packing Fee",
          amountMoney: { amount: BigInt(Math.round(PACKING_FEE * 100)), currency: "AUD" },
          calculationPhase: "TOTAL_PHASE",
        }],
      },
      checkoutOptions: {
        redirectUrl: `${siteOrigin(req)}/order?paid=${checkoutToken}`,
        askForShippingAddress: false,
        allowTipping: false,
        acceptedPaymentMethods: { applePay: true, googlePay: true },
      },
      prePopulatedData: { buyerEmail: email.trim() },
      paymentNote: `${STORE.name} — Click & Collect ${orderNumber} (${name.trim()})`,
    });
    paymentLink = response.paymentLink;
  } catch (err) {
    console.error("Square payment link error:", err);
    return res.status(502).json({ error: "Couldn't start the payment with Square. Please try again." });
  }

  if (!paymentLink?.url || !paymentLink.orderId) {
    console.error("Square payment link error: response missing url or orderId.", paymentLink);
    return res.status(502).json({ error: "Couldn't start the payment with Square. Please try again." });
  }

  try {
    // Order row + its first history entry in one statement, so they can't diverge.
    await sql`
      WITH o AS (
        INSERT INTO orders (order_number, name, phone, email, note, pickup_label, items, subtotal, packing_fee, total, status, square_order_id, checkout_token, payment_link_id)
        VALUES (${orderNumber}, ${name.trim()}, ${phone.trim()}, ${email.trim()}, ${safeNote}, ${safePickup}, ${JSON.stringify(storedItems)},
                ${subtotal}, ${PACKING_FEE}, ${total}, ${PENDING_STATUS}, ${paymentLink.orderId}, ${checkoutToken}, ${paymentLink.id ?? null})
        RETURNING order_number, status
      )
      INSERT INTO order_events (order_number, status, source)
      SELECT order_number, status, 'checkout' FROM o
    `;
  } catch (err) {
    // Without this row a payment couldn't be matched back to an order, so
    // never send the customer to pay if it didn't save.
    console.error("Pending order save error:", err);
    return res.status(500).json({ error: "Couldn't save your order. Please try again." });
  }

  return res.status(200).json({ url: paymentLink.url, orderNumber });
}
