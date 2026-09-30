import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayParis } from "@/lib/dates";
import type { CommandeVue, ProduitStock, Unite } from "@/types/models";
import type { AppelListe } from "@/features/appels/queries";

export type Indicateurs = {
  rouges: number;
  oranges: number;
  dlc: number;
  valeur_stock_ht: number;
  a_valider: number;
  brouillons: number;
  attendues_aujourdhui: number;
  en_retard: number;
  inventaires_soumis: number;
  appels_aujourdhui: number;
};

export async function getIndicateurs(poleId: number | null): Promise<Indicateurs> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "indicateurs_tableau_de_bord",
    poleId ? { p_pole_id: poleId } : {},
  );
  if (error) throw error;
  return data as unknown as Indicateurs;
}

const COMMANDE_COLONNES =
  "id, reference, pole_id, fournisseur_nom, statut, nb_lignes, montant_ht, date_livraison_prevue, soumise_le";
export type CommandeResume = Pick<
  CommandeVue,
  | "id"
  | "reference"
  | "pole_id"
  | "fournisseur_nom"
  | "statut"
  | "nb_lignes"
  | "montant_ht"
  | "date_livraison_prevue"
  | "soumise_le"
>;

/** Commandes soumises, en attente du « Valider et envoyer » du gérant (les plus anciennes d'abord). */
export async function listCommandesAValider(poleId: number | null, limit = 8) {
  const supabase = await createClient();
  const query = supabase
    .from("v_commandes")
    .select(COMMANDE_COLONNES)
    .eq("statut", "a_valider")
    .order("soumise_le", { ascending: true, nullsFirst: false })
    .order("numero", { ascending: true })
    .limit(limit);
  const { data, error } = await (poleId ? query.eq("pole_id", poleId) : query);
  if (error) throw error;
  return (data ?? []) as unknown as CommandeResume[];
}

/** Livraisons prévues aujourd'hui (jour de Paris) sur des commandes envoyées et pas encore reçues. */
export async function listLivraisonsAttendues(poleId: number | null, limit = 8) {
  const supabase = await createClient();
  const query = supabase
    .from("v_commandes")
    .select(COMMANDE_COLONNES)
    .in("statut", ["envoyee", "confirmee", "en_retard"])
    .eq("date_livraison_prevue", todayParis())
    .order("numero", { ascending: true })
    .limit(limit);
  const { data, error } = await (poleId ? query.eq("pole_id", poleId) : query);
  if (error) throw error;
  return (data ?? []) as unknown as CommandeResume[];
}

export type ProduitSousSeuil = Pick<
  ProduitStock,
  "id" | "nom" | "pole_id" | "unite" | "stock_actuel" | "seuil_minimum"
>;

/** Produits sous le seuil, les plus dégarnis d'abord (rapport stock / seuil). */
export async function listProduitsSousSeuil(poleId: number | null, limit = 6) {
  const supabase = await createClient();
  const query = supabase
    .from("v_stock_produits")
    .select("id, nom, pole_id, unite, stock_actuel, seuil_minimum")
    .eq("actif", true)
    .eq("niveau_alerte", "rouge")
    .limit(200);
  const { data, error } = await (poleId ? query.eq("pole_id", poleId) : query);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ProduitSousSeuil[];
  const ratio = (p: ProduitSousSeuil) =>
    Number(p.stock_actuel) / Math.max(Number(p.seuil_minimum), 1e-9);
  return rows
    .sort((a, b) => ratio(a) - ratio(b) || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, limit);
}

export async function listDerniersAppels(poleId: number | null, limit = 5) {
  const supabase = await createClient();
  const query = supabase
    .from("appels_ia")
    .select("id, debut, duree_secondes, numero_masque, pole_id, issue, resume")
    .order("debut", { ascending: false })
    .limit(limit);
  const { data, error } = await (poleId ? query.eq("pole_id", poleId) : query);
  if (error) throw error;
  return (data ?? []) as AppelListe[];
}

export type PointValeur = { jour: string; valeur: number };

export async function getEvolutionValeurStock(poleId: number | null, jours = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("evolution_valeur_stock", {
    p_jours: jours,
    ...(poleId ? { p_pole_id: poleId } : {}),
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({ jour: r.jour, valeur: Number(r.valeur_ht) })) as PointValeur[];
}

export type ProduitConsomme = {
  produit_id: string;
  nom: string;
  unite: Unite;
  quantite: number;
  valeur_ht: number;
};

export async function getTopConsommes(poleId: number | null, jours = 30, limite = 10) {
  const supabase = await createClient();
  const fin = todayParis();
  const { data, error } = await supabase.rpc("top_produits_consommes", {
    p_debut: addDays(fin, -(jours - 1)),
    p_fin: fin,
    p_limite: limite,
    ...(poleId ? { p_pole_id: poleId } : {}),
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    produit_id: r.produit_id,
    nom: r.nom,
    unite: r.unite,
    quantite: Number(r.quantite),
    valeur_ht: Number(r.valeur_ht),
  })) as ProduitConsomme[];
}
