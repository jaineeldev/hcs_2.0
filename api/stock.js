import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await sql`
      SELECT product_id FROM stock_overrides WHERE out_of_stock = true
    `;
    return res.status(200).json({ outOfStockIds: rows.map((r) => r.product_id) });
  }

  if (req.method === "PATCH") {
    if (!isStaffAuthorized(req)) {
      return res.status(401).json({ error: "Staff login required." });
    }
    const { productId, outOfStock } = req.body || {};
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ error: "Missing product id." });
    }
    if (outOfStock) {
      await sql`
        INSERT INTO stock_overrides (product_id, out_of_stock, updated_at)
        VALUES (${productId}, true, now())
        ON CONFLICT (product_id) DO UPDATE SET out_of_stock = true, updated_at = now()
      `;
    } else {
      await sql`DELETE FROM stock_overrides WHERE product_id = ${productId}`;
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
