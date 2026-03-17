import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { getSignedUrl, deleteFile } from "@/lib/storage";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeMerchant } from "@/lib/merchant";

// GET /api/receipts/[id] — fetch a single receipt
export async function GET(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const doc = await db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .doc(id)
      .get();

    if (!doc.exists) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    const data = doc.data();

    // Generate signed URLs for all images (imagePaths array or single imagePath)
    const paths = data.imagePaths?.length ? data.imagePaths : (data.imagePath ? [data.imagePath] : []);
    const imageUrls = await Promise.all(
      paths.map(async (p) => {
        try { return await getSignedUrl(p); }
        catch { return null; }
      })
    );
    const imageUrl = imageUrls[0] || null; // primary for backwards compat

    return Response.json({
      receipt: {
        id: doc.id,
        ...data,
        imageUrl,
        imageUrls: imageUrls.filter(Boolean),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error fetching receipt:", error);
    return Response.json(
      { error: "Failed to fetch receipt" },
      { status: 500 }
    );
  }
}

// PATCH /api/receipts/[id] — update receipt fields
export async function PATCH(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const allowedFields = [
      "merchant", "date", "total", "subtotal", "tax", "tip",
      "category", "notes", "items",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Normalize merchant name if being updated
    if (updates.merchant) {
      updates.merchant = normalizeMerchant(updates.merchant);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updatedAt = Timestamp.now();

    const ref = db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    await ref.update(updates);

    const updated = await ref.get();
    const data = updated.data();

    // Generate signed URL
    let imageUrl = null;
    if (data.imagePath) {
      try {
        imageUrl = await getSignedUrl(data.imagePath);
      } catch {
        // ignore
      }
    }

    return Response.json({
      receipt: {
        id: updated.id,
        ...data,
        imageUrl,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error updating receipt:", error);
    return Response.json(
      { error: "Failed to update receipt" },
      { status: 500 }
    );
  }
}

// DELETE /api/receipts/[id] — delete a receipt and its image
export async function DELETE(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const ref = db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    const data = doc.data();

    // Delete image from Cloud Storage
    if (data.imagePath) {
      try {
        await deleteFile(data.imagePath);
      } catch {
        console.error("Failed to delete image:", data.imagePath);
      }
    }

    // Delete Firestore document
    await ref.delete();

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting receipt:", error);
    return Response.json(
      { error: "Failed to delete receipt" },
      { status: 500 }
    );
  }
}
