import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, ClipboardPlus, PackagePlus, Truck } from "lucide-react";
import type { Role } from "@/types/models";

export type AjoutId = "produit" | "commande" | "fournisseur" | "mouvement";

export type Ajout = {
  id: AjoutId;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: Role[];
  /** Mots que la palette accepte en plus de l'intitulé (recherche sans accents ni majuscules). */
  mots: string[];
};

/**
 * Registre unique des ajouts rapides : le bouton « + Ajouter », la palette Ctrl/⌘ K et la touche N
 * lisent cette liste. Ajouter une entrée ici (et son tiroir dans `quick-add-provider.tsx`) la rend
 * disponible partout. La sécurité réelle reste la RLS : ce filtre par rôle ne fait que guider.
 */
export const AJOUTS: Ajout[] = [
  {
    id: "produit",
    label: "Nouveau produit",
    description: "Ajouter un produit au catalogue",
    icon: PackagePlus,
    roles: ["gerant", "responsable"],
    mots: ["article", "catalogue", "creer"],
  },
  {
    id: "commande",
    label: "Nouvelle commande",
    description: "Préparer une commande fournisseur",
    icon: ClipboardPlus,
    roles: ["gerant", "responsable"],
    mots: ["achat", "brouillon", "creer"],
  },
  {
    id: "fournisseur",
    label: "Nouveau fournisseur",
    description: "Ajouter un fournisseur",
    icon: Truck,
    roles: ["gerant", "responsable"],
    mots: ["creer"],
  },
  {
    id: "mouvement",
    label: "Mouvement de stock",
    description: "Entrée, sortie ou perte d'un produit",
    icon: ArrowLeftRight,
    roles: ["gerant", "responsable", "salarie"],
    mots: ["entree", "sortie", "perte", "stock", "livraison"],
  },
];

export const ajoutsFor = (role: Role) => AJOUTS.filter((a) => a.roles.includes(role));

/**
 * Ajout que la touche N ouvre directement selon la page : sur Commandes, une commande, etc.
 * Ailleurs (`null`), N ouvre le menu « + Ajouter ».
 */
export function ajoutParDefaut(pathname: string, role: Role): AjoutId | null {
  const dispo = new Set(ajoutsFor(role).map((a) => a.id));
  const choix: AjoutId | null = pathname.startsWith("/commandes")
    ? "commande"
    : pathname.startsWith("/fournisseurs")
      ? "fournisseur"
      : pathname.startsWith("/stocks/mouvements")
        ? "mouvement"
        : pathname === "/stocks" || /^\/stocks\/(alertes|import)/.test(pathname)
          ? "produit"
          : null;
  return choix && dispo.has(choix) ? choix : null;
}
