import { adminAuth } from "@/lib/firebase-admin";

const ALLOWED_EMAILS = (process.env.UNLIMITED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token (with uid, email, etc.) or null.
 * Also rejects emails not in the beta allowlist.
 */
export async function verifyAuth(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);

    // Beta gate: reject emails not in the allowlist
    if (
      ALLOWED_EMAILS.length > 0 &&
      !ALLOWED_EMAILS.includes(decoded.email?.toLowerCase())
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Helper to create a 401 JSON response.
 */
export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
