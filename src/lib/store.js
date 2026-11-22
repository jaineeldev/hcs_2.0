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
export const ORDERING_ENABLED = import.meta.env.VITE_ORDERING_ENABLED === "true";

export const GOOGLE_REVIEWS_URL = "https://www.google.com/maps?cid=8960640778133855742";

export const FACEBOOK_URL = "https://www.facebook.com/p/Hawthorne-Corner-Store-100057350894668/";
