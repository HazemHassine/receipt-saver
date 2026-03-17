"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Save,
  X,
  CreditCard,
  Store,
  Calendar,
  DollarSign,
  Plus,
  ChevronLeft,
  ChevronRight,
  Images,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const CATEGORIES = [
  "groceries", "dining", "transport", "entertainment",
  "utilities", "health", "shopping", "travel", "other",
];

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/api/receipts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setReceipt(data.receipt);
        } else {
          toast.error("Receipt not found");
          router.push("/receipts");
        }
      } catch (err) {
        console.error("Failed to load receipt:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, authFetch, router]);

  const startEditing = () => {
    setEditData({
      merchant: receipt.merchant || "",
      date: receipt.date ? receipt.date.split("T")[0] : "",
      total: receipt.total || 0,
      subtotal: receipt.subtotal || 0,
      tax: receipt.tax || 0,
      tip: receipt.tip || 0,
      category: receipt.category || "other",
      items: (receipt.items || []).map((item) => ({ ...item })),
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditData({});
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`/api/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt(data.receipt);
        setEditing(false);
        toast.success("Receipt updated");
      } else {
        toast.error("Failed to update receipt");
      }
    } catch {
      toast.error("Failed to update receipt");
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = async () => {
    setDeleting(true);
    try {
      const res = await authFetch(`/api/receipts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Receipt deleted");
        router.push("/receipts");
      } else {
        toast.error("Failed to delete receipt");
      }
    } catch {
      toast.error("Failed to delete receipt");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!receipt) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {receipt.merchant || "Receipt Details"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {receipt.date
                ? format(parseISO(receipt.date), "MMMM d, yyyy")
                : "No date"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdits} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
          <Dialog>
            <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-background px-3 h-8 text-xs font-medium text-destructive hover:bg-accent hover:text-destructive cursor-pointer">
              <Trash2 className="h-3.5 w-3.5" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Receipt</DialogTitle>
                <DialogDescription>
                  This will permanently delete this receipt and its image. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteReceipt}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receipt image(s) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {receipt.imageUrls?.length > 1 ? (
                <><Images className="h-4 w-4" /> Receipt Images ({receipt.imageUrls.length})</>
              ) : "Receipt Image"}
            </CardTitle>
            {receipt.imageUrls?.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {activeImageIndex + 1} / {receipt.imageUrls.length}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Main image viewer */}
            <div className="relative">
              {(receipt.imageUrls?.length > 0 ? receipt.imageUrls[activeImageIndex] : receipt.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={receipt.imageUrls?.length > 0 ? receipt.imageUrls[activeImageIndex] : receipt.imageUrl}
                  alt={`Receipt${receipt.imageUrls?.length > 1 ? ` (image ${activeImageIndex + 1})` : ""}`}
                  className="w-full rounded-lg border"
                />
              ) : (
                <div className="flex items-center justify-center h-64 rounded-lg border bg-muted">
                  <p className="text-sm text-muted-foreground">No image available</p>
                </div>
              )}
              {/* Prev / Next arrows */}
              {receipt.imageUrls?.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImageIndex((i) => Math.max(0, i - 1))}
                    disabled={activeImageIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-20 text-white rounded-full p-1.5 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setActiveImageIndex((i) => Math.min(receipt.imageUrls.length - 1, i + 1))}
                    disabled={activeImageIndex === receipt.imageUrls.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-20 text-white rounded-full p-1.5 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {/* Thumbnail strip */}
            {receipt.imageUrls?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {receipt.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={cn(
                      "shrink-0 w-16 h-20 rounded border overflow-hidden transition-all",
                      activeImageIndex === i
                        ? "ring-2 ring-foreground"
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt details */}
        <div className="space-y-6">
          {/* Info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                /* Edit form */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Merchant</Label>
                    <Input
                      value={editData.merchant}
                      onChange={(e) => setEditData({ ...editData, merchant: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={editData.date}
                      onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Subtotal</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.subtotal}
                        onChange={(e) => setEditData({ ...editData, subtotal: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tax</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.tax}
                        onChange={(e) => setEditData({ ...editData, tax: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tip</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.tip}
                        onChange={(e) => setEditData({ ...editData, tip: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.total}
                        onChange={(e) => setEditData({ ...editData, total: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={editData.category}
                      onValueChange={(v) => setEditData({ ...editData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="capitalize">
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                /* Display */
                <div className="space-y-3">
                  <DetailRow icon={Store} label="Merchant" value={receipt.merchant || "—"} />
                  <DetailRow
                    icon={Calendar}
                    label="Date"
                    value={
                      receipt.date
                        ? format(parseISO(receipt.date), "MMM d, yyyy")
                        : "—"
                    }
                  />
                  <Separator />
                  <DetailRow icon={DollarSign} label="Subtotal" value={fmtMoney(receipt.subtotal)} />
                  <DetailRow icon={DollarSign} label="Tax" value={fmtMoney(receipt.tax)} />
                  <DetailRow icon={DollarSign} label="Tip" value={fmtMoney(receipt.tip)} />
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-bold">{fmtMoney(receipt.total)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Category</span>
                    <Badge variant="secondary" className="capitalize">
                      {receipt.category || "other"}
                    </Badge>
                  </div>
                  {receipt.paymentMethod && (
                    <DetailRow
                      icon={CreditCard}
                      label="Payment"
                      value={formatPayment(receipt.paymentMethod)}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          {((editing && editData.items) || (!editing && receipt.items && receipt.items.length > 0)) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Items ({editing ? editData.items.length : receipt.items.length})
                </CardTitle>
                {editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setEditData({
                        ...editData,
                        items: [
                          ...editData.items,
                          { description: "", quantity: 1, unitPrice: null, totalPrice: 0 },
                        ],
                      });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editing ? (
                  <div className="space-y-3">
                    {editData.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Item description"
                            value={item.description || ""}
                            onChange={(e) => {
                              const newItems = [...editData.items];
                              newItems[i] = { ...newItems[i], description: e.target.value };
                              setEditData({ ...editData, items: newItems });
                            }}
                          />
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Qty"
                              className="w-20"
                              value={item.quantity ?? ""}
                              onChange={(e) => {
                                const newItems = [...editData.items];
                                newItems[i] = { ...newItems[i], quantity: parseFloat(e.target.value) || null };
                                setEditData({ ...editData, items: newItems });
                              }}
                            />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              className="w-28"
                              value={item.totalPrice ?? item.unitPrice ?? ""}
                              onChange={(e) => {
                                const newItems = [...editData.items];
                                newItems[i] = { ...newItems[i], totalPrice: parseFloat(e.target.value) || 0 };
                                setEditData({ ...editData, items: newItems });
                              }}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const newItems = editData.items.filter((_, idx) => idx !== i);
                            setEditData({ ...editData, items: newItems });
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {editData.items.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No items. Click &quot;Add&quot; to add one.
                      </p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipt.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">
                            {item.description || "\u2014"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {item.quantity || "\u2014"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {fmtMoney(item.totalPrice || item.unitPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function fmtMoney(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function formatPayment(pm) {
  const parts = [];
  if (pm.cardBrand) parts.push(pm.cardBrand);
  if (pm.lastFourDigits) parts.push(`••••${pm.lastFourDigits}`);
  if (pm.type) parts.push(`(${pm.type})`);
  return parts.join(" ") || "—";
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
