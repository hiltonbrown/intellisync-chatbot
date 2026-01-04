"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";

const colors = [
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#16a34a", // green-600
  "#9333ea", // purple-600
  "#ea580c", // orange-600
];

export function UsageChart({ data }: { data: any[] }) {
  const { theme } = useTheme();

  // Extract model names from the first data point, excluding 'date'
  const models = data.length > 0 
    ? Object.keys(data[0]).filter(key => key !== "date")
    : [];

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
            borderColor: theme === "dark" ? "#374151" : "#e5e7eb",
            borderRadius: "0.5rem",
            color: theme === "dark" ? "#f3f4f6" : "#111827",
          }}
          itemStyle={{ color: theme === "dark" ? "#f3f4f6" : "#111827" }}
          labelStyle={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
        />
        <Legend />
        {models.map((model, index) => (
          <Line
            key={model}
            type="monotone"
            dataKey={model}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
