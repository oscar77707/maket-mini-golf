"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PriceChart } from "@/features/stocks/components/price-chart";
import { formatDate, formatEuro } from "@/lib/format";
import type { PointPrix } from "../queries";

/** Évolution des prix facturés par ce fournisseur : variations récentes et courbe d'un produit. */
export function PrixFournisseur({
  points,
  noms,
}: {
  points: PointPrix[];
  noms: Record<string, string>;
}) {
  const byProduit = new Map<string, PointPrix[]>();
  for (const p of points) byProduit.set(p.produit_id, [...(byProduit.get(p.produit_id) ?? []), p]);
  const produits = [...byProduit.entries()]
    .filter(([id]) => noms[id])
    .map(([id, list]) => {
      const last = list[list.length - 1];
      const previous = list.length > 1 ? list[list.length - 2] : null;
      const variation =
        previous && previous.prix > 0 ? ((last.prix - previous.prix) / previous.prix) * 100 : null;
      return { id, nom: noms[id], list, last, variation };
    })
    .sort((a, b) => b.list.length - a.list.length || a.nom.localeCompare(b.nom, "fr"));
  const [choix, setChoix] = useState<string>(
    produits.find((p) => p.list.length > 1)?.id ?? produits[0]?.id ?? "",
  );
  const courant = produits.find((p) => p.id === choix);

  if (produits.length === 0) return null;
  const changes = produits.filter((p) => p.variation !== null && Math.abs(p.variation) >= 0.5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution des prix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {changes.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Variations récentes de prix">
            {changes.slice(0, 6).map((p) => {
              const hausse = (p.variation ?? 0) > 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.nom}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatEuro(p.last.prix)} au {formatDate(p.last.date)}
                    </span>
                  </span>
                  <Badge variant={hausse ? "rouge" : "vert"}>
                    {hausse ? (
                      <TrendingUp aria-hidden className="size-4" />
                    ) : (
                      <TrendingDown aria-hidden className="size-4" />
                    )}
                    {hausse ? "+" : ""}
                    {(p.variation ?? 0).toFixed(1).replace(".", ",")} %
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        <Select
          aria-label="Produit affiché sur la courbe"
          value={choix}
          onChange={(e) => setChoix(e.target.value)}
          className="max-w-sm"
        >
          {produits.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} ({p.list.length} prix)
            </option>
          ))}
        </Select>
        {courant &&
          (courant.list.length >= 2 ? (
            <PriceChart points={courant.list.map((p) => ({ date: p.date, prix: p.prix }))} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Un seul prix connu pour ce produit ({formatEuro(courant.last.prix)} au{" "}
              {formatDate(courant.last.date)}) : la courbe apparaîtra après une autre livraison.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
