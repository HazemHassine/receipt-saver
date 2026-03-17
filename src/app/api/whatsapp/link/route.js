import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { linkPhone, unlinkPhone } from "@/lib/phone-links";
import { db } from "@/lib/firebase-admin";

/**
 * POST /api/whatsapp/link – Link a WhatsApp phone number to the authenticated user.
 * Body: { phone: "+1234567890" }
 */
export async function POST(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const { phone } = await request.json();

    if (!phone || !/^\+\d{7,15}$/.test(phone)) {
      return Response.json(
        { error: "Invalid phone number. Use international format, e.g. +1234567890" },
        { status: 400 }
      );
    }

    await linkPhone(user.uid, user.email, phone);

    return Response.json({ ok: true, phone });
  } catch (error) {
    console.error("WhatsApp link error:", error);
    return Response.json(
      { error: "Failed to link phone number" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/whatsapp/link – Unlink WhatsApp from the authenticated user.
 */
export async function DELETE(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    await unlinkPhone(user.uid);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("WhatsApp unlink error:", error);
    return Response.json(
      { error: "Failed to unlink phone number" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/whatsapp/link – Get the linked phone number for the authenticated user.
 */
export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    const whatsappPhone = userDoc.data()?.whatsappPhone || null;
    return Response.json({ phone: whatsappPhone });
  } catch (error) {
    console.error("WhatsApp link check error:", error);
    return Response.json(
      { error: "Failed to check link status" },
      { status: 500 }
    );
  }
}
