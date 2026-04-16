"use client";

import { PricePoint } from "@/lib/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface PriceChartProps {
  priceHistory: PricePoint[];
  currentPrice: number;
  averagePrice: number;
}

export default function PriceChart({ priceHistory, currentPrice, averagePrice }: PriceChartProps) {
  const data = priceHistory.map((p) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    price: p.price,
    fullDate: p.date,
  }));

  // Show ~30 data points max for readability
  const step = Math.max(1, Math.floor(data.length / 30));
  const filtered = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={filtered} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            interval={Math.max(0, Math.floor(filtered.length / 6))}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "none",
              borderRadius: "8px",
              color: "#f9fafb",
              fontSize: 13,
            }}
            formatter={(value) => [`$${value}`, "Price"]}
          />
          <ReferenceLine
            y={averagePrice}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{
              value: `Avg $${averagePrice}`,
              position: "insideTopRight",
              fill: "#9ca3af",
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#6366f1" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
