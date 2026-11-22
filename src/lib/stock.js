/* =========================
   Out-of-stock toggles — backed by the real stock_overrides table via
   /api/stock. Staff mark a product out of stock here; the order page
   polls this to hide the "Add" control for that product.
========================= */
export async function getOutOfStockIds() {
  const res = await fetch("/api/stock");
  if (!res.ok) throw new Error("Failed to load stock.");
  const data = await res.json();
  return data.outOfStockIds;
}

export async function setProductStock(productId, inStock) {
  const res = await fetch("/api/stock", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, outOfStock: !inStock }),
  });
  if (!res.ok) throw new Error("Failed to update stock.");
  return res.json();
}
