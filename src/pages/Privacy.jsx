import { Link } from "react-router-dom";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import { STORE } from "../lib/store.js";
import { ui, getInitialTheme, setStoredTheme } from "../lib/theme.js";
import { useEffect, useState } from "react";

const PRIVACY_EMAIL = "privacy@hawthornecornerstore.com.au";
const LAST_UPDATED = "14 November 2026";

function Section({ heading, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight">{heading}</h2>
      <div className="mt-2 text-sm text-stone-700 dark:text-stone-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Privacy() {
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
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Last updated {LAST_UPDATED}</p>

        <p className="mt-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          This policy explains what personal information {STORE.name} collects through this website, why we collect it, and how it's handled —
          whether you're just browsing or placing a Click &amp; Collect order.
        </p>

        <Section heading="What we collect">
          <p>Browsing the site doesn't require an account and we don't collect anything identifying just from a visit.</p>
          <p>When you place an order, we collect your name, phone number, email address, the items and pickup time you chose, and any note you add for the store.</p>
          <p>
            We never see or store your full card details. Card entry is handled directly by Square, our payment processor — we only receive
            confirmation that payment succeeded.
          </p>
        </Section>

        <Section heading="How we use it">
          <p>Your order details are used to prepare your order, notify you by email when it's ready, and contact you if there's a problem with your order (e.g. an item is out of stock).</p>
          <p>We don't use your details for marketing, and we don't sell or rent your information to anyone.</p>
        </Section>

        <Section heading="Who we share it with">
          <p>We share only what's needed to run the ordering system, with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Square</strong> — processes payment and holds your card details; we never receive them ourselves.</li>
            <li><strong>Resend</strong> — delivers your order receipt and "ready for pickup" emails.</li>
            <li><strong>Vercel</strong> — hosts the site and provides anonymised, aggregate analytics (page visits, not individual identity).</li>
          </ul>
        </Section>

        <Section heading="Cookies and local storage">
          <p>
            Your cart contents and light/dark theme preference are stored in your browser only (local/session storage), never on our servers,
            and are cleared when you clear your browser data. We don't use advertising or tracking cookies.
          </p>
        </Section>

        <Section heading="How long we keep it">
          <p>Order details are kept only as long as needed to fulfil your order and resolve any follow-up questions about it.</p>
        </Section>

        <Section heading="Your rights">
          <p>
            You can ask us what personal information we hold about you, ask us to correct it, or ask us to delete it, by contacting us using
            the details below.
          </p>
        </Section>

        <Section heading="Changes to this policy">
          <p>If this policy changes, we'll update the date at the top of this page.</p>
        </Section>

        <Section heading="Contact us">
          <p>
            {STORE.name}, {STORE.suburb}
            <br />
            Phone: {STORE.phoneDisplay}
            <br />
            Email: <a href={`mailto:${PRIVACY_EMAIL}`} className="underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500">{PRIVACY_EMAIL}</a>
          </p>
        </Section>
      </main>
    </div>
  );
}
