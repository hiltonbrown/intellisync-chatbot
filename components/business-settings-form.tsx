"use client";

import { useState, useTransition } from "react";
import {
	AUSTRALIAN_TIMEZONES,
	CURRENCY_OPTIONS,
	DATE_FORMAT_OPTIONS,
	saveUserSettings,
	type UserSettingsInput,
} from "@/app/(auth)/personalization-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { UserSettings } from "@/lib/db/schema";

interface BusinessSettingsFormProps {
	initialSettings: UserSettings | null;
}

export function BusinessSettingsForm({
	initialSettings,
}: BusinessSettingsFormProps) {
	const [isPending, startTransition] = useTransition();
	const [saved, setSaved] = useState(false);

	const [companyName, setCompanyName] = useState(
		initialSettings?.companyName || "",
	);
	const [timezone, setTimezone] = useState(
		initialSettings?.timezone || "Australia/Brisbane",
	);
	const [baseCurrency, setBaseCurrency] = useState(
		initialSettings?.baseCurrency || "AUD",
	);
	const [dateFormat, setDateFormat] = useState(
		initialSettings?.dateFormat || "DD/MM/YYYY",
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setSaved(false);

		const settings: UserSettingsInput = {
			companyName: companyName || null,
			timezone,
			baseCurrency,
			dateFormat,
		};

		startTransition(async () => {
			await saveUserSettings(settings);
			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="space-y-2">
				<Label htmlFor="companyName">Company / Organisation Name</Label>
				<Input
					id="companyName"
					placeholder="Enter your company name"
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
				/>
				<p className="text-sm text-muted-foreground">
					Used for personalised AI responses and document generation
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="timezone">Timezone</Label>
				<Select value={timezone} onValueChange={setTimezone}>
					<SelectTrigger id="timezone">
						<SelectValue placeholder="Select timezone" />
					</SelectTrigger>
					<SelectContent>
						{AUSTRALIAN_TIMEZONES.map((tz) => (
							<SelectItem key={tz.value} value={tz.value}>
								{tz.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-sm text-muted-foreground">
					Used for date/time formatting in documents
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="baseCurrency">Base Currency</Label>
				<Select value={baseCurrency} onValueChange={setBaseCurrency}>
					<SelectTrigger id="baseCurrency">
						<SelectValue placeholder="Select currency" />
					</SelectTrigger>
					<SelectContent>
						{CURRENCY_OPTIONS.map((currency) => (
							<SelectItem key={currency.value} value={currency.value}>
								{currency.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-sm text-muted-foreground">
					Default currency for financial calculations and reports
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="dateFormat">Date Format</Label>
				<Select value={dateFormat} onValueChange={setDateFormat}>
					<SelectTrigger id="dateFormat">
						<SelectValue placeholder="Select date format" />
					</SelectTrigger>
					<SelectContent>
						{DATE_FORMAT_OPTIONS.map((format) => (
							<SelectItem key={format.value} value={format.value}>
								{format.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-sm text-muted-foreground">
					Format used for dates in documents and spreadsheets
				</p>
			</div>

			<div className="flex items-center gap-4">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Saving..." : "Save Settings"}
				</Button>
				{saved && (
					<span className="text-sm text-green-600 dark:text-green-400">
						Settings saved successfully
					</span>
				)}
			</div>
		</form>
	);
}
