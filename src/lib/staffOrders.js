/* =========================
   Staff order feed — backed by the real orders table via /api/orders.
   Orders are created server-side (api/process-payment.js) right after
   payment succeeds, so there's nothing to push from the client here.
========================= */
export async function getStaffOrders() {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed to load orders.");
  const data = await res.json();
  return data.orders;
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
