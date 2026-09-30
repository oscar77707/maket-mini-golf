"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd, ToucheModificateur } from "@/components/ui/kbd";
import { useQuickAdd } from "@/features/quick-add/context";

/** Ouvre la palette Ctrl/⌘ K : champ étendu sur ordinateur, simple loupe sur téléphone. */
export function RechercheButton() {
  const { ouvrirPalette } = useQuickAdd();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label="Rechercher"
        data-testid="recherche-rapide"
        className="hidden w-44 justify-start gap-2 font-normal text-muted-foreground lg:flex xl:w-64"
        onClick={ouvrirPalette}
      >
        <Search aria-hidden />
        <span aria-hidden className="flex-1 text-left">
          Rechercher
        </span>
        <span aria-hidden className="flex gap-1">
          <ToucheModificateur />
          <Kbd>K</Kbd>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Recherche rapide"
        data-testid="recherche-rapide-mobile"
        className="lg:hidden"
        onClick={ouvrirPalette}
      >
        <Search aria-hidden />
      </Button>
    </>
  );
}
