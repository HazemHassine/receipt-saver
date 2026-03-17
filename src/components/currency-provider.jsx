"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";

/**
 * Curated list of commonly used currencies.
 * { code, label, symbol } — symbol is used for display; Intl.NumberFormat
 * is the authoritative formatter.
 */
export const CURRENCIES = [
  { code: "USD", label: "US Dollar",       symbol: "$"  },
  { code: "EUR", label: "Euro",            symbol: "€"  },
  { code: "GBP", label: "British Pound",   symbol: "£"  },
  { code: "JPY", label: "Japanese Yen",    symbol: "¥"  },
  { code: "CNY", label: "Chinese Yuan",    symbol: "¥"  },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$"},
  { code: "AUD", label: "Australian Dollar",symbol: "A$"},
  { code: "CHF", label: "Swiss Franc",     symbol: "CHF"},
  { code: "INR", label: "Indian Rupee",    symbol: "₹"  },
  { code: "BRL", label: "Brazilian Real",  symbol: "R$" },
  { code: "MXN", label: "Mexican Peso",    symbol: "MX$"},
  { code: "KRW", label: "South Korean Won",symbol: "₩"  },
  { code: "SEK", label: "Swedish Krona",   symbol: "kr" },
  { code: "NOK", label: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", label: "Danish Krone",    symbol: "kr" },
  { code: "PLN", label: "Polish Zloty",    symbol: "zł" },
  { code: "TRY", label: "Turkish Lira",    symbol: "₺"  },
  { code: "SAR", label: "Saudi Riyal",     symbol: "﷼"  },
  { code: "AED", label: "UAE Dirham",      symbol: "د.إ"},
  { code: "EGP", label: "Egyptian Pound",  symbol: "E£" },
  { code: "TND", label: "Tunisian Dinar",  symbol: "DT" },
  { code: "MAD", label: "Moroccan Dirham", symbol: "MAD"},
  { code: "ZAR", label: "South African Rand", symbol: "R"},
  { code: "SGD", label: "Singapore Dollar",symbol: "S$" },
  { code: "HKD", label: "Hong Kong Dollar",symbol: "HK$"},
];

const DEFAULT_CURRENCY = "USD";

const CurrencyContext = createContext({
  currency: DEFAULT_CURRENCY,
  setCurrency: async () => {},
  formatAmount: (n) => `$${Number(n).toFixed(2)}`,
  loading: true,
});

export function CurrencyProvider({ children }) {
  const authFetch = useAuthFetch();
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  // Load the user's preferred currency from the API on mount
  useEffect(() => {
    authFetch("/api/user")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user?.preferredCurrency) {
          setCurrencyState(data.user.preferredCurrency);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  // Persist new currency to Firestore via API, then update local state
  const setCurrency = useCallback(async (code) => {
    setCurrencyState(code); // optimistic update
    try {
      await authFetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: code }),
      });
    } catch {
      // Silent — optimistic state stays, will re-sync on next load
    }
  }, [authFetch]);

  // Intl.NumberFormat-based formatter — respects locale and currency conventions
  const formatAmount = useCallback((value) => {
    const n = Number(value) || 0;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      // Fallback if currency code is somehow invalid
      return `${n.toFixed(2)} ${currency}`;
    }
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
