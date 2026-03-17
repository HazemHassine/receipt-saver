import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

/**
 * GET /api/ai/chats — List all chats for the current user
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const snap = await db
      .collection("users")
      .doc(user.uid)
      .collection("chats")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    const chats = snap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title || "Untitled",
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json({ chats });
  } catch (error) {
    console.error("Error listing chats:", error);
    return Response.json({ error: "Failed to list chats" }, { status: 500 });
  }
}

/**
 * DELETE /api/ai/chats — Delete a specific chat
 * Body: { chatId: string }
 */
export async function DELETE(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { chatId } = await request.json();
    if (!chatId) {
      return Response.json({ error: "chatId is required" }, { status: 400 });
    }

    const chatRef = db
      .collection("users")
      .doc(user.uid)
      .collection("chats")
      .doc(chatId);

    // Delete all messages in subcollection
    const messagesSnap = await chatRef.collection("messages").get();
    const batch = db.collection("users").doc(user.uid); // just for .firestore
    const promises = messagesSnap.docs.map((doc) => doc.ref.delete());
    await Promise.all(promises);

    // Delete the chat document
    await chatRef.delete();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return Response.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
