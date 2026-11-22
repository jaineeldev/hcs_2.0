import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock, LogOut, Sun, Moon, Phone, Mail, ClipboardList, CheckCircle2,
  ChefHat, PackageCheck, Clock, AlertCircle, ArrowLeft, Boxes, X, Power,
} from "lucide-react";
import { STORE } from "../lib/store.js";
import { ui, getInitialTheme, setStoredTheme } from "../lib/theme.js";
import { PRODUCTS, CATEGORIES, formatPrice, variantLabel } from "../data/products.js";
import { getStaffOrders, updateStaffOrderStatus } from "../lib/staffOrders.js";
import { getOutOfStockIds, setProductStock } from "../lib/stock.js";
import { getOrderingMode, setOrderingMode } from "../lib/orderingOverride.js";
import { isStaffUnlocked, setStaffUnlocked, staffLogin, staffLogout } from "../lib/staffAuth.js";
import { playChime } from "../lib/chime.js";

// Square's published AU rate for online/remote card payments (flat, no AU
// surcharging allowed since Oct 2026 — this is just for your own bookkeeping,
// never shown to customers or added to what they're charged).
const SQUARE_FEE_RATE = 0.022;

const STATUS_FLOW = {
  new: { label: "New", next: "preparing", nextLabel: "Start preparing", icon: AlertCircle, tone: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" },
  preparing: { label: "Preparing", next: "ready", nextLabel: "Mark ready", icon: ChefHat, tone: "text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900" },
  ready: { label: "Ready for pickup", next: "completed", nextLabel: "Mark collected", icon: PackageCheck, tone: "text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900" },
  completed: { label: "Collected", next: null, nextLabel: null, icon: CheckCircle2, tone: "text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800" },
};

function timeAgo(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

function StaffLogin({ onUnlock }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ok = await staffLogin(value);
      if (ok) {
        setStaffUnlocked();
        onUnlock();
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Staff login request failed:", err);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${ui.page} min-h-screen flex items-center justify-center p-6`}>
      <form onSubmit={handleSubmit} className={`${ui.cardNoPad} w-full max-w-sm p-6`}>
        <div className="h-11 w-11 rounded-xl bg-stone-200/70 dark:bg-stone-800/70 flex items-center justify-center">
          <Lock className="h-5 w-5 text-stone-700 dark:text-stone-300" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight">Staff access</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Enter the passcode to view incoming orders.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          className="mt-4 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white/60 dark:bg-black/20 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
          placeholder="Passcode"
        />
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">Wrong passcode — try again.</p>}
        <button type="submit" disabled={submitting} className={`${ui.beigePrimary} w-full mt-4 disabled:opacity-50`}>
          {submitting ? "Checking…" : "Unlock"}
        </button>
        <Link to="/" className="mt-4 flex items-center justify-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition">
          <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Back to site
        </Link>
      </form>
    </div>
  );
}

function OrderCard({ order, justArrived, onAdvance }) {
  const status = STATUS_FLOW[order.status] || STATUS_FLOW.new;
  const StatusIcon = status.icon;
  const orderTotal = order.total ?? order.subtotal;

  return (
    <div className={`${ui.cardNoPad} p-5 transition-all ${justArrived ? "ring-2 ring-[#c9b79f] shadow-lg" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-stone-500 dark:text-stone-400">{order.orderNumber}</div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-500 dark:text-stone-400">
            <Clock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {timeAgo(order.receivedAt)}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.tone}`}>
          <StatusIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <div className="mt-4 space-y-1">
        {order.items.map((line) => (
          <div key={line.key} className="flex items-center justify-between text-sm">
            <span className="text-stone-700 dark:text-stone-300">{line.qty} × {variantLabel(line.product, line.size, line.flavour)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-stone-200/80 dark:border-stone-800 text-sm space-y-1">
        <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
        </div>
        {order.packingFee != null && (
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
            <span>Packing fee</span>
            <span className="tabular-nums">{formatPrice(order.packingFee)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-semibold pt-1">
          <span>Total charged</span>
          <span className="tabular-nums">{formatPrice(orderTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>Square fee (2.2%, est.)</span>
          <span className="tabular-nums">−{formatPrice(orderTotal * SQUARE_FEE_RATE)}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-300">
          <span>Net to you</span>
          <span className="tabular-nums">{formatPrice(orderTotal * (1 - SQUARE_FEE_RATE))}</span>
        </div>
        <div className="text-stone-600 dark:text-stone-300 pt-1">Pickup: {order.pickupLabel}</div>
        <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
          <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <a href={`tel:${order.phone}`} className="underline decoration-stone-300 dark:decoration-stone-700">{order.name} · {order.phone}</a>
        </div>
        {order.email && (
          <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
            <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <a href={`mailto:${order.email}`} className="underline decoration-stone-300 dark:decoration-stone-700 truncate">{order.email}</a>
          </div>
        )}
        {order.note && <div className="text-xs text-stone-500 dark:text-stone-400 italic">"{order.note}"</div>}
      </div>

      {status.next && (
        <button
          onClick={() => onAdvance(order.orderNumber, status.next)}
          className={`${ui.beigePrimarySm} w-full mt-4`}
        >
          {status.nextLabel}
        </button>
      )}
    </div>
  );
}

function StockPanel({ outOfStockIds, onToggle, onClose }) {
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
      <div className={`${ui.cardNoPad} relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 rounded-b-none sm:rounded-b-2xl`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-stone-200/70 dark:bg-stone-800/70 hover:bg-stone-300/70 dark:hover:bg-stone-700/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-stone-200/70 dark:bg-stone-800/70 flex items-center justify-center">
            <Boxes className="h-5 w-5 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Manage stock</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Out-of-stock items can't be added on the order page.</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {byCategory.map(({ category, items }) => (
            <div key={category}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{category}</h3>
              <div className="mt-2 space-y-2">
                {items.map((product) => {
                  const outOfStock = outOfStockIds.has(product.id);
                  return (
                    <div key={product.id} className="flex items-center justify-between gap-3 py-1">
                      <span className="text-sm text-stone-800 dark:text-stone-200 truncate">{product.name}</span>
                      <button
                        type="button"
                        onClick={() => onToggle(product.id, outOfStock)}
                        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                          outOfStock
                            ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                            : "text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                        }`}
                      >
                        {outOfStock ? "Out of stock" : "In stock"}
                      </button>
                    </div>
                  );
                })}
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
      <div className={`${ui.cardNoPad} relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 rounded-b-none sm:rounded-b-2xl`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-stone-200/70 dark:bg-stone-800/70 hover:bg-stone-300/70 dark:hover:bg-stone-700/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
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
              className={`w-full text-left rounded-xl border p-3 transition ${
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
  const [unlocked, setUnlocked] = useState(() => isStaffUnlocked());
  const [theme, setTheme] = useState(() => getInitialTheme());
  const [orders, setOrders] = useState([]);
  const [justArrivedIds, setJustArrivedIds] = useState(() => new Set());
  const prevIdsRef = useRef(null);
  const [outOfStockIds, setOutOfStockIds] = useState(() => new Set());
  const [stockPanelOpen, setStockPanelOpen] = useState(false);
  const [orderingMode, setOrderingModeState] = useState("auto");
  const [orderingPanelOpen, setOrderingPanelOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!unlocked) return;

    async function refreshStock() {
      try {
        setOutOfStockIds(new Set(await getOutOfStockIds()));
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

  async function toggleStock(productId, currentlyOutOfStock) {
    const nextOutOfStock = !currentlyOutOfStock;
    setOutOfStockIds((prev) => {
      const next = new Set(prev);
      if (nextOutOfStock) next.add(productId); else next.delete(productId);
      return next;
    });

    try {
      await setProductStock(productId, currentlyOutOfStock);
    } catch (err) {
      console.error("Failed to update stock:", err);
      setOutOfStockIds((prev) => {
        const reverted = new Set(prev);
        if (currentlyOutOfStock) reverted.add(productId); else reverted.delete(productId);
        return reverted;
      });
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
      let latest;
      try {
        latest = await getStaffOrders();
      } catch (err) {
        console.error("Failed to load orders:", err);
        return;
      }
      const latestIds = new Set(latest.map((o) => o.orderNumber));

      if (prevIdsRef.current) {
        const arrived = latest.filter((o) => !prevIdsRef.current.has(o.orderNumber));
        if (arrived.length > 0) {
          playChime();
          setJustArrivedIds(new Set(arrived.map((o) => o.orderNumber)));
          setTimeout(() => setJustArrivedIds(new Set()), 4000);
        }
      }

      prevIdsRef.current = latestIds;
      setOrders(latest);
    }

    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [unlocked]);

  async function advanceStatus(orderNumber, nextStatus) {
    setOrders((prev) => prev.map((o) => (o.orderNumber === orderNumber ? { ...o, status: nextStatus } : o)));
    try {
      await updateStaffOrderStatus(orderNumber, nextStatus);
    } catch (err) {
      console.error("Failed to update order status:", err);
    }

    if (nextStatus === "ready") {
      fetch("/api/send-ready-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      }).catch((err) => console.error("Ready email request failed:", err));
    }
  }

  if (!unlocked) {
    return <StaffLogin onUnlock={() => setUnlocked(true)} />;
  }

  const active = orders.filter((o) => o.status !== "completed");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <div className={`${ui.container} py-4 flex items-center justify-between`}>
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold hover:text-stone-600 dark:hover:text-stone-300 transition">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {STORE.name} · Staff
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setOrderingPanelOpen(true)}
              className={`min-h-[40px] w-[40px] flex items-center justify-center border rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60 ${
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
              className="min-h-[40px] w-[40px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Manage stock"
              title="Manage stock"
            >
              <Boxes className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button onClick={toggleTheme}
              className="min-h-[40px] w-[40px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
            </button>
            <button onClick={() => { staffLogout(); setUnlocked(false); }}
              className="min-h-[40px] w-[40px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className={`${ui.container} py-10`}>
        {orderingMode !== "auto" && (
          <button
            onClick={() => setOrderingPanelOpen(true)}
            className="w-full text-left mb-6 flex items-center gap-2 text-sm rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/50 transition"
          >
            <Power className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Online ordering is manually {orderingMode === "open" ? "forced open" : "forced closed"} — tap to change.
          </button>
        )}

        <div className="flex items-center gap-2 text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">
          <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ORDER BOARD
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
          {active.length === 0 ? "No active orders" : `${active.length} active order${active.length === 1 ? "" : "s"}`}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Updates automatically. Keep this tab open on the counter tablet.
        </p>

        {active.length === 0 ? (
          <div className={`${ui.card} mt-8 text-center py-12`}>
            <p className="text-sm text-stone-500 dark:text-stone-400">Waiting for orders…</p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white/30 dark:bg-black/10 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((order) => (
                <OrderCard
                  key={order.orderNumber}
                  order={order}
                  justArrived={justArrivedIds.has(order.orderNumber)}
                  onAdvance={advanceStatus}
                />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mt-14 pt-10 border-t border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              COLLECTED TODAY
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight">
              {completed.length} order{completed.length === 1 ? "" : "s"} collected
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {completed.map((order) => (
                <OrderCard key={order.orderNumber} order={order} justArrived={false} onAdvance={advanceStatus} />
              ))}
            </div>
          </div>
        )}
      </main>

      {stockPanelOpen && (
        <StockPanel
          outOfStockIds={outOfStockIds}
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
