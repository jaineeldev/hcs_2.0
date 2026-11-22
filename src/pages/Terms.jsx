import { Link } from "react-router-dom";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import { STORE } from "../lib/store.js";
import { ui, getInitialTheme, setStoredTheme } from "../lib/theme.js";
import { PACKING_FEE, MIN_ORDER_AMOUNT, formatPrice } from "../data/products.js";
import { useEffect, useState } from "react";

const LAST_UPDATED = "14 November 2026";

function Section({ heading, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight">{heading}</h2>
      <div className="mt-2 text-sm text-stone-700 dark:text-stone-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Terms() {
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

      <main className={`${ui.container} py-10 sm:py-14 max-w-3xl`}>
        <div className="text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">LEGAL</div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Last updated {LAST_UPDATED}</p>

        <p className="mt-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          These terms cover ordering from {STORE.name} online for Click &amp; Collect pickup. By placing an order through this site, you agree to them.
        </p>

        <Section heading="Click & Collect only">
          <p>
            Online ordering is for in-store pickup only — we don't offer delivery. The online range is a smaller, rotating selection of what's
            in store; the full range is always available if you shop in person.
          </p>
        </Section>

        <Section heading="Pricing and fees">
          <p>
            A flat {formatPrice(PACKING_FEE)} packing fee applies to Click &amp; Collect orders, shown before you start adding items — it's the
            same regardless of how you pay, not a card surcharge. Shopping in-store has no packing fee.
          </p>
          <p>There's a {formatPrice(MIN_ORDER_AMOUNT)} minimum order (before the packing fee) for Click &amp; Collect. All prices include GST.</p>
          <p>Prices and stock availability are correct at the time of ordering but may change without notice.</p>
        </Section>

        <Section heading="Payment">
          <p>
            Payment is taken securely at the time of ordering, processed by Square. We never see or store your full card details — only Square does.
          </p>
        </Section>

        <Section heading="Order accuracy and availability">
          <p>
            We check stock and pricing when you order, but on rare occasions an item may no longer be available. If that happens, we'll contact
            you using the details you provided to sort out a substitute, adjustment, or refund for that item.
          </p>
        </Section>

        <Section heading="Pickup">
          <p>
            Please collect your order at your chosen pickup time. Just give us your name at the counter — you don't need to show anything.
            Running late or can't make it? Call the store and we'll sort it out.
          </p>
        </Section>

        <Section heading="Cancellations and refunds">
          <p>
            We handle cancellations and refunds case by case — call the store on {STORE.phoneDisplay} as soon as possible if something's wrong
            with your order or you need to cancel it.
          </p>
          <p>Nothing in these terms limits any guarantee or remedy you're entitled to under the Australian Consumer Law.</p>
        </Section>

        <Section heading="Liability">
          <p>
            To the extent permitted by law, our liability for any issue with an online order is limited to the value of that order, replacing
            the item, or providing the service again — except where the Australian Consumer Law gives you a right that can't be excluded.
          </p>
        </Section>

        <Section heading="Governing law">
          <p>These terms are governed by the laws of Queensland, Australia.</p>
        </Section>

        <Section heading="Contact us">
          <p>
            {STORE.name}, {STORE.suburb}
            <br />
            Phone: {STORE.phoneDisplay}
          </p>
        </Section>
      </main>
    </div>
  );
}
