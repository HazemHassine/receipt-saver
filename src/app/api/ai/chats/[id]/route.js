import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";

/**
 * GET /api/ai/chats/[id] — Get all messages for a chat
 */
export async function GET(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const chatRef = db
      .collection("users")
      .doc(user.uid)
      .collection("chats")
      .doc(id);

    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    const messagesSnap = await chatRef
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const messages = messagesSnap.docs.map((doc) => ({
      id: doc.id,
      role: doc.data().role,
      content: doc.data().content,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json({
      chat: {
        id: chatDoc.id,
        title: chatDoc.data().title,
        createdAt: chatDoc.data().createdAt?.toDate?.()?.toISOString() || null,
      },
      messages,
    });
  } catch (error) {
    console.error("Error fetching chat:", error);
    return Response.json({ error: "Failed to fetch chat" }, { status: 500 });
  }
}
