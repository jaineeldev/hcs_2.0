/* =========================
   Shared style tokens
   Keep App.jsx and any other page visually consistent
========================= */
export const ui = {
  page: "grain min-h-screen bg-[#f6f0e6] text-stone-900 dark:bg-[#161513] dark:text-stone-100",
  header: "sticky top-0 z-40 bg-[#f6f0e6]/90 dark:bg-[#161513]/90 backdrop-blur border-b border-stone-200/80 dark:border-stone-800",
  container: "max-w-7xl mx-auto px-6",
  section: "px-6 py-16 border-t border-stone-200/80 dark:border-stone-800",
  card: "rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] p-6 transition hover:-translate-y-0.5 hover:shadow-md",
  cardNoPad: "rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] transition hover:-translate-y-0.5 hover:shadow-md",
  beigePrimary: "min-h-[44px] bg-[#d9c3a6] text-[#2a231b] hover:bg-[#cfb897] transition px-6 py-3 rounded-xl font-semibold shadow-sm border border-[#c9b79f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70",
  darkPrimary: "min-h-[44px] bg-[#2b241d] text-[#f5efe6] hover:bg-[#3a3128] transition px-6 py-3 rounded-xl font-semibold shadow-sm border border-[#3f352a] dark:bg-[#26211b] dark:hover:bg-[#332b22] dark:border-[#3b3127] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/50",
  beigePrimarySm: "min-h-[40px] bg-[#d9c3a6] text-[#2a231b] hover:bg-[#cfb897] transition px-4 py-2 rounded-xl font-semibold shadow-sm border border-[#c9b79f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70",
  darkPrimarySm: "min-h-[40px] bg-[#2b241d] text-[#f5efe6] hover:bg-[#3a3128] transition px-4 py-2 rounded-xl font-semibold shadow-sm border border-[#3f352a] dark:bg-[#26211b] dark:hover:bg-[#332b22] dark:border-[#3b3127] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/50",
  revealBase: "transition-all duration-700 ease-out will-change-transform will-change-opacity",
  revealHidden: "opacity-0 translate-y-4",
  revealVisible: "opacity-100 translate-y-0",
};

export function disabledClass(base) {
  return `${base} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-none`;
}

/* =========================
   Theme helper
   Defaults to "light" regardless of system preference
========================= */
export function getInitialTheme() {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private browsing, disabled storage)
  }
  return "light";
}

export function setStoredTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage unavailable (private browsing, disabled storage) — theme just won't persist
  }
}

