"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatEuro } from "@/lib/format";

export function PriceChart({ points }: { points: { date: string; prix: number }[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <figure className="space-y-2">
      <div
        className="h-56 w-full"
        role="img"
        aria-label={`Évolution du prix d'achat, de ${formatEuro(first.prix)} le ${formatDate(first.date)} à ${formatEuro(last.prix)} le ${formatDate(last.date)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d)}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(v: number) => formatEuro(v)}
              stroke="var(--muted-foreground)"
              fontSize={12}
              width={70}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v) => formatEuro(Number(v))}
              labelFormatter={(d) => formatDate(String(d))}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <Line
              type="monotone"
              dataKey="prix"
              name="Prix d'achat HT"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
