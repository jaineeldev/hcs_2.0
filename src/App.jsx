import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import {
  Sun, Moon, Menu, X, Star, MapPin, Phone, ShoppingCart,
  CupSoda, Cookie, ShoppingBag, Shirt, Disc, Wrench,
  Flame, Milk, Battery, ChefHat, Utensils,
} from "lucide-react";
import storefrontImg from "./assets/storefront.jpg";
import { STORE, GOOGLE_REVIEWS_URL, FACEBOOK_URL } from "./lib/store.js";
import {
  isHoliday, getForcedClosure, getOpenStatus,
  formatTime, buildUpcomingRows,
} from "./lib/hours.js";
import { ui, getInitialTheme, setStoredTheme } from "./lib/theme.js";

function IconGasBottle({ className, strokeWidth = 1.6 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="10" y="3" width="4" height="5" rx="1" />
      <rect x="6.5" y="8" width="11" height="13" rx="2.5" />
      <line x1="6.5" y1="12.5" x2="17.5" y2="12.5" />
    </svg>
  );
}

const PAYMENT_METHODS = ["Eftpos", "Apple Pay", "Google Wallet", "Samsung Pay", "Cash"];

/* =========================
   Preloader session gate
   Only shown once per browser session
========================= */
const PRELOADER_SESSION_KEY = "hcs-preloader-shown";

function hasShownPreloader() {
  try {
    return sessionStorage.getItem(PRELOADER_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPreloaderShown() {
  try {
    sessionStorage.setItem(PRELOADER_SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable (private browsing, disabled storage)
  }
}

/* =========================
   Reveal on scroll
========================= */
function useRevealOnScroll() {
  const [visible, setVisible] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  );

  // A callback ref runs synchronously when React attaches the node, before
  // paint — unlike an effect, so checking layout here can't cause a visible
  // flash of the hidden state for a section already on screen at mount.
  // Returning a cleanup function (React 19) lets React tear it down correctly,
  // including StrictMode's dev-mode double-invoke of ref callbacks.
  const domRef = useCallback((el) => {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "0px 0px 150px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [domRef, visible];
}

/* =========================
   Preloader
   Sequence:
     0ms    — mount, everything hidden
     80ms   — icon fades + scales in
     320ms  — store name slides up + fades in
     540ms  — suburb line fades in
     700ms  — progress bar starts filling
     1600ms — begin fade-out
     2000ms — unmount
========================= */
function Preloader({ onDone }) {
  const [stage, setStage] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (prefersReduced) { onDone(); return; }

    const timers = [
      setTimeout(() => setStage(1), 80),
      setTimeout(() => setStage(2), 320),
      setTimeout(() => setStage(3), 540),
      setTimeout(() => setStage(4), 700),
      setTimeout(() => setFading(true), 1600),
      setTimeout(() => onDone(), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #f8f2e8 0%, #f0e8d8 100%)",
        transition: fading ? "opacity 400ms ease" : "none",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "all",
      }}
    >
      {/* Warm radial glow */}
      <div style={{
        position: "absolute",
        width: "420px",
        height: "420px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(201,183,159,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Store SVG icon from public/favicon.svg */}
      <div style={{
        marginBottom: "1.5rem",
        opacity: stage >= 1 ? 1 : 0,
        transform: stage >= 1 ? "scale(1) translateY(0)" : "scale(0.82) translateY(8px)",
        transition: `opacity 500ms ${ease}, transform 500ms ${ease}`,
      }}>
        <img
          src="/favicon.svg"
          alt=""
          width="56"
          height="56"
          style={{
            borderRadius: "14px",
            boxShadow: "0 2px 12px rgba(139,112,80,0.15)",
          }}
        />
      </div>

      {/* Store name */}
      <div style={{
        fontWeight: 800,
        fontSize: "1.15rem",
        letterSpacing: "0.01em",
        color: "#2a231b",
        opacity: stage >= 2 ? 1 : 0,
        transform: stage >= 2 ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 500ms ${ease}, transform 500ms ${ease}`,
        marginBottom: "0.3rem",
      }}>
        Hawthorne Corner Store
      </div>

      {/* Suburb line */}
      <div style={{
        fontSize: "0.72rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#8c7a66",
        opacity: stage >= 3 ? 1 : 0,
        transform: stage >= 3 ? "translateY(0)" : "translateY(6px)",
        transition: `opacity 400ms ${ease}, transform 400ms ${ease}`,
        marginBottom: "1.75rem",
      }}>
        Hawthorne · Brisbane
      </div>

      {/* Progress bar */}
      <div style={{
        width: "140px",
        height: "2px",
        borderRadius: "999px",
        background: "#e0d0bc",
        overflow: "hidden",
        opacity: stage >= 4 ? 1 : 0,
        transition: "opacity 300ms ease",
      }}>
        <div style={{
          height: "100%",
          borderRadius: "999px",
          background: "linear-gradient(90deg, #c9b79f, #b8a48c)",
          width: stage >= 4 ? "100%" : "0%",
          transition: stage >= 4 ? "width 900ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }} />
      </div>

      {/* Pulsing dots */}
      <div style={{
        display: "flex",
        gap: "5px",
        marginTop: "0.85rem",
        opacity: stage >= 4 ? 0.5 : 0,
        transition: "opacity 400ms ease",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: "3px",
            height: "3px",
            borderRadius: "50%",
            background: "#c9b79f",
            animation: stage >= 4 ? `hcs-pulse 1.2s ease-in-out ${i * 0.18}s infinite` : "none",
          }} />
        ))}
      </div>

      <style>{`
        @keyframes hcs-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

/* =========================
   UI bits
========================= */
function SectionLabel({ children }) {
  return (
    <div className="text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">
      {children}
    </div>
  );
}

function SectionHeader({ label, title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        {label ? <SectionLabel>{label}</SectionLabel> : null}
        <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h3>
        {subtitle ? (
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300 max-w-2xl">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function HolidayTag({ children, tone = "amber" }) {
  const cls =
    tone === "red"
      ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/25 text-red-800 dark:text-red-200"
      : "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/25 text-amber-900 dark:text-amber-200";
  return <span className={"text-[11px] font-semibold px-2 py-1 rounded-full border " + cls}>{children}</span>;
}

function PaymentChip({ children }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-stone-200/80 dark:border-stone-800 bg-white/40 dark:bg-black/10 text-stone-700 dark:text-stone-300">
      {children}
    </span>
  );
}

function staggerStyle(visible, index, stepMs = 70) {
  return { transitionDelay: visible ? `${index * stepMs}ms` : "0ms" };
}

/* =========================
   App
========================= */
export default function App() {
  const [ready, setReady] = useState(() => hasShownPreloader());

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => getOpenStatus(now, 45), [now]);
  const todayHoliday = useMemo(() => isHoliday(now), [now]);
  const forcedToday = useMemo(() => getForcedClosure(now), [now]);

  const [statusLead, ...statusRestParts] = status.label.split(" • ");
  const statusRest = statusRestParts.join(" • ");
  const statusDot = status.isOpen
    ? (status.closingSoon ? "bg-amber-500" : "bg-green-500")
    : "bg-red-500";
  const statusPillTone = status.isOpen
    ? (status.closingSoon
        ? "text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
        : "text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800")
    : "text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800";

  const mapsLink = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE.mapsQuery)}`,
    []
  );
  const mapsEmbed = useMemo(
    () => `https://www.google.com/maps?q=${encodeURIComponent(STORE.mapsQuery)}&output=embed`,
    []
  );

  const [theme, setTheme] = useState(() => getInitialTheme());
  const headerRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMobileCTA, setShowMobileCTA] = useState(false);
  const [mobileCTADismissed, setMobileCTADismissed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#161513" : "#f6f0e6"
    );
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  useEffect(() => {
    function onResize() { if (window.innerWidth >= 768) setMobileMenuOpen(false); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function onKeyDown(e) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    function onPointerDown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    function onScroll() {
      if (window.innerWidth >= 640) return;
      const scrolledEnough = window.scrollY > 420;
      const contactEl = document.getElementById("contact");
      const nearContact = contactEl && contactEl.getBoundingClientRect().top < window.innerHeight * 0.75;
      setShowMobileCTA(scrolledEnough && !nearContact && !mobileCTADismissed);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileCTADismissed]);

  const navLinks = [
    ["#instore", "In store"],
    ["#services", "Services"],
    ["#finds", "Discover"],
    ["#reviews", "Reviews"],
    ["#hours", "Hours"],
    ["#contact", "Contact"],
  ];

  const orderCta = (
    <Link to="/order" onClick={() => track("order_online_click", { location: "nav" })}
      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-sm font-semibold bg-[#d9c3a6] text-[#2a231b] hover:bg-[#cfb897] transition border border-[#c9b79f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
    >
      <ShoppingCart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      Order Online
    </Link>
  );

  const essentials = [
    { icon: CupSoda, title: "Cold drinks", desc: "Local favourites, plus a small range of American drinks." },
    { icon: Cookie, title: "Snacks", desc: "Everyday snacks, with some American and Kiwi options available." },
    { icon: ShoppingBag, title: "Everyday essentials", desc: "Local basics when you need them." },
  ];

  const extraRange = [
    { icon: Disc, title: "Hand trolley wheels", desc: "Replacement wheels available in store." },
    { icon: Disc, title: "Wheelbarrow wheels", desc: "A small range of options available." },
    { icon: Wrench, title: "Hand tools & socket sets", desc: "Handy items for quick jobs." },
  ];

  const hiddenFinds = [
    { icon: Flame, title: "Cooking spices", desc: "A large range — cumin, turmeric and more." },
    { icon: Milk, title: "Ricotta & other cheeses", desc: "A few options beyond the usual block cheddar." },
    { icon: Battery, title: "Batteries", desc: "Common household sizes." },
    { icon: ChefHat, title: "Baking needs", desc: "Flour, sugar and other baking basics." },
    { icon: Utensils, title: "Sauces & marinades", desc: "For a quick dinner without the supermarket trip." },
  ];

  const reviews = [
    { name: "Luisa Cali", text: "I have recently moved to Hawthorne and this store has staff that are genuine and ultra friendly. The store looks small but has so many grocery items." },
    { name: "MrB Greig", text: "A very nice experience here. The couple that helped me out was very friendly. Bought a USB-C cord and socket connection — it ended up working out very well with an amazingly working recharge unit! Highly recommended!" },
    { name: "Andrew Pollock", text: "Raj is a local legend and the store is incredibly convenient." },
    { name: "Aoifa", text: "Fantastic range of soft drinks, including some international ones! The clerk was lovely and even offered to open my drink for me — great service!" },
    { name: "Aimee Damerow", text: "This shop regularly saves my life, and they're always very friendly." },
    { name: "Oliver Krivan", text: "Awesome shop! Some NZ treats too. Friendly guy with a nice smile." },
  ];

  const [heroRef, heroVisible] = useRevealOnScroll();
  const [instoreRef, instoreVisible] = useRevealOnScroll();
  const [servicesRef, servicesVisible] = useRevealOnScroll();
  const [reviewsRef, reviewsVisible] = useRevealOnScroll();
  const [hoursRef, hoursVisible] = useRevealOnScroll();
  const [findsRef, findsVisible] = useRevealOnScroll();
  const [contactRef, contactVisible] = useRevealOnScroll();

  const upcomingRows = useMemo(() => buildUpcomingRows(now, 7), [now]);

  return (
    <>
      {!ready && <Preloader onDone={() => { markPreloaderShown(); setReady(true); }} />}

      <div className={ui.page}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-[#2b241d] focus:text-[#f5efe6] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
        >
          Skip to content
        </a>

        {/* Header */}
        <header ref={headerRef} className={ui.header}>
          <div className={`${ui.container} py-4 flex items-center justify-between`}>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-extrabold tracking-tight truncate">{STORE.name}</div>
              <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{STORE.suburb}</div>
            </div>

            <div className="flex items-center gap-3">
              <nav className="hidden md:flex items-center gap-1 text-sm text-stone-700 dark:text-stone-200">
                {navLinks.map(([href, label]) => (
                  <a key={href} href={href}
                    className="rounded-xl px-3 py-2 hover:bg-stone-200/70 dark:hover:bg-stone-800/60 hover:text-stone-950 dark:hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                  >{label}</a>
                ))}
                <span className="ml-1">{orderCta}</span>
              </nav>

              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="md:hidden min-h-[40px] w-[40px] flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
              </button>

              <button onClick={toggleTheme}
                className="min-h-[40px] w-[40px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-stone-200/80 dark:border-stone-800">
              <div className={`${ui.container} py-3`}>
                <div className="grid gap-2">
                  <Link to="/order" onClick={() => { setMobileMenuOpen(false); track("order_online_click", { location: "mobile_nav" }); }}
                    className="w-full flex items-center gap-2 rounded-2xl border border-[#c9b79f] bg-[#d9c3a6] text-[#2a231b] px-4 py-3 text-sm font-semibold hover:bg-[#cfb897] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                  >
                    <ShoppingCart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    Order Online
                  </Link>
                  {navLinks.map(([href, label]) => (
                    <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                      className="w-full rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white/30 dark:bg-[#1a1916] px-4 py-3 text-sm font-semibold hover:bg-white/50 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                    >{label}</a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Hero */}
        <main id="main-content" ref={heroRef} className={`${ui.container} py-14 sm:py-20 ${ui.revealBase} ${heroVisible ? ui.revealVisible : ui.revealHidden}`}>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${statusPillTone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
                {statusLead}
              </span>
              {statusRest && <span className="text-stone-600 dark:text-stone-300">{statusRest}</span>}
            </div>
            {todayHoliday?.isHoliday && !forcedToday.forcedClosed && (
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-500">Public holiday: {todayHoliday.name}. Hours may differ.</p>
            )}
            <h1 className="mt-4 text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Local Convenience Store.
            </h1>
            <p className="mt-3 text-xl font-medium text-stone-500 dark:text-stone-400 tracking-tight">
              Reliable every day.
            </p>
            <p className="mt-5 text-lg text-stone-700 dark:text-stone-300 leading-relaxed">
              Snacks, cold drinks and everyday grocery essentials — including some American & Kiwi favourites.
              Dry cleaning drop-off available in store.
            </p>

            <div className="mt-8">
              <Link to="/order" onClick={() => track("order_online_click", { location: "hero" })} className={`${ui.beigePrimary} inline-flex items-center gap-2`}>
                <ShoppingCart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Order Online
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap text-sm text-stone-600 dark:text-stone-400">
              <a href={`tel:${STORE.phoneTel}`} onClick={() => track("call_click", { location: "hero" })}
                className="underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4 hover:text-stone-900 dark:hover:text-stone-100 hover:decoration-stone-500 transition"
              >Call store</a>
              <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">·</span>
              <a href={mapsLink} target="_blank" rel="noreferrer" onClick={() => track("directions_click", { location: "hero" })}
                className="underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4 hover:text-stone-900 dark:hover:text-stone-100 hover:decoration-stone-500 transition"
              >Directions</a>
              <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">·</span>
              <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" onClick={() => track("reviews_click", { location: "hero" })}
                className="underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4 hover:text-stone-900 dark:hover:text-stone-100 hover:decoration-stone-500 transition"
              >Google reviews</a>
            </div>
          </div>

          <div className="mt-10 lg:mt-0 relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800">
            <img src={storefrontImg} alt="Hawthorne Corner Store storefront"
              className="h-56 sm:h-72 lg:h-[420px] w-full object-cover object-[center_62%] contrast-[1.08] saturate-[1.12] brightness-[1.03]" loading="eager" />
          </div>
          </div>
        </main>

        {/* In store */}
        <section id="instore" className={ui.section}>
          <div ref={instoreRef} className={`max-w-7xl mx-auto ${ui.revealBase} ${instoreVisible ? ui.revealVisible : ui.revealHidden}`}>
            <SectionHeader label="IN STORE" title="Everyday basics" subtitle="The essentials — quick, local, and easy." />
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {essentials.map((item, i) => (
                <div key={item.title}
                  className={`${ui.card} ${ui.revealBase} ${instoreVisible ? ui.revealVisible : ui.revealHidden}`}
                  style={staggerStyle(instoreVisible, i)}
                >
                  <div className="flex items-start gap-4">
                    <item.icon className="h-6 w-6 shrink-0 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
                    <div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
              Imported items and speciality stock may vary depending on availability.
            </p>
          </div>
        </section>

        {/* Services */}
        <section id="services" className={ui.section}>
          <div ref={servicesRef} className={`max-w-7xl mx-auto ${ui.revealBase} ${servicesVisible ? ui.revealVisible : ui.revealHidden}`}>
            <SectionHeader label="SERVICES" title="In-store services" subtitle="Everyday services available at the counter." />
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div className={`${ui.card} ${ui.revealBase} ${servicesVisible ? ui.revealVisible : ui.revealHidden}`} style={staggerStyle(servicesVisible, 0)}>
                <div className="flex items-start gap-4">
                  <Shirt className="h-6 w-6 shrink-0 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
                  <div>
                    <h4 className="font-semibold mb-1">Dry cleaning</h4>
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      Drop off your items in store and collect when ready. Cleaning is handled by an external dry-cleaning partner.
                    </p>
                    <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">Turnaround times and pricing may vary.</p>
                  </div>
                </div>
              </div>
              <div className={`${ui.card} ${ui.revealBase} ${servicesVisible ? ui.revealVisible : ui.revealHidden}`} style={staggerStyle(servicesVisible, 1)}>
                <div className="flex items-start gap-4">
                  <IconGasBottle className="h-6 w-6 shrink-0 text-stone-700 dark:text-stone-300" />
                  <div>
                    <h4 className="font-semibold mb-1">SodaStream gas bottles</h4>
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      Bring in your empty SodaStream bottle for a quick exchange, or buy a new one in store.
                    </p>
                    <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">Subject to stock availability — call ahead if you need to confirm.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Discover */}
        <section id="finds" className={ui.section}>
          <div ref={findsRef} className={`max-w-7xl mx-auto ${ui.revealBase} ${findsVisible ? ui.revealVisible : ui.revealHidden}`}>
            <div className="grid gap-10 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <SectionHeader label="BEYOND THE BASICS" title="You might not expect this" />
                <p className="mt-4 text-sm text-stone-600 dark:text-stone-300 max-w-sm leading-relaxed">
                  A corner store with a wider net than it looks — grocery surprises most people don't expect, plus a small hardware corner for the jobs that can't wait for a trip across town.
                </p>
                <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
                  Stock varies — give us a call if you're after something in particular.
                </p>
              </div>
              <div className="lg:col-span-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] overflow-hidden h-fit">
                <div className="divide-y divide-stone-200/80 dark:divide-stone-800">
                  {[...hiddenFinds, ...extraRange].map((item, i) => (
                    <div key={item.title}
                      className={`flex items-center gap-4 px-6 py-4 ${ui.revealBase} ${findsVisible ? ui.revealVisible : ui.revealHidden}`}
                      style={staggerStyle(findsVisible, i)}
                    >
                      <item.icon className="h-5 w-5 shrink-0 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
                      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-4 flex-wrap">
                        <h4 className="font-semibold">{item.title}</h4>
                        <p className="text-sm text-stone-600 dark:text-stone-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section id="reviews" className={ui.section}>
          <div ref={reviewsRef} className={`max-w-7xl mx-auto ${ui.revealBase} ${reviewsVisible ? ui.revealVisible : ui.revealHidden}`}>
            <SectionHeader
              label="REVIEWS"
              title="What customers say"
              subtitle="A few highlights from our Google reviews."
              right={
                <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" onClick={() => track("reviews_click", { location: "reviews_section" })} className={`${ui.darkPrimarySm} inline-flex items-center gap-1.5`}>
                  <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  Read on Google
                </a>
              }
            />
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {reviews.map((r, idx) => (
                <div key={r.name}
                  className={`${ui.card} h-full flex flex-col ${ui.revealBase} ${reviewsVisible ? ui.revealVisible : ui.revealHidden}`}
                  style={staggerStyle(reviewsVisible, idx)}
                >
                  <div className="flex items-center gap-0.5 text-amber-500" aria-label="5 out of 5 stars">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                    “{r.text}”
                  </p>
                  <div className="mt-auto pt-4 text-xs font-semibold text-stone-700 dark:text-stone-300">
                    {r.name}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
              Shown above are excerpts from our public Google reviews.
            </p>
          </div>
        </section>

        {/* Hours */}
        <section id="hours" className={ui.section}>
          <div ref={hoursRef} className={`max-w-7xl mx-auto ${ui.revealBase} ${hoursVisible ? ui.revealVisible : ui.revealHidden}`}>
            <SectionHeader label="HOURS" title="Opening hours" subtitle="Next 7 days (public holidays flagged)."
              right={
                <span className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusPillTone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
                    {statusLead}
                  </span>
                  {statusRest && <span className="text-stone-500 dark:text-stone-400">{statusRest}</span>}
                </span>
              }
            />
            <div className="mt-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] overflow-hidden">
              <div className="divide-y divide-stone-200/80 dark:divide-stone-800">
                {upcomingRows.map((row) => {
                  const xmasClosed = row.forced.forcedClosed;
                  const ph = row.holiday.isHoliday && !xmasClosed;
                  const timeText = xmasClosed ? "Closed"
                    : row.baseHours ? `${formatTime(row.baseHours.open)} – ${formatTime(row.baseHours.close)}`
                    : "—";
                  return (
                    <div key={row.iso}
                      className={["px-6 py-4", row.isToday ? "border-l-4 border-[#c9b79f]" : "border-l-4 border-transparent"].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          {row.isToday ? <span className="inline-flex h-2 w-2 rounded-full bg-[#c9b79f]" aria-hidden="true" /> : null}
                          <div className="font-semibold">
                            {row.label}
                            {row.isToday ? <span className="ml-2 text-xs text-stone-500">Today</span> : null}
                          </div>
                          {xmasClosed ? <HolidayTag tone="red">Closed</HolidayTag> : null}
                          {ph ? <HolidayTag>Public holiday</HolidayTag> : null}
                        </div>
                        <div className="text-stone-700 dark:text-stone-300 font-semibold">{timeText}</div>
                      </div>
                      {xmasClosed ? (
                        <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">Christmas Day • Closed all day</div>
                      ) : ph ? (
                        <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">{row.holiday.name} • Hours may differ</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
              Standard hours apply unless otherwise noted. Hours may change on public holidays.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className={ui.section}>
          <div ref={contactRef} className={`max-w-7xl mx-auto ${ui.revealBase} ${contactVisible ? ui.revealVisible : ui.revealHidden}`}>
            <SectionHeader label="CONTACT" title="Find us" subtitle="Call, check reviews, or get directions." />
            <div className="mt-7 grid gap-8 lg:grid-cols-2 items-start">
              <div className={`${ui.card} h-fit`}>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                    <MapPin className="h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400" strokeWidth={1.75} aria-hidden="true" />
                    <span className="font-semibold">{STORE.suburb}</span>
                  </p>
                  <p className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                    <Phone className="h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400" strokeWidth={1.75} aria-hidden="true" />
                    <a href={`tel:${STORE.phoneTel}`}
                      onClick={() => track("call_click", { location: "contact_info" })}
                      className="font-semibold underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
                    >{STORE.phoneDisplay}</a>
                  </p>
                  <div className="pt-3">
                    <div className="text-xs text-stone-500 dark:text-stone-400 mb-2">We accept</div>
                    <div className="flex gap-2 flex-wrap">
                      {PAYMENT_METHODS.map((method) => (
                        <PaymentChip key={method}>{method}</PaymentChip>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 flex items-center gap-3 flex-wrap">
                    <Link to="/order" onClick={() => track("order_online_click", { location: "contact" })} className={`${ui.beigePrimarySm} inline-flex items-center gap-1.5`}>
                      <ShoppingCart className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      Order Online
                    </Link>
                    <a className={ui.darkPrimarySm} href={`tel:${STORE.phoneTel}`} onClick={() => track("call_click", { location: "contact" })}>Call Store</a>
                  </div>
                  <div className="pt-3 flex items-center gap-3 flex-wrap text-sm text-stone-600 dark:text-stone-400">
                    <a href={mapsLink} target="_blank" rel="noreferrer" onClick={() => track("directions_click", { location: "contact" })}
                      className="underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4 hover:text-stone-900 dark:hover:text-stone-100 hover:decoration-stone-500 transition"
                    >Directions</a>
                    <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">·</span>
                    <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" onClick={() => track("reviews_click", { location: "contact" })}
                      className="underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4 hover:text-stone-900 dark:hover:text-stone-100 hover:decoration-stone-500 transition"
                    >Google reviews</a>
                    <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">·</span>
                    <a href={FACEBOOK_URL} target="_blank" rel="noreferrer" onClick={() => track("facebook_click", { location: "contact" })}
                      className="underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4 hover:text-stone-900 dark:hover:text-stone-100 hover:decoration-stone-500 transition"
                    >Facebook</a>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916]">
                <iframe title="Map" src={mapsEmbed}
                  className="w-full h-[320px] md:h-[380px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile quick actions */}
        {showMobileCTA && (
          <div className="sm:hidden fixed bottom-4 left-0 right-0 px-4 z-50">
            <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee]/95 dark:bg-[#1a1916]/95 shadow-lg p-2">
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="text-xs text-stone-500 dark:text-stone-400">Quick actions</div>
                <button onClick={() => setMobileCTADismissed(true)}
                  className="min-h-[32px] px-2 rounded-xl text-sm border border-stone-200/80 dark:border-stone-800 bg-white/30 dark:bg-black/10 hover:bg-white/50 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
                  aria-label="Dismiss quick actions"
                ><X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${STORE.phoneTel}`} onClick={() => track("call_click", { location: "mobile_cta" })} className={ui.beigePrimary}>Call</a>
                <a href={mapsLink} target="_blank" rel="noreferrer" onClick={() => track("directions_click", { location: "mobile_cta" })} className={ui.darkPrimary}>Directions</a>
              </div>
            </div>
          </div>
        )}

        <div className="sm:hidden h-24" />

        {/* Footer */}
        <footer className="px-6 py-10 border-t border-stone-200/80 dark:border-stone-800">
          <div className="max-w-7xl mx-auto grid gap-6 sm:grid-cols-3 text-sm text-stone-600 dark:text-stone-400">
            <div>
              <div className="font-extrabold text-stone-900 dark:text-stone-100">{STORE.name}</div>
              <div>{STORE.suburb}</div>
            </div>
            <div>
              <div className="font-semibold text-stone-900 dark:text-stone-100">Phone</div>
              <div>{STORE.phoneDisplay}</div>
              <a href={FACEBOOK_URL} target="_blank" rel="noreferrer" onClick={() => track("facebook_click", { location: "footer" })}
                className="inline-block mt-1 underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
              >Facebook</a>
            </div>
            <div>
              <div className="font-semibold text-stone-900 dark:text-stone-100">Status</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusPillTone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
                  {statusLead}
                </span>
                {statusRest && <span>{statusRest}</span>}
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-xs text-stone-500 dark:text-stone-500 mt-6">
            <Link to="/privacy" className="underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500">Privacy Policy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms" className="underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500">Terms &amp; Conditions</Link>
          </div>
          <div className="max-w-7xl mx-auto text-xs text-stone-500 dark:text-stone-500 mt-4 text-center">
            © {new Date().getFullYear()} {STORE.name}
          </div>
          <div className="max-w-7xl mx-auto text-xs text-stone-500 dark:text-stone-500 mt-2 text-center">
            Made by{" "}
            <a href="https://jaineel.dev" target="_blank" rel="noreferrer"
              className="font-semibold text-stone-700 dark:text-stone-300 underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
            >Jaineel</a>{" "}
            • Hosted on{" "}
            <a href="https://vercel.com" target="_blank" rel="noreferrer"
              className="underline decoration-stone-300 dark:decoration-stone-700 hover:decoration-stone-500"
            >Vercel</a>
          </div>
        </footer>

        <Analytics />
      </div>
    </>
  );
}