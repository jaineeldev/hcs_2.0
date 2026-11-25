import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";
import { PRODUCTS, isValidStockKey } from "../src/data/products.js";

/* =========================
   Out-of-stock list.
   GET   → { outOfStock: [key, …] }  (public — the order page needs it)
   PATCH → { key, outOfStock }       (staff only)
   A key is a whole product id ("monster") or one exact item
   ("monster::500ml::Mango Loco"). Marking a whole product back IN also clears
   its individual items, so "all in" really means everything is orderable.
========================= */

export default async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await sql`SELECT item_key FROM stock_overrides WHERE out_of_stock = true`;
    return res.status(200).json({ outOfStock: rows.map((r) => r.item_key) });
  }

  if (req.method === "PATCH") {
    if (!isStaffAuthorized(req)) {
      return res.status(401).json({ error: "Staff login required." });
    }
    const { key, outOfStock } = req.body || {};
    if (typeof key !== "string" || !isValidStockKey(key)) {
      return res.status(400).json({ error: "Unknown product or item." });
    }

    if (outOfStock) {
      await sql`
        INSERT INTO stock_overrides (item_key, out_of_stock, updated_at)
        VALUES (${key}, true, now())
        ON CONFLICT (item_key) DO UPDATE SET out_of_stock = true, updated_at = now()
      `;
    } else if (PRODUCTS.some((p) => p.id === key)) {
      await sql`DELETE FROM stock_overrides WHERE item_key = ${key} OR item_key LIKE ${`${key}::%`}`;
    } else {
      await sql`DELETE FROM stock_overrides WHERE item_key = ${key}`;
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
