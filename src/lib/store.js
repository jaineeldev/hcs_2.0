/* =========================
   Store data
========================= */
export const STORE = {
  name: "Hawthorne Corner Store",
  suburb: "331 Hawthorne Rd, Hawthorne, QLD 4171",
  phoneDisplay: "(07) 3399 6611",
  phoneTel: "+61733996611",
  mapsQuery: "Hawthorne Corner Store Hawthorne QLD",
};

export const SITE_URL = "https://www.hawthornecornerstore.com.au";

// Set VITE_ORDERING_ENABLED=true in Vercel's env vars (Production) when Click &
// Collect is ready to go live. Defaults to off so a plain deploy never exposes
// ordering before it's meant to.
// Optional chaining: this file is also imported by the api/* serverless
// functions, where plain Node has no import.meta.env — without the `?.` the
// whole function crashes on load.
export const ORDERING_ENABLED = import.meta.env?.VITE_ORDERING_ENABLED === "true";

// Square's published AU rate for online/remote card payments (flat, no AU
// surcharging allowed since Oct 2026 — this is just for staff bookkeeping on
// the staff board and sales report, never shown to customers or added to
// what they're charged).
export const SQUARE_FEE_RATE = 0.022;

export const GOOGLE_REVIEWS_URL = "https://www.google.com/maps?cid=8960640778133855742";

export const FACEBOOK_URL = "https://www.facebook.com/p/Hawthorne-Corner-Store-100057350894668/";
