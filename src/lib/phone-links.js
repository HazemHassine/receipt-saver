import { db } from "@/lib/firebase-admin";

/**
 * Look up a linked user by WhatsApp phone number.
 * @param {string} phone – E.164 format, e.g. "+1234567890"
 * @returns {{ uid: string, email: string } | null}
 */
export async function getUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  const doc = await db.collection("phone_links").doc(normalized).get();
  if (!doc.exists) return null;
  return { uid: doc.data().uid, email: doc.data().email };
}

/**
 * Link a WhatsApp phone number to a user account.
 * @param {string} uid
 * @param {string} email
 * @param {string} phone – E.164 format
 */
export async function linkPhone(uid, email, phone) {
  const normalized = normalizePhone(phone);

  // Remove any existing link for this user (one phone per user)
  const existingSnap = await db
    .collection("phone_links")
    .where("uid", "==", uid)
    .get();
  const batch = db.batch ? undefined : null; // db proxy doesn't have batch
  // Delete old links one by one
  for (const doc of existingSnap.docs) {
    await db.collection("phone_links").doc(doc.id).delete();
  }

  // Also update the user doc
  await db.collection("users").doc(uid).update({ whatsappPhone: normalized });

  // Create the new link
  await db.collection("phone_links").doc(normalized).set({
    uid,
    email,
    linkedAt: new Date().toISOString(),
  });
}

/**
 * Unlink a WhatsApp phone from a user account.
 * @param {string} uid
 */
export async function unlinkPhone(uid) {
  // Find existing link
  const existingSnap = await db
    .collection("phone_links")
    .where("uid", "==", uid)
    .get();

  for (const doc of existingSnap.docs) {
    await db.collection("phone_links").doc(doc.id).delete();
  }

  await db.collection("users").doc(uid).update({ whatsappPhone: null });
}

/**
 * Normalize phone to a consistent key (strip "whatsapp:" prefix, keep + and digits).
 */
function normalizePhone(phone) {
  return phone.replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
}
