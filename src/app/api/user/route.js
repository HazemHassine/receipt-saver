import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/credits";

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const userData = await getOrCreateUser(user);
    return Response.json({
      user: {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        credits: userData.credits,
        unlimited: userData.credits === -1,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return Response.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
