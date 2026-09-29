import type { Enums, Tables, Views } from "./database";

export type Role = Enums<"role_utilisateur">;
export type PoleCode = Enums<"code_pole">;
export type Unite = Enums<"unite_mesure">;
export type TypeMouvement = Enums<"type_mouvement">;
export type StatutCommande = Enums<"statut_commande">;
export type StatutInventaire = Enums<"statut_inventaire">;

export type Profile = Tables<"profiles">;
export type Pole = Tables<"poles">;
export type Parametres = Tables<"parametres">;
export type Produit = Tables<"produits">;
export type Categorie = Tables<"categories_produit">;
export type LieuStockage = Tables<"lieux_stockage">;
export type Fournisseur = Tables<"fournisseurs">;
export type Mouvement = Tables<"mouvements_stock">;
export type LotDlc = Tables<"lots_dlc">;
export type Inventaire = Tables<"inventaires">;
export type InventaireLigne = Tables<"inventaire_lignes">;

export type NiveauAlerte = "rouge" | "orange" | "ok";

/** Ligne de la vue v_stock_produits, sans les `null` que la génération ajoute à toutes les colonnes de vue. */
export type ProduitStock = Omit<
  { [K in keyof Views<"v_stock_produits">]: NonNullable<Views<"v_stock_produits">[K]> },
  | "niveau_alerte"
  | "reference"
  | "categorie_id"
  | "lieu_stockage_id"
  | "fournisseur_principal_id"
  | "notes"
  | "cree_par"
  | "dernier_mouvement"
> & {
  niveau_alerte: NiveauAlerte;
  reference: string | null;
  categorie_id: string | null;
  lieu_stockage_id: string | null;
  fournisseur_principal_id: string | null;
  notes: string | null;
  cree_par: string | null;
  dernier_mouvement: string | null;
};
