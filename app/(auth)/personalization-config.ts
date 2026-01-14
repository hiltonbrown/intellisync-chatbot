// Configuration constants for user personalization settings
// This file does not use "use server" because it only exports constants

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
