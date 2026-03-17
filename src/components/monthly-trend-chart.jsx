"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function MonthlyTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" fontSize={11} tick={{ fill: "#6b7280" }} />
        <YAxis
          tickFormatter={(v) => `$${v}`}
          fontSize={11}
          tick={{ fill: "#6b7280" }}
          width={56}
        />
        <Tooltip
          formatter={(value) => [`$${value.toFixed(2)}`, "Spend"]}
          contentStyle={{
            background: "white",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#1a1a1a"
          strokeWidth={2}
          dot={{ fill: "#1a1a1a", r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
