import {
  Milk, CupSoda, Candy, Popcorn, GlassWater, Wheat,
  Egg, Battery, Zap, Package, Cookie,
} from "lucide-react";

/* =========================
   Click & Collect catalog
   A small, fixed selection for testing the order flow —
   not the store's full range. Grouped into sections;
   section order follows CATEGORIES below.

   Prices and real stock brands below are drawn from the store's own
   Stock Item Sales Report (top sellers, cigarettes/tobacco excluded —
   age-restricted products aren't sold through unverified online pre-pay).
   Every price must be a real shelf price (ends in 0/5 cents, or .99).
   Gross inc ÷ Quantity from a year-long report is only evidence: it averages
   old prices, new prices and specials, so it produces fake prices like $4.17.
   Only use it where it lands exactly on a clean price; otherwise the shelf
   price has to come from the store. The report's "Unit Price inc" column is
   the store's cost price — never a selling price.

   Each product has one or more `sizes` (each with its own
   price) and an optional `flavours` list. `flavourLabel`
   overrides the dropdown's label when "Flavour" doesn't fit
   (e.g. milk's "Full Cream / Lite / Skim" is really a type).

   A size can also narrow which flavours it comes in (`flavours`) and give
   individual flavours their own shelf price (`flavourPrices`). Always read
   prices through priceFor() / flavoursFor() — the client and the server
   checkout both do, so they can never disagree.
========================= */
export const CATEGORIES = ["Cold Drinks", "Snacks & Chocolate", "Dairy & Bakery", "Household"];

// Flat, GST-inclusive packing fee for Click & Collect only — never a
// percentage (that would read as a card surcharge, which is banned in
// Australia). Applies the same regardless of payment method. Shop in-store
// and there's no fee at all, which is what keeps this a genuine "convenience
// of online ordering" charge rather than a disguised card surcharge.
export const PACKING_FEE = 2.0;

// Minimum order value (items only, before the packing fee) for Click & Collect.
export const MIN_ORDER_AMOUNT = 20.0;

// Maximum order value (items only, before the packing fee). Limits the damage
// from a stolen card (big baskets are the usual card-fraud pattern, and a
// chargeback loses the goods and the money) and stops one order emptying a
// shelf. Bigger orders go by phone so staff can check stock and the customer.
export const MAX_ORDER_AMOUNT = 150.0;

export const PRODUCTS = [
  // Cold Drinks
  {
    id: "coke", icon: CupSoda, image: "/images/logos/coke.png", category: "Cold Drinks", name: "Coca-Cola",
    // Flavours per size = exactly what the till sells in that size.
    // ("Coca-Cola Zero" is the till's "Coca Cola No Sugar".)
    sizes: [
      { label: "Can 375ml", price: 3.5, flavours: ["Coca-Cola", "Coca-Cola Zero", "Diet Coke"] },
      { label: "Bottle 600ml", price: 5.75, flavours: ["Coca-Cola", "Coca-Cola Zero", "Coca-Cola Zero Vanilla"] },
      { label: "1.25L", price: 5.95, flavours: ["Coca-Cola", "Coca-Cola Zero", "Coca-Cola Zero Caffeine Free"] },
      { label: "2L", price: 7.95, flavours: ["Coca-Cola"] },
    ],
    flavours: ["Coca-Cola", "Coca-Cola Zero", "Diet Coke", "Coca-Cola Zero Vanilla", "Coca-Cola Zero Caffeine Free"],
  },
  {
    id: "pepsi", icon: CupSoda, image: "/images/logos/pepsi.svg", category: "Cold Drinks", name: "Pepsi",
    sizes: [
      { label: "Can 375ml", price: 3.5, flavours: ["Pepsi", "Pepsi Max", "Solo"] },
      { label: "Bottle 600ml", price: 5.5, flavours: ["Pepsi Max", "Solo Zero", "Mountain Dew"] },
      { label: "1.25L", price: 5.5, flavours: ["Pepsi Max", "Solo", "Solo Lime Zero"], flavourPrices: { Solo: 5.75, "Solo Lime Zero": 5.75 } },
    ],
    flavours: ["Pepsi", "Pepsi Max", "Solo", "Solo Zero", "Solo Lime Zero", "Mountain Dew"],
  },
  {
    id: "schweppes", icon: CupSoda, image: "/images/logos/schweppes.png", category: "Cold Drinks", name: "Schweppes",
    sizes: [
      { label: "1.1L", price: 5.25 },
    ],
    flavours: ["Lemonade", "Soda Water", "Tonic Water", "Raspberry"],
  },
  {
    id: "nu-water", icon: GlassWater, category: "Cold Drinks", name: "Nu Water",
    sizes: [{ label: "600ml", price: 2.5 }],
  },
  {
    id: "crystal-peak-water", icon: GlassWater, category: "Cold Drinks", name: "Crystal Peak Water",
    sizes: [{ label: "1.5L", price: 3.5 }],
  },
  {
    id: "red-bull", icon: Zap, image: "/images/logos/red-bull.svg", category: "Cold Drinks", name: "Red Bull",
    sizes: [
      { label: "250ml", price: 4.25 },
      { label: "473ml", price: 6.95, flavours: ["Original"] },
    ],
    flavours: ["Original", "Sugar Free", "Grapefruit Blossom", "The Berry"],
  },
  {
    id: "v-energy", icon: Zap, image: "/images/logos/v-energy.svg", category: "Cold Drinks", name: "V Energy Drink",
    sizes: [
      { label: "250ml", price: 3.75 },
      { label: "500ml", price: 5.75, flavours: ["Original", "Blue"] },
    ],
    flavours: ["Original", "Sugar Free", "Blue", "Raspberry Lemon Guarana"],
  },
  {
    id: "monster", icon: Zap, image: "/images/logos/monster.png", category: "Cold Drinks", name: "Monster Energy",
    sizes: [{ label: "500ml", price: 4.95 }],
    flavours: ["Zero", "Original", "Mango Loco", "Ultra Peachy", "Ultra Strawberry"],
  },
  {
    id: "mother", icon: Zap, image: "/images/logos/mother.svg", category: "Cold Drinks", name: "Mother Energy",
    sizes: [{ label: "500ml", price: 4.95 }],
  },
  {
    id: "celsius", icon: Zap, image: "/images/logos/celsius.svg", category: "Cold Drinks", name: "Celsius",
    sizes: [{ label: "330ml", price: 5.65 }],
    flavours: ["Mango Lemonade", "Kiwi Strawberry", "Raspberry Peach", "Sunset Vibe", "Watermelon Lemonade"],
  },
  {
    id: "gatorade", icon: CupSoda, image: "/images/logos/gatorade.svg", category: "Cold Drinks", name: "Gatorade",
    sizes: [{ label: "600ml", price: 4.8 }],
    flavours: ["Glacier Freeze", "Peach", "Grape", "Blue", "Tropical"],
  },
  {
    id: "powerade", icon: CupSoda, image: "/images/logos/powerade.svg", category: "Cold Drinks", name: "Powerade",
    sizes: [{ label: "600ml", price: 4.99 }],
    flavours: ["Berry Ice", "Mountain Blast", "Gold Rush", "Blackcurrant", "Zero Mountain"],
  },
  {
    id: "dr-pepper", icon: CupSoda, image: "/images/logos/dr-pepper.webp", category: "Cold Drinks", name: "Dr Pepper",
    sizes: [{ label: "355ml", price: 3.7 }],
    flavours: ["Original", "Cherry"],
  },

  // Snacks & Chocolate
  {
    id: "smiths-chips", icon: Popcorn, image: "/images/logos/smiths-chips.png", category: "Snacks & Chocolate", name: "Smith's Chips",
    sizes: [
      { label: "45g", price: 2.2, flavours: ["Original"] },
      { label: "170g", price: 5.25, flavours: ["Salt & Vinegar", "Cheese & Onion", "Sour Cream & Onion", "BBQ", "Chicken"] },
    ],
    flavours: ["Original", "Salt & Vinegar", "Cheese & Onion", "Sour Cream & Onion", "BBQ", "Chicken"],
  },
  {
    id: "rrd-chips", icon: Popcorn, image: "/images/logos/rrd-chips.png", category: "Snacks & Chocolate", name: "Red Rock Deli Chips",
    sizes: [
      { label: "165g", price: 6.55 },
    ],
    flavours: ["Sea Salt", "Salt & Vinegar", "Honey Soy Chicken", "Sweet Chilli & Sour Cream"],
  },
  {
    id: "doritos", icon: Popcorn, image: "/images/logos/doritos.png", imageBg: "dark", category: "Snacks & Chocolate", name: "Doritos",
    sizes: [
      { label: "170g", price: 5.25 },
    ],
    flavours: ["Cheese Supreme", "Original"],
  },
  {
    id: "pringles", icon: Popcorn, image: "/images/logos/pringles.avif", category: "Snacks & Chocolate", name: "Pringles",
    sizes: [{ label: "134g", price: 5.5 }],
    flavours: ["Sour Cream & Onion", "Original", "BBQ", "Salt & Vinegar", "Chilli & Lime"],
  },
  {
    id: "cadbury", icon: Candy, image: "/images/logos/cadbury.png", category: "Snacks & Chocolate", name: "Cadbury Dairy Milk",
    sizes: [
      { label: "180g", price: 7.5 },
    ],
    flavours: ["Dairy Milk", "Fruit & Nut", "Hazelnut", "Snack", "Turkish Delight"],
  },
  {
    id: "mars", icon: Candy, image: "/images/logos/mars.svg", category: "Snacks & Chocolate", name: "Mars Bar",
    sizes: [
      { label: "47g", price: 2.95 },
    ],
  },
  {
    id: "kinder-bueno", icon: Candy, image: "/images/logos/kinder-bueno.png", category: "Snacks & Chocolate", name: "Kinder Bueno",
    sizes: [{ label: "43g", price: 3.5 }],
  },
  {
    id: "kinder-joy", icon: Candy, image: "/images/logos/kinder-joy.png", category: "Snacks & Chocolate", name: "Kinder Joy",
    sizes: [{ label: "20g", price: 3.99 }],
  },
  {
    id: "snickers", icon: Candy, image: "/images/logos/snickers.svg", category: "Snacks & Chocolate", name: "Snickers",
    sizes: [{ label: "44g", price: 2.95 }],
  },
  {
    id: "maltesers", icon: Candy, image: "/images/logos/maltesers.svg", category: "Snacks & Chocolate", name: "Maltesers",
    sizes: [{ label: "140g", price: 7.0 }],
  },
  {
    id: "mms", icon: Candy, image: "/images/logos/mms.svg", category: "Snacks & Chocolate", name: "M&M's Milk Chocolate",
    sizes: [{ label: "49g", price: 2.5 }],
  },
  {
    id: "reeses", icon: Candy, image: "/images/logos/reeses.svg", category: "Snacks & Chocolate", name: "Reese's 2 Cups",
    sizes: [{ label: "43g", price: 2.95 }],
  },
  {
    // Logo: Wikipedia's "Allen's" article file Allens_brand_logo.png
    // (English Wikipedia, marked public domain — a simple text logo).
    // 200g Snakes Alive is on the till (code 341, $5.25). The 190g bags were
    // supplied by Jaineel on 2026-11-24 at $5.25 each — they have no sales on
    // the till report yet, so their price comes from him, not Price 1.
    id: "allens", icon: Candy, image: "/images/logos/allens.webp", category: "Snacks & Chocolate", name: "Allen's Lollies",
    sizes: [
      { label: "190g", price: 5.25, flavours: ["Party Mix", "Jelly Beans", "Cheekies", "Peaches & Cream"] },
      { label: "200g", price: 5.25, flavours: ["Snakes Alive"] },
    ],
    flavours: ["Party Mix", "Jelly Beans", "Cheekies", "Peaches & Cream", "Snakes Alive"],
    flavourLabel: "Variety",
  },
  {
    id: "tim-tams", icon: Cookie, image: "/images/logos/tim-tams.png", category: "Snacks & Chocolate", name: "Arnott's Tim Tams",
    sizes: [
      { label: "200g", price: 6.25 },
    ],
    flavours: ["Original", "Double Coat"],
  },

  // Dairy & Bakery
  {
    id: "milk", icon: Milk, image: "/images/logos/milk.png", category: "Dairy & Bakery", name: "Norco Milk",
    sizes: [
      // 2% isn't stocked in 1L. Each type has its own shelf price.
      { label: "1L", price: 3.15, flavours: ["Full Cream", "Lite"], flavourPrices: { Lite: 3.55 } },
      { label: "2L", price: 5.0, flavourPrices: { Lite: 5.1, "2%": 5.6 } },
    ],
    flavours: ["Full Cream", "Lite", "2%"],
    flavourLabel: "Type",
  },
  {
    id: "eggs", icon: Egg, image: "/images/logos/eggs.png", category: "Dairy & Bakery", name: "Canobolas Free Range Eggs",
    sizes: [{ label: "12 Pack (700g)", price: 8.95 }],
  },
  {
    id: "best-buy-bread", icon: Wheat, category: "Dairy & Bakery", name: "Best Buy Bread",
    sizes: [{ label: "700g", price: 3.5 }],
    flavours: ["White", "Wholemeal", "Multigrain"],
    flavourLabel: "Type",
  },
  {
    id: "tip-top-sunblest", icon: Wheat, image: "/images/logos/tip-top-sunblest.png", category: "Dairy & Bakery", name: "Tip Top Sunblest",
    sizes: [{ label: "700g", price: 4.95 }],
    flavours: ["White", "Multigrain", "Wholemeal"],
    flavourLabel: "Type",
  },

  // Household
  {
    id: "batteries", icon: Battery, category: "Household", name: "Eveready Batteries",
    sizes: [
      { label: "4 Pack", price: 4.95 },
    ],
    flavours: ["AA", "AAA"],
    flavourLabel: "Type",
  },
  {
    id: "toilet-paper", icon: Package, image: "/images/logos/toilet-paper.png", category: "Household", name: "Quilton Toilet Paper",
    sizes: [
      { label: "9 Pack", price: 9.95 },
    ],
  },
];

function findSize(product, size) {
  return product.sizes.find((s) => s.label === size) || null;
}

// Flavours available in a given size (null when the product has none).
export function flavoursFor(product, size) {
  const sizeEntry = findSize(product, size);
  return sizeEntry?.flavours || product.flavours || null;
}

// Shelf price for an exact size + flavour, or null if that combination
// doesn't exist.
export function priceFor(product, size, flavour) {
  const sizeEntry = findSize(product, size);
  if (!sizeEntry) return null;
  const available = flavoursFor(product, size);
  if (available && !available.includes(flavour)) return null;
  return sizeEntry.flavourPrices?.[flavour] ?? sizeEntry.price;
}

// Lowest price across every size/flavour, for "From $x" labels.
export function lowestPrice(product) {
  return Math.min(...product.sizes.flatMap((s) => [s.price, ...Object.values(s.flavourPrices || {})]));
}

/* =========================
   Stock
   Staff can mark either a whole product out (key = product id, e.g. "monster")
   or one exact item (key = variantKey, e.g. "monster::500ml::Mango Loco").
   These helpers are the single rule for "is this out?" — used by the order
   page, the staff panel and the server checkout alike.
========================= */

// Every orderable size/flavour of a product, with its stock key.
export function variantsOf(product) {
  return product.sizes.flatMap((s) =>
    (flavoursFor(product, s.label) || [null]).map((flavour) => ({
      key: variantKey(product.id, s.label, flavour),
      size: s.label,
      flavour,
    })),
  );
}

export function isItemOut(outKeys, productId, size, flavour) {
  return outKeys.has(productId) || outKeys.has(variantKey(productId, size, flavour));
}

// "in" (everything orderable), "partial" (some items out) or "out" (nothing orderable).
export function productStock(outKeys, product) {
  if (outKeys.has(product.id)) return "out";
  const variants = variantsOf(product);
  const outCount = variants.filter((v) => outKeys.has(v.key)).length;
  if (outCount === 0) return "in";
  return outCount === variants.length ? "out" : "partial";
}

// A stock key staff are allowed to set: a real product id or a real item.
export function isValidStockKey(key) {
  return PRODUCTS.some((p) => p.id === key || variantsOf(p).some((v) => v.key === key));
}

export function formatPrice(n) {
  return `$${n.toFixed(2)}`;
}

export function variantKey(productId, size, flavour) {
  return `${productId}::${size}::${flavour || ""}`;
}

export function variantLabel(product, size, flavour) {
  return `${product.name} (${size}${flavour ? `, ${flavour}` : ""})`;
}
