"use client";

import { format, subDays } from "date-fns";
import { useMemo, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UsageChart } from "@/components/usage-chart";

const modelUsage = [
	// Mock data - replace with real data fetching
	{
		model: "Gemini 2.5 Flash Lite",
		inputTokens: 15420,
		outputTokens: 8500,
		totalTokens: 23920,
	},
	{
		model: "Anthropic Claude 3.5 Sonnet",
		inputTokens: 4200,
		outputTokens: 1200,
		totalTokens: 5400,
	},
	{
		model: "OpenAI GPT-4o",
		inputTokens: 1200,
		outputTokens: 800,
		totalTokens: 2000,
	},
];

function generateMockData(days: number) {
	const data = [];
	const today = new Date();

	for (let i = days; i >= 0; i--) {
		const date = subDays(today, i);
		data.push({
			date: format(date, "MMM d"),
			"Gemini 3 Pro": Math.floor(Math.random() * 5000) + 1000,
			"Claude Sonnet": Math.floor(Math.random() * 3000) + 500,
			"GPT-4o": Math.floor(Math.random() * 2000) + 200,
		});
	}
	return data;
}

export function UsagePage() {
	const [range, setRange] = useState("30");

	const chartData = useMemo(() => {
		return generateMockData(parseInt(range));
	}, [range]);

	return (
		<div className="w-full space-y-6 p-1">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold">Token Usage</h1>
				<p className="text-muted-foreground">
					View your token usage over time.
				</p>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
					<div className="space-y-1">
						<CardTitle>Usage Overview</CardTitle>
						<CardDescription>Daily token consumption by model.</CardDescription>
					</div>
					<Select value={range} onValueChange={setRange}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Select range" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="30">Last 30 days</SelectItem>
							<SelectItem value="60">Last 60 days</SelectItem>
							<SelectItem value="90">Last 90 days</SelectItem>
						</SelectContent>
					</Select>
				</CardHeader>
				<CardContent className="pl-2">
					<UsageChart data={chartData} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Usage by Model</CardTitle>
					<CardDescription>
						Detailed breakdown of input and output tokens per model (Mock
						Total).
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border">
						<div className="grid grid-cols-4 border-b bg-muted/50 p-4 text-sm font-medium">
							<div>Model</div>
							<div className="text-right">Input Tokens</div>
							<div className="text-right">Output Tokens</div>
							<div className="text-right">Total</div>
						</div>
						{modelUsage.map((item) => (
							<div
								key={item.model}
								className="grid grid-cols-4 items-center p-4 text-sm hover:bg-muted/50"
							>
								<div className="font-medium">{item.model}</div>
								<div className="text-right text-muted-foreground">
									{item.inputTokens.toLocaleString()}
								</div>
								<div className="text-right text-muted-foreground">
									{item.outputTokens.toLocaleString()}
								</div>
								<div className="text-right font-medium">
									{item.totalTokens.toLocaleString()}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
