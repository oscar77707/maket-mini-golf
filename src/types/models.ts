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

export type StatutLivraison = Enums<"statut_livraison">;
export type ModeCommande = Enums<"mode_commande">;

export type Commande = Tables<"commandes">;
export type CommandeLigne = Tables<"commande_lignes">;
export type Livraison = Tables<"livraisons">;
export type LivraisonLigne = Tables<"livraison_lignes">;
export type FournisseurProduit = Tables<"fournisseur_produits">;
export type WebhookN8n = Tables<"webhooks_n8n">;

/** Ligne de la vue v_commandes (référence « CMD-000123 », nom du fournisseur, total, retard). */
export type CommandeVue = Omit<Commande, "numero"> & {
  numero: number;
  reference: string;
  fournisseur_nom: string;
  nb_lignes: number;
  montant_ht: number;
  est_en_retard: boolean;
};

export type StatsFournisseur = {
  nb_commandes: number;
  delai_reel_moyen_jours: number | null;
  taux_conformite_pct: number | null;
  montant_total_ht: number | null;
};

export type IssueAppel = Enums<"issue_appel">;
export type AppelIA = Tables<"appels_ia">;

/** Retour de la fonction SQL `stats_appels`. */
export type StatsAppels = {
  total: number;
  duree_moyenne_s: number | null;
  taux_transfert_pct: number | null;
  par_jour: { jour: string; nb: number }[];
  par_heure: { heure: number; nb: number }[];
  par_pole: { pole: string; nb: number }[];
  par_issue: { issue: IssueAppel; nb: number }[];
};
