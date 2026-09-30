"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd, ToucheModificateur } from "@/components/ui/kbd";
import { reglerTouchesSimples, useTouchesSimples } from "@/hooks/use-hotkeys";
import { navFor } from "@/lib/auth/navigation";
import type { Role } from "@/types/models";

function Ligne({ touches, children }: { touches: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="flex items-center gap-1">{touches}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** Aide « ? » : toutes les touches utiles, avec les pages accessibles à la personne connectée. */
export function ShortcutsHelp({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}) {
  const pages = navFor(role);
  const touchesActives = useTouchesSimples();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Raccourcis clavier"
        description="Les touches d'une lettre ne marchent pas quand vous écrivez dans un champ."
        className="overflow-y-auto"
      >
        <div className="space-y-4 overflow-y-auto px-6 pb-6">
          <dl className="divide-y">
            <Ligne
              touches={
                <>
                  <ToucheModificateur />
                  <Kbd>K</Kbd>
                </>
              }
            >
              Rechercher et lancer une action
            </Ligne>
            <Ligne touches={<Kbd>N</Kbd>}>Ajouter (selon la page : produit, commande…)</Ligne>
            <Ligne touches={<Kbd>/</Kbd>}>Aller au champ de recherche de la liste</Ligne>
            <Ligne touches={<Kbd>?</Kbd>}>Afficher cette aide</Ligne>
            <Ligne touches={<Kbd>Échap</Kbd>}>Fermer la fenêtre ou le tiroir ouvert</Ligne>
          </dl>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              checked={touchesActives}
              onChange={(e) => reglerTouchesSimples(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Activer les touches d&apos;une lettre (N, /, ?, G…)
              <span className="block text-sm text-muted-foreground">
                Décochez si elles gênent (dictée vocale, clavier adapté). Ctrl ou ⌘ K reste toujours
                disponible.
              </span>
            </span>
          </label>
          <div>
            <h3 className="mb-1 font-semibold">Aller à une page : G puis…</h3>
            <dl className="divide-y">
              {pages.map((p) => (
                <Ligne
                  key={p.href}
                  touches={
                    <>
                      <Kbd>G</Kbd>
                      <span aria-hidden className="text-xs text-muted-foreground">
                        puis
                      </span>
                      <Kbd>{p.key.toUpperCase()}</Kbd>
                    </>
                  }
                >
                  {p.label}
                </Ligne>
              ))}
            </dl>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
