"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useTheme } from "next-themes";

const data = [
  {
    date: "Jan 1",
    tokens: 2400,
  },
  {
    date: "Jan 2",
    tokens: 1398,
  },
  {
    date: "Jan 3",
    tokens: 9800,
  },
  {
    date: "Jan 4",
    tokens: 3908,
  },
  {
    date: "Jan 5",
    tokens: 4800,
  },
  {
    date: "Jan 6",
    tokens: 3800,
  },
  {
    date: "Jan 7",
    tokens: 4300,
  },
];

export function UsageChart() {
  const { theme } = useTheme();

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
        <Line
          type="monotone"
          dataKey="tokens"
          stroke="#2563eb" // blue-600
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#2563eb" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
