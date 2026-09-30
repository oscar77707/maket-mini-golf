import type { Categorie, Fournisseur, LieuStockage, Pole } from "@/types/models";

/** Listes de choix des tiroirs d'ajout rapide, réduites aux colonnes utiles (envoyées à chaque page). */
export type ReferentielsAjout = {
  poles: Pick<Pole, "id" | "code" | "nom">[];
  categories: Pick<Categorie, "id" | "nom" | "pole_id">[];
  lieux: Pick<LieuStockage, "id" | "nom" | "pole_id">[];
  fournisseurs: Pick<Fournisseur, "id" | "nom">[];
};
