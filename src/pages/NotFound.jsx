import { Link } from "react-router-dom";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import { STORE } from "../lib/store.js";
import { ui, getInitialTheme, setStoredTheme } from "../lib/theme.js";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [theme, setTheme] = useState(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <div className={`${ui.container} py-4 flex items-center justify-between`}>
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold hover:text-stone-600 dark:hover:text-stone-300 transition">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {STORE.name}
          </Link>
          <button onClick={toggleTheme}
            className="min-h-[40px] w-[40px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className={`${ui.container} py-20 sm:py-28 max-w-xl text-center`}>
        <div className="text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">404</div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Page not found</h1>
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
          That page doesn't exist — it may have moved, or the link might be wrong.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link to="/" className={`${ui.beigePrimary} inline-flex items-center gap-2`}>
            Back to the homepage
          </Link>
          <Link to="/order" className={`${ui.darkPrimary} inline-flex items-center gap-2`}>
            Order Online
          </Link>
        </div>
      </main>
    </div>
  );
}
