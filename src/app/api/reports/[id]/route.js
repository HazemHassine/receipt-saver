import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { deleteFile } from "@/lib/storage";

// DELETE /api/reports/[id]
export async function DELETE(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const ref = db
      .collection("users")
      .doc(user.uid)
      .collection("reports")
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const data = doc.data();

    // Delete PDF from Cloud Storage
    if (data.filePath) {
      try {
        await deleteFile(data.filePath);
      } catch {
        // file may already be deleted
      }
    }

    // Delete Firestore document
    await ref.delete();

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting report:", error);
    return Response.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
