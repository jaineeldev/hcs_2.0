/* =========================
   Real server-side staff auth check. The passcode itself now lives only
   in the STAFF_PASSCODE server env var (never shipped to the client), and
   a successful /api/staff-login sets an HttpOnly cookie holding that same
   value — unreadable by client JS, sent automatically on same-origin
   requests. Every staff-only mutation checks this before doing anything.
========================= */
export function isStaffAuthorized(req) {
  const token = req.cookies?.staff_session;
  return Boolean(token) && Boolean(process.env.STAFF_PASSCODE) && token === process.env.STAFF_PASSCODE;
}
