import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";

const VALID_STATUSES = ["new", "preparing", "ready", "completed"];
// Collected orders are paged on the server so the board stays fast no matter
// how many have built up. Active orders (new/preparing/ready) are always
// returned in full — they're the work queue.
const COLLECTED_PAGE_SIZE = 6;

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
    collectedAt: row.collected_at ? new Date(row.collected_at).getTime() : null,
  };
}

export default async function handler(req, res) {
  if (!isStaffAuthorized(req)) {
    return res.status(401).json({ error: "Staff login required." });
  }

  // GET ?page=N → { active: [...oldest first], collected: { orders, page, totalPages, total } }
  if (req.method === "GET") {
    const active = await sql`
      SELECT * FROM orders WHERE status IN ('new', 'preparing', 'ready') ORDER BY received_at ASC
    `;

    const [{ total }] = await sql`SELECT count(*)::int AS total FROM orders WHERE status = 'completed'`;
    const totalPages = Math.max(1, Math.ceil(total / COLLECTED_PAGE_SIZE));
    const requested = Number.parseInt(req.query?.page, 10);
    const page = Math.min(totalPages, Math.max(1, Number.isFinite(requested) ? requested : 1));

    // Newest collected first, using the time it was actually marked collected
    // (from order_events), falling back to when it was paid.
    const collected = await sql`
      SELECT o.*, ev.collected_at
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT max(e.created_at) AS collected_at FROM order_events e
        WHERE e.order_number = o.order_number AND e.status = 'completed'
      ) ev ON true
      WHERE o.status = 'completed'
      ORDER BY coalesce(ev.collected_at, o.received_at) DESC, o.order_number
      LIMIT ${COLLECTED_PAGE_SIZE} OFFSET ${(page - 1) * COLLECTED_PAGE_SIZE}
    `;

    return res.status(200).json({
      active: active.map(toOrder),
      collected: { orders: collected.map(toOrder), page, totalPages, total },
    });
  }

  if (req.method === "PATCH") {
    const { orderNumber, status } = req.body || {};
    if (!orderNumber || typeof orderNumber !== "string") {
      return res.status(400).json({ error: "Missing order reference." });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    // Status change + history entry in one statement.
    const rows = await sql`
      WITH u AS (
        UPDATE orders SET status = ${status}
        WHERE order_number = ${orderNumber} AND status <> 'pending_payment'
        RETURNING *
      ), e AS (
        INSERT INTO order_events (order_number, status, source)
        SELECT order_number, status, 'staff' FROM u
      )
      SELECT * FROM u
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }
    return res.status(200).json({ order: toOrder(rows[0]) });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
