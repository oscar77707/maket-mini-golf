"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, ArrowDownToLine, ArrowUpFromLine, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import type { ProduitStock, TypeMouvement } from "@/types/models";
import type { Referentiels } from "../queries";
import { archiverProduits } from "../actions";
import { CommanderButton } from "./commander-button";
import { MouvementSheet } from "./mouvement-sheet";
import { ProduitSheet } from "./produit-sheet";

export function ProduitActions({
  produit,
  referentiels,
  canManage,
  isGerant,
}: {
  produit: ProduitStock;
  referentiels: Referentiels;
  canManage: boolean;
  isGerant: boolean;
}) {
  const router = useRouter();
  const [mouvement, setMouvement] = useState<TypeMouvement | null>(null);
  const [edit, setEdit] = useState(false);
  const [pending, startTransition] = useTransition();
  const archived = !produit.actif;

  const toggleArchive = () =>
    startTransition(async () => {
      const result = await archiverProduits([produit.id], !archived);
      notify(result, {
        undo: {
          onClick: async () => {
            notify(await archiverProduits([produit.id], archived));
            router.refresh();
          },
        },
      });
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {!archived && (
        <>
          <Button onClick={() => setMouvement("entree")}>
            <ArrowDownToLine aria-hidden />+ Entrée
          </Button>
          <Button variant="outline" onClick={() => setMouvement("sortie")}>
            <ArrowUpFromLine aria-hidden />+ Sortie
          </Button>
        </>
      )}
      {canManage && !archived && produit.niveau_alerte !== "ok" && (
        <CommanderButton variant="secondary" produitIds={[produit.id]}>
          Commander
        </CommanderButton>
      )}
      {canManage && (
        <>
          <Button variant="outline" onClick={() => setEdit(true)}>
            <Pencil aria-hidden />
            Modifier
          </Button>
          <Button variant="ghost" disabled={pending} onClick={toggleArchive}>
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? "Restaurer" : "Archiver"}
          </Button>
          <ProduitSheet
            referentiels={referentiels}
            isGerant={isGerant}
            defaultPoleId={produit.pole_id}
            produit={produit}
            open={edit}
            onOpenChange={setEdit}
          />
        </>
      )}
      <MouvementSheet
        produit={{
          id: produit.id,
          nom: produit.nom,
          unite: produit.unite,
          stock_actuel: produit.stock_actuel,
          suivi_dlc: produit.suivi_dlc,
        }}
        type={mouvement ?? "entree"}
        canCorrect={canManage}
        open={mouvement !== null}
        onOpenChange={(o) => !o && setMouvement(null)}
      />
    </div>
  );
}
