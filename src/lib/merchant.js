/**
 * merchant.js — Production-ready merchant normalization pipeline.
 *
 * Design principles:
 *  - Layered: each stage has a clear, single responsibility.
 *  - Precision > recall: prefer returning `unresolved` over a wrong canonical name.
 *  - Non-destructive: the original raw value is always preserved.
 *  - Deterministic: same input → same output, no randomness or side-effects.
 *  - Extensible: add merchants by editing MERCHANT_CATALOG; no pipeline changes needed.
 *
 * Pipeline stages (in order):
 *  1. lightNormalize     — safe text cleanup (whitespace, unicode, punctuation)
 *  2. extractBranch      — pull out store#/location before comparison
 *  3. exactAliasMatch    — direct lookup on the light-normalized key
 *  4. cleanedAliasMatch  — strip legal suffixes then re-lookup
 *  5. brandRuleMatch     — per-merchant prefix / pattern rules (opt-in)
 *  6. fuzzyMatch         — Levenshtein-based OCR-error recovery (high threshold)
 *  7. unresolved         — when confidence is not sufficient
 */

// ---------------------------------------------------------------------------
// Merchant catalog
// ---------------------------------------------------------------------------

/**
 * Each entry defines ONE canonical merchant.
 *
 * Fields:
 *  canonical     {string}   — the authoritative display name
 *  aliases       {string[]} — exact match keys (lowercase, stripped of punctuation)
 *  prefixes      {string[]} — opt-in: match anything STARTING WITH this prefix key.
 *                             Use only when the prefix unambiguously identifies the brand.
 *  noiseSuffixes {string[]} — merchant-specific trailing words to strip before
 *                             cleaned-alias matching. NOT applied globally.
 *
 * DO NOT add very short or ambiguous keys (e.g. "bar", "market") — they cause
 * false positives. Use prefixes only when the prefix itself is unambiguous.
 */
const MERCHANT_CATALOG = [
  // ── Grocery ────────────────────────────────────────────────────────────────
  {
    canonical: "Aldi",
    aliases: ["aldi", "aldi sud", "aldi sued", "aldi north", "aldi nord"],
    // "aldi sud 123", "aldi süd markt" all start with "aldi"
    prefixes: ["aldi"],
    noiseSuffixes: ["markt", "sud", "sued", "nord", "north"],
  },
  {
    canonical: "Lidl",
    aliases: ["lidl"],
    prefixes: ["lidl"],
    noiseSuffixes: ["markt", "filiale"],
  },
  {
    canonical: "Rewe",
    aliases: ["rewe", "rewe markt", "rewe center", "rewe city"],
    prefixes: ["rewe"],
    noiseSuffixes: ["markt", "center", "city", "kaufpark"],
  },
  {
    canonical: "Edeka",
    aliases: ["edeka", "edeka markt", "edeka center", "edeka aktiv markt"],
    prefixes: ["edeka"],
    noiseSuffixes: ["markt", "center", "aktiv"],
  },
  {
    canonical: "Carrefour",
    aliases: ["carrefour", "carrefour market", "carrefour express", "carrefour bio"],
    prefixes: ["carrefour"],
  },
  {
    canonical: "Tesco",
    aliases: ["tesco", "tesco metro", "tesco extra", "tesco express"],
    prefixes: ["tesco"],
  },
  {
    canonical: "Walmart",
    aliases: ["walmart", "wal-mart", "walmart supercenter", "walmart neighborhood market"],
    prefixes: ["walmart", "wal-mart"],
  },
  {
    canonical: "Whole Foods",
    aliases: ["whole foods", "whole foods market", "wholefoods"],
    prefixes: ["whole foods"],
  },
  {
    canonical: "Kroger",
    aliases: ["kroger", "kroger fuel center"],
    prefixes: ["kroger"],
  },
  {
    canonical: "Costco",
    aliases: ["costco", "costco wholesale"],
    prefixes: ["costco"],
  },
  {
    canonical: "Target",
    aliases: ["target"],
    prefixes: ["target"],
    noiseSuffixes: ["optical", "cafe"],
  },
  {
    canonical: "Safeway",
    aliases: ["safeway"],
    prefixes: ["safeway"],
  },
  {
    canonical: "Publix",
    aliases: ["publix", "publix super market", "publix supermarket"],
    prefixes: ["publix"],
  },
  {
    canonical: "Spar",
    aliases: ["spar", "eurospar", "interspar", "spar markt"],
    prefixes: ["spar", "eurospar", "interspar"],
  },

  // ── Fast food / Coffee ─────────────────────────────────────────────────────
  {
    canonical: "McDonald's",
    aliases: ["mcdonalds", "mc donalds", "mcd"],
    // Note: "mcdonald's" keys to "mcdonalds" via makeLookupKey — already covered above.
    prefixes: ["mcdonald"],
    noiseSuffixes: ["restaurant", "drive thru", "drive-thru"],
  },
  {
    canonical: "Starbucks",
    aliases: ["starbucks", "starbucks coffee", "starbucks reserve"],
    prefixes: ["starbucks"],
    noiseSuffixes: ["coffee", "reserve", "roastery"],
  },
  {
    canonical: "Burger King",
    aliases: ["burger king", "burgerking", "bk"],
    prefixes: ["burger king"],
    noiseSuffixes: ["restaurant"],
  },
  {
    canonical: "KFC",
    aliases: ["kfc", "kentucky fried chicken"],
    prefixes: ["kfc"],
  },
  {
    canonical: "Subway",
    aliases: ["subway"],
    prefixes: ["subway"],
  },
  {
    canonical: "Pizza Hut",
    aliases: ["pizza hut", "pizzahut"],
    prefixes: ["pizza hut"],
  },
  {
    canonical: "Domino's",
    aliases: ["dominos", "domino s"],
    // Note: "domino's" and "domino's pizza" key to same values via makeLookupKey.
    prefixes: ["domino"],
    noiseSuffixes: ["pizza"],
  },
  {
    canonical: "Chipotle",
    aliases: ["chipotle", "chipotle mexican grill"],
    prefixes: ["chipotle"],
  },
  {
    canonical: "Taco Bell",
    aliases: ["taco bell", "tacobell"],
    prefixes: ["taco bell"],
  },
  {
    canonical: "Wendy's",
    aliases: ["wendys", "wendy s"],
    // Note: "wendy's" keys to "wendys" via makeLookupKey — already covered.
    prefixes: ["wendy"],
    noiseSuffixes: ["restaurant"],
  },
  {
    canonical: "Dunkin'",
    aliases: ["dunkin", "dunkin donuts"],
    // Note: "dunkin'" and "dunkin' donuts" key via makeLookupKey to same values — covered.
    prefixes: ["dunkin"],
    noiseSuffixes: ["donuts"],
  },
  {
    canonical: "Five Guys",
    aliases: ["five guys", "five guys burgers", "five guys burgers and fries"],
    prefixes: ["five guys"],
  },

  // ── Retail ─────────────────────────────────────────────────────────────────
  {
    canonical: "Amazon",
    aliases: ["amazon", "amazon.com", "amzn", "amzn mktp", "amazon marketplace"],
    // AMZN Mktp DE, Amazon.de, Amazon UK etc. all start with "amzn" or "amazon"
    prefixes: ["amazon", "amzn"],
    noiseSuffixes: ["marketplace", "mktp", "prime"],
  },
  {
    canonical: "Apple",
    aliases: ["apple", "apple store", "apple.com"],
    // No broad prefix — "Appleby's Diner" must not match
  },
  {
    canonical: "Best Buy",
    aliases: ["best buy", "bestbuy"],
    prefixes: ["best buy"],
  },
  {
    canonical: "IKEA",
    aliases: ["ikea"],
    prefixes: ["ikea"],
    noiseSuffixes: ["ab"],
  },
  {
    canonical: "Home Depot",
    aliases: ["home depot", "homedepot", "the home depot"],
    prefixes: ["home depot"],
  },
  {
    canonical: "Lowe's",
    aliases: ["lowes", "lowe s", "lowes home improvement"],
    // Note: "lowe's" keys to "lowes" via makeLookupKey — already covered.
    prefixes: ["lowe"],
    noiseSuffixes: ["home improvement"],
  },
  {
    canonical: "Walgreens",
    aliases: ["walgreens", "walgreens pharmacy"],
    prefixes: ["walgreens"],
  },
  {
    canonical: "CVS",
    aliases: ["cvs", "cvs pharmacy", "cvs health"],
    prefixes: ["cvs"],
    noiseSuffixes: ["pharmacy", "health"],
  },

  // ── Transport / Fuel ───────────────────────────────────────────────────────
  {
    canonical: "Uber",
    // "Uber Eats" intentionally NOT here — it has its own entry below.
    // We use only explicit aliases and no prefix so "uber eats" doesn't hit this.
    aliases: ["uber", "uber bv", "uber technologies"],
  },
  {
    canonical: "Uber Eats",
    aliases: ["uber eats", "ubereats"],
    // Longer prefix listed before "uber" in the catalog → sorted first in prefixList
    prefixes: ["uber eats"],
  },
  {
    canonical: "Lyft",
    aliases: ["lyft", "lyft inc"],
    prefixes: ["lyft"],
  },
  {
    canonical: "Shell",
    // "Shell Recharge" (EV charging network) must NOT be normalized to Shell.
    // No prefix declared — only explicit aliases match.
    aliases: ["shell", "shell station", "shell petrol", "shell oil"],
    noiseSuffixes: ["station", "petrol", "oil", "service station"],
  },
  {
    canonical: "BP",
    aliases: ["bp", "bp petrol", "bp station", "british petroleum"],
    prefixes: ["bp"],
    noiseSuffixes: ["petrol", "station"],
  },
  {
    canonical: "Exxon",
    aliases: ["exxon", "exxon mobil", "exxonmobil"],
    prefixes: ["exxon"],
  },
  {
    canonical: "Chevron",
    aliases: ["chevron"],
    prefixes: ["chevron"],
  },
  {
    canonical: "Mobil",
    // No broad prefix — avoids matching "mobile", "mobilcom", etc.
    aliases: ["mobil", "mobil station"],
    noiseSuffixes: ["station"],
  },

  // ── Subscriptions / Digital ────────────────────────────────────────────────
  {
    canonical: "Netflix",
    aliases: ["netflix", "netflix inc"],
    prefixes: ["netflix"],
  },
  {
    canonical: "Spotify",
    aliases: ["spotify", "spotify ab"],
    prefixes: ["spotify"],
    noiseSuffixes: ["ab"],
  },
  {
    canonical: "Airbnb",
    aliases: ["airbnb", "airbnb inc", "airbnb ireland"],
    prefixes: ["airbnb"],
  },
];

// ---------------------------------------------------------------------------
// Legal suffixes — stripped ONLY during the cleaned-alias stage.
// Never applied globally to avoid destroying meaningful words.
// ---------------------------------------------------------------------------
const LEGAL_SUFFIXES = new Set([
  "llc", "ltd", "inc", "corp", "co", "gmbh", "ag", "sa", "plc",
  "nv", "bv", "srl", "pty", "limited", "incorporated", "group",
]);

// ---------------------------------------------------------------------------
// Build O(1) lookup tables from the catalog at module load time.
// ---------------------------------------------------------------------------

/** aliasMap: normalized-alias-key → catalog entry */
const aliasMap = new Map();

/** prefixList: [{ prefix, entry }] sorted longest-first (most specific wins) */
const prefixList = [];

for (const entry of MERCHANT_CATALOG) {
  for (const alias of entry.aliases) {
    const key = makeLookupKey(alias);
    if (aliasMap.has(key) && process.env.NODE_ENV !== "production") {
      console.warn(`[merchant] Duplicate alias key "${key}" in catalog`);
    }
    aliasMap.set(key, entry);
  }
  if (entry.prefixes) {
    for (const prefix of entry.prefixes) {
      prefixList.push({ prefix: makeLookupKey(prefix), entry });
    }
  }
}

// Longest prefix first — most specific match always wins
prefixList.sort((a, b) => b.prefix.length - a.prefix.length);

// ---------------------------------------------------------------------------
// Stage helpers (exported so they can be unit-tested independently)
// ---------------------------------------------------------------------------

/**
 * Stage 1 — Light normalization.
 *
 * Produces a stable, readable string without destroying data.
 * - Trims whitespace.
 * - NFD-decomposes Unicode, strips only combining diacritics (ü→u, é→e),
 *   then re-composes. This lets "ALDI SÜD" match "ALDI SUD" while
 *   preserving legitimate non-Latin base characters.
 * - Collapses internal whitespace runs to a single space.
 *
 * @param {string} raw
 * @returns {string}
 */
export function lightNormalize(raw) {
  if (!raw || typeof raw !== "string") return "";

  return raw
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip combining diacritics only
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stage 2 — Branch / store-number extraction.
 *
 * Pulls out location qualifiers that appear after the brand name so they
 * don't pollute alias matching.  We only strip patterns that are
 * unambiguously branch identifiers:
 *   - "#4521" / "Nr. 12" / "No. 12"
 *   - Trailing 3+ digit numbers ("REWE 2345")
 *   - Separator + city: "STARBUCKS - BERLIN", "STARBUCKS / Munich"
 *
 * @param {string} normalized — output of lightNormalize
 * @returns {{ name: string, branch: string | null }}
 */
export function extractBranch(normalized) {
  let name = normalized;
  const branchParts = [];

  // "#4521", "Nr. 12", "No. 12"
  name = name.replace(/\s*(?:#|Nr\.?\s*|No\.?\s*)\d[\w\s]*/gi, (m) => {
    branchParts.push(m.trim());
    return "";
  });

  // Separator + city/location: "- BERLIN", "/ Munich"
  name = name.replace(/\s*[-\/]\s*[A-ZÜÄÖ][A-Za-züäöÜÄÖß\s,]+$/, (m) => {
    branchParts.push(m.trim());
    return "";
  });

  // Trailing standalone 3+ digit number: "REWE 2345"
  name = name.replace(/\s+\d{3,}\s*$/, (m) => {
    branchParts.push(m.trim());
    return "";
  });

  return {
    name: name.trim(),
    branch: branchParts.length > 0 ? branchParts.join(" ").trim() : null,
  };
}

/**
 * Build a lookup key from a display string.
 *
 * Produces a compact, lowercase, punctuation-free key for map/prefix lookups.
 * Used for matching ONLY — the original string is never overwritten.
 *
 * @param {string} str
 * @returns {string}
 */
export function makeLookupKey(str) {
  return str
    .toLowerCase()
    .replace(/[''`´]/g, "")             // remove apostrophes/possessives
    .replace(/[^a-z0-9]+/g, " ")        // non-alphanumeric → space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip legal suffixes from the END of a key-word array.
 * Only strips when at least one non-suffix word would remain.
 *
 * @param {string[]} words — lowercase words
 * @returns {string[]}
 */
function stripLegalSuffixes(words) {
  let w = [...words];
  while (w.length > 1 && LEGAL_SUFFIXES.has(w[w.length - 1])) {
    w.pop();
  }
  return w;
}

/**
 * Strip merchant-specific noise suffixes from the END of a key-word array.
 * Only called when we're already testing against a specific catalog entry.
 *
 * @param {string[]} words
 * @param {string[] | undefined} noiseSuffixes
 * @returns {string[]}
 */
function stripMerchantNoise(words, noiseSuffixes) {
  if (!noiseSuffixes?.length) return words;
  const noiseSet = new Set(noiseSuffixes.map((s) => s.toLowerCase()));
  let w = [...words];
  while (w.length > 1 && noiseSet.has(w[w.length - 1])) {
    w.pop();
  }
  return w;
}

// ---------------------------------------------------------------------------
// Lightweight Levenshtein fuzzy matching (no external deps)
// ---------------------------------------------------------------------------

/**
 * Levenshtein edit distance — standard DP, O(m*n) time, O(min(m,n)) space.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  if (a.length < b.length) return levenshtein(b, a); // ensure a is longer

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Normalized similarity score in [0, 1].
 * score = 1 - (editDistance / maxLength)
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Minimum similarity to accept a fuzzy match.
 * 0.85 → at most ~15% of characters can differ.
 * This catches common OCR substitutions (0→O, rn→m, l→1, I→1)
 * while rejecting unrelated-but-similar names.
 */
const FUZZY_THRESHOLD = 0.85;

/** Keys shorter than this are too ambiguous for fuzzy matching. */
const FUZZY_MIN_LEN = 4;

/**
 * Find the best fuzzy alias match for `key` above FUZZY_THRESHOLD.
 * Returns the best match or null if nothing qualifies.
 *
 * @param {string} key — makeLookupKey output
 * @returns {{ entry: object, score: number } | null}
 */
function fuzzyMatchKey(key) {
  if (key.length < FUZZY_MIN_LEN) return null;

  let best = null;
  let bestScore = FUZZY_THRESHOLD - 0.001; // must strictly beat threshold

  for (const [aliasKey, entry] of aliasMap) {
    // Fast rejection: skip if relative length difference is > 40%
    if (
      Math.abs(aliasKey.length - key.length) /
        Math.max(aliasKey.length, key.length) >
      0.4
    ) {
      continue;
    }
    const score = similarity(key, aliasKey);
    if (score > bestScore) {
      bestScore = score;
      best = { entry, score };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Main normalization function
// ---------------------------------------------------------------------------

/**
 * Normalize a raw merchant name extracted from a receipt.
 *
 * Returns a structured result so callers can decide what to display or store:
 *  - Use `merchantCanonical` when you need a resolved brand name.
 *  - Use `merchantCleaned` as a safe fallback (branch-stripped but not resolved).
 *  - Use `merchantRaw` to preserve the original value.
 *  - Use `matchType` and `confidence` for audit/debugging.
 *
 * @param {string | null} raw
 * @returns {{
 *   merchantRaw:       string | null,
 *   merchantCleaned:   string | null,
 *   merchantCanonical: string | null,
 *   merchantBranch:    string | null,
 *   matchType:         "exact_alias" | "cleaned_alias" | "brand_rule" | "fuzzy" | "unresolved",
 *   confidence:        number
 * }}
 */
export function normalizeMerchant(raw) {
  // Always preserve the original — never mutate the caller's value.
  const merchantRaw = typeof raw === "string" && raw.trim() ? raw.trim() : null;

  const unresolved = (merchantCleaned = null, merchantBranch = null) => ({
    merchantRaw,
    merchantCleaned,
    merchantCanonical: null,
    merchantBranch,
    matchType: "unresolved",
    confidence: 0,
  });

  if (!merchantRaw) return unresolved();

  // ── Stage 1: Light normalization ──────────────────────────────────────────
  // Safe cleanup: trim, unicode diacritic normalization, whitespace collapse.
  const lightNorm = lightNormalize(merchantRaw);
  if (!lightNorm) return unresolved();

  // ── Stage 2: Branch extraction ────────────────────────────────────────────
  // Separate store numbers, city names, and location markers from the brand.
  // The cleaned name (without branch) is used for all matching below.
  const { name: cleanedName, branch } = extractBranch(lightNorm);
  const merchantCleaned = cleanedName || lightNorm;

  const key = makeLookupKey(merchantCleaned);
  if (!key) return unresolved(merchantCleaned, branch);

  // ── Stage 3: Exact alias match ────────────────────────────────────────────
  // O(1) map lookup. Highest confidence: the alias was explicitly catalogued.
  const exactEntry = aliasMap.get(key);
  if (exactEntry) {
    return {
      merchantRaw,
      merchantCleaned,
      merchantCanonical: exactEntry.canonical,
      merchantBranch: branch,
      matchType: "exact_alias",
      confidence: 1.0,
    };
  }

  // ── Stage 4: Cleaned alias match ──────────────────────────────────────────
  // Strip legal suffixes ("GmbH", "Inc", "BV" …) then retry the alias table.
  // This handles "REWE Markt GmbH" → strip "gmbh" → "rewe markt" → exact match.
  // merchantCleaned is NOT modified — this is matching-only.
  const keyWords = key.split(" ");
  const strippedWords = stripLegalSuffixes(keyWords);
  const strippedKey = strippedWords.join(" ");

  if (strippedKey !== key) {
    const cleanedEntry = aliasMap.get(strippedKey);
    if (cleanedEntry) {
      return {
        merchantRaw,
        merchantCleaned,
        merchantCanonical: cleanedEntry.canonical,
        merchantBranch: branch,
        matchType: "cleaned_alias",
        confidence: 0.95,
      };
    }
  }

  // ── Stage 5: Brand rule match (opt-in prefix matching) ───────────────────
  // Only fires for merchants that explicitly declare `prefixes` in their entry.
  // prefixList is sorted longest-first, so "uber eats" always beats "uber".
  //
  // After a prefix match we strip that merchant's own noise suffixes from the
  // remainder.  Confidence is slightly lower when the remainder contains
  // unexpected words (the brand name is present but the context is unusual).
  for (const { prefix, entry } of prefixList) {
    if (key === prefix || key.startsWith(prefix + " ")) {
      const remainder = key.slice(prefix.length).trim();
      const remainderWords = remainder ? remainder.split(" ") : [];
      const cleanedRemainder = stripMerchantNoise(remainderWords, entry.noiseSuffixes);

      // Fewer unexpected trailing words → higher confidence
      const confidence = cleanedRemainder.length === 0 ? 0.9 : 0.8;

      return {
        merchantRaw,
        merchantCleaned,
        merchantCanonical: entry.canonical,
        merchantBranch: branch,
        matchType: "brand_rule",
        confidence,
      };
    }
  }

  // ── Stage 6: Fuzzy match (OCR error recovery) ─────────────────────────────
  // Last resort before giving up. Requires similarity ≥ FUZZY_THRESHOLD (0.85).
  // We try both the full key and the legal-suffix-stripped key.
  const keysToTry = key !== strippedKey ? [key, strippedKey] : [key];

  for (const k of keysToTry) {
    const fuzzy = fuzzyMatchKey(k);
    if (fuzzy) {
      return {
        merchantRaw,
        merchantCleaned,
        merchantCanonical: fuzzy.entry.canonical,
        merchantBranch: branch,
        matchType: "fuzzy",
        // Cap fuzzy confidence below brand_rule to reflect lower certainty
        confidence: Math.round(fuzzy.score * 0.9 * 100) / 100,
      };
    }
  }

  // ── Stage 7: Unresolved ────────────────────────────────────────────────────
  // No stage produced a confident match. Return cleaned data without a canonical
  // name so callers know this merchant was not resolved.
  return unresolved(merchantCleaned, branch);
}

// ---------------------------------------------------------------------------
// Convenience helper
// ---------------------------------------------------------------------------

/**
 * Resolve a raw merchant string to the best single display name.
 * Prefers: canonical → cleaned → raw.
 *
 * Use this when you only need one string (e.g. to store in Firestore).
 *
 * @param {string | null} raw
 * @returns {string | null}
 */
export function resolveMerchantName(raw) {
  const result = normalizeMerchant(raw);
  return result.merchantCanonical ?? result.merchantCleaned ?? result.merchantRaw;
}

// ---------------------------------------------------------------------------
// Test cases (documentary + self-test CLI)
// ---------------------------------------------------------------------------

/**
 * Expected output for each test case:
 *
 * INPUT                          | matchType       | canonical         | branch
 * ───────────────────────────────┼─────────────────┼───────────────────┼──────────────────
 * "ALDI SÜD 123"                 | brand_rule      | "Aldi"            | "123"
 * "Aldi Sud"                     | brand_rule      | "Aldi"            | null
 * "STARBUCKS COFFEE #4521 BERLIN"| brand_rule      | "Starbucks"       | "#4521"
 * "MCD0NALDS"                    | fuzzy           | "McDonald's"      | null
 * "McDonalds"                    | exact_alias     | "McDonald's"      | null
 * "REWE Markt GmbH"              | cleaned_alias   | "Rewe"            | null
 * "Shell Recharge"               | unresolved      | null              | null   ← intentional
 * "AMZN Mktp DE"                 | brand_rule      | "Amazon"          | null
 * "Uber BV"                      | cleaned_alias   | "Uber"            | null
 * "Kaffeewerk Passau"            | unresolved      | null              | "- Passau" *
 *
 * Notes:
 * • "Shell Recharge" stays unresolved because Shell has no prefix declared,
 *   "shell recharge" is not an alias, and fuzzy similarity to "shell" is ~0.55
 *   (well below the 0.85 threshold).  This is correct: Shell Recharge is an EV
 *   charging network — merging it with a petrol station would corrupt analytics.
 *
 * • "Kaffeewerk Passau" stays unresolved — local coffee roaster, not a chain.
 *   Branch extractor may pull "- Passau" if the pattern fires; otherwise branch=null.
 */

// Self-test — only runs when executed directly, not when imported as a module.
const _isCLI =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("merchant.js") || process.argv[1].includes("merchant"));

if (_isCLI) {
  const tests = [
    "ALDI SÜD 123",
    "Aldi Sud",
    "STARBUCKS COFFEE #4521 BERLIN",
    "MCD0NALDS",
    "McDonalds",
    "REWE Markt GmbH",
    "Shell Recharge",
    "AMZN Mktp DE",
    "Uber BV",
    "Kaffeewerk Passau",
    // Bonus edge cases
    "MCDONALD'S",
    "Burger King Restaurant",
    "LIDL FILIALE 4",
    "Tesco Extra",
    "Spotify AB",
    "Netflix Inc",
    "IKEA AB",
    "Whole Foods Market",
    "CVS Pharmacy",
    "amzn mktp de",
    "Uber Eats",
    "Shell",
    "shell station",
  ];

  console.log("\n──── Merchant Normalization Test Run ────\n");
  for (const t of tests) {
    const r = normalizeMerchant(t);
    const canon = r.merchantCanonical ?? "(unresolved)";
    const branch = r.merchantBranch ?? "—";
    console.log(`"${t}"`);
    console.log(`  canonical:  ${canon}`);
    console.log(`  cleaned:    ${r.merchantCleaned}`);
    console.log(`  branch:     ${branch}`);
    console.log(`  matchType:  ${r.matchType}`);
    console.log(`  confidence: ${r.confidence}`);
    console.log("");
  }
}
