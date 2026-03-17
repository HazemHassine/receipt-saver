import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * GET /api/ai/goals — List all financial goals
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const snap = await db
      .collection("users")
      .doc(user.uid)
      .collection("financial_goals")
      .orderBy("createdAt", "desc")
      .get();

    const goals = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json({ goals });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return Response.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

/**
 * PATCH /api/ai/goals — Update a goal's progress or status
 * Body: { goalId, currentAmount?, status? }
 */
export async function PATCH(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { goalId, currentAmount, status } = body;

    if (!goalId) {
      return Response.json({ error: "goalId is required" }, { status: 400 });
    }

    const updates = {};
    if (currentAmount !== undefined) updates.currentAmount = Number(currentAmount);
    if (status) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .collection("users")
      .doc(user.uid)
      .collection("financial_goals")
      .doc(goalId)
      .update(updates);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error updating goal:", error);
    return Response.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

/**
 * DELETE /api/ai/goals — Delete a goal
 * Body: { goalId }
 */
export async function DELETE(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { goalId } = await request.json();
    if (!goalId) {
      return Response.json({ error: "goalId is required" }, { status: 400 });
    }

    await db
      .collection("users")
      .doc(user.uid)
      .collection("financial_goals")
      .doc(goalId)
      .delete();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return Response.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
