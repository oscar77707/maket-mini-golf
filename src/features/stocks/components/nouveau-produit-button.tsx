"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Referentiels } from "../queries";
import { ProduitSheet } from "./produit-sheet";

export function NouveauProduitButton({
  referentiels,
  isGerant,
  defaultPoleId,
  variant,
}: {
  referentiels: Referentiels;
  isGerant: boolean;
  defaultPoleId: number | null;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouveau produit
      </Button>
      <ProduitSheet
        referentiels={referentiels}
        isGerant={isGerant}
        defaultPoleId={defaultPoleId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
