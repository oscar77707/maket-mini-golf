import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, inChunks } from "@/lib/supabase/paginate";
import { first, oneOf, parsePaging, sanitizeSearch, type SearchParams } from "@/lib/table-params";
import type {
  CommandeVue,
  Fournisseur,
  FournisseurProduit,
  ModeCommande,
  StatsFournisseur,
} from "@/types/models";

const MODES = ["email", "telephone", "portail"] as const;

export type FournisseurFilters = { q: string; mode?: ModeCommande; archives: boolean };

export function parseFournisseurFilters(params: SearchParams): FournisseurFilters {
  return {
    q: sanitizeSearch(first(params.q)),
    mode: oneOf(first(params.mode), MODES),
    archives: first(params.archives) === "1",
  };
}

const EMPTY_STATS: StatsFournisseur = {
  nb_commandes: 0,
  delai_reel_moyen_jours: null,
  taux_conformite_pct: null,
  montant_total_ht: null,
};

type StatRow = { fournisseur_id: string | null } & Partial<
  Record<keyof StatsFournisseur, number | null>
>;

const toStats = (r?: StatRow): StatsFournisseur =>
  r
    ? {
        nb_commandes: Number(r.nb_commandes ?? 0),
        delai_reel_moyen_jours: r.delai_reel_moyen_jours ?? null,
        taux_conformite_pct: r.taux_conformite_pct ?? null,
        montant_total_ht: r.montant_total_ht ?? null,
      }
    : EMPTY_STATS;

export async function listFournisseurs(f: FournisseurFilters, params: SearchParams) {
  const { from, to, page, pageSize } = parsePaging(params);
  const supabase = await createClient();
  let query = supabase
    .from("fournisseurs")
    .select("*", { count: "exact" })
    .eq("actif", !f.archives);
  if (f.q) query = query.or(`nom.ilike.%${f.q}%,contact_nom.ilike.%${f.q}%`);
  if (f.mode) query = query.eq("mode_commande", f.mode);
  const { data, count, error } = await query.order("nom").range(from, to);
  if (error) throw error;
  const rows = (data ?? []) as Fournisseur[];
  const stats = await inChunks(
    rows.map((r) => r.id),
    (chunk) => supabase.from("v_stats_fournisseurs").select("*").in("fournisseur_id", chunk),
  );
  const byId = new Map(stats.map((s) => [s.fournisseur_id as string, toStats(s)]));
  return {
    rows: rows.map((r) => ({ ...r, stats: byId.get(r.id) ?? EMPTY_STATS })),
    total: count ?? 0,
    page,
    pageSize,
  };
}
export type FournisseurRow = Awaited<ReturnType<typeof listFournisseurs>>["rows"][number];

export async function getFournisseur(id: string) {
  const supabase = await createClient();
  const [fiche, stats] = await Promise.all([
    supabase.from("fournisseurs").select("*").eq("id", id).maybeSingle(),
    supabase.from("v_stats_fournisseurs").select("*").eq("fournisseur_id", id).maybeSingle(),
  ]);
  if (fiche.error) throw fiche.error;
  if (!fiche.data) return null;
  return { fournisseur: fiche.data as Fournisseur, stats: toStats(stats.data ?? undefined) };
}

export type ProduitAssocie = FournisseurProduit & {
  produit_nom: string;
  unite: "kg" | "L" | "piece";
  pole_id: number;
  prix_achat_ht: number;
  actif: boolean;
};

/** Produits associés à un fournisseur (ceux que l'utilisateur a le droit de voir). */
export async function listProduitsAssocies(fournisseurId: string): Promise<ProduitAssocie[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fournisseur_produits")
    .select("*")
    .eq("fournisseur_id", fournisseurId);
  if (error) throw error;
  const links = (data ?? []) as FournisseurProduit[];
  const produits = await inChunks(
    links.map((l) => l.produit_id),
    (chunk) =>
      supabase
        .from("produits")
        .select("id, nom, unite, pole_id, prix_achat_ht, actif")
        .in("id", chunk),
  );
  const byId = new Map(produits.map((p) => [p.id, p]));
  return links
    .flatMap((l) => {
      const p = byId.get(l.produit_id);
      return p
        ? [
            {
              ...l,
              produit_nom: p.nom,
              unite: p.unite,
              pole_id: p.pole_id,
              prix_achat_ht: p.prix_achat_ht,
              actif: p.actif,
            },
          ]
        : [];
    })
    .sort((a, b) => a.produit_nom.localeCompare(b.produit_nom, "fr"));
}

/** Produits actifs pouvant être associés (visibles par l'utilisateur, pas déjà associés). */
export async function listProduitsAssociables(fournisseurId: string) {
  const supabase = await createClient();
  const [produits, liens] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("produits")
        .select("id, nom, unite, pole_id, prix_achat_ht")
        .eq("actif", true)
        .order("nom")
        .range(a, b),
    ),
    supabase.from("fournisseur_produits").select("produit_id").eq("fournisseur_id", fournisseurId),
  ]);
  if (liens.error) throw liens.error;
  const deja = new Set((liens.data ?? []).map((l) => l.produit_id));
  return produits.filter((p) => !deja.has(p.id));
}

export type PointPrix = { date: string; prix: number; produit_id: string };

/** Prix réellement facturés par ce fournisseur (livraisons validées), du plus ancien au plus récent. */
export async function listPrixFournisseur(fournisseurId: string): Promise<PointPrix[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_historique_prix")
    .select("*")
    .eq("fournisseur_id", fournisseurId)
    .order("date_prix", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: r.date_prix as string,
    prix: r.prix_unitaire_ht as number,
    produit_id: r.produit_id as string,
  }));
}

export async function listCommandesFournisseur(fournisseurId: string, limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_commandes")
    .select("*")
    .eq("fournisseur_id", fournisseurId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as CommandeVue[];
}
