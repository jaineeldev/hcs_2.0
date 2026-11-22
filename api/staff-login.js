export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.STAFF_PASSCODE) {
    console.error("Staff login error: STAFF_PASSCODE is not configured.");
    return res.status(500).json({ error: "Staff login isn't configured yet." });
  }

  const { passcode } = req.body || {};
  if (passcode !== process.env.STAFF_PASSCODE) {
    return res.status(401).json({ error: "Wrong passcode." });
  }

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
