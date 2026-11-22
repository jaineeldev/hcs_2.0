import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";

const VALID_STATUSES = ["new", "preparing", "ready", "completed"];
const MAX_ORDERS = 50;

function toOrder(row) {
  return {
    orderNumber: row.order_number,
    name: row.name,
    phone: row.phone,
    email: row.email,
    note: row.note,
    pickupLabel: row.pickup_label,
    items: row.items,
    subtotal: Number(row.subtotal),
    packingFee: Number(row.packing_fee),
    total: Number(row.total),
    paymentId: row.payment_id,
    emailSent: row.email_sent,
    status: row.status,
    receivedAt: new Date(row.received_at).getTime(),
  };
}

export default async function handler(req, res) {
  if (!isStaffAuthorized(req)) {
    return res.status(401).json({ error: "Staff login required." });
  }

  if (req.method === "GET") {
    const rows = await sql`
      SELECT * FROM orders ORDER BY received_at DESC LIMIT ${MAX_ORDERS}
    `;
    return res.status(200).json({ orders: rows.map(toOrder) });
  }

  if (req.method === "PATCH") {
    const { orderNumber, status } = req.body || {};
    if (!orderNumber || typeof orderNumber !== "string") {
      return res.status(400).json({ error: "Missing order reference." });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    const rows = await sql`
      UPDATE orders SET status = ${status} WHERE order_number = ${orderNumber} RETURNING *
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }
    return res.status(200).json({ order: toOrder(rows[0]) });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
