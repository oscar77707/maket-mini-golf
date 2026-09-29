"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FournisseurSheet } from "./fournisseur-sheet";

export function NouveauFournisseurButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouveau fournisseur
      </Button>
      <FournisseurSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
