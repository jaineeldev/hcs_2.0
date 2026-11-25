/* =========================
   Out-of-stock list — backed by the stock_overrides table via /api/stock.
   Keys are whole product ids or exact items (see products.js variantsOf /
   isItemOut). The order page polls this; staff set it from the stock panel.
========================= */
export async function getOutOfStockKeys() {
  const res = await fetch("/api/stock");
  if (!res.ok) throw new Error("Failed to load stock.");
  const data = await res.json();
  return data.outOfStock;
}

export async function setStockKey(key, inStock) {
  const res = await fetch("/api/stock", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, outOfStock: !inStock }),
  });
  if (!res.ok) throw new Error("Failed to update stock.");
  return res.json();
}
