/* =========================
   Staff passcode gate — the real check now happens server-side
   (api/staff-login.js sets an HttpOnly cookie after verifying the
   passcode against the server-only STAFF_PASSCODE env var). This file
   just tracks a lightweight "don't re-show the login form" UI flag for
   the current tab; it grants no access on its own — every staff API
   call is independently checked against the real cookie.
========================= */
const UNLOCK_KEY = "hcs-staff-unlocked";

export function isStaffUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStaffUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    // sessionStorage unavailable — stays unlocked for this render only
  }
}

export async function staffLogin(passcode) {
  const res = await fetch("/api/staff-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  return res.ok;
}

export async function staffLogout() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // sessionStorage unavailable
  }
  try {
    await fetch("/api/staff-logout", { method: "POST" });
  } catch (err) {
    console.error("Staff logout request failed:", err);
  }
}
