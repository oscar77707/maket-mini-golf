"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Ban, CheckCheck, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import type { StatutInventaire } from "@/types/models";
import { changerStatutInventaire, soumettreInventaire, validerInventaire } from "../actions";

export function InventaireActions({
  id,
  statut,
  canManage,
  comptes,
}: {
  id: string;
  statut: StatutInventaire;
  canManage: boolean;
  comptes: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Parameters<typeof notify>[0]>, after?: () => void) =>
    startTransition(async () => {
      const ok = notify(await fn());
      router.refresh();
      if (ok) after?.();
    });

  if (statut === "valide" || statut === "annule") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {statut === "en_cours" && (
        <Button
          size="lg"
          disabled={pending || comptes === 0}
          onClick={() => run(() => soumettreInventaire(id))}
        >
          <Send aria-hidden />
          Soumettre à validation
        </Button>
      )}
      {canManage && (
        <Button
          size="lg"
          variant={statut === "soumis" ? "default" : "outline"}
          disabled={pending || comptes === 0}
          onClick={() => {
            if (
              window.confirm(
                "Valider l'inventaire ? Les écarts deviendront des corrections de stock, définitives.",
              )
            )
              run(() => validerInventaire(id));
          }}
        >
          <CheckCheck aria-hidden />
          Valider et corriger le stock
        </Button>
      )}
      {canManage && statut === "soumis" && (
        <Button
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => changerStatutInventaire(id, "rouvrir"))}
        >
          <RotateCcw aria-hidden />
          Rouvrir le comptage
        </Button>
      )}
      {canManage && (
        <Button
          size="lg"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Annuler cet inventaire ? Les comptages saisis seront perdus."))
              run(
                () => changerStatutInventaire(id, "annuler"),
                () => router.push("/stocks/inventaires"),
              );
          }}
        >
          <Ban aria-hidden />
          Annuler l&apos;inventaire
        </Button>
      )}
    </div>
  );
}
