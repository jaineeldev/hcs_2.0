/* =========================
   Staff sales report — fetch + CSV export helpers (client side).
   Data comes from api/sales.js (staff only). CSVs are built in the browser
   from what's already on screen, so an export always matches the report.
========================= */

export async function getSalesReport(from, to) {
  const res = await fetch(`/api/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Couldn't load the sales report.");
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---- Brisbane calendar dates (QLD has no daylight saving) ---- */

export function brisbaneToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date());
}

// "YYYY-MM-DD" ± days, without timezone drift.
export function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDay(ymd, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-AU", { timeZone: "UTC", ...opts });
}

export function rangePresets(today = brisbaneToday()) {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "yesterday", label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    { id: "7d", label: "Last 7 days", from: addDays(today, -6), to: today },
    { id: "month", label: "This month", from: monthStart, to: today },
    { id: "lastmonth", label: "Last month", from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
  ];
}

/* ---- CSV ---- */

// Quote every cell, double inner quotes, and neutralise spreadsheet formulas
// (a customer name like "=HYPERLINK(...)" must stay plain text in Excel).
function cell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

function download(filename, csv) {
  // BOM so Excel opens it as UTF-8 (keeps "×", "—", accented names intact).
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const money = (n) => (n == null ? "" : Number(n).toFixed(2));

export function exportItemsCsv(report) {
  const rows = report.items.map((it) => [it.productName, it.size, it.flavour || "", it.qty, it.amountKnown ? money(it.amount) : ""]);
  rows.push([], ["Total", "", "", report.totals.itemsSold, money(report.totals.subtotal)]);
  download(
    `hcs-items-sold_${report.from}_to_${report.to}.csv`,
    toCsv(["Product", "Size", "Flavour/Type", "Quantity sold", "Sales (AUD, inc. GST where applicable)"], rows),
  );
}

export function exportOrdersCsv(report) {
  const rows = report.orders.map((o) => [
    o.day, o.time, o.orderNumber, o.name, o.phone, o.email || "", o.status,
    o.lines.map((l) => `${l.qty} x ${l.label}`).join("; "),
    money(o.subtotal), money(o.packingFee), money(o.total),
  ]);
  download(
    `hcs-orders_${report.from}_to_${report.to}.csv`,
    toCsv(["Date", "Time", "Order", "Customer", "Phone", "Email", "Status", "Items", "Items subtotal", "Packing fee", "Total"], rows),
  );
}
