/* =========================
   Staff override on top of the scheduled opening hours (src/lib/hours.js)
   — "auto" follows the schedule, "open"/"closed" force it either way,
   for closing early, staying open late, etc. Backed by /api/ordering-override.
========================= */
export async function getOrderingMode() {
  const res = await fetch("/api/ordering-override");
  if (!res.ok) throw new Error("Failed to load ordering mode.");
  const data = await res.json();
  return data.mode;
}

export async function setOrderingMode(mode) {
  const res = await fetch("/api/ordering-override", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("Failed to update ordering mode.");
  return res.json();
}

export function applyOrderingOverride(scheduled, mode) {
  if (mode === "open") {
    return { ...scheduled, isOpen: true, label: "Open now (staff override)" };
  }
  if (mode === "closed") {
    return { ...scheduled, isOpen: false, label: "Temporarily closed by staff" };
  }
  return scheduled;
}
