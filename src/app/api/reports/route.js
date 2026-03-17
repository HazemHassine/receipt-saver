import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { getSignedUrl, deleteFile } from "@/lib/storage";

// GET /api/reports — list all saved reports
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const snapshot = await db
      .collection("users")
      .doc(user.uid)
      .collection("reports")
      .orderBy("createdAt", "desc")
      .get();

    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let downloadUrl = null;
        if (data.filePath) {
          try {
            downloadUrl = await getSignedUrl(data.filePath);
          } catch {
            // file may have been deleted
          }
        }
        return {
          id: doc.id,
          ...data,
          downloadUrl,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      })
    );

    return Response.json({ reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return Response.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
