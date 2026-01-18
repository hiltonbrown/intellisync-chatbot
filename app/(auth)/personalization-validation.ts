import { z } from "zod";
import {
	AUSTRALIAN_TIMEZONES,
	CURRENCY_OPTIONS,
	DATE_FORMAT_OPTIONS,
} from "./personalization-config";

const VALID_TIMEZONES = AUSTRALIAN_TIMEZONES.map((tz) => tz.value);
const VALID_CURRENCIES = CURRENCY_OPTIONS.map((c) => c.value);
const VALID_DATE_FORMATS = DATE_FORMAT_OPTIONS.map((df) => df.value);

export const userSettingsInputSchema = z.object({
	companyName: z
		.string()
		.max(256, "Company name must be 256 characters or less")
		.nullish(),
	timezone: z.enum([...VALID_TIMEZONES] as [string, ...string[]]).nullish(),
	baseCurrency: z
		.enum([...VALID_CURRENCIES] as [string, ...string[]])
		.nullish(),
	dateFormat: z
		.enum([...VALID_DATE_FORMATS] as [string, ...string[]])
		.nullish(),
});

export type ValidatedUserSettingsInput = z.infer<
	typeof userSettingsInputSchema
>;
