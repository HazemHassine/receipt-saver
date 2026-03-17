"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const GRAY_SHADES = [
  "#1a1a1a",
  "#3a3a3a",
  "#5a5a5a",
  "#7a7a7a",
  "#9a9a9a",
  "#bababa",
  "#d4d4d4",
  "#e5e5e5",
];

export function CategoryChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tickFormatter={(v) => `$${v}`} fontSize={12} />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          fontSize={12}
          tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
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
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={GRAY_SHADES[index % GRAY_SHADES.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
