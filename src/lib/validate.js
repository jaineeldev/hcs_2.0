/* =========================
   Checkout form validation
========================= */
export function isValidName(value) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && !/^\d+$/.test(trimmed);
}

export function isValidAuPhone(value) {
  const cleaned = value.trim().replace(/[\s\-()]/g, "");
  // 0X XXXXXXXX (10 digits, valid AU prefix) or +61X / 61X equivalents
  return /^0[2-478]\d{8}$/.test(cleaned) || /^(\+?61)[2-478]\d{8}$/.test(cleaned);
}

export function isValidEmail(value) {
  const trimmed = value.trim();
  // Deliberately simple — just enough to catch obvious typos, not a full RFC check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
