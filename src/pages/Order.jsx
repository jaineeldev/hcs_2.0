import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "@vercel/analytics";
import {
  Sun, Moon, ArrowLeft, Plus, Minus, ShoppingCart, FlaskConical,
  Loader2, ClipboardList, X, Check, Trash2, AlertCircle, Lock, Info,
} from "lucide-react";
import { STORE } from "../lib/store.js";
import { buildPickupSlots, getOpenStatus } from "../lib/hours.js";
import { ui, getInitialTheme, setStoredTheme, disabledClass } from "../lib/theme.js";
import { PRODUCTS, CATEGORIES, PACKING_FEE, MIN_ORDER_AMOUNT, MAX_ORDER_AMOUNT, formatPrice, variantKey, variantLabel, flavoursFor, priceFor, lowestPrice, isItemOut, productStock } from "../data/products.js";
import { getOutOfStockKeys } from "../lib/stock.js";
import { getOrderingMode, applyOrderingOverride } from "../lib/orderingOverride.js";
import { isValidName, isValidAuPhone, isValidEmail } from "../lib/validate.js";

const CART_STORAGE_KEY = "hcs-click-collect-cart-v2";

// Square sends the customer back to /order?paid=<checkout token> after paying.
function readReturnToken() {
  try {
    return new URLSearchParams(window.location.search).get("paid");
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readStoredCart() {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredCart(cart) {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // sessionStorage unavailable (private browsing, disabled storage)
  }
}

function DemoBanner() {
  return (
    <div className="bg-amber-100 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-2 text-xs sm:text-sm">
        <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          <strong className="font-semibold">Testing preview.</strong>{" "}
          Online ordering uses Square's sandbox — payments are processed for real against test money only, nothing is actually charged.
        </span>
      </div>
    </div>
  );
}

function Stepper({ qty, onChange, min = 1, name, compact = false }) {
  const btnSize = compact ? "h-7 w-7" : "h-10 w-10";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-3"}`} role="group" aria-label={`Quantity for ${name}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(qty - 1); }}
        disabled={qty <= min}
        aria-label="Decrease quantity"
        className={`${btnSize} flex items-center justify-center rounded-full border border-stone-300 dark:border-stone-700 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-stone-800/60 transition disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70`}
      >
        <Minus className={iconSize} strokeWidth={2} aria-hidden="true" />
      </button>
      <span className={`${compact ? "w-5 text-sm" : "w-6 text-base"} text-center font-semibold tabular-nums`}>{qty}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(qty + 1); }}
        aria-label="Increase quantity"
        className={`${btnSize} flex items-center justify-center rounded-full border border-stone-300 dark:border-stone-700 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70`}
      >
        <Plus className={iconSize} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

function OptionChips({ legend, options, value, onChange, unavailable }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          const isOut = unavailable?.has(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              disabled={isOut}
              aria-pressed={selected}
              aria-label={isOut ? `${option}, out of stock` : undefined}
              title={isOut ? "Out of stock" : undefined}
              className={
                isOut
                  ? "min-h-[40px] px-3.5 rounded-full text-sm font-medium border border-dashed border-stone-300 dark:border-stone-700 text-stone-400 dark:text-stone-600 line-through cursor-not-allowed"
                  : selected
                    ? "min-h-[40px] px-3.5 rounded-full text-sm font-semibold bg-[#d9c3a6] text-[#2a231b] border border-[#c9b79f]"
                    : "min-h-[40px] px-3.5 rounded-full text-sm font-medium bg-white/50 dark:bg-black/20 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-white/80 dark:hover:bg-stone-800/60 transition"
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProductCard({ product, cartLines, inStock, onOpen, onQtyChange, onRemove }) {
  const Icon = product.icon;
  const fromPrice = lowestPrice(product);
  const cartQty = cartLines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className={`${ui.card} ${!inStock ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={inStock ? onOpen : undefined}
        disabled={!inStock}
        aria-disabled={!inStock}
        className="text-left flex items-center gap-3 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70 disabled:cursor-not-allowed"
      >
        <div className={`h-14 w-14 shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${
          !product.image ? "bg-stone-200/70 dark:bg-stone-800/70" : product.imageBg === "dark" ? "bg-[#1c1917]" : ""
        }`}>
          {product.image ? (
            <img src={product.image} alt="" className={product.imageBg === "dark" ? "h-11 w-11 object-contain" : "h-14 w-14 object-contain"} />
          ) : (
            <Icon className="h-6 w-6 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{product.name}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {inStock ? `From ${formatPrice(fromPrice)}` : "Out of stock"}
          </div>
        </div>
        {!inStock ? (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400">
            Unavailable
          </span>
        ) : cartQty > 0 ? (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-[#d9c3a6] text-[#2a231b]">
            {cartQty} in cart
          </span>
        ) : (
          <span className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-[#d9c3a6] text-[#2a231b]">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </button>

      {cartLines.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-200/70 dark:border-stone-800/70 space-y-2">
          {cartLines.map((line) => (
            <div key={line.key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-stone-600 dark:text-stone-400 truncate">
                {line.size}{line.flavour ? `, ${line.flavour}` : ""}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Stepper compact qty={line.qty} min={0} name={`${product.name} ${line.size}`} onChange={(n) => onQtyChange(line.key, n)} />
                <button
                  type="button"
                  onClick={() => onRemove(line.key)}
                  aria-label={`Remove ${product.name} ${line.size}${line.flavour ? `, ${line.flavour}` : ""}`}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductOptionsModal({ product, outOfStock, onClose, onAdd }) {
  const itemOut = (s, f) => isItemOut(outOfStock, product.id, s, f);
  const inStockFlavours = (s) => (flavoursFor(product, s) || [null]).filter((f) => !itemOut(s, f));
  const sizeOut = (s) => inStockFlavours(s).length === 0;

  // Start on the first size/flavour that's actually in stock.
  const firstSize = (product.sizes.find((s) => !sizeOut(s.label)) || product.sizes[0]).label;
  const [size, setSize] = useState(firstSize);
  const [flavour, setFlavour] = useState(() => inStockFlavours(firstSize)[0] ?? null);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const availableFlavours = flavoursFor(product, size);
  const unitPrice = priceFor(product, size, flavour) ?? product.sizes[0].price;
  const Icon = product.icon;

  const selectionOut = itemOut(size, flavour);
  const unavailableSizes = new Set(product.sizes.map((s) => s.label).filter(sizeOut));
  const unavailableFlavours = new Set((availableFlavours || []).filter((f) => itemOut(size, f)));

  // Some sizes don't come in every flavour (e.g. no 2% milk in 1L), and some
  // flavours may be out of stock — if the current flavour isn't orderable in
  // the new size, fall back to the first one that is.
  function changeSize(nextSize) {
    setSize(nextSize);
    const orderable = inStockFlavours(nextSize);
    if (!orderable.includes(flavour)) setFlavour(orderable[0] ?? null);
  }

  function handleAdd() {
    onAdd(product, size, flavour, qty);
    setJustAdded(true);
    setTimeout(onClose, 500);
  }

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
          <div className={`h-16 w-16 shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${
            !product.image ? "bg-stone-200/70 dark:bg-stone-800/70" : product.imageBg === "dark" ? "bg-[#1c1917]" : ""
          }`}>
            {product.image ? (
              <img src={product.image} alt="" className={product.imageBg === "dark" ? "h-12 w-12 object-contain" : "h-16 w-16 object-contain"} />
            ) : (
              <Icon className="h-7 w-7 text-stone-700 dark:text-stone-300" strokeWidth={1.6} aria-hidden="true" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">{product.name}</h2>
            <div className="text-sm font-semibold text-stone-600 dark:text-stone-300">{formatPrice(unitPrice)}</div>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <OptionChips legend="Size" options={product.sizes.map((s) => s.label)} value={size} onChange={changeSize} unavailable={unavailableSizes} />
          {availableFlavours && (
            <OptionChips legend={product.flavourLabel || "Flavour"} options={availableFlavours} value={flavour} onChange={setFlavour} unavailable={unavailableFlavours} />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Quantity</span>
          <Stepper qty={qty} onChange={(n) => setQty(Math.max(1, n))} name={product.name} />
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={selectionOut}
          className={`${disabledClass(ui.beigePrimary)} w-full mt-6 flex items-center justify-center gap-2`}
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Added
            </>
          ) : selectionOut ? (
            "Out of stock"
          ) : (
            `Add to order — ${formatPrice(unitPrice * qty)}`
          )}
        </button>
      </div>
    </div>
  );
}

// Shown when the cart is over MAX_ORDER_AMOUNT — big orders go by phone.
function OverMaxNotice({ amountOver, className = "" }) {
  return (
    <p className={`text-sm text-red-600 dark:text-red-400 ${className}`}>
      Online orders are limited to {formatPrice(MAX_ORDER_AMOUNT)} — remove {formatPrice(amountOver)} to continue, or call us on{" "}
      <a href={`tel:${STORE.phoneTel}`} className="font-semibold underline">{STORE.phoneDisplay}</a> for bigger orders.
    </p>
  );
}

function CartModal({ cartItems, subtotal, packingFee, total, belowMinimum, amountToMinimum, overMaximum, amountOverMax, isOpen, openLabel, onQtyChange, onRemove, onCheckout, onClose }) {
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

        <div className="flex items-center gap-2 text-lg font-bold tracking-tight pr-10">
          <ShoppingCart className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          Your cart
        </div>

        {cartItems.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">Your cart is empty.</p>
        ) : (
          <>
            <div className="mt-4 divide-y divide-stone-200/70 dark:divide-stone-800/70">
              {cartItems.map((line) => {
                const key = line.key;
                const label = variantLabel(line.product, line.size, line.flavour);
                return (
                  <div key={key} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-stone-700 dark:text-stone-300 truncate">{label}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{formatPrice(line.unitPrice)} each</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Stepper compact qty={line.qty} min={0} name={label} onChange={(n) => onQtyChange(key, n)} />
                      <span className="font-semibold tabular-nums w-14 text-right">{formatPrice(line.qty * line.unitPrice)}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(key)}
                        aria-label={`Remove ${label}`}
                        className="h-8 w-8 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-stone-200/80 dark:border-stone-800 text-sm space-y-1">
              <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                <span>Packing fee</span>
                <span className="tabular-nums">{formatPrice(packingFee)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>
            {!isOpen ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{openLabel} — online ordering isn't available right now.</p>
            ) : overMaximum ? (
              <OverMaxNotice amountOver={amountOverMax} className="mt-3" />
            ) : belowMinimum && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                Add {formatPrice(amountToMinimum)} more to reach the {formatPrice(MIN_ORDER_AMOUNT)} minimum order.
              </p>
            )}

            <button onClick={onCheckout} disabled={belowMinimum || overMaximum || !isOpen} className={disabledClass(`${ui.beigePrimary} w-full mt-5`)}>
              Checkout
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Order() {
  const [theme, setTheme] = useState(() => getInitialTheme());
  const [cart, setCart] = useState(() => readStoredCart());
  const [modalProduct, setModalProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [returnToken] = useState(() => readReturnToken());
  // browse | checkout | placing (redirecting to Square) | verifying (back from Square) | unpaid | confirmed
  const [step, setStep] = useState(() => (returnToken ? "verifying" : "browse"));
  const [form, setForm] = useState({ name: "", phone: "", email: "", pickup: "", note: "" });
  const [touched, setTouched] = useState({ name: false, phone: false, email: false });

  const nameValid = isValidName(form.name);
  const phoneValid = isValidAuPhone(form.phone);
  const emailValid = isValidEmail(form.email);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [confirmedVisible, setConfirmedVisible] = useState(false);
  const [outOfStock, setOutOfStock] = useState(() => new Set());
  const [orderingMode, setOrderingMode] = useState("auto");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const scheduledStatus = useMemo(() => getOpenStatus(now), [now]);
  const openStatus = useMemo(() => applyOrderingOverride(scheduledStatus, orderingMode), [scheduledStatus, orderingMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    async function refresh() {
      try {
        setOutOfStock(new Set(await getOutOfStockKeys()));
      } catch (err) {
        console.error("Failed to load stock:", err);
      }
    }
    async function refreshMode() {
      try {
        setOrderingMode(await getOrderingMode());
      } catch (err) {
        console.error("Failed to load ordering mode:", err);
      }
    }

    refresh();
    refreshMode();
    const interval = setInterval(() => { refresh(); refreshMode(); }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step !== "confirmed") {
      setConfirmedVisible(false);
      return;
    }
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (prefersReduced) {
      setConfirmedVisible(true);
      return;
    }
    // Double rAF so the initial "hidden" state actually paints before
    // transitioning, otherwise the browser can skip straight to the end state.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setConfirmedVisible(true)));
    return () => cancelAnimationFrame(id);
  }, [step]);

  useEffect(() => {
    writeStoredCart(cart);
  }, [cart]);

  // Back from Square's payment page: ask our server (which asks Square)
  // whether the order was actually paid. Square can take a moment to settle,
  // so a "pending" answer is retried a few times before giving up.
  async function verifyReturn(token) {
    setStep("verifying");
    setVerifyMessage("");
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const res = await fetch("/api/confirm-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === "paid") {
          setConfirmedOrder(data.order);
          setCart({});
          track("click_collect_order_paid", { total: Number(data.order.total).toFixed(2) });
          window.history.replaceState(null, "", "/order");
          setStep("confirmed");
          return;
        }
        if (!res.ok && res.status !== 502) {
          setVerifyMessage(data.error || "We couldn't find that order.");
          setStep("unpaid");
          return;
        }
      } catch {
        // network blip — fall through to retry
      }
      await sleep(2000);
    }
    setVerifyMessage("");
    setStep("unpaid");
  }

  useEffect(() => {
    if (returnToken) verifyReturn(returnToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  function addToCart(product, size, flavour, qty) {
    const key = variantKey(product.id, size, flavour);
    setCart((prev) => ({
      ...prev,
      [key]: { productId: product.id, size, flavour, qty: (prev[key]?.qty || 0) + qty },
    }));
    track("click_collect_add_to_cart", { productId: product.id, size, flavour, qty });
  }

  function setCartLineQty(key, nextQty) {
    setCart((prev) => {
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { ...prev[key], qty: nextQty } };
    });
  }

  function removeCartLine(key) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([key, entry]) => {
        const product = PRODUCTS.find((p) => p.id === entry.productId);
        if (!product) return null;
        // A cart saved before a catalog change can hold a combination that no
        // longer exists (e.g. 2% milk 1L) — drop it rather than mis-price it.
        const unitPrice = priceFor(product, entry.size, entry.flavour);
        if (unitPrice == null) return null;
        return { key, product, size: entry.size, flavour: entry.flavour, qty: entry.qty, unitPrice };
      })
      .filter(Boolean);
  }, [cart]);

  const itemCount = cartItems.reduce((sum, l) => sum + l.qty, 0);
  const subtotal = cartItems.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const packingFee = itemCount > 0 ? PACKING_FEE : 0;
  const orderTotal = subtotal + packingFee;
  const belowMinimum = itemCount > 0 && subtotal < MIN_ORDER_AMOUNT;
  const amountToMinimum = MIN_ORDER_AMOUNT - subtotal;
  // Compared in cents so float drift (e.g. 150.00000001) can't trip the limit.
  const overMaximum = Math.round(subtotal * 100) > Math.round(MAX_ORDER_AMOUNT * 100);
  const amountOverMax = subtotal - MAX_ORDER_AMOUNT;

  const cartLinesByProduct = useMemo(() => {
    const groups = {};
    for (const line of cartItems) {
      (groups[line.product.id] ||= []).push(line);
    }
    return groups;
  }, [cartItems]);

  const pickupSlots = useMemo(() => buildPickupSlots(new Date(), { days: 4 }), []);

  const productsByCategory = useMemo(
    () => CATEGORIES
      .map((category) => ({ category, items: PRODUCTS.filter((p) => p.category === category) }))
      .filter((group) => group.items.length > 0),
    []
  );

  function goToCheckout() {
    if (itemCount === 0 || belowMinimum || overMaximum || !openStatus.isOpen) return;
    setPaymentError("");
    track("click_collect_checkout_started", { itemCount, subtotal: subtotal.toFixed(2) });
    setStep("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true });
    setPaymentError("");
    if (!nameValid || !phoneValid || !emailValid || !form.pickup) return;

    const pickupMatch = pickupSlots
      .flatMap((day) => day.times.map((t) => ({ ...t, day: day.label })))
      .find((t) => t.value === form.pickup);
    const pickupLabelText = pickupMatch ? `${pickupMatch.day}, ${pickupMatch.label}` : "—";

    setStep("placing");
    track("click_collect_order_submit", { itemCount, subtotal: subtotal.toFixed(2) });

    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((l) => ({ productId: l.product.id, size: l.size, flavour: l.flavour || null, qty: l.qty })),
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          pickupLabel: pickupLabelText,
          note: form.note.trim(),
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Couldn't reach the store's server. Check your connection and try again.");
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Couldn't start the payment. Please try again.");
      }

      // Off to Square's own payment page. The cart stays in sessionStorage,
      // so it's still there if the customer comes back without paying.
      window.location.assign(data.url);
    } catch (err) {
      setPaymentError(err.message || "Something went wrong. Please try again.");
      setStep("checkout");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function startNewOrder() {
    setForm({ name: "", phone: "", email: "", pickup: "", note: "" });
    setConfirmedOrder(null);
    setPaymentError("");
    setVerifyMessage("");
    setStep("browse");
  }

  return (
    <div className={ui.page}>
      <DemoBanner />

      <header className={ui.header}>
        <div className={`${ui.container} py-4 flex items-center justify-between`}>
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold hover:text-stone-600 dark:hover:text-stone-300 transition">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {STORE.name}
          </Link>
          <div className="flex items-center gap-3">
            {step === "browse" && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                aria-label={`View cart, ${itemCount} item${itemCount === 1 ? "" : "s"}, ${formatPrice(orderTotal)}`}
                className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition rounded-xl px-2 py-1.5 -mx-2 hover:bg-white/40 dark:hover:bg-stone-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              >
                <ShoppingCart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                <span className="font-semibold tabular-nums">{itemCount}</span>
                <span className="hidden sm:inline">· {formatPrice(orderTotal)}</span>
              </button>
            )}
            {step !== "confirmed" && step !== "browse" && (
              <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <ShoppingCart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                <span className="font-semibold tabular-nums">{itemCount}</span>
                <span className="hidden sm:inline">· {formatPrice(orderTotal)}</span>
              </div>
            )}
            <button onClick={toggleTheme}
              className="min-h-[40px] w-[40px] flex items-center justify-center border border-stone-300 dark:border-stone-700 rounded-xl bg-white/40 dark:bg-[#1a1916] hover:bg-white/60 dark:hover:bg-stone-800/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/60"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <main className={`${ui.container} py-10 sm:py-14 ${itemCount > 0 && step === "browse" ? "pb-28" : ""}`}>
        {step === "browse" && (
          <>
            <div className="text-[11px] tracking-[0.16em] uppercase text-stone-500 dark:text-stone-400 font-semibold">CLICK &amp; COLLECT</div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">Order ahead, collect in store</h1>
            <p className="mt-3 text-stone-600 dark:text-stone-300 max-w-2xl">
              A small selection for now, {PRODUCTS.length} items while we test this out. Pick a size and flavour, choose a pickup time, and we'll have it ready at the counter.
            </p>

            {!openStatus.isOpen && (
              <div className="mt-5 inline-flex items-start gap-2 text-sm rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-700 dark:text-red-300" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-red-800 dark:text-red-200">
                  {openStatus.label} — online ordering isn't available right now.
                </span>
              </div>
            )}

            <div className="mt-5 inline-flex items-start gap-2 text-sm rounded-xl border border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee] dark:bg-[#1a1916] px-4 py-3">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-stone-500 dark:text-stone-400" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-stone-700 dark:text-stone-300">
                A flat <span className="font-semibold">{formatPrice(PACKING_FEE)} packing fee</span> applies to Click &amp; Collect orders, with a <span className="font-semibold">{formatPrice(MIN_ORDER_AMOUNT)} minimum</span> and <span className="font-semibold">{formatPrice(MAX_ORDER_AMOUNT)} maximum order</span> — shop in-store anytime with no fee or limits.
              </span>
            </div>

            <div className="mt-8 space-y-10">
              {productsByCategory.map(({ category, items }) => (
                <div key={category}>
                  <h2 className="text-lg font-bold tracking-tight">{category}</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        cartLines={cartLinesByProduct[product.id] || []}
                        inStock={productStock(outOfStock, product) !== "out"}
                        onOpen={() => setModalProduct(product)}
                        onQtyChange={setCartLineQty}
                        onRemove={removeCartLine}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {modalProduct && (
          <ProductOptionsModal
            product={modalProduct}
            outOfStock={outOfStock}
            onClose={() => setModalProduct(null)}
            onAdd={addToCart}
          />
        )}

        {cartOpen && (
          <CartModal
            cartItems={cartItems}
            subtotal={subtotal}
            packingFee={packingFee}
            total={orderTotal}
            belowMinimum={belowMinimum}
            amountToMinimum={amountToMinimum}
            overMaximum={overMaximum}
            amountOverMax={amountOverMax}
            isOpen={openStatus.isOpen}
            openLabel={openStatus.label}
            onQtyChange={setCartLineQty}
            onRemove={removeCartLine}
            onCheckout={() => { setCartOpen(false); goToCheckout(); }}
            onClose={() => setCartOpen(false)}
          />
        )}

        {step === "checkout" && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep("browse")} className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Back to menu
            </button>

            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight">Checkout</h1>

            {cartItems.length === 0 ? (
              <div className={`${ui.card} mt-6 text-center`}>
                <p className="text-sm text-stone-600 dark:text-stone-300">Your cart is empty.</p>
                <button onClick={() => setStep("browse")} className={`${ui.beigePrimarySm} mt-4`}>Back to menu</button>
              </div>
            ) : (<>
            <div className={`${ui.card} mt-6`}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                <ClipboardList className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Your order
              </div>
              <div className="divide-y divide-stone-200/70 dark:divide-stone-800/70">
                {cartItems.map((line) => {
                  const key = line.key;
                  const label = variantLabel(line.product, line.size, line.flavour);
                  return (
                    <div key={key} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-stone-700 dark:text-stone-300 truncate">{label}</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">{formatPrice(line.unitPrice)} each</div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <Stepper qty={line.qty} min={0} name={label} onChange={(n) => setCartLineQty(key, n)} />
                        <span className="font-semibold tabular-nums w-14 text-right">{formatPrice(line.qty * line.unitPrice)}</span>
                        <button
                          type="button"
                          onClick={() => removeCartLine(key)}
                          aria-label={`Remove ${label}`}
                          className="h-9 w-9 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-stone-200/80 dark:border-stone-800 text-sm space-y-1">
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                  <span>Packing fee</span>
                  <span className="tabular-nums">{formatPrice(packingFee)}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(orderTotal)}</span>
              </div>
              {belowMinimum && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  Add {formatPrice(amountToMinimum)} more to reach the {formatPrice(MIN_ORDER_AMOUNT)} minimum order.
                </p>
              )}
              {overMaximum && <OverMaxNotice amountOver={amountOverMax} className="mt-3" />}
            </div>

            {!openStatus.isOpen ? (
              <div className={`${ui.card} mt-4 text-center`}>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  {openStatus.label} — online ordering isn't available right now.
                </p>
                <button onClick={() => setStep("browse")} className={`${ui.beigePrimarySm} mt-4`}>Back to menu</button>
              </div>
            ) : belowMinimum ? (
              <div className={`${ui.card} mt-4 text-center`}>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  Your order is below the {formatPrice(MIN_ORDER_AMOUNT)} minimum — add {formatPrice(amountToMinimum)} more to continue.
                </p>
                <button onClick={() => setStep("browse")} className={`${ui.beigePrimarySm} mt-4`}>Back to menu</button>
              </div>
            ) : overMaximum ? (
              <div className={`${ui.card} mt-4 text-center`}>
                <OverMaxNotice amountOver={amountOverMax} />
                <button onClick={() => setStep("browse")} className={`${ui.beigePrimarySm} mt-4`}>Back to menu</button>
              </div>
            ) : (
            <form onSubmit={handlePlaceOrder} className="mt-4 space-y-4">
              <div className={`${ui.card} space-y-4`}>
                <div className="flex items-center gap-2 text-sm font-semibold mb-1">
                  <ClipboardList className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Your details
                </div>
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">Name</label>
                <input id="name" required maxLength={60} value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  aria-invalid={touched.name && !nameValid}
                  className={`w-full min-h-[44px] rounded-xl border bg-white/60 dark:bg-black/20 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 ${
                    touched.name && !nameValid
                      ? "border-red-400 dark:border-red-700 focus-visible:ring-red-300"
                      : "border-stone-300 dark:border-stone-700 focus-visible:ring-[#c9b79f]/70"
                  }`}
                  placeholder="Your name" />
                {touched.name && !nameValid && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Enter your name.</p>
                )}
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">Phone</label>
                <input id="phone" required type="tel" maxLength={20} value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  aria-invalid={touched.phone && !phoneValid}
                  className={`w-full min-h-[44px] rounded-xl border bg-white/60 dark:bg-black/20 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 ${
                    touched.phone && !phoneValid
                      ? "border-red-400 dark:border-red-700 focus-visible:ring-red-300"
                      : "border-stone-300 dark:border-stone-700 focus-visible:ring-[#c9b79f]/70"
                  }`}
                  placeholder="04xx xxx xxx" />
                {touched.phone && !phoneValid && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Enter a valid Australian phone number.</p>
                )}
                {phoneValid && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden="true" />
                    <span>We'll call <span className="underline">{form.phone.trim()}</span> if there's a problem with your order — double-check it's right.</span>
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">Email (for your receipt)</label>
                <input id="email" required type="email" maxLength={120} value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  aria-invalid={touched.email && !emailValid}
                  className={`w-full min-h-[44px] rounded-xl border bg-white/60 dark:bg-black/20 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 ${
                    touched.email && !emailValid
                      ? "border-red-400 dark:border-red-700 focus-visible:ring-red-300"
                      : "border-stone-300 dark:border-stone-700 focus-visible:ring-[#c9b79f]/70"
                  }`}
                  placeholder="you@example.com" />
                {touched.email && !emailValid && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Enter a valid email address.</p>
                )}
                {emailValid && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden="true" />
                    <span>Your receipt and pickup-ready alert go to <span className="underline break-all">{form.email.trim()}</span> — double-check it's right.</span>
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="pickup" className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">Pickup time</label>
                <select id="pickup" required value={form.pickup} onChange={(e) => setForm((f) => ({ ...f, pickup: e.target.value }))}
                  className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white/60 dark:bg-black/20 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
                >
                  <option value="" disabled>Choose a time</option>
                  {pickupSlots.map((day) => (
                    <optgroup key={day.iso} label={day.label}>
                      {day.times.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {pickupSlots.length === 0 && (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">No pickup slots available right now — try again closer to opening.</p>
                )}
              </div>
              <div>
                <label htmlFor="note" className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">Note (optional)</label>
                <textarea id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} maxLength={200}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white/60 dark:bg-black/20 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b79f]/70"
                  placeholder="Anything we should know?" />
              </div>
              </div>

              <div className="rounded-2xl border-2 border-[#c9b79f] dark:border-[#7a6a4f] bg-[#fbf6ee] dark:bg-[#1a1916] p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Lock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    Secure payment
                  </div>
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Powered by Square</span>
                </div>

                <p className="text-sm text-stone-700 dark:text-stone-300">
                  You'll pay on Square's secure checkout page, with card, Apple Pay or Google Pay, then come straight back here.
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Your payment details are entered on Square's site, not ours — we never see or store them.
                </p>

                {paymentError && (
                  <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <button type="submit" className={`${ui.beigePrimary} w-full flex items-center justify-center gap-2`}>
                  <Lock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Continue to payment · {formatPrice(orderTotal)}
                </button>
                {import.meta.env.VITE_SQUARE_ENV !== "production" && (
                  <p className="text-xs text-stone-500 dark:text-stone-500 text-center">
                    Square sandbox only — on Square's page use test card 4111 1111 1111 1111, any future expiry, any CVV. No real card is charged.
                  </p>
                )}
              </div>
            </form>
            )}
            </>)}
          </div>
        )}

        {step === "placing" && (
          <div className="max-w-xl mx-auto py-24 flex flex-col items-center text-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-stone-500 dark:text-stone-400" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-stone-600 dark:text-stone-300">Taking you to Square's secure payment page…</p>
          </div>
        )}

        {step === "verifying" && (
          <div className="max-w-xl mx-auto py-24 flex flex-col items-center text-center gap-3" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-stone-500 dark:text-stone-400" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-stone-600 dark:text-stone-300">Confirming your payment with Square…</p>
          </div>
        )}

        {step === "unpaid" && (
          <div className="max-w-xl mx-auto">
            <div className={`${ui.card} text-center`}>
              <AlertCircle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden="true" />
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Payment not received yet</h1>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                {verifyMessage || "We haven't seen a completed payment for this order. If you've just paid, it can take a moment — check again. If you cancelled, your cart is still here."}
              </p>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                Paid but still seeing this? Call us on{" "}
                <a href={`tel:${STORE.phoneTel}`} className="font-semibold underline">{STORE.phoneDisplay}</a>{" "}
                — you won't be charged twice.
              </p>
              <div className="mt-6 flex gap-3 justify-center flex-wrap">
                {returnToken && (
                  <button onClick={() => verifyReturn(returnToken)} className={ui.beigePrimarySm}>Check again</button>
                )}
                <button
                  onClick={() => { window.history.replaceState(null, "", "/order"); setStep("browse"); }}
                  className={ui.darkPrimarySm}
                >
                  Back to cart
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "confirmed" && confirmedOrder && (
          <div className="max-w-xl mx-auto">
            <div
              className={`${ui.card} text-center transition-all duration-500 ease-out ${
                confirmedVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"
              }`}
            >
              <svg
                viewBox="0 0 52 52"
                className="mx-auto h-16 w-16"
                aria-hidden="true"
                style={{
                  transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 350ms ease-out",
                  transform: confirmedVisible ? "scale(1)" : "scale(0.7)",
                  opacity: confirmedVisible ? 1 : 0,
                }}
              >
                <circle
                  cx="26" cy="26" r="24" fill="none" strokeWidth="2.5"
                  className="stroke-green-600 dark:stroke-green-400"
                  style={{
                    strokeDasharray: 151,
                    strokeDashoffset: confirmedVisible ? 0 : 151,
                    transition: "stroke-dashoffset 650ms cubic-bezier(0.65, 0, 0.45, 1)",
                  }}
                />
                <path
                  d="M14.1 27.2l7.1 7.2 16.7-16.8" fill="none" strokeWidth="3.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="stroke-green-600 dark:stroke-green-400"
                  style={{
                    strokeDasharray: 48,
                    strokeDashoffset: confirmedVisible ? 0 : 48,
                    transition: "stroke-dashoffset 350ms cubic-bezier(0.65, 0, 0.45, 1) 550ms",
                  }}
                />
              </svg>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Order placed</h1>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                Order <span className="font-semibold">{confirmedOrder.orderNumber}</span> — paid via Square{import.meta.env.VITE_SQUARE_ENV !== "production" ? " sandbox (test mode)" : ""}.
              </p>

              <div className="mt-6 text-left space-y-2">
                {confirmedOrder.items.map((line, i) => (
                  <div
                    key={`${line.label}-${i}`}
                    className="flex items-center justify-between text-sm transition-all duration-400 ease-out"
                    style={{
                      transitionDelay: confirmedVisible ? `${250 + i * 60}ms` : "0ms",
                      opacity: confirmedVisible ? 1 : 0,
                      transform: confirmedVisible ? "translateY(0)" : "translateY(4px)",
                    }}
                  >
                    <span className="text-stone-700 dark:text-stone-300">{line.qty} × {line.label}</span>
                    <span className="font-semibold tabular-nums">{formatPrice(line.amount)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-stone-600 dark:text-stone-300">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(confirmedOrder.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                  <span>Packing fee</span>
                  <span className="tabular-nums">{formatPrice(confirmedOrder.packingFee)}</span>
                </div>
                <div className="pt-1 flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatPrice(confirmedOrder.total)}</span>
                </div>
              </div>

              <div className="mt-5 text-left text-sm text-stone-600 dark:text-stone-300 space-y-1">
                <div><span className="text-stone-500 dark:text-stone-400">Pickup:</span> {confirmedOrder.pickupLabel}</div>
                <div><span className="text-stone-500 dark:text-stone-400">Name:</span> {confirmedOrder.name}</div>
                <div><span className="text-stone-500 dark:text-stone-400">Phone:</span> {confirmedOrder.phone}</div>
                <div><span className="text-stone-500 dark:text-stone-400">Email:</span> {confirmedOrder.email}</div>
                {confirmedOrder.note && <div><span className="text-stone-500 dark:text-stone-400">Note:</span> {confirmedOrder.note}</div>}
              </div>

              {confirmedOrder.emailSent ? (
                <p className="mt-4 text-sm text-green-700 dark:text-green-400">A receipt has been emailed to {confirmedOrder.email}.</p>
              ) : (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">We couldn't email your receipt, but your order is confirmed — keep this page as your reference.</p>
              )}

              <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
                {import.meta.env.VITE_SQUARE_ENV !== "production"
                  ? "Square sandbox test payment — no real card was charged. "
                  : ""}
                We've got your order and we'll have it ready at the counter.
                {confirmedOrder.paymentId && <> Payment ref: {confirmedOrder.paymentId}</>}
              </p>

              <div className="mt-6 flex gap-3 justify-center flex-wrap">
                <button onClick={startNewOrder} className={ui.beigePrimarySm}>Start another test order</button>
                <Link to="/" className={ui.darkPrimarySm}>Back to site</Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {itemCount > 0 && step === "browse" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200/80 dark:border-stone-800 bg-[#fbf6ee]/95 dark:bg-[#1a1916]/95 backdrop-blur">
          <div className={`${ui.container} py-3 flex items-center justify-between gap-4`}>
            <div className="text-sm min-w-0">
              <div>
                <span className="font-semibold">{itemCount}</span> item{itemCount === 1 ? "" : "s"} · <span className="font-semibold tabular-nums">{formatPrice(orderTotal)}</span>
                <span className="hidden sm:inline text-stone-500 dark:text-stone-400"> (incl. {formatPrice(packingFee)} packing fee)</span>
              </div>
              {!openStatus.isOpen ? (
                <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">We're closed right now — ordering unavailable</div>
              ) : overMaximum ? (
                <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Over the {formatPrice(MAX_ORDER_AMOUNT)} online limit — remove {formatPrice(amountOverMax)}, or call us for bigger orders
                </div>
              ) : belowMinimum && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Add {formatPrice(amountToMinimum)} more to reach the {formatPrice(MIN_ORDER_AMOUNT)} minimum order
                </div>
              )}
            </div>
            <button onClick={goToCheckout} disabled={belowMinimum || overMaximum || !openStatus.isOpen} className={disabledClass(ui.beigePrimarySm)}>Checkout</button>
          </div>
        </div>
      )}
    </div>
  );
}
