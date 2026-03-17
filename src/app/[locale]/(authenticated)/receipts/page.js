"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCurrency } from "@/components/currency-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Receipt,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronDown,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Link } from "@/i18n/navigation";
import { ExportDialog } from "@/components/export-dialog";
import { useTranslations } from "next-intl";

const CATEGORIES = [
  "groceries", "dining", "transport", "entertainment",
  "utilities", "health", "shopping", "travel", "other",
];

export default function ReceiptsPage() {
  const authFetch = useAuthFetch();
  const { formatAmount } = useCurrency();
  const t = useTranslations("receiptsPage");
  const tc = useTranslations("common");
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState([]); // empty = all
  const [statusFilter, setStatusFilter] = useState([]);     // empty = all
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function toggleItem(setter, value) {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  // Sort state
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

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

  const hasActiveFilters = searchQuery || categoryFilter.length > 0 || statusFilter.length > 0 || dateFrom || dateTo;

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter([]);
    setStatusFilter([]);
    setDateFrom("");
    setDateTo("");
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "total" ? "desc" : "asc");
    }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  }

  const filtered = useMemo(() => {
    let result = [...receipts];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.merchant || "").toLowerCase().includes(q) ||
          (r.category || "").toLowerCase().includes(q)
      );
    }

    // Category
    if (categoryFilter.length > 0) {
      result = result.filter((r) => categoryFilter.includes(r.category || "other"));
    }

    // Status
    if (statusFilter.length > 0) {
      result = result.filter((r) => statusFilter.includes(r.status));
    }

    // Date range
    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      result = result.filter((r) => {
        if (!r.date) return false;
        return !isBefore(parseISO(r.date), from);
      });
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      result = result.filter((r) => {
        if (!r.date) return false;
        return !isAfter(parseISO(r.date), to);
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "merchant":
          cmp = (a.merchant || "").localeCompare(b.merchant || "");
          break;
        case "date":
          cmp = (a.date || "").localeCompare(b.date || "");
          break;
        case "category":
          cmp = (a.category || "other").localeCompare(b.category || "other");
          break;
        case "total":
          cmp = (a.total || 0) - (b.total || 0);
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        default:
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, searchQuery, JSON.stringify(categoryFilter), JSON.stringify(statusFilter), dateFrom, dateTo, sortField, sortDir]);

  if (loading) {
    return <ReceiptsListSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {tc("receiptsCount", { count: receipts.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDialog />
          <Link href="/upload">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {tc("upload")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      {receipts.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Category multi-select */}
            <Popover>
              <PopoverTrigger className="inline-flex items-center justify-between rounded-md border border-input bg-background px-3 h-10 text-sm w-full sm:w-[170px] hover:bg-accent transition-colors gap-2">
                <span className="truncate text-left">
                  {categoryFilter.length === 0
                    ? tc("allCategories")
                    : categoryFilter.length === 1
                    ? categoryFilter[0].charAt(0).toUpperCase() + categoryFilter[0].slice(1)
                    : tc("categories", { count: categoryFilter.length })}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="space-y-1">
                  <button
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
                    onClick={() => setCategoryFilter([])}
                  >
                    {categoryFilter.length > 0 ? tc("clearSelection") : tc("allCategories")}
                  </button>
                  {CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm capitalize"
                    >
                      <Checkbox
                        checked={categoryFilter.includes(cat)}
                        onCheckedChange={() => toggleItem(setCategoryFilter, cat)}
                      />
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {/* Status multi-select */}
            <Popover>
              <PopoverTrigger className="inline-flex items-center justify-between rounded-md border border-input bg-background px-3 h-10 text-sm w-full sm:w-[155px] hover:bg-accent transition-colors gap-2">
                <span className="truncate text-left">
                  {statusFilter.length === 0
                    ? tc("allStatuses")
                    : statusFilter.length === 1
                    ? statusFilter[0].charAt(0).toUpperCase() + statusFilter[0].slice(1)
                    : tc("statuses", { count: statusFilter.length })}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-2" align="start">
                <div className="space-y-1">
                  <button
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
                    onClick={() => setStatusFilter([])}
                  >
                    {statusFilter.length > 0 ? tc("clearSelection") : tc("allStatuses")}
                  </button>
                  {["completed", "processing", "failed"].map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm capitalize"
                    >
                      <Checkbox
                        checked={statusFilter.includes(s)}
                        onCheckedChange={() => toggleItem(setStatusFilter, s)}
                      />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">{tc("from")}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">{tc("to")}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                {tc("clearFilters")}
              </Button>
            )}
            {hasActiveFilters && (
              <span className="text-sm text-muted-foreground ml-auto">
                {tc("results", { count: filtered.length })}
              </span>
            )}
          </div>
        </div>
      )}

      {receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("noReceipts")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("uploadFirst")}
          </p>
          <Link href="/upload">
            <Button>{t("uploadReceipt")}</Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">{t("noMatching")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("adjustFilters")}
          </p>
          <Button variant="outline" onClick={clearFilters}>{tc("clearFilters")}</Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort("merchant")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Merchant <SortIcon field="merchant" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("date")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Date <SortIcon field="date" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("category")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Category <SortIcon field="category" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("total")}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Total <SortIcon field="total" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Status <SortIcon field="status" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((receipt) => (
                <TableRow key={receipt.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/receipts/${receipt.id}`}
                      className="font-medium hover:underline"
                    >
                      {receipt.merchant || t("unknown")}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {receipt.date
                      ? format(parseISO(receipt.date), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {receipt.category || "other"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(receipt.total || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        receipt.status === "completed" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {receipt.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ReceiptsListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24 mt-2" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[160px]" />
        <Skeleton className="h-10 w-[140px]" />
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
