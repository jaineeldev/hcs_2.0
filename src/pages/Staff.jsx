import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock, LogOut, Sun, Moon, Phone, Mail, ClipboardList, CheckCircle2,
  ChefHat, PackageCheck, Clock, AlertCircle, ArrowLeft, Boxes, X, Power, ChevronRight, Delete, BarChart3, VolumeX,
} from "lucide-react";
import { STORE, SQUARE_FEE_RATE } from "../lib/store.js";
import { ui, getInitialTheme, setStoredTheme } from "../lib/theme.js";
import { PRODUCTS, CATEGORIES, formatPrice, variantLabel, variantsOf, productStock } from "../data/products.js";
import { getStaffOrders, updateStaffOrderStatus } from "../lib/staffOrders.js";
import { getOutOfStockKeys, setStockKey } from "../lib/stock.js";
import { getOrderingMode, setOrderingMode } from "../lib/orderingOverride.js";
import { checkStaffSession, staffLogin, staffLogout } from "../lib/staffAuth.js";
import { playChime, primeChime, chimeReady } from "../lib/chime.js";


const STATUS_FLOW = {
  new: { label: "New", next: "preparing", nextLabel: "Start preparing", icon: AlertCircle, tone: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" },
  preparing: { label: "Preparing", next: "ready", nextLabel: "Mark ready", icon: ChefHat, tone: "text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900" },
  ready: { label: "Ready for pickup", next: "completed", nextLabel: "Mark collected", icon: PackageCheck, tone: "text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900" },
  completed: { label: "Collected", next: null, nextLabel: null, icon: CheckCircle2, tone: "text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800" },
};

// Three clear surface levels so "box inside box" reads at a glance on the
// counter tablet:  page  →  recessed column (a step darker, like a tray)
// →  raised card (a step lighter, firmer border, soft shadow).
// Dark mode keeps the same order: page → darker tray → lighter card.
const SURFACE = {
  lane: "bg-[#e7dfd0] dark:bg-[#0c0b0a]",
  laneHeader: "border-b border-stone-300/70 dark:border-stone-800",
  card: "bg-[#fffdf8] dark:bg-[#292723] border border-stone-300 dark:border-stone-700 shadow-[0_1px_3px_rgba(41,33,24,0.12)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.6)]",
  row: "bg-[#fffdf8]/90 dark:bg-[#22201d] border border-stone-300/80 dark:border-stone-700/80",
};

function timeAgo(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

const MAX_PIN_LENGTH = 12;

// Tablet-first PIN keypad. A physical keyboard works too (digits, Backspace,
// Enter, Escape). The device then stays logged in for 7 days.
function StaffLogin({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null); // { kind, text }
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef("");
  pinRef.current = pin;

  function press(digit) {
    setError(null);
    setPin((p) => (p.length < MAX_PIN_LENGTH ? p + digit : p));
  }
  function backspace() {
    setError(null);
    setPin((p) => p.slice(0, -1));
  }
  function clear() {
    setError(null);
    setPin("");
  }

  async function submit() {
    const value = pinRef.current;
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const { result, triesLeft, message } = await staffLogin(value);
      if (result === "ok") {
        onUnlock();
        return;
      }
      setPin("");
      if (result === "wrong") {
        setError({ kind: "wrong", text: triesLeft > 0 && triesLeft <= 3 ? `Wrong PIN — ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left before a 15-minute lockout.` : "Wrong PIN — try again." });
      } else if (result === "locked") {
        setError({ kind: "locked", text: message || "Too many wrong tries. Try again in 15 minutes." });
      } else {
        setError({ kind: "error", text: "Couldn't reach the server or staff login isn't set up. Try again in a moment." });
      }
    } catch (err) {
      console.error("Staff login request failed:", err);
      setError({ kind: "error", text: "Couldn't reach the server. Check the connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === "Backspace") { backspace(); e.preventDefault(); }
      else if (e.key === "Escape") clear();
      else if (e.key === "Enter") { submit(); e.preventDefault(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = "min-h-[64px] rounded-2xl text-2xl font-semibold tabular-nums bg-white/60 dark:bg-black/20 border border-stone-300 dark:border-stone-700 hover:bg-white/90 dark:hover:bg-stone-800/70 active:scale-[0.97] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70";

  return (
    <div className={`${ui.page} min-h-screen flex items-center justify-center p-6`}>
      <div className="w-full max-w-xs p-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-stone-200/70 dark:bg-stone-800/70 flex items-center justify-center">
            <Lock className="h-5 w-5 text-stone-700 dark:text-stone-300" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Staff access</h1>
            <p className="text-xs text-stone-600 dark:text-stone-300">Enter the staff PIN.</p>
          </div>
        </div>

        <div
          className="mt-5 h-12 flex items-center justify-center gap-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white/40 dark:bg-black/20"
          role="status"
          aria-label={pin.length ? `${pin.length} digit${pin.length === 1 ? "" : "s"} entered` : "No digits entered"}
        >
          {pin.length === 0 ? (
            <span className="text-sm text-stone-400 dark:text-stone-500">PIN</span>
          ) : (
            Array.from(pin).map((_, i) => <span key={i} className="h-3 w-3 rounded-full bg-stone-800 dark:bg-stone-200" aria-hidden="true" />)
          )}
        </div>

        <p className={`mt-2 min-h-[2.5rem] text-xs ${error ? "text-red-600 dark:text-red-400" : "text-transparent"}`} aria-live="polite">
          {error?.text || "."}
        </p>

        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} disabled={submitting} className={key}>{d}</button>
          ))}
          <button type="button" onClick={clear} disabled={submitting} className={`${key} text-sm font-medium`}>Clear</button>
          <button type="button" onClick={() => press("0")} disabled={submitting} className={key}>0</button>
          <button type="button" onClick={backspace} disabled={submitting} aria-label="Delete last digit" className={`${key} flex items-center justify-center`}>
            <Delete className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <button type="button" onClick={submit} disabled={submitting || pin.length === 0} className={`${ui.beigePrimary} w-full mt-4 disabled:opacity-50`}>
          {submitting ? "Checking…" : "Unlock"}
        </button>
        <p className="mt-3 text-center text-[11px] text-stone-500 dark:text-stone-400">This device stays logged in for 7 days.</p>
        <Link to="/" className="mt-1 min-h-[44px] flex items-center justify-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Back to site
        </Link>
      </div>
    </div>
  );
}

function formatCollected(ts) {
  return new Date(ts).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

// Compact by design: what staff act on (items, pickup, customer, next step) is
// always visible; the money breakdown folds into one expandable line so a
// board full of orders stays scannable.
function OrderCard({ order, justArrived, onAdvance, showStatus = false }) {
  const status = STATUS_FLOW[order.status] || STATUS_FLOW.new;
  const StatusIcon = status.icon;
  const orderTotal = order.total ?? order.subtotal;
  const collected = order.status === "completed";

  return (
    // Raised card on a recessed column. No hover lift — on touch screens
    // hover styles stick after a tap.
    <div className={`rounded-xl ${SURFACE.card} p-3.5 transition-shadow ${justArrived ? "ring-2 ring-[#b9a17f] dark:ring-[#c9b79f] shadow-lg" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{order.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            <span className="font-mono">{order.orderNumber}</span>
            <span aria-hidden="true">·</span>
            <Clock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
            {collected && order.collectedAt ? `Collected ${formatCollected(order.collectedAt)}` : timeAgo(order.receivedAt)}
          </div>
        </div>
        {showStatus && (
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.tone}`}>
            <StatusIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {status.label}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm font-medium text-stone-800 dark:text-stone-100">Pickup: {order.pickupLabel}</div>

      <ul className="mt-1.5 space-y-0.5">
        {order.items.map((line) => (
          <li key={line.key} className="text-sm text-stone-700 dark:text-stone-300">
            <span className="font-semibold tabular-nums">{line.qty} ×</span> {variantLabel(line.product, line.size, line.flavour)}
          </li>
        ))}
      </ul>
      {order.note && <div className="mt-2 text-xs text-stone-600 dark:text-stone-300 italic">Note: "{order.note}"</div>}

      <div className="mt-2.5 pt-2.5 border-t border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300">
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2 select-none min-h-[40px]">
            <a href={`tel:${order.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 underline decoration-stone-300 dark:decoration-stone-700">
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {order.phone}
            </a>
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" strokeWidth={2} aria-hidden="true" />
              Paid <span className="font-semibold tabular-nums text-stone-800 dark:text-stone-100">{formatPrice(orderTotal)}</span>
            </span>
          </summary>
          <div className="mt-1.5 space-y-0.5">
            {order.email && (
              <div className="flex items-center gap-1.5 min-w-0 pb-1">
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <a href={`mailto:${order.email}`} className="underline decoration-stone-300 dark:decoration-stone-700 truncate">{order.email}</a>
              </div>
            )}
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatPrice(order.subtotal)}</span></div>
            {order.packingFee != null && (
              <div className="flex justify-between"><span>Packing fee</span><span className="tabular-nums">{formatPrice(order.packingFee)}</span></div>
            )}
            <div className="flex justify-between text-stone-500 dark:text-stone-400"><span>Square fee (2.2%, est.)</span><span className="tabular-nums">−{formatPrice(orderTotal * SQUARE_FEE_RATE)}</span></div>
            <div className="flex justify-between font-semibold"><span>Net to you</span><span className="tabular-nums">{formatPrice(orderTotal * (1 - SQUARE_FEE_RATE))}</span></div>
          </div>
        </details>
      </div>

      {status.next && (
        <button
          onClick={() => onAdvance(order.orderNumber, status.next)}
          className={`${ui.beigePrimarySm} w-full mt-2 min-h-[48px] text-base select-none`}
        >
          {status.nextLabel}
        </button>
      )}
    </div>
  );
}

// Everything still to be picked across all New + Preparing orders, so staff
// can walk the shelves once for several orders instead of once per order.
function PickList({ orders }) {
  const toPick = orders.filter((o) => o.status === "new" || o.status === "preparing");
  if (toPick.length < 2) return null;

  const totals = new Map();
  for (const order of toPick) {
    for (const line of order.items) {
      const label = variantLabel(line.product, line.size, line.flavour);
      totals.set(label, (totals.get(label) || 0) + line.qty);
    }
  }
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <details open className={`shrink-0 rounded-xl ${SURFACE.card} px-4 py-2 group`}>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 select-none">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" strokeWidth={2} aria-hidden="true" />
          To pick for {toPick.length} orders
        </span>
        <span className="text-xs text-stone-500 dark:text-stone-400">{rows.reduce((n, [, q]) => n + q, 0)} items, new + preparing</span>
      </summary>
      {/* Capped height so the board below always keeps its space on one screen. */}
      <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:max-h-[4.5rem] md:overflow-y-auto overscroll-contain">
        {rows.map(([label, qty]) => (
          <li key={label} className="text-sm text-stone-700 dark:text-stone-300 truncate">
            <span className="font-semibold tabular-nums">{qty} ×</span> {label}
          </li>
        ))}
      </ul>
    </details>
  );
}

const LANES = [
  { status: "new", title: "New", empty: "No new orders" },
  { status: "preparing", title: "Preparing", empty: "Nothing being prepared" },
  { status: "ready", title: "Ready for pickup", empty: "Nothing waiting for pickup" },
];

// Column shell. From md (portrait tablet) up, each column fills the
// remaining screen height and scrolls on its own, so the whole board fits
// one screen. Below md (phones) the columns stack and the page scrolls.
// overscroll-contain stops a column's scroll from dragging the page.
function BoardColumn({ title, count, tone, footer, className = "flex", children }) {
  return (
    <section aria-label={`${title}: ${count}`} className={`${className} min-w-0 flex-col md:min-h-0 rounded-2xl ${SURFACE.lane}`}>
      <div className={`shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 ${SURFACE.laneHeader}`}>
        <h2 className="text-sm font-bold tracking-tight text-stone-800 dark:text-stone-200">{title}</h2>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border tabular-nums ${tone}`}>{count}</span>
      </div>
      <div className="p-2.5 space-y-2.5 md:flex-1 md:min-h-0 md:overflow-y-auto overscroll-contain">{children}</div>
      {footer}
    </section>
  );
}

// Collected orders as compact rows (6 per server page) with a pager pinned to
// the bottom. A 4th column on landscape tablets/desktop and phones; on
// portrait tablets it lives in a slide-in panel instead (CollectedDrawer).
function CollectedColumn({ collected, onPage, className }) {
  const { orders, page, totalPages, total } = collected;
  const pagerBtn = "min-h-[44px] px-4 rounded-xl text-sm border border-stone-300 dark:border-stone-700 hover:bg-white/60 dark:hover:bg-stone-800/60 disabled:opacity-40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60";
  return (
    <BoardColumn
      className={className}
      title="Collected"
      count={total}
      tone={STATUS_FLOW.completed.tone}
      footer={totalPages > 1 && (
        <nav aria-label="Collected orders pages" className="shrink-0 flex items-center justify-between gap-2 px-2.5 py-2 border-t border-stone-200/80 dark:border-stone-800">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} className={pagerBtn}>Previous</button>
          <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums" aria-current="page">{page} of {totalPages}</span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page === totalPages} className={pagerBtn}>Next</button>
        </nav>
      )}
    >
      {orders.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400 px-1 py-3 text-center">Nothing collected yet</p>
      ) : (
        orders.map((order) => (
          <div key={order.orderNumber} className={`rounded-xl ${SURFACE.row} px-3 py-2`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{order.name}</span>
              <span className="text-sm tabular-nums shrink-0">{formatPrice(order.total ?? order.subtotal)}</span>
            </div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
              <span className="font-mono">{order.orderNumber}</span> · {order.collectedAt ? formatCollected(order.collectedAt) : timeAgo(order.receivedAt)}
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 truncate">
              {order.items.map((l) => `${l.qty} × ${variantLabel(l.product, l.size, l.flavour)}`).join(", ")}
            </div>
          </div>
        ))
      )}
    </BoardColumn>
  );
}

// Portrait tablets: Collected opens as a full-height panel from the right.
function CollectedDrawer({ collected, onPage, onClose }) {
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Collected orders">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative h-full w-full max-w-sm p-3 bg-[#f6f0e6] dark:bg-[#161513] flex flex-col gap-2">
        <button type="button" onClick={onClose}
          className="self-end min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-stone-300 dark:border-stone-700 flex items-center gap-1.5 hover:bg-white/60 dark:hover:bg-stone-800/60 transition">
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Close
        </button>
        <CollectedColumn collected={collected} onPage={onPage} className="flex flex-1 min-h-0" />
      </div>
    </div>
  );
}

// New / Preparing / Ready (oldest first, so the next order to handle is on
// top) plus Collected. Columns: 3 on portrait tablet (Collected in a drawer),
// 4 on landscape tablet / desktop, stacked on phones.
function OrderBoard({ orders, collected, justArrivedIds, onAdvance, onPage }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-3 md:flex-1 md:min-h-0">
      {LANES.map((lane) => {
        const laneOrders = orders.filter((o) => o.status === lane.status);
        return (
          <BoardColumn key={lane.status} title={lane.title} count={laneOrders.length} tone={STATUS_FLOW[lane.status].tone}>
            {laneOrders.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 px-1 py-3 text-center">{lane.empty}</p>
            ) : (
              laneOrders.map((order) => (
                <OrderCard key={order.orderNumber} order={order} justArrived={justArrivedIds.has(order.orderNumber)} onAdvance={onAdvance} />
              ))
            )}
          </BoardColumn>
        );
      })}
      <CollectedColumn collected={collected} onPage={onPage} className="flex md:hidden lg:flex" />
    </div>
  );
}

// Pop-up panels (stock, ordering override): a static surface — the shared
// card style lifts on hover, which sticks after a tap on touch screens.
const STAFF_PANEL = "relative w-full max-h-[90vh] overflow-y-auto overscroll-contain p-6 rounded-2xl rounded-b-none sm:rounded-b-2xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916]";

const STOCK_TONE = {
  in: "text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900",
  out: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
  partial: "text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900",
};

function StockToggle({ out, onClick, label, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`shrink-0 min-h-[40px] min-w-[7.5rem] text-sm font-semibold px-3 rounded-full border transition disabled:opacity-50 select-none ${out ? STOCK_TONE.out : STOCK_TONE.in}`}
    >
      {out ? "Out of stock" : "In stock"}
    </button>
  );
}

function StockProductRow({ product, outOfStock, onToggle }) {
  const [open, setOpen] = useState(false);
  const variants = variantsOf(product);
  const state = productStock(outOfStock, product);
  const wholeOut = outOfStock.has(product.id);
  const outCount = variants.filter((v) => outOfStock.has(v.key)).length;

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-3">
        {variants.length > 1 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="min-w-0 min-h-[44px] flex items-center gap-1.5 text-left text-sm text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white"
          >
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{product.name}</span>
            {state === "partial" && (
              <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${STOCK_TONE.partial}`}>{outCount} out</span>
            )}
          </button>
        ) : (
          <span className="text-sm text-stone-800 dark:text-stone-200 truncate pl-5">{product.name}</span>
        )}
        <StockToggle
          out={wholeOut || state === "out"}
          label={`${product.name}: mark all ${wholeOut || state === "out" ? "in" : "out of"} stock`}
          onClick={() => onToggle(product.id, wholeOut || state === "out")}
        />
      </div>

      {open && variants.length > 1 && (
        <div className="mt-2 ml-5 pl-3 border-l border-stone-200 dark:border-stone-800 space-y-1.5">
          {wholeOut && (
            <p className="text-xs text-stone-500 dark:text-stone-400">Whole product is marked out — mark it in to manage items individually.</p>
          )}
          {variants.map((v) => {
            const itemLabel = [v.size, v.flavour].filter(Boolean).join(" · ");
            const out = wholeOut || outOfStock.has(v.key);
            return (
              <div key={v.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-stone-600 dark:text-stone-300 truncate">{itemLabel}</span>
                <StockToggle
                  out={out}
                  disabled={wholeOut}
                  label={`${product.name} ${itemLabel}: mark ${out ? "in" : "out of"} stock`}
                  onClick={() => onToggle(v.key, out)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StockPanel({ outOfStock, onToggle, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const byCategory = CATEGORIES
    .map((category) => ({ category, items: PRODUCTS.filter((p) => p.category === category) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className={`${STAFF_PANEL} sm:max-w-lg`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-11 w-11 flex items-center justify-center rounded-full bg-stone-200/70 dark:bg-stone-800/70 hover:bg-stone-300/70 dark:hover:bg-stone-700/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-stone-200/70 dark:bg-stone-800/70 flex items-center justify-center">
            <Boxes className="h-5 w-5 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Manage stock</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Mark a whole product, or open it to mark single sizes and flavours. Out-of-stock items can't be ordered.</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {byCategory.map(({ category, items }) => (
            <div key={category}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{category}</h3>
              <div className="mt-2 space-y-2">
                {items.map((product) => (
                  <StockProductRow key={product.id} product={product} outOfStock={outOfStock} onToggle={onToggle} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ORDERING_MODES = [
  { value: "auto", label: "Automatic", description: "Follow the store's scheduled opening hours." },
  { value: "open", label: "Force open", description: "Accept online orders even if we're outside scheduled hours." },
  { value: "closed", label: "Force closed", description: "Block online orders even during scheduled hours — closing early, etc." },
];

function OrderingPanel({ mode, onChange, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className={`${STAFF_PANEL} sm:max-w-md`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-11 w-11 flex items-center justify-center rounded-full bg-stone-200/70 dark:bg-stone-800/70 hover:bg-stone-300/70 dark:hover:bg-stone-700/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-stone-200/70 dark:bg-stone-800/70 flex items-center justify-center">
            <Power className="h-5 w-5 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Online ordering</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Overrides the scheduled hours — for closing early, staying open late, etc.</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {ORDERING_MODES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-full text-left rounded-xl border p-4 min-h-[56px] transition ${
                mode === opt.value
                  ? "border-[#c9b79f] bg-[#fbf6ee] dark:bg-[#1a1916]"
                  : "border-stone-200/80 dark:border-stone-800 hover:bg-white/40 dark:hover:bg-stone-800/40"
              }`}
            >
              <div className="text-sm font-semibold">{opt.label}</div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Staff() {
  // null = still asking the server whether this device is logged in.
  const [unlocked, setUnlocked] = useState(null);

  useEffect(() => {
    let cancelled = false;
    checkStaffSession().then((loggedIn) => { if (!cancelled) setUnlocked(loggedIn); });
    return () => { cancelled = true; };
  }, []);
  const [theme, setTheme] = useState(() => getInitialTheme());
  const [orders, setOrders] = useState([]); // active only: new / preparing / ready
  const [collected, setCollected] = useState({ orders: [], page: 1, totalPages: 1, total: 0 });
  const [collectedPage, setCollectedPage] = useState(1);
  const [justArrivedIds, setJustArrivedIds] = useState(() => new Set());
  const prevIdsRef = useRef(null);
  const refreshRef = useRef(() => {});
  const [outOfStock, setOutOfStock] = useState(() => new Set());
  const [stockPanelOpen, setStockPanelOpen] = useState(false);
  const [orderingMode, setOrderingModeState] = useState("auto");
  const [orderingPanelOpen, setOrderingPanelOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => chimeReady());
  const [collectedOpen, setCollectedOpen] = useState(false); // portrait-tablet drawer

  // Tablets mute web audio until the page is tapped. The first tap anywhere
  // unlocks the new-order chime; until then the board shows a warning.
  useEffect(() => {
    if (!unlocked || soundOn) return;
    async function unlock() {
      if (await primeChime()) setSoundOn(true);
    }
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [unlocked, soundOn]);

  // Keep the counter tablet's screen on while the board is open. The browser
  // drops the lock whenever the tab is hidden, so take it again on return.
  useEffect(() => {
    if (!unlocked || !("wakeLock" in navigator)) return;
    let lock = null;
    let cancelled = false;
    async function acquire() {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) lock.release().catch(() => {});
      } catch {
        // Low battery / power saver / unsupported — the screen may sleep.
      }
    }
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [unlocked]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!unlocked) return;

    async function refreshStock() {
      try {
        setOutOfStock(new Set(await getOutOfStockKeys()));
      } catch (err) {
        console.error("Failed to load stock:", err);
      }
    }
    async function refreshOrderingMode() {
      try {
        setOrderingModeState(await getOrderingMode());
      } catch (err) {
        console.error("Failed to load ordering mode:", err);
      }
    }

    refreshStock();
    refreshOrderingMode();
    const interval = setInterval(() => { refreshStock(); refreshOrderingMode(); }, 15000);
    return () => clearInterval(interval);
  }, [unlocked]);

  async function changeOrderingMode(mode) {
    const prev = orderingMode;
    setOrderingModeState(mode);
    try {
      await setOrderingMode(mode);
    } catch (err) {
      console.error("Failed to update ordering mode:", err);
      setOrderingModeState(prev);
    }
  }

  // key = whole product id or one exact item (products.js variantKey).
  // Marking a whole product back in also clears its individual items —
  // mirrored here so the panel matches what the server does.
  async function toggleStock(key, makeInStock) {
    setOutOfStock((prev) => {
      const next = new Set(prev);
      if (makeInStock) {
        next.delete(key);
        if (!key.includes("::")) for (const k of prev) if (k.startsWith(`${key}::`)) next.delete(k);
      } else {
        next.add(key);
      }
      return next;
    });

    try {
      await setStockKey(key, makeInStock);
    } catch (err) {
      console.error("Failed to update stock:", err);
      // Resync from the server rather than guess what to roll back.
      try { setOutOfStock(new Set(await getOutOfStockKeys())); } catch { /* next poll will fix it */ }
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  useEffect(() => {
    if (!unlocked) return;

    async function refresh() {
      let data;
      try {
        data = await getStaffOrders(collectedPage);
      } catch (err) {
        // Login expired (7 days) or logged out elsewhere → back to the PIN pad.
        if (err.status === 401) { setUnlocked(false); return; }
        console.error("Failed to load orders:", err);
        return;
      }
      const latest = data.active;
      // New-order chime is based on active orders only, so paging through
      // collected orders never looks like an arrival.
      const latestIds = new Set(latest.map((o) => o.orderNumber));
      if (prevIdsRef.current) {
        const arrived = latest.filter((o) => o.status === "new" && !prevIdsRef.current.has(o.orderNumber));
        if (arrived.length > 0) {
          playChime();
          setJustArrivedIds(new Set(arrived.map((o) => o.orderNumber)));
          setTimeout(() => setJustArrivedIds(new Set()), 4000);
        }
      }
      prevIdsRef.current = latestIds;
      setOrders(latest);
      setCollected(data.collected);
      // The server clamps the page (e.g. the last page emptied) — follow it.
      if (data.collected.page !== collectedPage) setCollectedPage(data.collected.page);
    }

    refreshRef.current = refresh;
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [unlocked, collectedPage]);

  async function advanceStatus(orderNumber, nextStatus) {
    // Optimistic: move it between lanes now (or off the board when collected).
    setOrders((prev) => nextStatus === "completed"
      ? prev.filter((o) => o.orderNumber !== orderNumber)
      : prev.map((o) => (o.orderNumber === orderNumber ? { ...o, status: nextStatus } : o)));
    try {
      await updateStaffOrderStatus(orderNumber, nextStatus);
    } catch (err) {
      console.error("Failed to update order status:", err);
    }
    refreshRef.current();

    if (nextStatus === "ready") {
      fetch("/api/send-ready-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      }).catch((err) => console.error("Ready email request failed:", err));
    }
  }

  if (unlocked === null) {
    return (
      <div className={`${ui.page} min-h-screen flex items-center justify-center`} role="status">
        <p className="text-sm text-stone-500 dark:text-stone-400">Checking login…</p>
      </div>
    );
  }
  if (!unlocked) {
    return <StaffLogin onUnlock={() => setUnlocked(true)} />;
  }

  const active = orders;
  const countOf = (s) => active.filter((o) => o.status === s).length;

  // Tablets are the main staff device. From md (portrait tablet, 768px) up
  // the page is exactly one screen tall: header + summary + pick list take
  // what they need, the board fills the rest and each column scrolls
  // internally. Phones scroll normally. touch-manipulation removes the
  // double-tap-to-zoom delay so buttons react instantly to a finger.
  return (
    <div className={`${ui.page} touch-manipulation md:h-dvh md:min-h-0 md:flex md:flex-col md:overflow-hidden`}>
      <header className={`${ui.header} shrink-0`}>
        <div className={`${ui.container} py-3 md:py-2 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="shrink-0 min-h-[44px] flex items-center gap-2 text-sm font-semibold hover:text-stone-600 dark:hover:text-stone-300 transition">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="md:hidden xl:inline">{STORE.name} · </span>Staff
            </Link>
            {/* Tablet/desktop: live counts sit in the header to give the columns more height. */}
            <h1 className="hidden md:flex items-baseline gap-2 min-w-0 pl-4 border-l border-stone-300 dark:border-stone-700">
              <span className="text-base font-extrabold tracking-tight whitespace-nowrap">
                {active.length === 0 ? "No active orders" : `${active.length} active`}
              </span>
              {active.length > 0 && (
                <span className="text-sm text-stone-500 dark:text-stone-400 truncate">
                  {countOf("new")} new · {countOf("preparing")} preparing · {countOf("ready")} ready
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Portrait tablets only — there Collected isn't a column. */}
            <button
              type="button"
              onClick={() => setCollectedOpen(true)}
              className="hidden md:inline-flex lg:hidden shrink-0 items-center gap-1.5 min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-stone-300 dark:border-stone-700 bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Collected ({collected.total})
            </button>
            <Link to="/staff/history"
              className="min-h-[44px] w-[44px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Sales and order history"
              title="Sales and order history"
            >
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <button onClick={() => setOrderingPanelOpen(true)}
              className={`min-h-[44px] w-[44px] flex items-center justify-center border rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60 ${
                orderingMode !== "auto"
                  ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                  : "border-stone-300 dark:border-stone-700 bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60"
              }`}
              aria-label="Online ordering override"
              title="Online ordering override"
            >
              <Power className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button onClick={() => setStockPanelOpen(true)}
              className="min-h-[44px] w-[44px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Manage stock"
              title="Manage stock"
            >
              <Boxes className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button onClick={toggleTheme}
              className="min-h-[44px] w-[44px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
            </button>
            <button onClick={() => { staffLogout(); setUnlocked(false); }}
              className="min-h-[44px] w-[44px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className={`${ui.container} w-full py-5 md:py-3 flex flex-col gap-3 md:flex-1 md:min-h-0`}>
        {!soundOn && (
          <button
            type="button"
            onClick={async () => { if (await primeChime()) setSoundOn(true); }}
            className="shrink-0 w-full text-left flex items-center gap-2 text-sm rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 min-h-[44px] text-amber-900 dark:text-amber-200 transition"
          >
            <VolumeX className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            New-order sound is off — tap anywhere on the screen to turn it on.
          </button>
        )}
        {orderingMode !== "auto" && (
          <button
            onClick={() => setOrderingPanelOpen(true)}
            className="shrink-0 w-full text-left flex items-center gap-2 text-sm rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-2 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/50 transition"
          >
            <Power className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Online ordering is manually {orderingMode === "open" ? "forced open" : "forced closed"} — tap to change.
          </button>
        )}

        {/* Phones only — on tablets the counts live in the header. */}
        <div className="md:hidden shrink-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <ClipboardList className="h-4 w-4 self-center" strokeWidth={2} aria-hidden="true" />
            {active.length === 0 ? "No active orders" : `${active.length} active order${active.length === 1 ? "" : "s"}`}
            {active.length > 0 && (
              <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
                · {countOf("new")} new · {countOf("preparing")} preparing · {countOf("ready")} ready
              </span>
            )}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">Updates automatically.</p>
        </div>

        <PickList orders={active} />

        <OrderBoard
          orders={active}
          collected={collected}
          justArrivedIds={justArrivedIds}
          onAdvance={advanceStatus}
          onPage={setCollectedPage}
        />
      </main>

      {collectedOpen && (
        <CollectedDrawer collected={collected} onPage={setCollectedPage} onClose={() => setCollectedOpen(false)} />
      )}

      {stockPanelOpen && (
        <StockPanel
          outOfStock={outOfStock}
          onToggle={toggleStock}
          onClose={() => setStockPanelOpen(false)}
        />
      )}

      {orderingPanelOpen && (
        <OrderingPanel
          mode={orderingMode}
          onChange={changeOrderingMode}
          onClose={() => setOrderingPanelOpen(false)}
        />
      )}
    </div>
  );
}
