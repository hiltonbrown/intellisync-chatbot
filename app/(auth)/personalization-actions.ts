"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
	createOrUpdateUserSettings,
	getUserById,
	getUserSettingsByUserId,
	updateUserSystemPrompt,
} from "@/lib/db/queries";
import type { UserSettings } from "@/lib/db/schema";

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

	const result = await createOrUpdateUserSettings({
		userId,
		...settings,
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

// Common Australian timezone options (Brisbane is default)
export const AUSTRALIAN_TIMEZONES = [
	{ value: "Australia/Brisbane", label: "Brisbane (AEST)" },
	{ value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
	{ value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
	{ value: "Australia/Perth", label: "Perth (AWST)" },
	{ value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
	{ value: "Australia/Darwin", label: "Darwin (ACST)" },
	{ value: "Australia/Hobart", label: "Hobart (AEST/AEDT)" },
] as const;

// Common currency options for Australian businesses
export const CURRENCY_OPTIONS = [
	{ value: "AUD", label: "AUD - Australian Dollar" },
	{ value: "USD", label: "USD - US Dollar" },
	{ value: "NZD", label: "NZD - New Zealand Dollar" },
	{ value: "GBP", label: "GBP - British Pound" },
	{ value: "EUR", label: "EUR - Euro" },
	{ value: "SGD", label: "SGD - Singapore Dollar" },
] as const;

// Date format options
export const DATE_FORMAT_OPTIONS = [
	{ value: "DD/MM/YYYY", label: "DD/MM/YYYY (Australian)" },
	{ value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
	{ value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
] as const;
