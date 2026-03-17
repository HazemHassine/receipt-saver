import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { format } from "date-fns";

/**
 * GET /api/budget/check
 * Returns budget status for all categories this month.
 * Response: { alerts: [{ category, spent, limit, percent }] }
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    // Check if budgeting features are enabled
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.data() || {};
    const features = userData.features || {};

    if (!features.budgetingEnabled || !features.budgetingAlerts) {
      return Response.json({ alerts: [] });
    }

    const currentMonth = format(new Date(), "yyyy-MM");

    // Get budget limits
    const limitsSnap = await db
      .collection("users")
      .doc(user.uid)
      .collection("budget_limits")
      .get();

    const limits = {};
    limitsSnap.forEach((doc) => {
      limits[doc.id] = doc.data().limit;
    });

    if (Object.keys(limits).length === 0) {
      return Response.json({ alerts: [] });
    }

    // Get this month's receipts
    const receiptsSnap = await db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .where("status", "==", "completed")
      .get();

    // Sum by category for current month
    const categoryTotals = {};
    receiptsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.date?.startsWith(currentMonth)) {
        const cat = data.category || "other";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (data.total || 0);
      }
    });

    // Check thresholds
    const alerts = [];
    for (const [category, limit] of Object.entries(limits)) {
      const spent = categoryTotals[category] || 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;

      if (percent >= 90) {
        alerts.push({
          category,
          spent: Math.round(spent * 100) / 100,
          limit,
          percent: Math.round(percent),
        });
      }
    }

    return Response.json({ alerts });
  } catch (error) {
    console.error("Error checking budget:", error);
    return Response.json({ error: "Failed to check budget" }, { status: 500 });
  }
}
