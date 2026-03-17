"use client";

import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Trash2,
  Calendar,
  Receipt,
  DollarSign,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-dialog";
import { useTranslations } from "next-intl";

export default function ReportsPage() {
  const authFetch = useAuthFetch();
  const { formatAmount } = useCurrency();
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  async function loadReports() {
    try {
      const res = await authFetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [authFetch]);

  function handleReportCreated(report) {
    setReports((prev) => [report, ...prev]);
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      const res = await authFetch(`/api/reports/${id}`, { method: "DELETE" });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        toast.success(t("reportDeleted"));
      } else {
        toast.error(t("failedDelete"));
      }
    } catch {
      toast.error(t("failedDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <ReportsPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {tc("reportsCount", { count: reports.length })}
          </p>
        </div>
        <ExportDialog onReportCreated={handleReportCreated} />
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("noReports")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("noReportsDesc")}
          </p>
          <ExportDialog
            trigger={<Button>{t("createReport")}</Button>}
            onReportCreated={handleReportCreated}
          />
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reportName")}</TableHead>
                <TableHead>{t("dateCreated")}</TableHead>
                <TableHead className="text-center">{t("receiptCount")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead>{t("filters")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{report.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {report.createdAt
                      ? format(parseISO(report.createdAt), "MMM d, yyyy 'at' h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      {report.receiptCount || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(report.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {report.filters?.from && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.filters.from}
                        </Badge>
                      )}
                      {report.filters?.to && (
                        <Badge variant="outline" className="text-xs gap-1">
                          → {report.filters.to}
                        </Badge>
                      )}
                      {report.filters?.categories && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {report.filters.categories.length} categories
                        </Badge>
                      )}
                      {!report.filters?.from && !report.filters?.to && !report.filters?.categories && (
                        <span className="text-xs text-muted-foreground">{t("allData")}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {report.downloadUrl && (
                        <a href={report.downloadUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Dialog>
                        <DialogTrigger
                          className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("deleteReport")}</DialogTitle>
                            <DialogDescription>
                              {t("deleteConfirm", { name: report.name })}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline">{tc("cancel")}</Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleDelete(report.id)}
                              disabled={deletingId === report.id}
                            >
                              {deletingId === report.id ? tc("deleting") : tc("delete")}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
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

function ReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24 mt-2" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
