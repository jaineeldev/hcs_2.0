import { isStaffAuthorized } from "../src/lib/staffSession.js";

/* =========================
   "Am I still logged in?" — lets the staff page skip the PIN screen on a
   device that logged in within the last 7 days (the HttpOnly cookie can't be
   read by page JS, so the page has to ask). Reveals nothing but yes/no.
========================= */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ loggedIn: isStaffAuthorized(req) });
}
