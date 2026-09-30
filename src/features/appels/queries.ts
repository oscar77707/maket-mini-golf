import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, debutJourParis } from "@/lib/dates";
import {
  dateOrUndefined,
  first,
  oneOf,
  parsePaging,
  sanitizeSearch,
  type SearchParams,
} from "@/lib/table-params";
import { ISSUES } from "@/features/appels/labels";
import type { AppelIA, IssueAppel, StatsAppels } from "@/types/models";

export type AppelFilters = {
  poleId: number | null;
  issue?: IssueAppel;
  q: string;
  du?: string;
  au?: string;
};

export function parseAppelFilters(params: SearchParams, poleId: number | null): AppelFilters {
  return {
    poleId,
    issue: oneOf(first(params.issue), ISSUES),
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

/** Filtres communs à la liste et aux compteurs d'onglets (sauf l'issue). Les dates sont des jours de Paris. */
function baseFilters<Q extends Filtrable<Q>>(query: Q, f: AppelFilters): Q {
  let q = query;
  if (f.poleId) q = q.eq("pole_id", f.poleId);
  if (f.q)
    q = q.or(`resume.ilike.%${f.q}%,numero_masque.ilike.%${f.q}%,transcription.ilike.%${f.q}%`);
  if (f.du) q = q.gte("debut", debutJourParis(f.du).toISOString());
  if (f.au) q = q.lt("debut", debutJourParis(addDays(f.au, 1)).toISOString());
  return q;
}

export type AppelListe = Pick<
  AppelIA,
  "id" | "debut" | "duree_secondes" | "numero_masque" | "pole_id" | "issue" | "resume"
>;

const COLONNES_LISTE = "id, debut, duree_secondes, numero_masque, pole_id, issue, resume";

export async function listAppels(f: AppelFilters, params: SearchParams) {
  const { from, to, page, pageSize } = parsePaging(params);
  const supabase = await createClient();
  const query = baseFilters(
    supabase.from("appels_ia").select(COLONNES_LISTE, { count: "exact" }),
    f,
  );
  const { data, count, error } = await (f.issue ? query.eq("issue", f.issue) : query)
    .order("debut", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as AppelListe[], total: count ?? 0, page, pageSize };
}

/** Nombre d'appels par onglet d'issue (mêmes filtres que la liste, sans l'issue). */
export async function countAppelsParIssue(f: AppelFilters) {
  const supabase = await createClient();
  const tabs: (IssueAppel | undefined)[] = [undefined, ...ISSUES];
  const counts = await Promise.all(
    tabs.map(async (issue) => {
      const query = baseFilters(
        supabase.from("appels_ia").select("id", { count: "exact", head: true }),
        f,
      );
      const { count, error } = await (issue ? query.eq("issue", issue) : query);
      if (error) throw error;
      return [issue ?? "toutes", count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<"toutes" | IssueAppel, number>;
}

export async function getAppel(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appels_ia").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const appel = data as AppelIA;

  let memeNumero: AppelListe[] = [];
  let totalMemeNumero = 0;
  if (appel.numero_hash) {
    const {
      data: autres,
      count,
      error: e2,
    } = await supabase
      .from("appels_ia")
      .select(COLONNES_LISTE, { count: "exact" })
      .eq("numero_hash", appel.numero_hash)
      .neq("id", id)
      .order("debut", { ascending: false })
      .limit(5);
    if (e2) throw e2;
    memeNumero = (autres ?? []) as AppelListe[];
    totalMemeNumero = count ?? 0;
  }
  return { appel, memeNumero, totalMemeNumero };
}

export type AppelDetail = NonNullable<Awaited<ReturnType<typeof getAppel>>>;

export async function getStatsAppels(du: string, au: string, poleId: number | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stats_appels", {
    p_debut: du,
    p_fin: au,
    ...(poleId ? { p_pole_id: poleId } : {}),
  });
  if (error) throw error;
  return data as unknown as StatsAppels;
}

/** Durée de conservation des appels (réglage du gérant, 90 jours par défaut). */
export async function getRetentionAppelsJours() {
  const supabase = await createClient();
  const { data } = await supabase.from("parametres").select("retention_appels_jours").maybeSingle();
  return data?.retention_appels_jours ?? 90;
}
