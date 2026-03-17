import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

/**
 * GET /api/budget/limits
 * Returns all budget limits as { limits: { categoryName: number, ... } }
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("budget_limits")
      .get();

    const limits = {};
    snapshot.forEach((doc) => {
      limits[doc.id] = doc.data().limit;
    });

    return Response.json({ limits });
  } catch (error) {
    console.error("Error fetching budget limits:", error);
    return Response.json({ error: "Failed to fetch limits" }, { status: 500 });
  }
}

/**
 * PUT /api/budget/limits
 * Sets a budget limit for a category.
 * Body: { category: string, limit: number }
 */
export async function PUT(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { category, limit } = body;

    if (!category || limit === undefined) {
      return Response.json({ error: "category and limit are required" }, { status: 400 });
    }

    const docRef = db
      .collection("users")
      .doc(user.uid)
      .collection("budget_limits")
      .doc(category);

    if (Number(limit) <= 0) {
      // Delete the limit if set to 0 or negative
      await docRef.delete();
    } else {
      await docRef.set({ limit: Number(limit) });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error saving budget limit:", error);
    return Response.json({ error: "Failed to save limit" }, { status: 500 });
  }
}
