/* =========================
   Staff login — client side. The real check is server-side: a successful
   /api/staff-login sets a 7-day HttpOnly cookie, and every staff API call is
   checked against it. Page JS can't read that cookie, so the staff page asks
   /api/staff-session whether this device is still logged in — that's what
   lets the counter tablet skip the PIN screen after the tab is closed.
========================= */

export async function checkStaffSession() {
  try {
    const res = await fetch("/api/staff-session", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.loggedIn);
  } catch {
    return false;
  }
}

// → { result: "ok" | "wrong" | "locked" | "error", triesLeft?, message? }
export async function staffLogin(passcode) {
  const res = await fetch("/api/staff-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  if (res.ok) return { result: "ok" };
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return { result: "wrong", triesLeft: data.triesLeft };
  if (res.status === 429) return { result: "locked", message: data.error };
  return { result: "error" };
}

export async function staffLogout() {
  try {
    await fetch("/api/staff-logout", { method: "POST" });
  } catch (err) {
    console.error("Staff logout request failed:", err);
  }
}
