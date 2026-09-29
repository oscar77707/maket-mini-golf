import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, inChunks } from "@/lib/supabase/paginate";
import {
  dateOrUndefined,
  first,
  oneOf,
  parsePaging,
  sanitizeSearch,
  uuidOrUndefined,
  type SearchParams,
} from "@/lib/table-params";
import type { CurrentUser } from "@/lib/auth/session";
import type {
  Categorie,
  Fournisseur,
  Inventaire,
  Mouvement,
  LieuStockage,
  LotDlc,
  Pole,
  ProduitStock,
  TypeMouvement,
} from "@/types/models";

/** Pôle sélectionné : un non-gérant est toujours limité à son pôle (la RLS l'impose de toute façon). */
export function selectedPoleId(
  user: CurrentUser,
  poles: Pole[],
  params: SearchParams,
): number | null {
  if (user.profile.role !== "gerant") return user.profile.pole_id;
  const code = first(params.pole);
  return poles.find((p) => p.code === code)?.id ?? null;
}

export async function getReferentiels() {
  const supabase = await createClient();
  const [poles, categories, lieux, fournisseurs] = await Promise.all([
    supabase.from("poles").select("*").eq("actif", true).order("ordre"),
    supabase.from("categories_produit").select("*").order("ordre").order("nom"),
    supabase.from("lieux_stockage").select("*").order("ordre").order("nom"),
    supabase.from("fournisseurs").select("*").eq("actif", true).order("nom"),
  ]);
  for (const r of [poles, categories, lieux, fournisseurs]) if (r.error) throw r.error;
  return {
    poles: poles.data as Pole[],
    categories: categories.data as Categorie[],
    lieux: lieux.data as LieuStockage[],
    fournisseurs: fournisseurs.data as Fournisseur[],
  };
}
export type Referentiels = Awaited<ReturnType<typeof getReferentiels>>;

// ---------------------------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------------------------
export const SORT_COLUMNS = {
  nom: "nom",
  stock: "stock_actuel",
  valeur: "valeur_stock_ht",
  prix: "prix_achat_ht",
} as const;
export type SortKey = keyof typeof SORT_COLUMNS;

export type ProduitFilters = {
  poleId: number | null;
  q: string;
  categorieId?: string;
  lieuId?: string;
  fournisseurId?: string;
  alerte?: "rouge" | "orange" | "alerte" | "ok";
  archives: boolean;
  tri: SortKey;
  sens: "asc" | "desc";
};

export function parseProduitFilters(params: SearchParams, poleId: number | null): ProduitFilters {
  return {
    poleId,
    q: sanitizeSearch(first(params.q)),
    categorieId: uuidOrUndefined(first(params.categorie)),
    lieuId: uuidOrUndefined(first(params.lieu)),
    fournisseurId: uuidOrUndefined(first(params.fournisseur)),
    alerte: oneOf(first(params.alerte), ["rouge", "orange", "alerte", "ok"] as const),
    archives: first(params.archives) === "1",
    tri: oneOf(first(params.tri), Object.keys(SORT_COLUMNS) as SortKey[]) ?? "nom",
    sens: first(params.sens) === "desc" ? "desc" : "asc",
  };
}

type Client = Awaited<ReturnType<typeof createClient>>;

function produitsQuery(supabase: Client, f: ProduitFilters, withCount: boolean) {
  let query = supabase
    .from("v_stock_produits")
    .select("*", withCount ? { count: "exact" } : undefined)
    .eq("actif", !f.archives);
  if (f.poleId) query = query.eq("pole_id", f.poleId);
  if (f.q) query = query.or(`nom.ilike.%${f.q}%,reference.ilike.%${f.q}%`);
  if (f.categorieId) query = query.eq("categorie_id", f.categorieId);
  if (f.lieuId) query = query.eq("lieu_stockage_id", f.lieuId);
  if (f.fournisseurId) query = query.eq("fournisseur_principal_id", f.fournisseurId);
  if (f.alerte === "alerte") query = query.in("niveau_alerte", ["rouge", "orange"]);
  else if (f.alerte) query = query.eq("niveau_alerte", f.alerte);
  return query.order(SORT_COLUMNS[f.tri], { ascending: f.sens === "asc" }).order("nom");
}

export async function listProduits(f: ProduitFilters, params: SearchParams) {
  const { from, to, page, pageSize } = parsePaging(params);
  const supabase = await createClient();
  const { data, count, error } = await produitsQuery(supabase, f, true).range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as ProduitStock[], total: count ?? 0, page, pageSize };
}

/** Tous les produits filtrés (pour l'export CSV), par paquets de 1000. */
export async function listAllProduits(f: ProduitFilters, ids?: string[]) {
  const supabase = await createClient();
  const out: ProduitStock[] = [];
  for (let from = 0; ; from += 1000) {
    let query = produitsQuery(supabase, f, false);
    if (ids?.length) query = query.in("id", ids);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as ProduitStock[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function getProduit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_stock_produits")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProduitStock | null) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Mouvements
// ---------------------------------------------------------------------------------------------
export type MouvementFilters = {
  poleId: number | null;
  type?: TypeMouvement;
  du?: string;
  au?: string;
  q: string;
  produitId?: string;
};

export function parseMouvementFilters(
  params: SearchParams,
  poleId: number | null,
  produitId?: string,
): MouvementFilters {
  return {
    poleId,
    type: oneOf(first(params.type), ["entree", "sortie", "perte", "correction"] as const),
    du: dateOrUndefined(first(params.du)),
    au: dateOrUndefined(first(params.au)),
    q: sanitizeSearch(first(params.q)),
    produitId,
  };
}

export type MouvementRow = {
  id: number;
  produit_id: string;
  produit_nom: string;
  unite: ProduitStock["unite"] | null;
  type: TypeMouvement;
  quantite: number;
  motif: string | null;
  date_mouvement: string;
  auteur: string | null;
  cree_par: string | null;
  annule: boolean;
  est_annulation: boolean;
  origine: string;
};

/** Recherche par nom de produit : on résout d'abord les identifiants correspondants. */
async function searchProduitIds(supabase: Client, f: MouvementFilters) {
  if (f.produitId || !f.q) return undefined;
  const { data } = await supabase.from("produits").select("id").ilike("nom", `%${f.q}%`).limit(200);
  return data?.length ? data.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"];
}

function mouvementsQuery(
  supabase: Client,
  f: MouvementFilters,
  withCount: boolean,
  searchIds?: string[],
) {
  let query = supabase
    .from("mouvements_stock")
    .select("*", withCount ? { count: "exact" } : undefined);
  if (f.poleId) query = query.eq("pole_id", f.poleId);
  if (f.type) query = query.eq("type", f.type);
  if (f.du) query = query.gte("date_mouvement", `${f.du}T00:00:00+00:00`);
  if (f.au)
    query = query.lt(
      "date_mouvement",
      new Date(Date.parse(`${f.au}T00:00:00Z`) + 86_400_000).toISOString(),
    );
  if (f.produitId) query = query.eq("produit_id", f.produitId);
  else if (searchIds) query = query.in("produit_id", searchIds);
  return query.order("date_mouvement", { ascending: false }).order("id", { ascending: false });
}

export async function listMouvements(f: MouvementFilters, params: SearchParams, all = false) {
  const supabase = await createClient();
  const { from, to, page, pageSize } = parsePaging(params);
  const searchIds = await searchProduitIds(supabase, f);
  let rows: Mouvement[];
  let count: number | null = null;
  if (all) {
    rows = await fetchAll(
      (a, b) => mouvementsQuery(supabase, f, false, searchIds).range(a, b),
      5000,
    );
    count = rows.length;
  } else {
    const res = await mouvementsQuery(supabase, f, true, searchIds).range(from, to);
    if (res.error) throw res.error;
    rows = res.data ?? [];
    count = res.count;
  }

  const produitIds = [...new Set(rows.map((r) => r.produit_id))];
  const auteurIds = [...new Set(rows.map((r) => r.cree_par).filter((x): x is string => !!x))];
  const mvtIds = rows.map((r) => r.id);
  const [produits, auteurs, annulations] = await Promise.all([
    inChunks(produitIds, (c) => supabase.from("produits").select("id, nom, unite").in("id", c)),
    inChunks(auteurIds, (c) => supabase.from("profiles").select("id, prenom, nom").in("id", c)),
    inChunks(mvtIds as unknown as string[], (c) =>
      supabase
        .from("mouvements_stock")
        .select("annule_mouvement_id")
        .in("annule_mouvement_id", c as unknown as number[]),
    ),
  ]);
  const pMap = new Map(produits.map((p) => [p.id, p]));
  const aMap = new Map(auteurs.map((a) => [a.id, `${a.prenom} ${a.nom}`.trim()]));
  const annules = new Set(annulations.map((a) => a.annule_mouvement_id));

  const result: MouvementRow[] = rows.map((r) => ({
    id: r.id,
    produit_id: r.produit_id,
    produit_nom: pMap.get(r.produit_id)?.nom ?? "Produit",
    unite: pMap.get(r.produit_id)?.unite ?? null,
    type: r.type,
    quantite: r.quantite,
    motif: r.motif,
    date_mouvement: r.date_mouvement,
    cree_par: r.cree_par,
    auteur: r.cree_par ? (aMap.get(r.cree_par) ?? "Collègue") : "Automatique",
    annule: annules.has(r.id),
    est_annulation: r.annule_mouvement_id !== null,
    origine: r.origine,
  }));
  return { rows: result, total: count ?? 0, page, pageSize };
}

// ---------------------------------------------------------------------------------------------
// Alertes, lots, prix
// ---------------------------------------------------------------------------------------------
export async function listAlertes(poleId: number | null) {
  const supabase = await createClient();
  const stock = supabase
    .from("v_stock_produits")
    .select("*")
    .eq("actif", true)
    .in("niveau_alerte", ["rouge", "orange"])
    .order("nom");
  const dlc = supabase.from("v_alertes_dlc").select("*").order("dlc");
  const [s, d] = await Promise.all([
    poleId ? stock.eq("pole_id", poleId) : stock,
    poleId ? dlc.eq("pole_id", poleId) : dlc,
  ]);
  if (s.error) throw s.error;
  if (d.error) throw d.error;
  const produits = (s.data ?? []) as unknown as ProduitStock[];
  return {
    rouges: produits.filter((p) => p.niveau_alerte === "rouge"),
    oranges: produits.filter((p) => p.niveau_alerte === "orange"),
    lots: (d.data ?? []).map((l) => ({
      id: l.id as string,
      produit_id: l.produit_id as string,
      produit_nom: l.produit_nom as string,
      pole_id: l.pole_id as number,
      dlc: l.dlc as string,
      numero_lot: l.numero_lot as string | null,
      quantite_initiale: l.quantite_initiale as number,
      jours_restants: l.jours_restants as number,
    })),
  };
}
export type AlerteLot = Awaited<ReturnType<typeof listAlertes>>["lots"][number];

export async function listLotsOuverts(produitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots_dlc")
    .select("*")
    .eq("produit_id", produitId)
    .is("solde_le", null)
    .order("dlc");
  if (error) throw error;
  return (data ?? []) as LotDlc[];
}

export async function listHistoriquePrix(produitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_historique_prix")
    .select("*")
    .eq("produit_id", produitId)
    .order("date_prix", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: r.date_prix as string,
    prix: r.prix_unitaire_ht as number,
    fournisseur_id: r.fournisseur_id as string,
  }));
}

// ---------------------------------------------------------------------------------------------
// Inventaires
// ---------------------------------------------------------------------------------------------
export type InventaireResume = Inventaire & { total: number; comptes: number };

export async function listInventaires(poleId: number | null) {
  const supabase = await createClient();
  let query = supabase
    .from("inventaires")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (poleId) query = query.eq("pole_id", poleId);
  const { data, error } = await query;
  if (error) throw error;
  const inventaires = (data ?? []) as Inventaire[];
  if (inventaires.length === 0) return [] as InventaireResume[];
  const ids = inventaires.map((i) => i.id);
  const lignes = await fetchAll((a, b) =>
    supabase
      .from("inventaire_lignes")
      .select("inventaire_id, quantite_comptee")
      .in("inventaire_id", ids)
      .range(a, b),
  );
  const stats = new Map<string, { total: number; comptes: number }>();
  for (const l of lignes) {
    const s = stats.get(l.inventaire_id) ?? { total: 0, comptes: 0 };
    s.total += 1;
    if (l.quantite_comptee !== null) s.comptes += 1;
    stats.set(l.inventaire_id, s);
  }
  return inventaires.map((i) => ({
    ...i,
    total: stats.get(i.id)?.total ?? 0,
    comptes: stats.get(i.id)?.comptes ?? 0,
  }));
}

export type LigneInventaire = {
  id: string;
  produit_id: string;
  nom: string;
  unite: ProduitStock["unite"];
  categorie_id: string | null;
  lieu_stockage_id: string | null;
  prix_achat_ht: number;
  stock_theorique: number | null;
  quantite_comptee: number | null;
  ecart: number | null;
};

export async function getInventaire(id: string) {
  const supabase = await createClient();
  const { data: inventaire, error } = await supabase
    .from("inventaires")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!inventaire) return null;
  const lignes = await fetchAll((a, b) =>
    supabase.from("inventaire_lignes").select("*").eq("inventaire_id", id).range(a, b),
  );
  const produits = await inChunks([...new Set(lignes.map((l) => l.produit_id))], (c) =>
    supabase
      .from("produits")
      .select("id, nom, unite, categorie_id, lieu_stockage_id, prix_achat_ht")
      .in("id", c),
  );
  const pMap = new Map(produits.map((p) => [p.id, p]));
  const rows: LigneInventaire[] = lignes
    .map((l) => {
      const p = pMap.get(l.produit_id);
      return {
        id: l.id,
        produit_id: l.produit_id,
        nom: p?.nom ?? "Produit",
        unite: p?.unite ?? "piece",
        categorie_id: p?.categorie_id ?? null,
        lieu_stockage_id: p?.lieu_stockage_id ?? null,
        prix_achat_ht: p?.prix_achat_ht ?? 0,
        stock_theorique: l.stock_theorique,
        quantite_comptee: l.quantite_comptee,
        ecart: l.ecart,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { inventaire: inventaire as Inventaire, lignes: rows };
}
