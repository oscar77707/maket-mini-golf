"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuro, formatNumber } from "@/lib/format";

export type BarPoint = { label: string; value: number; color?: string; tooltip?: string };

/**
 * Histogramme accessible : le graphique est décrit par `summary` (lecteurs d'écran) et le détail
 * chiffré est repris dans un tableau masqué visuellement.
 */
export function BarBlock({
  title,
  unit,
  data,
  summary,
  horizontal = false,
  height = 224,
  labelWidth = 110,
  valueFormat = "nombre",
  className,
}: {
  title: string;
  /** Ce que mesure la valeur, au pluriel (« appels », « produits »). */
  unit: string;
  data: BarPoint[];
  summary: string;
  horizontal?: boolean;
  height?: number;
  /** Largeur réservée aux libellés d'un graphique horizontal. */
  labelWidth?: number;
  valueFormat?: "nombre" | "euro";
  className?: string;
}) {
  const format = (v: number) =>
    valueFormat === "euro" ? formatEuro(v) : `${formatNumber(v, 0)} ${unit}`;
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full" role="img" aria-label={`${title}. ${summary}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={horizontal} />
              {horizontal ? (
                <>
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickFormatter={
                      valueFormat === "euro" ? (v: number) => formatEuro(v) : undefined
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    width={labelWidth}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    width={32}
                  />
                </>
              )}
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                formatter={(v) => [format(Number(v)), ""]}
                labelFormatter={(_, payload) =>
                  (payload?.[0]?.payload as BarPoint | undefined)?.tooltip ??
                  String(payload?.[0]?.payload?.label ?? "")
                }
                separator=""
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.label} fill={d.color ?? "var(--primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="sr-only">
          <table>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                <th scope="col">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.tooltip ?? d.label}</th>
                  <td>{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
