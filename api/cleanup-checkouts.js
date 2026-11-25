import { cleanupAbandonedCheckouts } from "../src/lib/checkout.js";

/* =========================
   Daily Vercel cron (see vercel.json → crons): removes checkouts that were
   never paid after 7 days — see cleanupAbandonedCheckouts() for the safety
   steps (re-check with Square, switch off the payment link, then delete).

   Vercel calls this with "Authorization: Bearer <CRON_SECRET>". Without a
   CRON_SECRET env var set, it refuses every request, so nobody else can
   trigger deletions.
========================= */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  try {
    const result = await cleanupAbandonedCheckouts({ olderThanDays: 7 });
    console.log("Abandoned checkout cleanup:", JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err) {
    console.error("Abandoned checkout cleanup failed:", err);
    return res.status(500).json({ error: "Cleanup failed." });
  }
}
