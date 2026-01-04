"use server";

import { auth } from "@clerk/nextjs/server";
import { updateUserSystemPrompt, getUserById } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export async function saveSystemPrompt(systemPrompt: string | null) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  await updateUserSystemPrompt({ id: userId, systemPrompt });
  revalidatePath("/");
}

export async function getUserSystemPrompt() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await getUserById({ id: userId });
  return user?.systemPrompt || null;
}
