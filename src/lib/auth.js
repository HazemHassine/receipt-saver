import { adminAuth } from "@/lib/firebase-admin";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token (with uid, email, etc.) or null.
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
