/* =========================
   Staff order feed — backed by the real orders table via /api/orders.
   Orders are created server-side (api/create-checkout.js) and only appear
   here once the server has verified the Square payment (src/lib/checkout.js),
   so there's nothing to push from the client here.
========================= */
// → { active: [...], collected: { orders, page, totalPages, total } }
export async function getStaffOrders(collectedPage = 1) {
  const res = await fetch(`/api/orders?page=${encodeURIComponent(collectedPage)}`);
  if (!res.ok) {
    const err = new Error("Failed to load orders.");
    err.status = res.status; // 401 = login expired → staff page shows the PIN screen
    throw err;
  }
  return res.json();
}

export async function updateStaffOrderStatus(orderNumber, status) {
  const res = await fetch("/api/orders", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderNumber, status }),
  });
  if (!res.ok) throw new Error("Failed to update order status.");
  return res.json();
}
