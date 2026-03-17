import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

const DEFAULT_CATEGORIES = ["groceries", "dining", "transport", "utilities", "health"];

/**
 * GET /api/budget/categories
 * Returns the user's tracked budget categories.
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const doc = await db
      .collection("users")
      .doc(user.uid)
      .collection("preferences")
      .doc("budget")
      .get();

    if (!doc.exists) {
      return Response.json({ categories: DEFAULT_CATEGORIES });
    }

    return Response.json({
      categories: doc.data().trackedCategories || DEFAULT_CATEGORIES,
    });
  } catch (error) {
    console.error("Error fetching budget categories:", error);
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

/**
 * PUT /api/budget/categories
 * Persists the user's tracked budget categories.
 * Body: { categories: string[] }
 */
export async function PUT(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return Response.json({ error: "categories must be an array" }, { status: 400 });
    }

    await db
      .collection("users")
      .doc(user.uid)
      .collection("preferences")
      .doc("budget")
      .set({ trackedCategories: categories }, { merge: true });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error saving budget categories:", error);
    return Response.json({ error: "Failed to save categories" }, { status: 500 });
  }
}
