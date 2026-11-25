import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* =========================
   Small, dependency-free charts for the staff sales page.
   Built to the dataviz rules: one series per chart → one accent hue
   (validated: #a35a17 on the light card, #c27a2c on the dark card — both pass
   lightness, chroma and ≥3:1 contrast), bars ≤24px with a 4px rounded data
   end and a square baseline, hairline recessive gridlines, labels in text
   colours (never the bar colour), and a tap/hover/focus tooltip on every bar.
   Every value shown here is also in the tables below, so nothing is
   tooltip-only.
========================= */

const ACCENT_FILL = "fill-[#a35a17] dark:fill-[#c27a2c]";
const ACCENT_BG = "bg-[#a35a17] dark:bg-[#c27a2c]";

// Clean axis ticks: 0 and steps of 1/2/2.5/5 × 10ⁿ, ~4 lines.
function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Column path: rounded 4px top corners, square at the baseline.
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* ---- Column chart (one series) ----
   data: [{ key, label, tick?, value, lines: [{ value, label }] }]
   `tick` = the short x-axis label; `lines` = the tooltip rows (value first). */
export function ColumnChart({ data, height = 200, formatTick, ariaLabel }) {
  const [wrapRef, width] = useWidth();
  const [active, setActive] = useState(null);

  // Tap outside the chart clears the tooltip (touch screens have no "hover out").
  useEffect(() => {
    if (active == null) return;
    function onDown(e) { if (!wrapRef.current?.contains(e.target)) setActive(null); }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active, wrapRef]);

  const pad = { top: 8, right: 4, bottom: 22, left: 44 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1] || 1;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, slot * 0.62));
  // Thin the x labels so they never collide (~44px each).
  const every = Math.max(1, Math.ceil(44 / Math.max(slot, 1)));
  const y = (v) => pad.top + plotH - (v / top) * plotH;
  const activeItem = active != null ? data[active] : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-stone-200 dark:stroke-stone-800" strokeWidth="1" shapeRendering="crispEdges" />
              <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 dark:fill-stone-400 text-[11px] tabular-nums">{formatTick(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.left + i * slot + (slot - barW) / 2;
            const h = Math.max(0, (d.value / top) * plotH);
            const isActive = i === active;
            return (
              <g key={d.key}>
                {h > 0 && (
                  <path d={columnPath(x, pad.top + plotH - h, barW, h)} className={`${ACCENT_FILL} transition-opacity ${active != null && !isActive ? "opacity-45" : ""}`} />
                )}
                {i % every === 0 && (
                  <text x={pad.left + i * slot + slot / 2} y={height - 6} textAnchor="middle" className="fill-stone-500 dark:fill-stone-400 text-[11px]">{d.tick ?? d.label}</text>
                )}
                {/* Hit target: the whole slot, full height — far bigger than the bar. */}
                <rect
                  x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="transparent"
                  tabIndex={0} role="button" aria-label={`${d.label}: ${d.lines.map((l) => `${l.value} ${l.label}`).join(", ")}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                  className="cursor-pointer focus:outline-none"
                />
              </g>
            );
          })}
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} className="stroke-stone-300 dark:stroke-stone-700" strokeWidth="1" shapeRendering="crispEdges" />
        </svg>
      )}
      {activeItem && (
        <Tooltip
          x={pad.left + active * slot + slot / 2}
          y={y(activeItem.value)}
          width={width}
          title={activeItem.label}
          lines={activeItem.lines}
        />
      )}
    </div>
  );
}

function Tooltip({ x, y, width, title, lines }) {
  const W = 168;
  const left = Math.min(Math.max(0, x - W / 2), Math.max(0, width - W));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-stone-300 dark:border-stone-700 bg-[#fffdf8] dark:bg-[#292723] shadow-md px-3 py-2"
      style={{ left, top: Math.max(0, y - 12), width: W, transform: "translateY(-100%)" }}
      role="status"
    >
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`h-0.5 w-3 rounded-full ${ACCENT_BG}`} aria-hidden="true" />
          <span className="text-sm font-bold tabular-nums">{l.value}</span>
          <span className="text-xs text-stone-500 dark:text-stone-400">{l.label}</span>
        </div>
      ))}
      <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">{title}</div>
    </div>
  );
}

/* ---- Ranked horizontal bars (one hue), largest first ----
   data: [{ key, label, value, figure, sub? }] — `figure` is printed at the bar end. */
export function RankedBars({ data, emptyText = "No data" }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max <= 0) {
    return <p className="text-sm text-stone-500 dark:text-stone-400 py-6 text-center">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-stone-700 dark:text-stone-300">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{d.figure}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-r-[4px] bg-stone-200/70 dark:bg-stone-800/70" aria-hidden="true">
            <div className={`h-full rounded-r-[4px] ${ACCENT_BG}`} style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }} />
          </div>
          {d.sub && <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">{d.sub}</div>}
        </li>
      ))}
    </ul>
  );
}
