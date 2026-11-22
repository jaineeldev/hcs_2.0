/* =========================
   Shared styling tokens for transactional emails — kept in sync
   with the site's own brand tokens (src/lib/theme.js) since email
   clients can't read the app's Tailwind config.
========================= */
export const EMAIL_FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
