"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
	getUserById,
	getUserSettingsByUserId,
	updateUserSystemPrompt,
	upsertUserSettings,
} from "@/lib/db/queries";
import type { UserSettings } from "@/lib/db/schema";
import { userSettingsInputSchema } from "./personalization-validation";

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

// User Settings Actions for Intellisync

export interface UserSettingsInput {
	companyName?: string | null;
	timezone?: string | null;
	baseCurrency?: string | null;
	dateFormat?: string | null;
}

export async function saveUserSettings(
	settings: UserSettingsInput,
): Promise<UserSettings> {
	const { userId } = await auth();

	if (!userId) {
		throw new Error("Unauthorized");
	}

	// Validate input
	const validationResult = userSettingsInputSchema.safeParse(settings);
	if (!validationResult.success) {
		throw new Error(`Invalid settings: ${validationResult.error.message}`);
	}

	const result = await upsertUserSettings({
		userId,
		...validationResult.data,
	});

	revalidatePath("/");
	return result;
}

export async function getUserSettings(): Promise<UserSettings | null> {
	const { userId } = await auth();

	if (!userId) {
		return null;
	}

	return getUserSettingsByUserId({ userId });
}
