"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ShortcutsHelp } from "@/components/command-palette/shortcuts-help";
import { Kbd } from "@/components/ui/kbd";
import { NouvelleCommandeSheet } from "@/features/commandes/components/nouvelle-commande-button";
import { FournisseurSheet } from "@/features/fournisseurs/components/fournisseur-sheet";
import { ProduitSheet } from "@/features/stocks/components/produit-sheet";
import { fenetreOuverte, useHotkeys } from "@/hooks/use-hotkeys";
import { nettoyerBrouillons } from "@/hooks/use-form-draft";
import { navFor } from "@/lib/auth/navigation";
import type { Role } from "@/types/models";
import { MouvementRapideSheet } from "./components/mouvement-rapide-sheet";
import { QuickAddCtx } from "./context";
import { ajoutParDefaut, ajoutsFor, type AjoutId } from "./registry";
import type { ReferentielsAjout } from "./types";

type Tiroir = {
  id: AjoutId;
  /** Change à chaque ouverture : un tiroir rouvert repart d'un état neuf. */
  ouverture: number;
  /** Page où le tiroir a été ouvert : s'il ne s'y trouve plus (retour arrière, lien), il se referme. */
  chemin: string;
  poleId: number | null;
  fournisseurId?: string;
};

const FICHE_FOURNISSEUR = /^\/fournisseurs\/([0-9a-f-]{36})(\/|$)/i;

/**
 * Cœur de l'ajout rapide et des raccourcis : le bouton « + Ajouter », la palette, la touche N et
 * l'aide « ? » ouvrent tous les mêmes tiroirs depuis n'importe quelle page.
 */
export function QuickAddProvider({
  role,
  utilisateurId,
  poleUtilisateurId,
  referentiels,
  children,
}: {
  role: Role;
  utilisateurId: string;
  /** Pôle de la personne (null pour le gérant). */
  poleUtilisateurId: number | null;
  referentiels: ReferentielsAjout;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);
  const [tiroir, setTiroir] = useState<Tiroir | null>(null);
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [attenteAller, setAttenteAller] = useState(false);
  const ajouts = useMemo(() => ajoutsFor(role), [role]);
  const pages = useMemo(() => navFor(role), [role]);

  // les brouillons de plus de 24 h partent d'eux-mêmes
  useEffect(() => nettoyerBrouillons(), []);

  const ouvrir = useCallback(
    (id: AjoutId) => {
      // pôle choisi dans le filtre du gérant (?pole=…), sinon pôle de la personne
      // (le filtre est un outil du gérant : un lien reçu avec ?pole= ne change rien pour les autres)
      const code =
        role === "gerant" ? new URLSearchParams(window.location.search).get("pole") : null;
      const poleFiltre = referentiels.poles.find((p) => p.code === code)?.id ?? null;
      const fiche = FICHE_FOURNISSEUR.exec(window.location.pathname);
      setMenuOuvert(false);
      setPaletteOuverte(false);
      setAideOuverte(false);
      setTiroir((t) => ({
        id,
        ouverture: (t?.ouverture ?? 0) + 1,
        chemin: window.location.pathname,
        poleId: poleFiltre ?? poleUtilisateurId,
        fournisseurId: id === "commande" ? fiche?.[1] : undefined,
      }));
      setTiroirOuvert(true);
    },
    [role, referentiels.poles, poleUtilisateurId],
  );
  const ouvrirPalette = useCallback(() => {
    setMenuOuvert(false);
    setPaletteOuverte(true);
  }, []);
  const ouvrirAide = useCallback(() => {
    setPaletteOuverte(false);
    setAideOuverte(true);
  }, []);

  useHotkeys({
    palette: () => {
      if (paletteOuverte) setPaletteOuverte(false);
      else if (!fenetreOuverte()) ouvrirPalette();
    },
    touches: {
      n: () => {
        const direct =
          ajoutParDefaut(pathname, role) ?? (ajouts.length === 1 ? ajouts[0].id : null);
        if (direct) ouvrir(direct);
        else if (ajouts.length > 0) setMenuOuvert(true);
      },
      "/": () => {
        const champ = document.querySelector<HTMLInputElement>('main input[type="search"]');
        if (champ) {
          champ.focus();
          champ.select();
        } else ouvrirPalette();
      },
      "?": ouvrirAide,
    },
    aller: Object.fromEntries(pages.map((p) => [p.key, () => router.push(p.href)])),
    debut: setAttenteAller,
  });

  // page quittée avec un tiroir ouvert : il est refermé pour de bon (il ne rouvre pas au retour)
  if (tiroirOuvert && tiroir && tiroir.chemin !== pathname) setTiroirOuvert(false);

  const valeur = useMemo(
    () => ({ utilisateurId, ouvrir, menuOuvert, setMenuOuvert, ouvrirPalette, ouvrirAide }),
    [utilisateurId, ouvrir, menuOuvert, ouvrirPalette, ouvrirAide],
  );
  const estGerant = role === "gerant";
  const ouvert = (id: AjoutId) => tiroirOuvert && tiroir?.id === id && tiroir.chemin === pathname;
  const fermer = (o: boolean) => {
    if (!o) setTiroirOuvert(false);
  };

  return (
    <QuickAddCtx.Provider value={valeur}>
      {children}

      {tiroir?.id === "produit" && (
        <ProduitSheet
          key={tiroir.ouverture}
          referentiels={referentiels}
          isGerant={estGerant}
          defaultPoleId={tiroir.poleId}
          open={ouvert("produit")}
          onOpenChange={fermer}
        />
      )}
      {tiroir?.id === "commande" && (
        <NouvelleCommandeSheet
          key={tiroir.ouverture}
          fournisseurs={referentiels.fournisseurs}
          poles={referentiels.poles}
          isGerant={estGerant}
          defaultPoleId={tiroir.poleId}
          fournisseurId={tiroir.fournisseurId}
          open={ouvert("commande")}
          onOpenChange={fermer}
        />
      )}
      {tiroir?.id === "fournisseur" && (
        <FournisseurSheet
          key={tiroir.ouverture}
          open={ouvert("fournisseur")}
          onOpenChange={fermer}
        />
      )}
      {tiroir?.id === "mouvement" && (
        <MouvementRapideSheet
          key={tiroir.ouverture}
          canCorrect={role !== "salarie"}
          open={ouvert("mouvement")}
          onOpenChange={fermer}
        />
      )}

      <CommandPalette open={paletteOuverte} onOpenChange={setPaletteOuverte} role={role} />
      <ShortcutsHelp open={aideOuverte} onOpenChange={setAideOuverte} role={role} />

      {attenteAller && (
        <div
          role="status"
          aria-live="polite"
          data-testid="indice-aller"
          className="fixed bottom-6 left-1/2 z-50 hidden max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg border bg-card px-4 py-2 text-sm shadow-lg lg:flex"
        >
          <span className="font-medium">Aller à…</span>
          {pages.map((p) => (
            <span key={p.href} className="flex items-center gap-1">
              <Kbd>{p.key.toUpperCase()}</Kbd> {p.label}
            </span>
          ))}
        </div>
      )}
    </QuickAddCtx.Provider>
  );
}
