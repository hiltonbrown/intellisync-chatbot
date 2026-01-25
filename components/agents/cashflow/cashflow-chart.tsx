"use client";

import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CashflowChartProps {
	data: any[];
}

export function CashflowChart({ data }: CashflowChartProps) {
    const today = new Date().toISOString().split('T')[0];

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Cashflow Forecast</CardTitle>
			</CardHeader>
			<CardContent className="pl-2">
				<ResponsiveContainer width="100%" height={350}>
					<LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
						<XAxis
							dataKey="date"
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                            minTickGap={30}
						/>
						<YAxis />
						<Tooltip
                            labelFormatter={(value) => new Date(value).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
							formatter={(value: any, name: any) => [
								`$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
								String(name) === "historicalIn" ? "Cash In (Hist)" :
                                String(name) === "historicalOut" ? "Cash Out (Hist)" :
                                String(name) === "projectedIn" ? "Cash In (Proj)" : "Cash Out (Proj)",
							]}
						/>
                        <ReferenceLine x={today} stroke="red" label="Today" />
						<Line type="monotone" dataKey="historicalIn" stroke="#16a34a" strokeWidth={2} dot={false} name="In (Hist)" />
                        <Line type="monotone" dataKey="historicalOut" stroke="#dc2626" strokeWidth={2} dot={false} name="Out (Hist)" />
                        <Line type="monotone" dataKey="projectedIn" stroke="#16a34a" strokeDasharray="5 5" strokeWidth={2} dot={false} name="In (Proj)" />
                        <Line type="monotone" dataKey="projectedOut" stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Out (Proj)" />
					</LineChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
