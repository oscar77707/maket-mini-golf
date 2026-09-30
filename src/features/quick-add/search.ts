import "server-only";
import { sanitizeSearch } from "@/lib/table-params";
import { createClient } from "@/lib/supabase/server";
import type { Role, StatutCommande, Unite } from "@/types/models";

export const LIMITE_PAR_TYPE = 5;
export const MIN_CARACTERES = 2;

export type ResultatProduit = {
  id: string;
  nom: string;
  reference: string | null;
  unite: Unite;
  stock_actuel: number;
  suivi_dlc: boolean;
  niveau_alerte: string | null;
};
export type ResultatFournisseur = { id: string; nom: string; contact_nom: string | null };
export type ResultatCommande = {
  id: string;
  reference: string;
  fournisseur_nom: string;
  statut: StatutCommande;
};
export type ResultatsRecherche = {
  produits: ResultatProduit[];
  fournisseurs: ResultatFournisseur[];
  commandes: ResultatCommande[];
};

/**
 * Recherche de la palette : produits, fournisseurs et commandes que la personne a le droit de voir
 * (la RLS filtre par pôle). Un salarié ne cherche que des produits, comme dans le menu de l'application.
 */
export async function rechercher(role: Role, brut: string): Promise<ResultatsRecherche> {
  const q = sanitizeSearch(brut).slice(0, 60);
  const vide: ResultatsRecherche = { produits: [], fournisseurs: [], commandes: [] };
  if (q.length < MIN_CARACTERES) return vide;
  const supabase = await createClient();
  const motif = `%${q}%`;

  const produits = supabase
    .from("v_stock_produits")
    .select("id, nom, reference, unite, stock_actuel, suivi_dlc, niveau_alerte")
    .eq("actif", true)
    .or(`nom.ilike.${motif},reference.ilike.${motif}`)
    .order("nom")
    .limit(LIMITE_PAR_TYPE);

  if (role === "salarie") {
    const { data, error } = await produits;
    if (error) throw error;
    return { ...vide, produits: (data ?? []) as unknown as ResultatProduit[] };
  }

  const [p, f, c] = await Promise.all([
    produits,
    supabase
      .from("fournisseurs")
      .select("id, nom, contact_nom")
      .eq("actif", true)
      .or(`nom.ilike.${motif},contact_nom.ilike.${motif}`)
      .order("nom")
      .limit(LIMITE_PAR_TYPE),
    supabase
      .from("v_commandes")
      .select("id, reference, fournisseur_nom, statut")
      .or(`reference.ilike.${motif},fournisseur_nom.ilike.${motif}`)
      .order("created_at", { ascending: false })
      .limit(LIMITE_PAR_TYPE),
  ]);
  for (const r of [p, f, c]) if (r.error) throw r.error;
  return {
    produits: (p.data ?? []) as unknown as ResultatProduit[],
    fournisseurs: (f.data ?? []) as ResultatFournisseur[],
    commandes: (c.data ?? []) as unknown as ResultatCommande[],
  };
}
