import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const categoriesParam = searchParams.get("categories");
    const categories = categoriesParam ? categoriesParam.split(",") : null;

    // Fetch all receipts
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .orderBy("date", "desc")
      .get();

    let receipts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter by date range
    if (from) {
      receipts = receipts.filter((r) => r.date && r.date >= from);
    }
    if (to) {
      receipts = receipts.filter((r) => r.date && r.date <= to);
    }

    // Filter by categories
    if (categories && categories.length > 0) {
      receipts = receipts.filter((r) =>
        categories.includes(r.category || "other")
      );
    }

    // Build CSV
    const headers = [
      "Merchant",
      "Date",
      "Category",
      "Subtotal",
      "Tax",
      "Tip",
      "Total",
      "Currency",
      "Payment Method",
      "Notes",
      "Items",
    ];

    const rows = receipts.map((r) => {
      const itemsSummary = (r.items || [])
        .map(
          (item) =>
            `${item.description || "Item"} x${item.quantity || 1} @ $${(item.unitPrice || item.totalPrice || 0).toFixed(2)}`
        )
        .join("; ");

      return [
        escapeCSV(r.merchant || ""),
        escapeCSV(r.date || ""),
        escapeCSV(r.category || "other"),
        (r.subtotal || 0).toFixed(2),
        (r.tax || 0).toFixed(2),
        (r.tip || 0).toFixed(2),
        (r.total || 0).toFixed(2),
        escapeCSV(r.currency || "USD"),
        escapeCSV(
          r.paymentMethod
            ? `${r.paymentMethod.cardBrand || ""} ${r.paymentMethod.lastFour ? "****" + r.paymentMethod.lastFour : ""}`.trim()
            : ""
        ),
        escapeCSV(r.notes || ""),
        escapeCSV(itemsSummary),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="receipts.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return Response.json(
      { error: "Failed to export CSV" },
      { status: 500 }
    );
  }
}

function escapeCSV(str) {
  if (!str) return "";
  const s = String(str);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
