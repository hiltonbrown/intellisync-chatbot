import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ChatSDKError } from "@/lib/errors";
import { verifyUser } from "@/lib/db/queries";

/**
 * Gets the authenticated user from Clerk and verifies they exist in the database.
 * This is a convenience function to reduce code duplication across API routes.
 *
 * @throws {ChatSDKError} If user is not authenticated or verification fails
 * @returns Object containing userId and user from Clerk
 */
export async function getAuthenticatedUser() {
  const { userId } = await auth();
  const user = userId ? await currentUser() : null;

  if (!userId || !user) {
    throw new ChatSDKError("unauthorized:auth", "Authentication required");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new ChatSDKError(
      "bad_request:auth",
      "User email not found. Please ensure your account has a valid email address."
    );
  }

  // Verify user exists in database (or create if first time)
  await verifyUser({ id: userId, email });

  return { userId, user, email };
}
