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

   Each product has one or more `sizes` (each with its own
   price) and an optional `flavours` list. `flavourLabel`
   overrides the dropdown's label when "Flavour" doesn't fit
   (e.g. milk's "Full Cream / Lite / Skim" is really a type).
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

export const PRODUCTS = [
  // Cold Drinks
  {
    id: "coke", icon: CupSoda, image: "/images/logos/coke.png", category: "Cold Drinks", name: "Coca-Cola",
    sizes: [
      { label: "Can 375ml", price: 3.5 },
      { label: "Bottle 600ml", price: 5.55 },
      { label: "1.25L", price: 5.75 },
      { label: "2L", price: 7.6 },
    ],
    flavours: [
      "Coca-Cola", "Coca-Cola Zero", "Coca-Cola Vanilla", "Coca-Cola Cherry", "Diet Coke",
      "Sprite", "Sprite Zero", "Fanta Orange", "Fanta Raspberry", "Fanta Grape",
    ],
  },
  {
    id: "pepsi", icon: CupSoda, image: "/images/logos/pepsi.svg", category: "Cold Drinks", name: "Pepsi",
    sizes: [
      { label: "Can 375ml", price: 3.5 },
      { label: "Bottle 600ml", price: 5.3 },
      { label: "1.25L", price: 5.5 },
    ],
    flavours: ["Pepsi", "Pepsi Max", "Mountain Dew", "Solo"],
  },
  {
    id: "schweppes", icon: CupSoda, image: "/images/logos/schweppes.png", category: "Cold Drinks", name: "Schweppes",
    sizes: [
      { label: "1.1L", price: 5.05 },
    ],
    flavours: ["Lemonade", "Dry Ginger Ale", "Soda Water", "Tonic Water", "Lemon Lime & Bitters", "Creaming Soda"],
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
      { label: "250ml", price: 4.2 },
      { label: "473ml", price: 6.8 },
    ],
    flavours: ["Original", "Sugar Free", "Blue Edition", "Red Edition"],
  },
  {
    id: "v-energy", icon: Zap, image: "/images/logos/v-energy.svg", category: "Cold Drinks", name: "V Energy Drink",
    sizes: [
      { label: "250ml", price: 3.7 },
      { label: "500ml", price: 5.5 },
    ],
    flavours: ["Original", "Sugar Free", "Blue"],
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
    sizes: [{ label: "600ml", price: 4.55 }],
    flavours: ["Glacier Freeze", "Peach", "Grape", "Blue", "Tropical"],
  },
  {
    id: "powerade", icon: CupSoda, image: "/images/logos/powerade.svg", category: "Cold Drinks", name: "Powerade",
    sizes: [{ label: "600ml", price: 4.95 }],
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
      { label: "45g", price: 2.2 },
      { label: "170g", price: 4.95 },
    ],
    flavours: ["Original", "Salt & Vinegar", "Chicken", "BBQ"],
  },
  {
    id: "rrd-chips", icon: Popcorn, image: "/images/logos/rrd-chips.png", category: "Snacks & Chocolate", name: "Red Rock Deli Chips",
    sizes: [
      { label: "165g", price: 6.45 },
    ],
    flavours: ["Sea Salt", "Honey Soy Chicken", "Lime & Cracked Pepper", "Sweet Chilli & Sour Cream"],
  },
  {
    id: "doritos", icon: Popcorn, image: "/images/logos/doritos.png", imageBg: "dark", category: "Snacks & Chocolate", name: "Doritos",
    sizes: [
      { label: "170g", price: 5.25 },
    ],
    flavours: ["Cheese Supreme", "Salsa", "Sweet Chilli"],
  },
  {
    id: "pringles", icon: Popcorn, image: "/images/logos/pringles.avif", category: "Snacks & Chocolate", name: "Pringles",
    sizes: [{ label: "134g", price: 5.0 }],
    flavours: ["Sour Cream & Onion", "Original", "BBQ", "Salt & Vinegar"],
  },
  {
    id: "cadbury", icon: Candy, image: "/images/logos/cadbury.png", category: "Snacks & Chocolate", name: "Cadbury Dairy Milk",
    sizes: [
      { label: "180g", price: 7.5 },
    ],
    flavours: ["Dairy Milk", "Caramello", "Fruit & Nut", "Marble"],
  },
  {
    id: "mars", icon: Candy, image: "/images/logos/mars.svg", category: "Snacks & Chocolate", name: "Mars Bar",
    sizes: [
      { label: "47g", price: 2.95 },
    ],
  },
  {
    id: "kinder-bueno", icon: Candy, image: "/images/logos/kinder-bueno.png", category: "Snacks & Chocolate", name: "Kinder Bueno",
    sizes: [{ label: "43g", price: 3.25 }],
  },
  {
    id: "kinder-joy", icon: Candy, image: "/images/logos/kinder-joy.png", category: "Snacks & Chocolate", name: "Kinder Joy",
    sizes: [{ label: "20g", price: 4.0 }],
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
    id: "tim-tams", icon: Cookie, image: "/images/logos/tim-tams.png", category: "Snacks & Chocolate", name: "Arnott's Tim Tams",
    sizes: [
      { label: "200g", price: 6.25 },
    ],
    flavours: ["Original", "Double Coat", "Caramel", "White"],
  },

  // Dairy & Bakery
  {
    id: "milk", icon: Milk, image: "/images/logos/milk.png", category: "Dairy & Bakery", name: "Norco Milk",
    sizes: [
      { label: "1L", price: 3.05 },
      { label: "2L", price: 4.8 },
    ],
    flavours: ["Full Cream", "Lite", "2%"],
    flavourLabel: "Type",
  },
  {
    id: "eggs", icon: Egg, image: "/images/logos/eggs.png", category: "Dairy & Bakery", name: "Canobolas Free Range Eggs",
    sizes: [{ label: "12 Pack (700g)", price: 9.1 }],
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

export function formatPrice(n) {
  return `$${n.toFixed(2)}`;
}

export function variantKey(productId, size, flavour) {
  return `${productId}::${size}::${flavour || ""}`;
}

export function variantLabel(product, size, flavour) {
  return `${product.name} (${size}${flavour ? `, ${flavour}` : ""})`;
}
