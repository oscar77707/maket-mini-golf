"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/models";
import { useQuickAdd } from "../context";
import { ajoutsFor } from "../registry";

/**
 * Bouton « + Ajouter » : en haut à droite sur ordinateur, flottant au-dessus de la barre du bas sur
 * téléphone. Une seule entrée possible (salarié) : le bouton ouvre directement son tiroir.
 */
export function QuickAddButton({
  role,
  emplacement,
}: {
  role: Role;
  emplacement: "entete" | "flottant";
}) {
  const ajouts = ajoutsFor(role);
  const { ouvrir, menuOuvert, setMenuOuvert } = useQuickAdd();
  const choisi = useRef(false);
  // les deux boutons existent dans la page, un seul est visible : seul celui-là pilote le menu
  const bureau = useMediaQuery("(min-width: 1024px)", true);
  const actif = (emplacement === "entete") === bureau;
  if (ajouts.length === 0) return null;

  const bouton = (
    <Button
      type="button"
      aria-label="Ajouter"
      data-testid={emplacement === "flottant" ? "ajouter-flottant" : "ajouter-entete"}
      className={cn(
        emplacement === "flottant" &&
          "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 rounded-full px-5 shadow-lg lg:hidden",
        emplacement === "entete" && "hidden lg:inline-flex",
      )}
      onClick={ajouts.length === 1 ? () => ouvrir(ajouts[0].id) : undefined}
    >
      <Plus aria-hidden />
      <span aria-hidden>Ajouter</span>
      {emplacement === "entete" && (
        <Kbd aria-hidden className="ml-1 border-white/40 bg-white/20 text-primary-foreground">
          N
        </Kbd>
      )}
    </Button>
  );
  if (ajouts.length === 1) return bouton;

  return (
    <DropdownMenu
      modal={false}
      open={actif && menuOuvert}
      onOpenChange={(ouvert) => actif && setMenuOuvert(ouvert)}
    >
      <DropdownMenuTrigger asChild>{bouton}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={emplacement === "flottant" ? "top" : "bottom"}
        aria-label="Ajouter"
        onCloseAutoFocus={(e) => {
          // un tiroir vient de s'ouvrir : c'est lui qui garde le focus, pas le bouton
          if (choisi.current) e.preventDefault();
          choisi.current = false;
        }}
      >
        {ajouts.map(({ id, label, description, icon: Icon }) => (
          <DropdownMenuItem
            key={id}
            onSelect={() => {
              choisi.current = true;
              ouvrir(id);
            }}
          >
            <Icon aria-hidden className="size-5 shrink-0 text-primary" />
            <span className="flex flex-col">
              <span className="font-medium">{label}</span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
