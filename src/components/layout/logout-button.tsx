"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { nettoyerBrouillons } from "@/hooks/use-form-draft";

/** Déconnexion : les brouillons de formulaire enregistrés sur cet appareil sont effacés avec la session. */
export function LogoutButton() {
  return (
    <form action={logout} onSubmit={() => nettoyerBrouillons(true)}>
      <Button type="submit" variant="ghost" size="icon" aria-label="Se déconnecter">
        <LogOut aria-hidden />
      </Button>
    </form>
  );
}
