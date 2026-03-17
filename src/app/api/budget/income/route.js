import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { format } from "date-fns";

/**
 * GET /api/budget/income?period=YYYY-MM
 * Returns the income document for the given period (defaults to current month).
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || format(new Date(), "yyyy-MM");

    const doc = await db
      .collection("users")
      .doc(user.uid)
      .collection("income")
      .doc(period)
      .get();

    if (!doc.exists) {
      return Response.json({ income: { amount: 0, source: "", period } });
    }

    return Response.json({ income: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Error fetching income:", error);
    return Response.json({ error: "Failed to fetch income" }, { status: 500 });
  }
}

/**
 * PUT /api/budget/income
 * Creates or updates the income for a given period.
 * Body: { amount: number, source: string, period: string }
 */
export async function PUT(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { amount, source, period } = body;

    if (amount === undefined || !period) {
      return Response.json({ error: "amount and period are required" }, { status: 400 });
    }

    const docRef = db
      .collection("users")
      .doc(user.uid)
      .collection("income")
      .doc(period);

    await docRef.set(
      { amount: Number(amount), source: source || "", period },
      { merge: true }
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error saving income:", error);
    return Response.json({ error: "Failed to save income" }, { status: 500 });
  }
}
