"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";

const DEFAULT_CATEGORIES = ["groceries", "dining", "transport", "utilities", "health"];

const BudgetContext = createContext({
  budgetingEnabled: false,
  budgetingAlerts: false,
  setBudgetingEnabled: async () => {},
  setBudgetingAlerts: async () => {},
  income: null,
  limits: {},
  trackedCategories: DEFAULT_CATEGORIES,
  setTrackedCategories: async () => {},
  refreshBudget: async () => {},
  loading: true,
});

export function BudgetProvider({ children }) {
  const authFetch = useAuthFetch();
  const [budgetingEnabled, setBudgetingEnabledState] = useState(false);
  const [budgetingAlerts, setBudgetingAlertsState] = useState(false);
  const [income, setIncome] = useState(null);
  const [limits, setLimits] = useState({});
  const [trackedCategories, setTrackedCategoriesState] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Load feature flags from user preferences
  useEffect(() => {
    authFetch("/api/user")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.features) {
          setBudgetingEnabledState(!!data.user.features.budgetingEnabled);
          setBudgetingAlertsState(!!data.user.features.budgetingAlerts);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  // Load budget data when budgeting is enabled
  const refreshBudget = useCallback(async () => {
    try {
      const [incomeRes, limitsRes, catsRes] = await Promise.all([
        authFetch("/api/budget/income"),
        authFetch("/api/budget/limits"),
        authFetch("/api/budget/categories"),
      ]);
      if (incomeRes.ok) {
        const data = await incomeRes.json();
        setIncome(data.income);
      }
      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setLimits(data.limits || {});
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        setTrackedCategoriesState(data.categories || DEFAULT_CATEGORIES);
      }
    } catch {
      // silent
    }
  }, [authFetch]);

  useEffect(() => {
    if (budgetingEnabled) {
      refreshBudget();
    }
  }, [budgetingEnabled, refreshBudget]);

  const setBudgetingEnabled = useCallback(
    async (value) => {
      setBudgetingEnabledState(value);
      if (!value) setBudgetingAlertsState(false);
      try {
        await authFetch("/api/user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            features: {
              budgetingEnabled: value,
              budgetingAlerts: value ? budgetingAlerts : false,
            },
          }),
        });
      } catch {
        // revert on failure
        setBudgetingEnabledState(!value);
      }
    },
    [authFetch, budgetingAlerts]
  );

  const setBudgetingAlerts = useCallback(
    async (value) => {
      setBudgetingAlertsState(value);
      try {
        await authFetch("/api/user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            features: {
              budgetingEnabled,
              budgetingAlerts: value,
            },
          }),
        });
      } catch {
        setBudgetingAlertsState(!value);
      }
    },
    [authFetch, budgetingEnabled]
  );

  const setTrackedCategories = useCallback(
    async (categories) => {
      setTrackedCategoriesState(categories);
      try {
        await authFetch("/api/budget/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories }),
        });
      } catch {
        // silent — optimistic state stays
      }
    },
    [authFetch]
  );

  return (
    <BudgetContext.Provider
      value={{
        budgetingEnabled,
        budgetingAlerts,
        setBudgetingEnabled,
        setBudgetingAlerts,
        income,
        limits,
        trackedCategories,
        setTrackedCategories,
        refreshBudget,
        loading,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error("useBudget must be used within a BudgetProvider");
  }
  return context;
}
