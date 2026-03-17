"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIES = [
  "groceries", "dining", "transport", "entertainment",
  "utilities", "health", "shopping", "travel", "other",
];

export function ExportDialog({ trigger, onReportCreated }) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [reportName, setReportName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [exporting, setExporting] = useState(false);

  function toggleCategory(cat) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function selectAllCategories() {
    setSelectedCategories(
      selectedCategories.length === CATEGORIES.length ? [] : [...CATEGORIES]
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (selectedCategories.length > 0 && selectedCategories.length < CATEGORIES.length) {
        params.set("categories", selectedCategories.join(","));
      }

      if (exportFormat === "csv") {
        const res = await fetch(`/api/receipts/export/csv?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });
        if (!res.ok) throw new Error("Export failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportName || "receipts"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      } else {
        // PDF — save as report
        const name = reportName || `Receipt Report - ${format(new Date(), "MMM d, yyyy")}`;
        params.set("name", name);

        const res = await fetch(`/api/receipts/export/pdf?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Export failed");
        }

        const data = await res.json();

        // Also download the PDF
        if (data.downloadUrl) {
          const a = document.createElement("a");
          a.href = data.downloadUrl;
          a.download = `${name}.pdf`;
          a.target = "_blank";
          a.click();
        }

        toast.success("PDF report saved to Reports");
        if (data.report && onReportCreated) {
          onReportCreated(data.report);
        }
      }

      setOpen(false);
      resetForm();
    } catch (err) {
      console.error("Export error:", err);
      toast.error(err.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  function resetForm() {
    setReportName("");
    setDateFrom("");
    setDateTo("");
    setSelectedCategories([]);
    setExportFormat("pdf");
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      )}
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Export Receipts</DialogTitle>
          <DialogDescription>
            Choose format, date range, and categories to export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> PDF Report
                  </span>
                </SelectItem>
                <SelectItem value="csv">
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> CSV Spreadsheet
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Report name (PDF only) */}
          {exportFormat === "pdf" && (
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input
                placeholder={`Receipt Report - ${format(new Date(), "MMM d, yyyy")}`}
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for a default name. Saved to Reports page.
              </p>
            </div>
          )}

          {/* Date range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to include all dates.
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categories</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={selectAllCategories}
              >
                {selectedCategories.length === CATEGORIES.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted transition-colors text-sm capitalize"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  {cat}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave unchecked to include all categories.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// Helper to get Firebase auth token
async function getToken() {
  const { auth } = await import("@/lib/firebase");
  const firebaseAuth = auth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}
