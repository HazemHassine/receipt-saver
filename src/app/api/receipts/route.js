import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .orderBy("createdAt", "desc")
      .get();

    const receipts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json({ receipts });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return Response.json(
      { error: "Failed to fetch receipts" },
      { status: 500 }
    );
  }
}
