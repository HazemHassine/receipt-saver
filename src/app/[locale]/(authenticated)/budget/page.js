"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBudget } from "@/components/budget-provider";
import { useCurrency } from "@/components/currency-provider";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  PiggyBank,
  Pencil,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Settings2,
  Target,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { GoalsProgress } from "@/components/goals-progress";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, subDays } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

/* ───────── constants ───────── */

const ALL_CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "entertainment",
  "utilities",
  "health",
  "shopping",
  "travel",
  "education",
  "subscriptions",
  "insurance",
  "gifts",
  "pets",
  "personal care",
  "other",
];

const DEFAULT_CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "utilities",
  "health",
];

const GRAY_SHADES = [
  "#1a1a1a",
  "#2e2e2e",
  "#424242",
  "#565656",
  "#6a6a6a",
  "#7e7e7e",
  "#929292",
  "#a6a6a6",
  "#bababa",
  "#cecece",
  "#e0e0e0",
  "#f0f0f0",
];

/* ───────── page ───────── */

export default function BudgetPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const {
    budgetingEnabled,
    loading: budgetLoading,
    refreshBudget,
    trackedCategories,
    setTrackedCategories,
  } = useBudget();
  const { formatAmount } = useCurrency();

  const [receipts, setReceipts] = useState([]);
  const [income, setIncome] = useState({ amount: 0, source: "" });
  const [limits, setLimits] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [periodMode, setPeriodMode] = useState("month"); // "month" | "range"
  const [rangeStart, setRangeStart] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [rangeEnd, setRangeEnd] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  // Income editing
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ amount: "", source: "" });

  // Limit editing
  const [editingLimit, setEditingLimit] = useState(null);
  const [limitValue, setLimitValue] = useState("");

  // Category customization dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [pendingCats, setPendingCats] = useState([]);

  // Redirect if disabled
  useEffect(() => {
    if (!budgetLoading && !budgetingEnabled) {
      router.replace("/dashboard");
    }
  }, [budgetLoading, budgetingEnabled, router]);

  // Periods
  const periods = useMemo(() => {
    const r = [];
    for (let i = 0; i < 12; i++) r.push(format(subMonths(new Date(), i), "yyyy-MM"));
    return r;
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [receiptsRes, incomeRes, limitsRes] = await Promise.all([
        authFetch("/api/receipts"),
        authFetch(`/api/budget/income?period=${selectedPeriod}`),
        authFetch("/api/budget/limits"),
      ]);
      if (receiptsRes.ok) setReceipts((await receiptsRes.json()).receipts || []);
      if (incomeRes.ok) setIncome((await incomeRes.json()).income || { amount: 0, source: "" });
      if (limitsRes.ok) setLimits((await limitsRes.json()).limits || {});
    } catch (err) {
      console.error("Failed to load budget data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [authFetch, selectedPeriod]);

  useEffect(() => {
    if (budgetingEnabled) loadData();
  }, [budgetingEnabled, loadData]);

  /* ─── derived data ─── */

  // All completed receipts for this period
  const periodReceipts = useMemo(
    () =>
      receipts.filter((r) => {
        if (r.status !== "completed" || !r.date) return false;
        if (periodMode === "range") {
          return r.date >= rangeStart && r.date <= rangeEnd;
        }
        return r.date.startsWith(selectedPeriod);
      }),
    [receipts, selectedPeriod, periodMode, rangeStart, rangeEnd]
  );

  // Spending by category (all)
  const categorySpending = useMemo(() => {
    const map = {};
    for (const r of periodReceipts) {
      const cat = r.category || "other";
      map[cat] = (map[cat] || 0) + (r.total || 0);
    }
    return map;
  }, [periodReceipts]);

  const totalMonthlySpend = useMemo(
    () => Object.values(categorySpending).reduce((s, v) => s + v, 0),
    [categorySpending]
  );

  // Previous period for comparison
  const { prevStart, prevEnd } = useMemo(() => {
    if (periodMode === "range") {
      const start = parseISO(rangeStart);
      const end = parseISO(rangeEnd);
      const durationMs = end.getTime() - start.getTime();
      const pEnd = new Date(start.getTime() - 1); // day before rangeStart
      const pStart = new Date(pEnd.getTime() - durationMs);
      return {
        prevStart: format(pStart, "yyyy-MM-dd"),
        prevEnd: format(pEnd, "yyyy-MM-dd"),
      };
    }
    const prev = format(subMonths(new Date(selectedPeriod + "-01"), 1), "yyyy-MM");
    return { prevStart: prev, prevEnd: prev };
  }, [selectedPeriod, periodMode, rangeStart, rangeEnd]);

  const prevCategorySpending = useMemo(() => {
    const map = {};
    for (const r of receipts.filter((r) => {
      if (r.status !== "completed" || !r.date) return false;
      if (periodMode === "range") {
        return r.date >= prevStart && r.date <= prevEnd;
      }
      return r.date.startsWith(prevStart);
    })) {
      const cat = r.category || "other";
      map[cat] = (map[cat] || 0) + (r.total || 0);
    }
    return map;
  }, [receipts, periodMode, prevStart, prevEnd]);

  const prevMonthTotal = useMemo(
    () => Object.values(prevCategorySpending).reduce((s, v) => s + v, 0),
    [prevCategorySpending]
  );

  // Tracked categories (user-customized)
  const tracked = trackedCategories || DEFAULT_CATEGORIES;

  // Total budget allocated
  const totalBudgetAllocated = useMemo(
    () => tracked.reduce((sum, cat) => sum + (limits[cat] || 0), 0),
    [tracked, limits]
  );

  const totalTrackedSpend = useMemo(
    () => tracked.reduce((sum, cat) => sum + (categorySpending[cat] || 0), 0),
    [tracked, categorySpending]
  );

  const overallPercent = totalBudgetAllocated > 0
    ? (totalTrackedSpend / totalBudgetAllocated) * 100
    : 0;

  // Dynamic label for the current period
  const periodLabel = useMemo(() => {
    if (periodMode === "range") {
      return `${format(parseISO(rangeStart), "MMM d, yyyy")} – ${format(parseISO(rangeEnd), "MMM d, yyyy")}`;
    }
    return format(new Date(selectedPeriod + "-01"), "MMMM yyyy");
  }, [periodMode, selectedPeriod, rangeStart, rangeEnd]);

  // Pie chart data — spending breakdown (tracked only)
  const pieData = useMemo(() => {
    return tracked
      .map((cat) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value: Math.round((categorySpending[cat] || 0) * 100) / 100,
        key: cat,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [tracked, categorySpending]);

  // Bar chart: budget vs actual (tracked categories with limits)
  const barData = useMemo(() => {
    return tracked
      .filter((cat) => limits[cat] || categorySpending[cat])
      .map((cat) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        Budget: limits[cat] || 0,
        Spent: Math.round((categorySpending[cat] || 0) * 100) / 100,
      }));
  }, [tracked, limits, categorySpending]);

  /* ─── handlers ─── */

  async function handleSaveIncome() {
    try {
      const res = await authFetch("/api/budget/income", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(incomeForm.amount),
          source: incomeForm.source,
          period: selectedPeriod,
        }),
      });
      if (!res.ok) throw new Error();
      setIncome({
        amount: Number(incomeForm.amount),
        source: incomeForm.source,
        period: selectedPeriod,
      });
      setEditingIncome(false);
      refreshBudget();
      toast.success("Income saved");
    } catch {
      toast.error("Failed to save income");
    }
  }

  async function handleSaveLimit(category) {
    try {
      const res = await authFetch("/api/budget/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, limit: Number(limitValue) }),
      });
      if (!res.ok) throw new Error();
      setLimits((prev) => {
        const next = { ...prev };
        if (Number(limitValue) <= 0) delete next[category];
        else next[category] = Number(limitValue);
        return next;
      });
      setEditingLimit(null);
      refreshBudget();
      toast.success(
        `Limit ${Number(limitValue) <= 0 ? "removed" : "saved"} for ${category}`
      );
    } catch {
      toast.error("Failed to save limit");
    }
  }

  function openCatDialog() {
    setPendingCats([...tracked]);
    setCatDialogOpen(true);
  }

  function togglePendingCat(cat) {
    setPendingCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function saveCatSelection() {
    await setTrackedCategories(pendingCats);
    setCatDialogOpen(false);
    toast.success("Tracked categories updated");
  }

  /* ─── guards ─── */

  if (budgetLoading) return <BudgetSkeleton />;
  if (!budgetingEnabled) return null;

  const remainingBalance = income.amount - totalMonthlySpend;
  const monthDelta =
    prevMonthTotal > 0
      ? ((totalMonthlySpend - prevMonthTotal) / prevMonthTotal) * 100
      : null;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
          <p className="text-muted-foreground">
            Track spending against your income and category limits.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openCatDialog}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Categories
          </Button>

          <Tabs value={periodMode} onValueChange={setPeriodMode}>
            <TabsList className="h-8">
              <TabsTrigger value="month" className="text-xs px-2.5">
                Month
              </TabsTrigger>
              <TabsTrigger value="range" className="text-xs px-2.5 gap-1">
                <CalendarRange className="h-3 w-3" />
                Range
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {periodMode === "month" ? (
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {format(new Date(p + "-01"), "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-[140px] h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-[140px] h-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {loadingData ? (
        <BudgetSkeleton />
      ) : (
        <>
          {/* ─── Summary Cards ─── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Monthly Income"
              value={formatAmount(income.amount)}
              sub={income.source || "—"}
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            />
            <SummaryCard
              title="Total Spent"
              value={formatAmount(totalMonthlySpend)}
              sub={
                monthDelta !== null ? (
                  <span
                    className={`flex items-center gap-1 ${
                      monthDelta > 0 ? "text-red-500" : "text-green-600"
                    }`}
                  >
                    {monthDelta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {Math.abs(monthDelta).toFixed(1)}% vs prior period
                  </span>
                ) : (
                  periodLabel
                )
              }
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            />
            <SummaryCard
              title="Budget Used"
              value={
                totalBudgetAllocated > 0
                  ? `${Math.round(overallPercent)}%`
                  : "—"
              }
              sub={
                totalBudgetAllocated > 0
                  ? `${formatAmount(totalTrackedSpend)} of ${formatAmount(
                      totalBudgetAllocated
                    )}`
                  : "No limits set"
              }
              icon={<Target className="h-4 w-4 text-muted-foreground" />}
              highlight={overallPercent > 100}
            />
            <SummaryCard
              title="Remaining Balance"
              value={formatAmount(remainingBalance)}
              sub="income − spending"
              icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />}
              highlight={remainingBalance < 0}
            />
          </div>

          {/* ─── Overall Budget Progress ─── */}
          {totalBudgetAllocated > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Overall Budget Utilization</CardTitle>
                <CardDescription>
                  {formatAmount(totalTrackedSpend)} spent of{" "}
                  {formatAmount(totalBudgetAllocated)} budgeted across{" "}
                  {tracked.filter((c) => limits[c]).length} categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {Math.round(overallPercent)}% used
                    </span>
                    <span className="font-medium">
                      {formatAmount(
                        Math.max(totalBudgetAllocated - totalTrackedSpend, 0)
                      )}{" "}
                      remaining
                    </span>
                  </div>
                  <Progress
                    value={Math.min(overallPercent, 100)}
                    className={`h-3 ${
                      overallPercent > 100 ? "[&>div]:bg-destructive" : ""
                    }`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Charts Row ─── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Spending Breakdown Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spending Breakdown</CardTitle>
                <CardDescription>Where your money went ({periodLabel})</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                        fontSize={11}
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={GRAY_SHADES[i % GRAY_SHADES.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          formatAmount(value),
                          "Spent",
                        ]}
                        contentStyle={{
                          background: "white",
                          border: "1px solid #e5e5e5",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No spending data for this period.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Budget vs Actual Bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Budget vs Actual</CardTitle>
                <CardDescription>
                  Limit compared to actual spend per category
                </CardDescription>
              </CardHeader>
              <CardContent>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={barData}
                      margin={{ left: 8, right: 16, top: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" fontSize={11} tick={{ fill: "#6b7280" }} />
                      <YAxis
                        fontSize={11}
                        tick={{ fill: "#6b7280" }}
                        tickFormatter={(v) => formatAmount(v)}
                        width={72}
                      />
                      <Tooltip
                        formatter={(value) => formatAmount(value)}
                        contentStyle={{
                          background: "white",
                          border: "1px solid #e5e5e5",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="Budget"
                        fill="#d4d4d4"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Spent"
                        fill="#1a1a1a"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    Set limits on your tracked categories to see this chart.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Income Manager ─── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Income</CardTitle>
                <CardDescription>
                  Monthly income for {periodLabel}.
                </CardDescription>
              </div>
              {!editingIncome && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setIncomeForm({
                      amount: income.amount || "",
                      source: income.source || "",
                    });
                    setEditingIncome(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingIncome ? (
                <div className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="income-amount">Amount</Label>
                    <Input
                      id="income-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={incomeForm.amount}
                      onChange={(e) =>
                        setIncomeForm((p) => ({ ...p, amount: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income-source">Source (optional)</Label>
                    <Input
                      id="income-source"
                      placeholder="e.g. Salary, Freelance"
                      value={incomeForm.source}
                      onChange={(e) =>
                        setIncomeForm((p) => ({ ...p, source: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveIncome}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingIncome(false)}
                      className="gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <p className="text-lg font-semibold">
                    {formatAmount(income.amount)}
                  </p>
                  {income.source && (
                    <span className="text-sm text-muted-foreground">
                      — {income.source}
                    </span>
                  )}
                  {income.amount === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No income logged yet.
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Category Budget Cards ─── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Category Budgets</h2>
                <p className="text-sm text-muted-foreground">
                  Tracked categories · click a limit to edit
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={openCatDialog}
              >
                <Plus className="h-3.5 w-3.5" />
                Add / Remove
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tracked.map((cat) => {
                const spent = categorySpending[cat] || 0;
                const limit = limits[cat] || 0;
                const percent = limit > 0 ? (spent / limit) * 100 : 0;
                const isOver = percent > 100;
                const isWarning = percent >= 90 && percent <= 100;
                const isEditing = editingLimit === cat;
                const prevSpent = prevCategorySpending[cat] || 0;
                const catDelta =
                  prevSpent > 0
                    ? ((spent - prevSpent) / prevSpent) * 100
                    : null;

                return (
                  <Card
                    key={cat}
                    className={
                      isOver
                        ? "border-destructive/40"
                        : isWarning
                        ? "border-amber-400/40"
                        : ""
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold capitalize">
                          {cat}
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                          {(isOver || isWarning) && (
                            <AlertTriangle
                              className={`h-3.5 w-3.5 ${
                                isOver ? "text-destructive" : "text-amber-500"
                              }`}
                            />
                          )}
                          {limit > 0 && (
                            <Badge
                              variant={
                                isOver
                                  ? "destructive"
                                  : isWarning
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-xs px-1.5 py-0"
                            >
                              {Math.round(percent)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Spend amount + trend */}
                      <div>
                        <p className="text-xl font-bold">
                          {formatAmount(spent)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {limit > 0 && (
                            <span className="text-xs text-muted-foreground">
                              of {formatAmount(limit)}
                            </span>
                          )}
                          {catDelta !== null && (
                            <span
                              className={`text-xs flex items-center gap-0.5 ${
                                catDelta > 0
                                  ? "text-red-500"
                                  : "text-green-600"
                              }`}
                            >
                              {catDelta > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {Math.abs(catDelta).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {limit > 0 ? (
                        <Progress
                          value={Math.min(percent, 100)}
                          className={`h-2 ${
                            isOver ? "[&>div]:bg-destructive" : ""
                          }`}
                        />
                      ) : (
                        <div className="h-2 bg-muted rounded-full" />
                      )}

                      {/* Edit limit */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Limit"
                            value={limitValue}
                            onChange={(e) => setLimitValue(e.target.value)}
                            className="w-28 h-7 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveLimit(cat);
                              if (e.key === "Escape") setEditingLimit(null);
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleSaveLimit(cat)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingLimit(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground px-2"
                          onClick={() => {
                            setEditingLimit(cat);
                            setLimitValue(limit || "");
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {limit > 0 ? "Edit limit" : "Set limit"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* ─── Untracked spending (if any) ─── */}
          {Object.keys(categorySpending).some(
            (c) => !tracked.includes(c)
          ) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Other Spending</CardTitle>
                <CardDescription>
                  Categories not currently tracked — add them via the
                  Categories button
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(categorySpending)
                    .filter(([c]) => !tracked.includes(c))
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, spent]) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="gap-1.5 capitalize cursor-pointer hover:bg-muted"
                        onClick={() => {
                          setPendingCats([...tracked, cat]);
                          setCatDialogOpen(true);
                        }}
                      >
                        {cat}
                        <span className="font-semibold">
                          {formatAmount(spent)}
                        </span>
                        <Plus className="h-3 w-3" />
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ─── Financial Goals ─── */}
      <GoalsProgress />

      {/* ─── Category Customization Dialog ─── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tracked Categories</DialogTitle>
            <DialogDescription>
              Choose which categories to display on your budget dashboard. This
              selection is saved to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[340px] overflow-y-auto py-2">
            {ALL_CATEGORIES.map((cat) => {
              const isChecked = pendingCats.includes(cat);
              const spending = categorySpending[cat] || 0;
              return (
                <label
                  key={cat}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => togglePendingCat(cat)}
                  />
                  <span className="text-sm capitalize flex-1">{cat}</span>
                  {spending > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatAmount(spending)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {pendingCats.length} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCatDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveCatSelection}
                disabled={pendingCats.length === 0}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── helper components ───────── */

function SummaryCard({ title, value, sub, icon, highlight }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${highlight ? "text-destructive" : ""}`}
        >
          {value}
        </div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[260px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
