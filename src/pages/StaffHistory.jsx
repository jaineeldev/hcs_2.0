import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sun, Moon, Download, ChevronRight, BarChart3, AlertCircle, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { STORE, SQUARE_FEE_RATE } from "../lib/store.js";
import { ui, getInitialTheme, setStoredTheme } from "../lib/theme.js";
import { formatPrice } from "../data/products.js";
import { checkStaffSession } from "../lib/staffAuth.js";
import { getSalesReport, rangePresets, brisbaneToday, formatDay, addDays, exportItemsCsv, exportOrdersCsv } from "../lib/sales.js";
import { ColumnChart, RankedBars } from "../components/SalesCharts.jsx";

/* =========================
   Staff → Sales & history (/staff/history). Landscape-tablet first.
   Date filter (one row, scopes everything) → totals with change vs the
   previous period of the same length → charts (sales by day, by category,
   busiest times, best sellers) → orders by day + items sold table, with CSV
   exports. Same 7-day staff login as the order board.
========================= */

const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", completed: "Collected" };
// Raised card on the page background (same surface as the staff board cards).
const CARD = "rounded-2xl bg-[#fffdf8] dark:bg-[#292723] border border-stone-300 dark:border-stone-700 shadow-[0_1px_3px_rgba(41,33,24,0.10)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.6)]";
const money = (n) => formatPrice(n);
const compactMoney = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `$${Math.round(n)}`);

/* ---- data shaping (all from the one report, so every view agrees) ---- */

function dailySeries(report, from, to) {
  const byDay = new Map(report.days.map((d) => [d.day, d]));
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  // Long ranges become weekly columns so bars stay readable.
  if (dates.length > 62) {
    const weeks = new Map();
    for (const d of dates) {
      const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
      const start = addDays(d, -dow);
      const w = weeks.get(start) || { total: 0, orders: 0 };
      w.total += byDay.get(d)?.total || 0;
      w.orders += byDay.get(d)?.orders || 0;
      weeks.set(start, w);
    }
    return [...weeks].map(([start, w]) => ({
      key: start,
      label: `Week of ${formatDay(start, { day: "numeric", month: "short", year: "numeric" })}`,
      tick: formatDay(start, { day: "numeric", month: "short" }),
      value: w.total,
      lines: [{ value: money(w.total), label: "sales" }, { value: String(w.orders), label: w.orders === 1 ? "order" : "orders" }],
    }));
  }
  return dates.map((d) => {
    const day = byDay.get(d);
    return {
      key: d,
      label: formatDay(d, { weekday: "long", day: "numeric", month: "long" }),
      tick: dates.length <= 14 ? formatDay(d, { weekday: "short", day: "numeric" }) : formatDay(d, { day: "numeric" }),
      value: day?.total || 0,
      lines: [{ value: money(day?.total || 0), label: "sales" }, { value: String(day?.orders || 0), label: day?.orders === 1 ? "order" : "orders" }],
    };
  });
}

function hourlySeries(report) {
  const counts = new Map();
  for (const o of report.orders) {
    const h = Number(o.time.slice(0, 2));
    const c = counts.get(h) || { orders: 0, total: 0 };
    c.orders += 1;
    c.total += o.total;
    counts.set(h, c);
  }
  const hours = [...counts.keys()];
  const first = Math.min(7, ...hours);
  const last = Math.max(20, ...hours);
  const label = (h) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
  const out = [];
  for (let h = first; h <= last; h++) {
    const c = counts.get(h) || { orders: 0, total: 0 };
    out.push({
      key: String(h),
      label: `${label(h)} – ${label((h + 1) % 24)}`,
      tick: label(h),
      value: c.orders,
      lines: [{ value: String(c.orders), label: c.orders === 1 ? "order" : "orders" }, { value: money(c.total), label: "taken" }],
    });
  }
  return out;
}

function categoryBars(report) {
  const map = new Map();
  for (const it of report.items) {
    const c = map.get(it.category) || { amount: 0, qty: 0 };
    c.amount += it.amount;
    c.qty += it.qty;
    map.set(it.category, c);
  }
  const total = [...map.values()].reduce((s, c) => s + c.amount, 0) || 1;
  return [...map]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, c]) => ({ key: name, label: name, value: c.amount, figure: money(c.amount), sub: `${Math.round((c.amount / total) * 100)}% of item sales · ${c.qty} item${c.qty === 1 ? "" : "s"}` }));
}

function bestSellerBars(report, n = 8) {
  return report.items.slice(0, n).map((it) => ({
    key: it.label, label: it.label, value: it.qty, figure: `${it.qty} sold`, sub: it.amountKnown ? money(it.amount) : undefined,
  }));
}

/* ---- pieces ---- */

// Change vs the previous period. The period itself is named once above the
// tiles, so each tile only needs "Up 12%" (fits narrow landscape columns).
function Delta({ current, previous }) {
  if (!previous && !current) return <span className="text-[11px] text-stone-500 dark:text-stone-400">No change</span>;
  if (!previous) return <span className="text-[11px] text-stone-500 dark:text-stone-400">None before</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-[11px] text-stone-500 dark:text-stone-400">No change</span>;
  const up = pct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      {up ? "Up" : "Down"} {Math.abs(pct)}%
    </span>
  );
}

function Stat({ label, value, children, hero = false }) {
  return (
    <div className={`${CARD} px-4 py-3 min-w-0`}>
      <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{label}</div>
      {/* Never truncate the figure itself — it's the point of the tile. */}
      <div className={`mt-0.5 font-bold whitespace-nowrap ${hero ? "text-2xl xl:text-3xl tracking-tight" : "text-xl"}`}>{value}</div>
      <div className="mt-0.5 min-h-[1rem] truncate">{children}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, className = "", children }) {
  return (
    <section className={`${CARD} p-4 min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        {subtitle && <span className="text-[11px] text-stone-500 dark:text-stone-400 truncate">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function DayGroup({ day, orders }) {
  return (
    <section className={CARD}>
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-stone-200 dark:border-stone-800">
        <h3 className="text-sm font-bold">{formatDay(day.day)}</h3>
        <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
          {day.orders} order{day.orders === 1 ? "" : "s"} · <span className="font-semibold text-stone-800 dark:text-stone-100">{money(day.total)}</span>
        </div>
      </header>
      <ul className="divide-y divide-stone-200/80 dark:divide-stone-800/80">
        {orders.map((o) => (
          <li key={o.orderNumber}>
            <details className="group px-4 py-1">
              <summary className="cursor-pointer list-none flex items-center gap-3 select-none min-h-[44px]">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-open:rotate-90" strokeWidth={2} aria-hidden="true" />
                <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400 w-10 shrink-0">{o.time}</span>
                <span className="text-sm font-medium truncate flex-1 min-w-0">{o.name}</span>
                <span className="hidden sm:inline text-[11px] font-mono text-stone-500 dark:text-stone-400">{o.orderNumber}</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 w-16 text-right shrink-0">{STATUS_LABEL[o.status] || o.status}</span>
                <span className="text-sm font-semibold tabular-nums w-16 text-right shrink-0">{money(o.total)}</span>
              </summary>
              <div className="mt-1 mb-2 ml-[1.625rem] space-y-0.5 text-sm text-stone-700 dark:text-stone-300">
                {o.lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span><span className="font-semibold tabular-nums">{l.qty} ×</span> {l.label}</span>
                    <span className="tabular-nums shrink-0">{l.amount == null ? "—" : money(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
                  <span>Packing fee</span><span className="tabular-nums">{money(o.packingFee)}</span>
                </div>
                <div className="pt-1 text-xs text-stone-500 dark:text-stone-400">
                  <span className="font-mono sm:hidden">{o.orderNumber} · </span>{o.phone}{o.email ? ` · ${o.email}` : ""}
                </div>
                {!o.priceCheck && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Line prices don't add up to this order's total — check it in Square.
                  </div>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StaffHistory() {
  const [theme, setTheme] = useState(() => getInitialTheme());
  const [loggedIn, setLoggedIn] = useState(null);
  const presets = useMemo(() => rangePresets(), []);
  const [range, setRange] = useState({ from: presets[2].from, to: presets[2].to }); // last 7 days
  // The last finished fetch, tagged with the range it was for. "Loading" is
  // simply: the selected range isn't the one we have a result for yet.
  const [result, setResult] = useState({ key: null, report: null, error: "" });
  const rangeKey = `${range.from}|${range.to}`;
  const loading = Boolean(loggedIn && range.from && range.to && result.key !== rangeKey);
  const report = result.report;
  const error = result.key === rangeKey ? result.error : "";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    checkStaffSession().then((ok) => { if (!cancelled) setLoggedIn(ok); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    if (!range.from || !range.to) return;
    let cancelled = false;
    const key = `${range.from}|${range.to}`;
    getSalesReport(range.from, range.to)
      .then((data) => { if (!cancelled) setResult({ key, report: data, error: "" }); })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) setLoggedIn(false);
        // Keep showing the previous report under the error, rather than blanking it.
        else setResult((prev) => ({ key, report: prev.report, error: err.message }));
      });
    return () => { cancelled = true; };
  }, [loggedIn, range.from, range.to]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  const activePreset = presets.find((p) => p.from === range.from && p.to === range.to)?.id;
  const ordersByDay = useMemo(() => {
    const map = new Map();
    for (const o of report?.orders || []) (map.get(o.day) || map.set(o.day, []).get(o.day)).push(o);
    return map;
  }, [report]);
  // Charts are built from the report's own range so they always match the numbers.
  const charts = useMemo(() => {
    if (!report) return null;
    return {
      daily: dailySeries(report, report.from, report.to),
      hourly: hourlySeries(report),
      categories: categoryBars(report),
      best: bestSellerBars(report),
    };
  }, [report]);

  if (loggedIn === null) {
    return (
      <div className={`${ui.page} flex items-center justify-center`} role="status">
        <p className="text-sm text-stone-500 dark:text-stone-400">Checking login…</p>
      </div>
    );
  }
  if (!loggedIn) {
    return (
      <div className={`${ui.page} flex items-center justify-center p-6`}>
        <div className={`${CARD} max-w-sm w-full p-6 text-center`}>
          <h1 className="text-lg font-extrabold tracking-tight">Staff login needed</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Unlock the staff board first, then come back to sales.</p>
          <Link to="/staff" className={`${ui.beigePrimarySm} mt-4 inline-flex`}>Go to staff login</Link>
        </div>
      </div>
    );
  }

  const t = report?.totals;
  const prev = report?.previous;
  const fee = t ? t.total * SQUARE_FEE_RATE : 0;
  const spanDays = report ? Math.round((Date.parse(`${report.to}T00:00:00Z`) - Date.parse(`${report.from}T00:00:00Z`)) / 86400000) + 1 : 0;
  const periodLabel = spanDays === 1 ? "day before" : `previous ${spanDays} days`;
  const avg = t?.orders ? t.total / t.orders : 0;
  const prevAvg = prev?.orders ? prev.total / prev.orders : 0;
  const pill = (on) => `min-h-[44px] px-4 rounded-xl select-none text-sm border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60 ${
    on ? "bg-[#d9c3a6] text-[#2a231b] border-[#c9b79f] font-semibold" : "border-stone-300 dark:border-stone-700 bg-[#fffdf8]/60 dark:bg-[#292723]/60 hover:bg-white/80 dark:hover:bg-stone-800/60"}`;
  const dateInput = "min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#fffdf8] dark:bg-[#292723] px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70";
  const rangeText = report
    ? `${formatDay(report.from, { day: "numeric", month: "short", year: "numeric" })}${report.to !== report.from ? ` – ${formatDay(report.to, { day: "numeric", month: "short", year: "numeric" })}` : ""}`
    : "";

  return (
    <div className={`${ui.page} touch-manipulation`}>
      <header className={ui.header}>
        <div className={`${ui.container} py-2 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/staff" className="shrink-0 min-h-[44px] flex items-center gap-2 text-sm font-semibold hover:text-stone-600 dark:hover:text-stone-300 transition">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Order board
            </Link>
            <h1 className="flex items-center gap-2 min-w-0 pl-4 border-l border-stone-300 dark:border-stone-700 text-base font-extrabold tracking-tight">
              <BarChart3 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="truncate">Sales &amp; history</span>
              <span className="hidden lg:inline text-sm font-normal text-stone-500 dark:text-stone-400 truncate">· {STORE.name} Click &amp; Collect</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => report && exportItemsCsv(report)} disabled={!report || !report.items.length}
            className={`${ui.beigePrimarySm} min-h-[44px] inline-flex items-center gap-1.5 disabled:opacity-50 select-none`}>
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Items CSV
          </button>
          <button type="button" onClick={() => report && exportOrdersCsv(report)} disabled={!report || !report.orders.length}
            className="min-h-[44px] px-4 rounded-xl select-none text-sm border border-stone-300 dark:border-stone-700 bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition inline-flex items-center gap-1.5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60">
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Orders CSV
          </button>
          <button onClick={toggleTheme}
            className="shrink-0 min-h-[44px] w-[44px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
          </button>
          </div>
        </div>
      </header>

      <main className={`${ui.container} py-4 space-y-4`}>
        {/* One filter row that scopes everything below; exports on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button key={p.id} type="button" onClick={() => setRange({ from: p.from, to: p.to })} aria-pressed={activePreset === p.id} className={pill(activePreset === p.id)}>
                {p.label}
              </button>
            ))}
            <span className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300">
              <label htmlFor="from" className="sr-only">From</label>
              <input id="from" type="date" value={range.from} max={brisbaneToday()} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={dateInput} />
              to
              <label htmlFor="to" className="sr-only">To</label>
              <input id="to" type="date" value={range.to} max={brisbaneToday()} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={dateInput} />
            </span>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-stone-500" strokeWidth={2} aria-label="Loading" />}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-red-800 dark:text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" /> {error}
          </div>
        )}

        {/* While a new range loads, keep the last render visible but faded (no blank flash). */}
        {t && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
            <p className="text-xs text-stone-500 dark:text-stone-400 -mb-2">
              {rangeText} · changes compared with the {periodLabel}
              {prev && ` (${formatDay(prev.from, { day: "numeric", month: "short" })}${prev.to !== prev.from ? ` – ${formatDay(prev.to, { day: "numeric", month: "short" })}` : ""})`}
            </p>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <Stat label="Total taken" value={money(t.total)} hero>
                <Delta current={t.total} previous={prev?.total} />
              </Stat>
              <Stat label="Orders" value={t.orders}>
                <Delta current={t.orders} previous={prev?.orders} />
              </Stat>
              <Stat label="Average order" value={money(avg)}>
                <Delta current={avg} previous={prevAvg} />
              </Stat>
              <Stat label="Items sold" value={t.itemsSold}>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">{money(t.subtotal)} in items</span>
              </Stat>
              <Stat label="Packing fees" value={money(t.packingFees)}>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">{t.orders} × {money(2)}</span>
              </Stat>
              <Stat label="Net to you" value={money(t.total - fee)}>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">−{money(fee)} Square fee</span>
              </Stat>
            </div>
            {t.unverifiedOrders > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">{t.unverifiedOrders} order(s) have line prices that don't add up to their total — they're marked below.</p>
            )}

            {report.orders.length === 0 ? (
              <div className={`${CARD} text-center py-10`}>
                <p className="text-sm text-stone-500 dark:text-stone-400">No paid orders in this range.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <ChartCard title="Sales by day" subtitle={rangeText} className="md:col-span-2">
                    <ColumnChart data={charts.daily} height={220} formatTick={compactMoney} ariaLabel={`Sales by day, ${rangeText}`} />
                  </ChartCard>
                  <ChartCard title="Sales by category" subtitle="items only">
                    <RankedBars data={charts.categories} />
                  </ChartCard>
                  <ChartCard title="Busiest times" subtitle="orders by hour paid" className="md:col-span-2">
                    <ColumnChart data={charts.hourly} height={180} formatTick={(v) => String(v)} ariaLabel="Orders by hour of day" />
                  </ChartCard>
                  <ChartCard title="Best sellers" subtitle={`top ${charts.best.length} by quantity`}>
                    <RankedBars data={charts.best} />
                  </ChartCard>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
                  <div className="space-y-3 min-w-0">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Orders by day</h2>
                    {report.days.map((d) => <DayGroup key={d.day} day={d} orders={ordersByDay.get(d.day) || []} />)}
                  </div>
                  <div className="min-w-0 lg:sticky lg:top-20">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-3">All items sold</h2>
                    <div className={`${CARD} overflow-hidden`}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                            <th scope="col" className="text-left font-semibold px-4 py-2.5">Item</th>
                            <th scope="col" className="text-right font-semibold px-2 py-2.5">Qty</th>
                            <th scope="col" className="text-right font-semibold px-4 py-2.5">Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200/80 dark:divide-stone-800/80">
                          {report.items.map((it) => (
                            <tr key={`${it.label}`}>
                              <td className="px-4 py-2 text-stone-700 dark:text-stone-300">{it.label}</td>
                              <td className="px-2 py-2 text-right tabular-nums font-semibold">{it.qty}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{it.amountKnown ? money(it.amount) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-stone-300 dark:border-stone-700 font-semibold">
                            <td className="px-4 py-2.5">Total</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{t.itemsSold}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{money(t.subtotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
