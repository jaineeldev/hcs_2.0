import { sql } from "../src/lib/db.js";

/* =========================
   Staff login (PIN or passcode in STAFF_PASSCODE).
   The staff PIN is short, so guessing is rate-limited:
     - 5 wrong tries from one IP within 15 minutes  → that IP is locked out
     - 30 wrong tries from anywhere within 15 minutes → new logins pause
   Devices already logged in (7-day cookie) are unaffected by a lockout.
========================= */
const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_TOTAL = 30;

function clientIp(req) {
  // Vercel sets x-forwarded-for; the first entry is the real client.
  const forwarded = req.headers["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return first || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.STAFF_PASSCODE) {
    console.error("Staff login error: STAFF_PASSCODE is not configured.");
    return res.status(500).json({ error: "Staff login isn't configured yet." });
  }

  const ip = clientIp(req);
  await sql`DELETE FROM staff_login_failures WHERE created_at < now() - interval '1 day'`;
  const [{ ipFails, allFails }] = await sql`
    SELECT count(*) FILTER (WHERE ip = ${ip})::int AS "ipFails", count(*)::int AS "allFails"
    FROM staff_login_failures
    WHERE created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
  `;
  if (ipFails >= MAX_FAILS_PER_IP || allFails >= MAX_FAILS_TOTAL) {
    res.setHeader("Retry-After", String(WINDOW_MINUTES * 60));
    return res.status(429).json({ error: `Too many wrong tries. Try again in ${WINDOW_MINUTES} minutes.` });
  }

  // Trim both sides so a stray space from copy-pasting (or in the env file)
  // doesn't turn the right passcode into "wrong passcode".
  const { passcode } = req.body || {};
  if (typeof passcode !== "string" || passcode.trim() !== process.env.STAFF_PASSCODE.trim()) {
    await sql`INSERT INTO staff_login_failures (ip) VALUES (${ip})`;
    const left = MAX_FAILS_PER_IP - ipFails - 1;
    return res.status(401).json({ error: "Wrong passcode.", triesLeft: Math.max(0, left) });
  }

  await sql`DELETE FROM staff_login_failures WHERE ip = ${ip}`;

  const isProd = process.env.VERCEL_ENV === "production";
  const cookie = [
    `staff_session=${encodeURIComponent(process.env.STAFF_PASSCODE)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 7}`,
    ...(isProd ? ["Secure"] : []),
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);

  return res.status(200).json({ success: true });
}
