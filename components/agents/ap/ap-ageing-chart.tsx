"use client";

import {
	Bar,
	BarChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApAgeingChartProps {
	data: {
		current: number;
		currentCount: number;
		days30: number;
		days30Count: number;
		days60: number;
		days60Count: number;
		days90: number;
		days90Count: number;
		days90plus: number;
		days90plusCount: number;
	};
}

export function ApAgeingChart({ data }: ApAgeingChartProps) {
	const categories = [
		{
			name: "Current",
			value: data.current,
			count: data.currentCount,
			color: "#22c55e", // Green
		},
		{
			name: "1-30",
			value: data.days30,
			count: data.days30Count,
			color: "#eab308", // Yellow
		},
		{
			name: "31-60",
			value: data.days60,
			count: data.days60Count,
			color: "#f97316", // Orange
		},
		{
			name: "61-90",
			value: data.days90,
			count: data.days90Count,
			color: "#ef4444", // Red
		},
		{
			name: "90+",
			value: data.days90plus,
			count: data.days90plusCount,
			color: "#991b1b", // Dark Red
		},
	];

	// Calculate total payable for percentage calculations
	const totalPayable =
		data.current + data.days30 + data.days60 + data.days90 + data.days90plus;

	// Prepare data for stacked bar chart (single bar with all segments)
	const chartData = [
		{
			name: "Aged Payables",
			current: data.current,
			days30: data.days30,
			days60: data.days60,
			days90: data.days90,
			days90plus: data.days90plus,
		},
	];

	const formatCurrency = (value: number) =>
		`$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Aged Payables</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<ResponsiveContainer width="100%" height={90}>
					<BarChart
						data={chartData}
						layout="vertical"
						margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
					>
						<XAxis type="number" hide />
						<YAxis type="category" dataKey="name" hide />
						<Tooltip
							formatter={(value: number | undefined, name: string | undefined) => {
								const category = categories.find((c) => {
									if (name === "current") return c.name === "Current";
									if (name === "days30") return c.name === "1-30";
									if (name === "days60") return c.name === "31-60";
									if (name === "days90") return c.name === "61-90";
									if (name === "days90plus") return c.name === "90+";
									return false;
								});
								return [formatCurrency(value ?? 0), category?.name || name || ""];
							}}
							cursor={false}
						/>
						<Bar
							dataKey="current"
							stackId="a"
							fill={categories[0].color}
							radius={[4, 0, 0, 4]}
						/>
						<Bar dataKey="days30" stackId="a" fill={categories[1].color} />
						<Bar dataKey="days60" stackId="a" fill={categories[2].color} />
						<Bar dataKey="days90" stackId="a" fill={categories[3].color} />
						<Bar
							dataKey="days90plus"
							stackId="a"
							fill={categories[4].color}
							radius={[0, 4, 4, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>

				{/* Legend with bill counts and values */}
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
					{categories.map((category) => {
						const percentage =
							totalPayable > 0 ? (category.value / totalPayable) * 100 : 0;

						return (
							<div
								key={category.name}
								className="flex flex-col gap-1 rounded-lg border p-3"
							>
								<div className="flex items-center gap-2">
									<div
										className="h-3 w-3 rounded-sm"
										style={{ backgroundColor: category.color }}
									/>
									<span className="text-xs font-medium text-muted-foreground">
										{category.name}
									</span>
								</div>
								<div className="mt-1 space-y-0.5">
									<div className="flex items-baseline gap-2">
										<p className="text-sm font-semibold">
											{formatCurrency(category.value)}
										</p>
										<span className="text-xs font-medium text-muted-foreground">
											{percentage.toFixed(1)}%
										</span>
									</div>
									<p className="text-xs text-muted-foreground">
										{category.count} {category.count === 1 ? "bill" : "bills"}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
