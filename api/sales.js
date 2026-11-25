import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";
import { variantLabel, PRODUCTS } from "../src/data/products.js";

/* =========================
   Staff sales report / order history (staff only).
   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD   (inclusive, Brisbane calendar days)
   → { from, to, totals, days, items, orders }

   Paid orders only (anything past pending_payment), dated by when payment was
   verified (received_at). Line prices are the ones saved with the order —
   what the customer actually paid — never today's catalog prices:
     - orders since 2026-11-24 store unitPrice on every line;
     - older orders store a snapshot of the product (incl. that day's size
       prices), which is used instead.
   Each order's lines are checked to add up to its stored subtotal; if they
   don't, the order is flagged (priceCheck: false) rather than guessed.
========================= */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
const cents = (n) => Math.round(Number(n) * 100);

function normaliseLine(line) {
  const product = line.product || {};
  const unitPrice = line.unitPrice != null
    ? Number(line.unitPrice)
    : product.sizes?.find((s) => s.label === line.size)?.price ?? null;
  return {
    label: line.label || variantLabel({ name: product.name || product.id || "Unknown item" }, line.size, line.flavour),
    productId: product.id || null,
    productName: product.name || product.id || "Unknown item",
    // Category from the order's own snapshot; older lines without one fall
    // back to the product's current catalog category (a grouping, not a price).
    category: product.category || PRODUCTS.find((p) => p.id === product.id)?.category || "Other",
    size: line.size,
    flavour: line.flavour || null,
    qty: line.qty,
    unitPrice,
    amount: unitPrice == null ? null : cents(unitPrice) * line.qty / 100,
  };
}

export default async function handler(req, res) {
  if (!isStaffAuthorized(req)) {
    return res.status(401).json({ error: "Staff login required." });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { from, to } = req.query || {};
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) {
    return res.status(400).json({ error: "Pick a start and end date." });
  }
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(span) || span < 0) {
    return res.status(400).json({ error: "The start date must be on or before the end date." });
  }
  if (span >= MAX_DAYS) {
    return res.status(400).json({ error: "Pick a range of a year or less." });
  }

  const rows = await sql`
    SELECT order_number, name, phone, email, status, items, subtotal, packing_fee, total, received_at,
           to_char(received_at AT TIME ZONE 'Australia/Brisbane', 'YYYY-MM-DD') AS day,
           to_char(received_at AT TIME ZONE 'Australia/Brisbane', 'HH24:MI') AS time
    FROM orders
    WHERE status <> 'pending_payment'
      AND (received_at AT TIME ZONE 'Australia/Brisbane')::date BETWEEN ${from}::date AND ${to}::date
    ORDER BY received_at DESC
  `;

  const orders = rows.map((r) => {
    const lines = (r.items || []).map(normaliseLine);
    const known = lines.every((l) => l.amount != null);
    const priceCheck = known && lines.reduce((s, l) => s + cents(l.amount), 0) === cents(r.subtotal);
    return {
      orderNumber: r.order_number,
      name: r.name,
      phone: r.phone,
      email: r.email,
      status: r.status,
      day: r.day,
      time: r.time,
      subtotal: Number(r.subtotal),
      packingFee: Number(r.packing_fee),
      total: Number(r.total),
      priceCheck,
      lines,
    };
  });

  // Per day (newest first) and per item (best sellers first). Sums in cents.
  const dayMap = new Map();
  const itemMap = new Map();
  for (const o of orders) {
    const d = dayMap.get(o.day) || { day: o.day, orders: 0, subtotal: 0, packingFees: 0, total: 0 };
    d.orders += 1;
    d.subtotal += cents(o.subtotal);
    d.packingFees += cents(o.packingFee);
    d.total += cents(o.total);
    dayMap.set(o.day, d);

    for (const l of o.lines) {
      const key = `${l.productId || l.productName}::${l.size}::${l.flavour || ""}`;
      const it = itemMap.get(key) || { label: l.label, productName: l.productName, category: l.category, size: l.size, flavour: l.flavour, qty: 0, amount: 0, amountKnown: true };
      it.qty += l.qty;
      if (l.amount == null) it.amountKnown = false;
      else it.amount += cents(l.amount);
      itemMap.set(key, it);
    }
  }
  const toDollars = (o, keys) => keys.forEach((k) => { o[k] /= 100; });
  const dayList = [...dayMap.values()].sort((a, b) => b.day.localeCompare(a.day));
  dayList.forEach((d) => toDollars(d, ["subtotal", "packingFees", "total"]));
  const items = [...itemMap.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.label.localeCompare(b.label));
  items.forEach((it) => toDollars(it, ["amount"]));

  // Same-length period immediately before, for "vs previous" deltas.
  const days = span + 1;
  const prevTo = new Date(Date.parse(`${from}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(`${from}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const [prev] = await sql`
    SELECT count(*)::int AS orders, coalesce(sum(subtotal), 0) AS subtotal, coalesce(sum(total), 0) AS total
    FROM orders
    WHERE status <> 'pending_payment'
      AND (received_at AT TIME ZONE 'Australia/Brisbane')::date BETWEEN ${prevFrom}::date AND ${prevTo}::date
  `;
  const previous = { from: prevFrom, to: prevTo, orders: prev.orders, subtotal: Number(prev.subtotal), total: Number(prev.total) };

  const totals = {
    orders: orders.length,
    itemsSold: items.reduce((n, it) => n + it.qty, 0),
    subtotal: dayList.reduce((s, d) => s + cents(d.subtotal), 0) / 100,
    packingFees: dayList.reduce((s, d) => s + cents(d.packingFees), 0) / 100,
    total: dayList.reduce((s, d) => s + cents(d.total), 0) / 100,
    unverifiedOrders: orders.filter((o) => !o.priceCheck).length,
  };

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ from, to, totals, previous, days: dayList, items, orders });
}
