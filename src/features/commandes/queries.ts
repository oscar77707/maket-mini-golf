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
import type {
  CommandeLigne,
  CommandeVue,
  Fournisseur,
  Livraison,
  LivraisonLigne,
  StatutCommande,
  Unite,
} from "@/types/models";

type Client = Awaited<ReturnType<typeof createClient>>;

const STATUTS = [
  "brouillon",
  "a_valider",
  "envoyee",
  "confirmee",
  "en_retard",
  "livree",
  "cloturee",
  "annulee",
] as const satisfies readonly StatutCommande[];

export type CommandeFilters = {
  poleId: number | null;
  statut?: StatutCommande;
  fournisseurId?: string;
  q: string;
  du?: string;
  au?: string;
};

export function parseCommandeFilters(params: SearchParams, poleId: number | null): CommandeFilters {
  return {
    poleId,
    statut: oneOf(first(params.statut), STATUTS),
    fournisseurId: uuidOrUndefined(first(params.fournisseur)),
    q: sanitizeSearch(first(params.q)),
    du: dateOrUndefined(first(params.du)),
    au: dateOrUndefined(first(params.au)),
  };
}

/** Ce dont les filtres ont besoin d'un constructeur de requête PostgREST (chaque méthode renvoie le même type). */
interface Filtrable<Self> {
  eq(column: string, value: string | number): Self;
  or(filters: string): Self;
  gte(column: string, value: string): Self;
  lt(column: string, value: string): Self;
}

/** Applique les filtres communs à la liste et aux compteurs d'onglets (sauf le statut). */
function baseFilters<Q extends Filtrable<Q>>(query: Q, f: CommandeFilters): Q {
  let q = query;
  if (f.poleId) q = q.eq("pole_id", f.poleId);
  if (f.fournisseurId) q = q.eq("fournisseur_id", f.fournisseurId);
  if (f.q) q = q.or(`reference.ilike.%${f.q}%,fournisseur_nom.ilike.%${f.q}%`);
  if (f.du) q = q.gte("created_at", `${f.du}T00:00:00+00:00`);
  if (f.au)
    q = q.lt("created_at", new Date(Date.parse(`${f.au}T00:00:00Z`) + 86_400_000).toISOString());
  return q;
}

/** « En retard » regroupe le statut posé chaque matin et les commandes dont la date prévue est dépassée. */
function statutFilter<Q extends Filtrable<Q>>(query: Q, statut?: StatutCommande): Q {
  if (!statut) return query;
  if (statut === "en_retard") return query.or("statut.eq.en_retard,est_en_retard.eq.true");
  return query.eq("statut", statut);
}

export async function listCommandes(f: CommandeFilters, params: SearchParams) {
  const { from, to, page, pageSize } = parsePaging(params);
  const supabase = await createClient();
  const query = statutFilter(
    baseFilters(supabase.from("v_commandes").select("*", { count: "exact" }), f),
    f.statut,
  );
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("numero", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as CommandeVue[], total: count ?? 0, page, pageSize };
}

/** Nombre de commandes par onglet (mêmes filtres que la liste, sans le statut). */
export async function countCommandesParStatut(f: CommandeFilters) {
  const supabase = await createClient();
  const tabs: (StatutCommande | undefined)[] = [undefined, ...STATUTS];
  const counts = await Promise.all(
    tabs.map(async (statut) => {
      const { count, error } = await statutFilter(
        baseFilters(supabase.from("v_commandes").select("id", { count: "exact", head: true }), f),
        statut,
      );
      if (error) throw error;
      return [statut ?? "toutes", count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<"toutes" | StatutCommande, number>;
}

export type LigneDetail = CommandeLigne & {
  produit_nom: string;
  unite: Unite;
  suivi_dlc: boolean;
  stock_actuel: number;
  seuil_minimum: number;
  reference_fournisseur: string | null;
  conditionnement: number;
};

export type LivraisonDetail = Livraison & {
  lignes: (LivraisonLigne & { produit_nom: string; unite: Unite; suivi_dlc: boolean })[];
  receptionnaire: string | null;
};

async function nomsProfils(supabase: Client, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = await inChunks(unique, (c) =>
    supabase.from("profiles").select("id, prenom, nom").in("id", c),
  );
  return new Map(rows.map((p) => [p.id, `${p.prenom} ${p.nom}`.trim()]));
}

export async function getCommande(id: string) {
  const supabase = await createClient();
  const { data: cmd, error } = await supabase
    .from("v_commandes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!cmd) return null;
  const commande = cmd as unknown as CommandeVue;

  const [fournisseur, lignes, livraisons] = await Promise.all([
    supabase.from("fournisseurs").select("*").eq("id", commande.fournisseur_id).single(),
    supabase.from("commande_lignes").select("*").eq("commande_id", id).order("created_at"),
    supabase
      .from("livraisons")
      .select("*")
      .eq("commande_id", id)
      .order("recue_le", { ascending: false }),
  ]);
  for (const r of [fournisseur, lignes, livraisons]) if (r.error) throw r.error;

  const lignesData = (lignes.data ?? []) as CommandeLigne[];
  const produitIds = lignesData.map((l) => l.produit_id);
  const livraisonIds = (livraisons.data ?? []).map((l) => l.id);
  const [stock, liens, lvLignes] = await Promise.all([
    inChunks(produitIds, (c) =>
      supabase
        .from("v_stock_produits")
        .select("id, nom, unite, suivi_dlc, stock_actuel, seuil_minimum")
        .in("id", c),
    ),
    inChunks(produitIds, (c) =>
      supabase
        .from("fournisseur_produits")
        .select("produit_id, reference_fournisseur, conditionnement")
        .eq("fournisseur_id", commande.fournisseur_id)
        .in("produit_id", c),
    ),
    inChunks(livraisonIds, (c) =>
      supabase.from("livraison_lignes").select("*").in("livraison_id", c),
    ),
  ]);
  const produits = new Map(stock.map((p) => [p.id as string, p]));
  const lienMap = new Map(liens.map((l) => [l.produit_id, l]));
  const noms = await nomsProfils(supabase, [
    commande.cree_par,
    commande.valide_par,
    ...(livraisons.data ?? []).map((l) => l.recue_par),
  ]);

  const lignesDetail: LigneDetail[] = lignesData
    .map((l) => {
      const p = produits.get(l.produit_id);
      const lien = lienMap.get(l.produit_id);
      return {
        ...l,
        produit_nom: (p?.nom as string) ?? "Produit",
        unite: (p?.unite as Unite) ?? "piece",
        suivi_dlc: Boolean(p?.suivi_dlc),
        stock_actuel: Number(p?.stock_actuel ?? 0),
        seuil_minimum: Number(p?.seuil_minimum ?? 0),
        reference_fournisseur: lien?.reference_fournisseur ?? null,
        conditionnement: Number(lien?.conditionnement ?? 1),
      };
    })
    .sort((a, b) => a.produit_nom.localeCompare(b.produit_nom, "fr"));

  const livraisonsDetail: LivraisonDetail[] = (livraisons.data ?? []).map((lv) => ({
    ...(lv as Livraison),
    receptionnaire: lv.recue_par ? (noms.get(lv.recue_par) ?? null) : null,
    lignes: (lvLignes as LivraisonLigne[])
      .filter((l) => l.livraison_id === lv.id)
      .map((l) => {
        const p = produits.get(l.produit_id);
        return {
          ...l,
          produit_nom: (p?.nom as string) ?? "Produit",
          unite: (p?.unite as Unite) ?? "piece",
          suivi_dlc: Boolean(p?.suivi_dlc),
        };
      })
      .sort((a, b) => a.produit_nom.localeCompare(b.produit_nom, "fr")),
  }));

  return {
    commande,
    fournisseur: fournisseur.data as Fournisseur,
    lignes: lignesDetail,
    livraisons: livraisonsDetail,
    createur: commande.cree_par ? (noms.get(commande.cree_par) ?? null) : null,
    valideur: commande.valide_par ? (noms.get(commande.valide_par) ?? null) : null,
  };
}
export type CommandeDetail = NonNullable<Awaited<ReturnType<typeof getCommande>>>;

export type ProduitCommandable = {
  id: string;
  nom: string;
  unite: Unite;
  prix: number;
  conditionnement: number;
  stock_actuel: number;
  seuil_minimum: number;
  niveau_alerte: string;
  suggestion: number;
  associe: boolean;
};

/** Produits du pôle pouvant être ajoutés à la commande, ceux du fournisseur en premier. */
export async function listProduitsCommandables(
  poleId: number,
  fournisseurId: string,
): Promise<ProduitCommandable[]> {
  const supabase = await createClient();
  const [produits, liens] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("v_stock_produits")
        .select(
          "id, nom, unite, prix_achat_ht, stock_actuel, seuil_minimum, niveau_alerte, quantite_a_commander, quantite_reappro",
        )
        .eq("pole_id", poleId)
        .eq("actif", true)
        .order("nom")
        .range(a, b),
    ),
    supabase.from("fournisseur_produits").select("*").eq("fournisseur_id", fournisseurId),
  ]);
  if (liens.error) throw liens.error;
  const lienMap = new Map((liens.data ?? []).map((l) => [l.produit_id, l]));
  return produits
    .map((p) => {
      const lien = lienMap.get(p.id as string);
      const conditionnement = Number(lien?.conditionnement ?? 1);
      const besoin = Number(p.quantite_a_commander ?? 0) || Number(p.quantite_reappro ?? 0) || 1;
      return {
        id: p.id as string,
        nom: p.nom as string,
        unite: p.unite as Unite,
        prix: Number(lien?.prix_ht ?? p.prix_achat_ht ?? 0),
        conditionnement,
        stock_actuel: Number(p.stock_actuel ?? 0),
        seuil_minimum: Number(p.seuil_minimum ?? 0),
        niveau_alerte: (p.niveau_alerte as string) ?? "ok",
        suggestion: Math.ceil(besoin / conditionnement) * conditionnement,
        associe: Boolean(lien),
      };
    })
    .sort((a, b) => Number(b.associe) - Number(a.associe) || a.nom.localeCompare(b.nom, "fr"));
}
