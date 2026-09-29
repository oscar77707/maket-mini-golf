"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import { formatDate, formatNumber } from "@/lib/format";
import { solderLot } from "../actions";

export type LotAffiche = {
  id: string;
  produit_id: string;
  produit_nom?: string;
  dlc: string;
  numero_lot: string | null;
  quantite_initiale: number;
  jours_restants: number;
};

function DlcBadge({ jours }: { jours: number }) {
  if (jours < 0) return <Badge variant="rouge">Périmé depuis {-jours} j</Badge>;
  if (jours === 0) return <Badge variant="rouge">Périme aujourd&apos;hui</Badge>;
  if (jours === 1) return <Badge variant="rouge">Périme demain</Badge>;
  return <Badge variant="orange">J-{jours}</Badge>;
}

export function LotsDlcListe({ lots, showProduit }: { lots: LotAffiche[]; showProduit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {lots.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            {showProduit && (
              <Link
                href={`/stocks/${l.produit_id}`}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {l.produit_nom}
              </Link>
            )}
            <p className="text-sm text-muted-foreground">
              DLC {formatDate(l.dlc)}
              {l.numero_lot ? ` · lot ${l.numero_lot}` : ""} · reçu :{" "}
              {formatNumber(l.quantite_initiale, 3)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DlcBadge jours={l.jours_restants} />
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  notify(await solderLot(l.id));
                  router.refresh();
                })
              }
            >
              <CheckCheck aria-hidden className="size-4" />
              Consommé ou jeté
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
