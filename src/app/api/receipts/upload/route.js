import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { uploadReceiptImage } from "@/lib/storage";
import { extractReceiptData } from "@/lib/gemini";
import { compressReceiptImage } from "@/lib/image";
import { checkCredits, deductCredits, getOrCreateUser } from "@/lib/credits";
import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "crypto";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    await getOrCreateUser(user);

    const creditStatus = await checkCredits(user.uid, user.email);
    if (!creditStatus.allowed) {
      return Response.json(
        { error: "Not enough credits. You need 2 credits per receipt.", credits: creditStatus.credits },
        { status: 403 }
      );
    }

    const formData = await request.formData();

    // Collect all files — supports both single "file" and multiple "files"
    const rawFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((f) => f && typeof f !== "string");

    if (rawFiles.length === 0) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (rawFiles.length > MAX_FILES) {
      return Response.json({ error: `Maximum ${MAX_FILES} images per receipt.` }, { status: 400 });
    }

    // Validate each file
    for (const file of rawFiles) {
      if (!VALID_TYPES.includes(file.type)) {
        return Response.json(
          { error: `Invalid file type "${file.type}". Use JPEG, PNG, or WebP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: `File "${file.name}" is too large. Maximum 10 MB per image.` },
          { status: 400 }
        );
      }
    }

    // Read all buffers
    const fileData = await Promise.all(
      rawFiles.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    );

    // Deduplicate by SHA-256 hash (catches exact duplicate uploads)
    const seen = new Set();
    const uniqueFiles = fileData.filter(({ buffer }) => {
      const hash = createHash("sha256").update(buffer).digest("hex");
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });

    // Compress each image for storage (original kept for Gemini)
    const compressed = await Promise.all(
      uniqueFiles.map(async ({ name, buffer }) => ({
        name: name.replace(/\.\w+$/, ".jpg"),
        buffer: await compressReceiptImage(buffer),
      }))
    );

    // Upload all compressed images to Cloud Storage
    const uploadedPaths = await Promise.all(
      compressed.map(({ name, buffer }) =>
        uploadReceiptImage(user.uid, name, buffer, "image/jpeg")
      )
    );
    const imagePaths = uploadedPaths.map((u) => u.path);

    // Create initial receipt document
    const receiptRef = db
      .collection("users")
      .doc(user.uid)
      .collection("receipts")
      .doc();

    await receiptRef.set({
      imagePath: imagePaths[0],   // primary image (backwards compat)
      imagePaths,                  // all images
      imageCount: imagePaths.length,
      imageUrl: null,
      status: "processing",
      merchant: null,
      date: null,
      currency: "USD",
      subtotal: null,
      tax: null,
      tip: null,
      total: null,
      items: [],
      paymentMethod: null,
      category: null,
      notes: "",
      rawExtraction: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Extract using ALL original images in one Gemini call
    const geminiImages = uniqueFiles.map(({ buffer, mimeType }) => ({ buffer, mimeType }));
    let extractedData = null;
    try {
      extractedData = await extractReceiptData(geminiImages);
    } catch (extractionError) {
      console.error("Gemini extraction failed:", extractionError);
      await receiptRef.update({ status: "failed", updatedAt: Timestamp.now() });
      return Response.json(
        { error: "Failed to extract receipt data", receiptId: receiptRef.id },
        { status: 500 }
      );
    }

    if (!extractedData) {
      await receiptRef.update({ status: "failed", updatedAt: Timestamp.now() });
      return Response.json(
        { error: "Could not extract data from the receipt", receiptId: receiptRef.id },
        { status: 422 }
      );
    }

    await receiptRef.update({
      status: "completed",
      merchant: extractedData.merchant,
      date: extractedData.date,
      currency: extractedData.currency || "USD",
      subtotal: extractedData.subtotal,
      tax: extractedData.tax,
      tip: extractedData.tip,
      total: extractedData.total,
      items: extractedData.items || [],
      paymentMethod: extractedData.paymentMethod,
      category: extractedData.category,
      rawExtraction: extractedData,
      updatedAt: Timestamp.now(),
    });

    await deductCredits(user.uid, user.email);

    return Response.json({
      receiptId: receiptRef.id,
      status: "completed",
      merchant: extractedData.merchant,
      total: extractedData.total,
      category: extractedData.category,
      imageCount: imagePaths.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

