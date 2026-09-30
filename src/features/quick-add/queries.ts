import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/models";
import type { ReferentielsAjout } from "./types";

/**
 * Listes de choix des tiroirs (catégories, lieux, fournisseurs). Un salarié n'en a pas besoin :
 * son seul ajout rapide est un mouvement de stock, dont le produit se cherche.
 */
export async function getReferentielsAjout(
  role: Role,
  poles: ReferentielsAjout["poles"],
): Promise<ReferentielsAjout> {
  if (role === "salarie") return { poles, categories: [], lieux: [], fournisseurs: [] };
  const supabase = await createClient();
  const [categories, lieux, fournisseurs] = await Promise.all([
    supabase.from("categories_produit").select("id, nom, pole_id").order("ordre").order("nom"),
    supabase.from("lieux_stockage").select("id, nom, pole_id").order("ordre").order("nom"),
    supabase.from("fournisseurs").select("id, nom").eq("actif", true).order("nom"),
  ]);
  // Le layout entoure toutes les pages : une erreur passagère ici ne doit pas les faire tomber.
  // Les tiroirs s'ouvrent alors avec des listes vides (le serveur revérifie tout à l'envoi).
  const erreur = [categories, lieux, fournisseurs].find((r) => r.error)?.error;
  if (erreur) {
    console.error("Listes de l'ajout rapide indisponibles :", erreur.message);
    return { poles, categories: [], lieux: [], fournisseurs: [] };
  }
  return {
    poles,
    categories: categories.data ?? [],
    lieux: lieux.data ?? [],
    fournisseurs: fournisseurs.data ?? [],
  };
}
