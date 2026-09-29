"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import { NouvelleCommandeButton } from "@/features/commandes/components/nouvelle-commande-button";
import { dupliquerDerniereCommande } from "@/features/commandes/actions";
import type { Fournisseur, Pole } from "@/types/models";
import { setFournisseurActif } from "../actions";
import { FournisseurSheet } from "./fournisseur-sheet";

export function FournisseurActions({
  fournisseur,
  poles,
  isGerant,
  defaultPoleId,
  aDesCommandes,
}: {
  fournisseur: Fournisseur;
  poles: Pole[];
  isGerant: boolean;
  defaultPoleId: number | null;
  aDesCommandes: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {fournisseur.actif && (
        <NouvelleCommandeButton
          fournisseurs={[fournisseur]}
          fournisseurId={fournisseur.id}
          poles={poles}
          isGerant={isGerant}
          defaultPoleId={defaultPoleId}
        />
      )}
      {fournisseur.actif && (
        <Button
          variant="outline"
          disabled={pending || !aDesCommandes}
          title={aDesCommandes ? undefined : "Ce fournisseur n'a pas encore de commande."}
          onClick={() =>
            startTransition(async () => {
              const result = await dupliquerDerniereCommande(fournisseur.id);
              if (notify(result) && result.ok) router.push(`/commandes/${result.data.id}`);
            })
          }
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Copy aria-hidden />}
          Dupliquer la dernière commande
        </Button>
      )}
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        Modifier
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          const message = fournisseur.actif
            ? "Désactiver ce fournisseur ? Il ne sera plus proposé pour les nouvelles commandes, l'historique reste."
            : null;
          if (message && !window.confirm(message)) return;
          startTransition(async () => {
            notify(await setFournisseurActif(fournisseur.id, !fournisseur.actif));
            router.refresh();
          });
        }}
      >
        <Power aria-hidden />
        {fournisseur.actif ? "Désactiver" : "Réactiver"}
      </Button>
      <FournisseurSheet open={editing} onOpenChange={setEditing} fournisseur={fournisseur} />
    </div>
  );
}
