import { sql } from "../src/lib/db.js";
import { isStaffAuthorized } from "../src/lib/staffSession.js";

const VALID_MODES = ["auto", "open", "closed"];

export default async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await sql`SELECT value FROM settings WHERE key = 'ordering_mode'`;
    return res.status(200).json({ mode: rows[0]?.value || "auto" });
  }

  if (req.method === "PATCH") {
    if (!isStaffAuthorized(req)) {
      return res.status(401).json({ error: "Staff login required." });
    }
    const { mode } = req.body || {};
    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({ error: "Invalid mode." });
    }
    await sql`
      INSERT INTO settings (key, value, updated_at) VALUES ('ordering_mode', ${mode}, now())
      ON CONFLICT (key) DO UPDATE SET value = ${mode}, updated_at = now()
    `;
    return res.status(200).json({ success: true, mode });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
