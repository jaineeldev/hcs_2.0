/* =========================
   Square Web Payments SDK loader
   Loaded on demand (checkout only) rather than on every page —
   it's a sizeable third-party script nobody needs until they pay.
========================= */
let loadPromise = null;

export function loadSquareSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Square) return Promise.resolve(window.Square);
  if (loadPromise) return loadPromise;

  const isProduction = import.meta.env.VITE_SQUARE_ENV === "production";
  const src = isProduction
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (window.Square) resolve(window.Square);
      else reject(new Error("Square payment form failed to load."));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Square payment form failed to load."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
