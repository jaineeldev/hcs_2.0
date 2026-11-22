import { resolveMx } from "node:dns/promises";

/* =========================
   Catches obviously-fake emails (test@example.com, typo'd domains, etc.)
   that pass format validation but can't actually receive mail. Checks for
   a real MX record — not a full mailbox-exists check, just "could this
   domain plausibly receive email at all." A domain can also publish a
   single null MX record (RFC 7505, empty/"." exchange) to explicitly say
   "this domain accepts no mail" — example.com does exactly this — so that
   case is filtered out too, not just a missing record.
========================= */
export async function hasMailServer(email) {
  const domain = String(email).split("@")[1];
  if (!domain) return false;

  try {
    const records = await resolveMx(domain);
    return records.some((r) => r.exchange && r.exchange !== ".");
  } catch {
    return false;
  }
}
