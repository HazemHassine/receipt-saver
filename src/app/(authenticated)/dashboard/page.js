"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Store,
  X,
  Download,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
} from "date-fns";
import Link from "next/link";
import { CategoryChart } from "@/components/category-chart";
import { MonthlyTrendChart } from "@/components/monthly-trend-chart";
import { ExportDialog } from "@/components/export-dialog";

const CATEGORIES = [
  "groceries", "dining", "transport", "entertainment",
  "utilities", "health", "shopping", "travel", "other",
];

const PAYMENT_METHODS = ["cash", "credit", "debit", "visa", "mastercard", "amex", "other"];

export default function DashboardPage() {
  const authFetch = useAuthFetch();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch("/api/receipts");
        if (res.ok) {
          const data = await res.json();
          setReceipts(data.receipts || []);
        }
      } catch (err) {
        console.error("Failed to load receipts:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authFetch]);

  const hasFilters = dateFrom || dateTo || categoryFilter !== "all" || paymentFilter !== "all";

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setCategoryFilter("all");
    setPaymentFilter("all");
  }

  const { filtered, allCompleted } = useMemo(() => {
    const allCompleted = receipts.filter((r) => r.status === "completed");
    let result = [...allCompleted];

    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      result = result.filter((r) => r.date && !isBefore(parseISO(r.date), from));
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      result = result.filter((r) => r.date && !isAfter(parseISO(r.date), to));
    }
    if (categoryFilter !== "all") {
      result = result.filter((r) => (r.category || "other") === categoryFilter);
    }
    if (paymentFilter !== "all") {
      result = result.filter((r) => {
        const brand = (r.paymentMethod?.cardBrand || "").toLowerCase();
        const method = (r.paymentMethod?.type || "").toLowerCase();
        return brand.includes(paymentFilter) || method.includes(paymentFilter);
      });
    }

    return { filtered: result, allCompleted };
  }, [receipts, dateFrom, dateTo, categoryFilter, paymentFilter]);

  const stats = useMemo(() => {
    // Current period totals
    const totalSpend = filtered.reduce((sum, r) => sum + (r.total || 0), 0);
    const receiptCount = filtered.length;

    // This month vs last month (uses unfiltered data)
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthTotal = allCompleted
      .filter((r) => r.date && !isBefore(parseISO(r.date), thisMonthStart) && !isAfter(parseISO(r.date), thisMonthEnd))
      .reduce((sum, r) => sum + (r.total || 0), 0);

    const lastMonthTotal = allCompleted
      .filter((r) => r.date && !isBefore(parseISO(r.date), lastMonthStart) && !isAfter(parseISO(r.date), lastMonthEnd))
      .reduce((sum, r) => sum + (r.total || 0), 0);

    const monthDelta = lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : null;

    // Category breakdown
    const categoryMap = {};
    for (const r of filtered) {
      const cat = r.category || "other";
      categoryMap[cat] = (categoryMap[cat] || 0) + (r.total || 0);
    }
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    // Monthly trend (last 12 months, uses filtered data when date filters active, else all)
    const monthlyMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      monthlyMap[format(d, "MMM yy")] = 0;
    }
    for (const r of (hasFilters ? filtered : allCompleted)) {
      if (!r.date) continue;
      const key = format(parseISO(r.date), "MMM yy");
      if (key in monthlyMap) {
        monthlyMap[key] = (monthlyMap[key] || 0) + (r.total || 0);
      }
    }
    const monthlyTrend = Object.entries(monthlyMap).map(([month, total]) => ({
      month,
      total: Math.round(total * 100) / 100,
    }));

    // Merchant leaderboard (top 8)
    const merchantMap = {};
    for (const r of filtered) {
      if (!r.merchant) continue;
      merchantMap[r.merchant] = (merchantMap[r.merchant] || 0) + (r.total || 0);
    }
    const merchantLeaderboard = Object.entries(merchantMap)
      .map(([name, total]) => ({ name, total, count: filtered.filter((r) => r.merchant === name).length }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Recent receipts
    const recentReceipts = [...filtered]
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 5);

    // Avg per receipt
    const avgPerReceipt = receiptCount > 0 ? totalSpend / receiptCount : 0;

    return {
      totalSpend, receiptCount, categoryData, monthlyTrend,
      merchantLeaderboard, recentReceipts, avgPerReceipt,
      thisMonthTotal, lastMonthTotal, monthDelta,
    };
  }, [filtered, allCompleted, hasFilters]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Where is your money going, and what changed?</p>
        </div>
        <ExportDialog />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">From</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">To</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-sm" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px] h-8 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[150px] h-8 text-sm">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {PAYMENT_METHODS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        {hasFilters && (
          <span className="text-sm text-muted-foreground">{filtered.length} receipt{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Spend"
          value={`$${stats.totalSpend.toFixed(2)}`}
          sub={hasFilters ? "filtered period" : "all time"}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Receipts"
          value={stats.receiptCount}
          sub={`avg $${stats.avgPerReceipt.toFixed(2)} each`}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="This Month"
          value={`$${stats.thisMonthTotal.toFixed(2)}`}
          sub={
            stats.monthDelta !== null ? (
              <span className={`flex items-center gap-1 ${stats.monthDelta > 0 ? "text-red-500" : "text-green-600"}`}>
                {stats.monthDelta > 0
                  ? <TrendingUp className="h-3.5 w-3.5" />
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(stats.monthDelta).toFixed(1)}% vs last month
              </span>
            ) : `$${stats.lastMonthTotal.toFixed(2)} last month`
          }
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Top Category"
          value={<span className="capitalize">{stats.categoryData[0]?.name || "—"}</span>}
          sub={stats.categoryData[0] ? `$${stats.categoryData[0].value.toFixed(2)}` : "no data yet"}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Monthly trend + Category chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Spend Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Last 12 months</p>
          </CardHeader>
          <CardContent>
            <MonthlyTrendChart data={stats.monthlyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spend by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.categoryData.length > 0 ? (
              <CategoryChart data={stats.categoryData} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Merchant leaderboard + Recent receipts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" /> Merchant Leaderboard
            </CardTitle>
            <p className="text-xs text-muted-foreground">Top merchants by spend</p>
          </CardHeader>
          <CardContent>
            {stats.merchantLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {stats.merchantLeaderboard.map((m, i) => {
                  const maxTotal = stats.merchantLeaderboard[0].total;
                  const pct = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0;
                  return (
                    <div key={m.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                          <span className="font-medium truncate">{m.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{m.count}×</span>
                        </div>
                        <span className="font-semibold shrink-0 ml-2">${m.total.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No receipts yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentReceipts.length > 0 ? (
              <div className="space-y-4">
                {stats.recentReceipts.map((receipt) => (
                  <Link
                    key={receipt.id}
                    href={`/receipts/${receipt.id}`}
                    className="flex items-center justify-between group"
                  >
                    <div className="space-y-0.5 min-w-0 mr-3">
                      <p className="text-sm font-medium group-hover:underline truncate">
                        {receipt.merchant || "Unknown merchant"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {receipt.date ? format(parseISO(receipt.date), "MMM d, yyyy") : "No date"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="capitalize text-xs hidden sm:inline-flex">
                        {receipt.category || "other"}
                      </Badge>
                      <span className="text-sm font-semibold">${(receipt.total || 0).toFixed(2)}</span>
                    </div>
                  </Link>
                ))}
                <Link href="/receipts" className="block text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
                  View all receipts →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No receipts yet.{" "}
                <Link href="/upload" className="underline">Upload one</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-64 mt-2" /></div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-36" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32 mt-1" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}><CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}><CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              {[1,2,3,4,5].map((j) => <Skeleton key={j} className="h-10 w-full" />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
