"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatEuro } from "@/lib/format";

type Point = { jour: string; valeur: number };

const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const asDate = (d: string) => `${d}T12:00:00Z`;

/** Courbe de la valeur du stock (mouvements valorisés) sur la période, décrite pour les lecteurs d'écran. */
export function ValeurStockChart({ points, className }: { points: Point[]; className?: string }) {
  const debut = points[0];
  const fin = points[points.length - 1];
  const variation = fin && debut ? fin.valeur - debut.valeur : 0;
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Valeur du stock sur 30 jours</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <p className="py-10 text-center text-muted-foreground">Pas encore assez de données.</p>
        ) : (
          <>
            <div
              className="h-56 w-full"
              role="img"
              aria-label={`Valeur du stock : ${formatEuro(debut.valeur)} le ${formatDate(asDate(debut.jour))}, ${formatEuro(fin.valeur)} le ${formatDate(asDate(fin.jour))} (${variation >= 0 ? "+" : "−"}${formatEuro(Math.abs(variation))}).`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="jour"
                    tickFormatter={shortDay}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatEuro(v)}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    width={84}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    formatter={(v) => [formatEuro(Number(v)), "Valeur du stock"]}
                    labelFormatter={(d) => formatDate(asDate(String(d)))}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valeur"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="var(--primary)"
                    fillOpacity={0.15}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="sr-only">
              <table>
                <caption>Valeur du stock par jour</caption>
                <thead>
                  <tr>
                    <th scope="col">Jour</th>
                    <th scope="col">Valeur HT</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.jour}>
                      <th scope="row">{formatDate(asDate(p.jour))}</th>
                      <td>{formatEuro(p.valeur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
