"use client";

import { useState } from "react";
import {
  MouvementSheet,
  type MouvementProduit,
} from "@/features/stocks/components/mouvement-sheet";
import type { TypeMouvement } from "@/types/models";
import { ProduitPicker } from "./produit-picker";

/** Mouvement de stock depuis n'importe quelle page : on choisit d'abord le produit, puis le mouvement. */
export function MouvementRapideSheet({
  canCorrect,
  open,
  onOpenChange,
}: {
  canCorrect: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [produit, setProduit] = useState<MouvementProduit | null>(null);
  const [type, setType] = useState<TypeMouvement>("entree");
  return (
    <MouvementSheet
      produit={produit}
      type={type}
      canCorrect={canCorrect}
      open={open}
      onOpenChange={onOpenChange}
      selecteur={<ProduitPicker onChoisir={setProduit} />}
      onChangerProduit={() => setProduit(null)}
      onAutre={(t) => {
        setType(t);
        setProduit(null);
      }}
    />
  );
}
