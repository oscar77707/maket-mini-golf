"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { ProduitStock } from "@/types/models";
import { UNITE_LABELS } from "../labels";
import { CommanderButton } from "./commander-button";
import { MouvementSheet, type MouvementProduit } from "./mouvement-sheet";

export function AlertesListe({
  produits,
  canManage,
}: {
  produits: ProduitStock[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<MouvementProduit | null>(null);
  return (
    <>
      <ul className="divide-y rounded-lg border bg-card">
        {produits.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1">
              <Link
                href={`/stocks/${p.id}`}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {p.nom}
              </Link>
              <p className="text-sm text-muted-foreground">
                Stock{" "}
                <strong className="text-foreground">
                  {formatNumber(p.stock_actuel, 3)} {UNITE_LABELS[p.unite]}
                </strong>{" "}
                · seuil {formatNumber(p.seuil_minimum, 3)} · conseillé : commander{" "}
                {formatNumber(p.quantite_a_commander, 3)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelected({
                    id: p.id,
                    nom: p.nom,
                    unite: p.unite,
                    stock_actuel: p.stock_actuel,
                    suivi_dlc: p.suivi_dlc,
                  })
                }
              >
                <ArrowDownToLine aria-hidden className="size-4" />
                Entrée
              </Button>
              {canManage && (
                <CommanderButton size="sm" variant="secondary" produitIds={[p.id]}>
                  Commander
                </CommanderButton>
              )}
            </div>
          </li>
        ))}
      </ul>
      <MouvementSheet
        produit={selected}
        type="entree"
        canCorrect={canManage}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </>
  );
}
