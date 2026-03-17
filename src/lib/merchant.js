/**
 * Merchant name normalization.
 *
 * "ALDI SÜD 123", "ALDI SUD", "Aldi" → "Aldi"
 * "STARBUCKS #4521", "Starbucks Coffee" → "Starbucks"
 * "MCDONALD'S", "McDonalds", "McDonald's" → "McDonald's"
 */

// Known canonical merchant names — variant patterns mapped to the canonical form.
// Keys are normalized (lowercase, no accents, no punctuation).
const MERCHANT_ALIASES = {
  // Grocery
  aldi: "Aldi",
  lidl: "Lidl",
  walmart: "Walmart",
  "whole foods": "Whole Foods",
  wholefoods: "Whole Foods",
  kroger: "Kroger",
  costco: "Costco",
  target: "Target",
  safeway: "Safeway",
  publix: "Publix",
  aldi: "Aldi",
  carrefour: "Carrefour",
  tesco: "Tesco",
  rewe: "Rewe",
  edeka: "Edeka",
  spar: "Spar",
  // Fast food / coffee
  mcdonalds: "McDonald's",
  "mcdonald s": "McDonald's",
  starbucks: "Starbucks",
  subway: "Subway",
  "burger king": "Burger King",
  burgerking: "Burger King",
  kfc: "KFC",
  "pizza hut": "Pizza Hut",
  pizzahut: "Pizza Hut",
  dominos: "Domino's",
  "domino s": "Domino's",
  chipotle: "Chipotle",
  "taco bell": "Taco Bell",
  tacobell: "Taco Bell",
  wendys: "Wendy's",
  "wendy s": "Wendy's",
  dunkin: "Dunkin'",
  "dunkin donuts": "Dunkin'",
  "dunkin' donuts": "Dunkin'",
  "five guys": "Five Guys",
  // Retail
  amazon: "Amazon",
  "amazon.com": "Amazon",
  amzn: "Amazon",
  apple: "Apple",
  "apple store": "Apple",
  bestbuy: "Best Buy",
  "best buy": "Best Buy",
  ikea: "IKEA",
  "home depot": "Home Depot",
  homedepot: "Home Depot",
  lowes: "Lowe's",
  "lowe s": "Lowe's",
  walgreens: "Walgreens",
  cvs: "CVS",
  "cvs pharmacy": "CVS",
  // Transport / gas
  uber: "Uber",
  "uber eats": "Uber Eats",
  lyft: "Lyft",
  shell: "Shell",
  bp: "BP",
  exxon: "Exxon",
  chevron: "Chevron",
  mobil: "Mobil",
  // Misc
  netflix: "Netflix",
  spotify: "Spotify",
  airbnb: "Airbnb",
};

// Legal suffixes to strip (word-boundary match)
const LEGAL_SUFFIXES = [
  "llc", "ltd", "inc", "corp", "co", "gmbh", "ag", "sa", "plc",
  "nv", "bv", "srl", "pty", "limited", "incorporated",
];

// Words to strip that indicate store locations / generic noise
const NOISE_WORDS = [
  "store", "market", "shop", "supermarket", "hypermarket", "cafe",
  "restaurant", "bistro", "bar", "express", "extra", "premium",
  "international", "national", "group", "services", "solutions",
  "digital", "online",
];

/**
 * Normalize a merchant name to a canonical, consistent form.
 * Returns null if input is null/empty.
 */
export function normalizeMerchant(raw) {
  if (!raw || typeof raw !== "string") return raw;

  let name = raw.trim();
  if (!name) return raw;

  // 1. Strip common unicode accents/diacritics (ü→u, é→e, etc.)
  name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 2. Remove non-printable / control characters
  name = name.replace(/[^\x20-\x7E]/g, " ");

  // 3. Collapse multiple spaces
  name = name.replace(/\s+/g, " ").trim();

  // 4. Strip trailing store numbers / address fragments
  //    e.g. "#4521", "No. 12", "Store 123", "- Main St", "/ BERLIN"
  name = name
    .replace(/\s*[#\/]\s*\d[\w\s]*/g, "")           // #4521 or /123
    .replace(/\s+no\.?\s*\d+\b/gi, "")               // No. 12
    .replace(/\s+\d{3,}\s*$/g, "")                   // trailing 3+ digit number
    .replace(/\s*-\s*[A-Z][A-Za-z\s,]+$/, "")        // trailing "- City Name"
    .trim();

  // 5. Build lookup key: lowercase, remove punctuation and possessives
  const key = name
    .toLowerCase()
    .replace(/[''`]/g, "")       // remove apostrophes for lookup
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 6. Direct alias lookup (most specific match first)
  if (MERCHANT_ALIASES[key]) {
    return MERCHANT_ALIASES[key];
  }

  // 7. Prefix alias match — e.g. "starbucks coffee reserve" → "Starbucks"
  for (const [aliasKey, canonical] of Object.entries(MERCHANT_ALIASES)) {
    if (key === aliasKey || key.startsWith(aliasKey + " ")) {
      return canonical;
    }
  }

  // 8. Strip legal suffixes from the end
  let words = key.split(" ");
  while (words.length > 1 && LEGAL_SUFFIXES.includes(words[words.length - 1])) {
    words = words.slice(0, -1);
  }

  // 9. Strip trailing generic noise words (only if more than one word remains)
  while (words.length > 1 && NOISE_WORDS.includes(words[words.length - 1])) {
    words = words.slice(0, -1);
  }

  const cleaned = words.join(" ");

  // 10. Re-check alias after cleaning
  if (MERCHANT_ALIASES[cleaned]) {
    return MERCHANT_ALIASES[cleaned];
  }

  // 11. Title-case the cleaned name as the canonical form
  //     Preserve known all-caps abbreviations (KFC, BP, CVS, etc.)
  return toTitleCase(cleaned || key);
}

/**
 * Title-case a string, preserving common acronyms.
 */
const ACRONYMS = new Set(["kfc", "bp", "cvs", "ikea", "atm", "usa", "uk", "uae"]);

function toTitleCase(str) {
  return str
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
