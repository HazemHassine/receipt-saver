import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/credits";
import { db } from "@/lib/firebase-admin";

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const userData = await getOrCreateUser(user);
    return Response.json({
      user: {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        credits: userData.credits,
        unlimited: userData.credits === -1,
        preferredCurrency: userData.preferredCurrency || "USD",
        features: {
          budgetingEnabled: !!userData.features?.budgetingEnabled,
          budgetingAlerts: !!userData.features?.budgetingAlerts,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return Response.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const allowed = ["preferredCurrency", "features"];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields" }, { status: 400 });
    }

    await db.collection("users").doc(user.uid).update(updates);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
