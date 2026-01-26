"use client";

import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApAgeingChartProps {
	data: {
		current: number;
		days30: number;
		days60: number;
		days90: number;
		days90plus: number;
	};
}

export function ApAgeingChart({ data }: ApAgeingChartProps) {
	const chartData = [
		{ name: "Current", value: data.current },
		{ name: "1-30 Days", value: data.days30 },
		{ name: "31-60 Days", value: data.days60 },
		{ name: "61-90 Days", value: data.days90 },
		{ name: "90+ Days", value: data.days90plus },
	];

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Aged Payables</CardTitle>
			</CardHeader>
			<CardContent className="pl-2">
				<ResponsiveContainer width="100%" height={350}>
					<BarChart
						data={chartData}
						layout="vertical"
						margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
					>
						<XAxis
							type="number"
							tickFormatter={(value) => `$${value.toLocaleString()}`}
						/>
						<YAxis dataKey="name" type="category" width={100} />
						<Tooltip
							formatter={(value: any) => [
								`$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
								"Amount",
							]}
							cursor={{ fill: "transparent" }}
						/>
						<Bar dataKey="value" radius={[0, 4, 4, 0]}>
							{chartData.map((entry) => (
								<Cell
									key={entry.name}
									fill={
										["Current", "1-30 Days"].includes(entry.name)
											? "#2563eb"
											: "#ef4444"
									}
								/>
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
