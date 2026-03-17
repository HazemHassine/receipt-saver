import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

const INITIAL_CREDITS = 100;
const CREDITS_PER_RECEIPT = 2;

/**
 * Unlimited emails are configured via UNLIMITED_EMAILS env var.
 * Comma-separated list, e.g.: "a@gmail.com,b@gmail.com"
 */
function getUnlimitedEmails() {
  return (process.env.UNLIMITED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if a user has unlimited credits.
 */
export function isUnlimitedUser(email) {
  return getUnlimitedEmails().includes(email?.toLowerCase());
}

/**
 * Get or create a user document. Returns the user data with credits.
 */
export async function getOrCreateUser(firebaseUser) {
  const ref = db.collection("users").doc(firebaseUser.uid);
  const doc = await ref.get();

  if (doc.exists) {
    return { id: doc.id, ...doc.data() };
  }

  // First sign-in — create user doc
  const unlimited = isUnlimitedUser(firebaseUser.email);
  const userData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.name || firebaseUser.email,
    photoURL: firebaseUser.picture || null,
    credits: unlimited ? -1 : INITIAL_CREDITS, // -1 means unlimited
    createdAt: Timestamp.now(),
  };

  await ref.set(userData);
  return { id: firebaseUser.uid, ...userData };
}

/**
 * Check if user has enough credits. Returns { allowed, credits, unlimited }.
 */
export async function checkCredits(uid, email) {
  if (isUnlimitedUser(email)) {
    return { allowed: true, credits: -1, unlimited: true };
  }

  const ref = db.collection("users").doc(uid);
  const doc = await ref.get();

  if (!doc.exists) {
    return { allowed: true, credits: INITIAL_CREDITS, unlimited: false };
  }

  const data = doc.data();
  const credits = data.credits ?? 0;

  if (credits === -1) {
    return { allowed: true, credits: -1, unlimited: true };
  }

  return {
    allowed: credits >= CREDITS_PER_RECEIPT,
    credits,
    unlimited: false,
  };
}

/**
 * Deduct credits after a successful receipt extraction.
 * No-op for unlimited users.
 */
export async function deductCredits(uid, email) {
  if (isUnlimitedUser(email)) return;

  const ref = db.collection("users").doc(uid);
  const doc = await ref.get();

  if (!doc.exists) return;

  const data = doc.data();
  if (data.credits === -1) return; // unlimited

  const newCredits = Math.max(0, (data.credits ?? 0) - CREDITS_PER_RECEIPT);
  await ref.update({ credits: newCredits });
}

export { INITIAL_CREDITS, CREDITS_PER_RECEIPT };
