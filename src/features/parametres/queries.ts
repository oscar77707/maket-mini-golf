import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import { addDays, debutJourParis } from "@/lib/dates";
import {
  dateOrUndefined,
  first,
  oneOf,
  parsePaging,
  sanitizeSearch,
  type SearchParams,
} from "@/lib/table-params";
import type { Parametres, Pole, Profile, WebhookN8n } from "@/types/models";
import type { Tables } from "@/types/database";
import { GROUPES_AUDIT, GROUPES_AUDIT_IDS, type StatutCompte, statutCompte } from "./labels";
import type { Referentiel } from "./schemas";

export type Saison = Tables<"saisons">;
export type Horaire = Tables<"horaires_poles">;
export type Fermeture = Tables<"fermetures_exceptionnelles">;

export async function getParametres(): Promise<Parametres> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("parametres").select("*").single();
  if (error) throw error;
  return data;
}

/** Tous les pôles, y compris ceux qui seraient désactivés (l'écran de réglage les montre tous). */
export async function getTousLesPoles(): Promise<Pole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("poles").select("*").order("ordre");
  if (error) throw error;
  return data;
}

export type Utilisateur = Profile & { statut: StatutCompte; pole_nom: string | null };

export async function getUtilisateurs(): Promise<Utilisateur[]> {
  const supabase = await createClient();
  const [profils, poles, jamais] = await Promise.all([
    fetchAll<Profile>((from, to) =>
      supabase.from("profiles").select("*").order("nom").order("prenom").range(from, to),
    ),
    getTousLesPoles(),
    supabase.rpc("invitations_en_attente"),
  ]);
  if (jamais.error) throw jamais.error;
  const attente = new Set((jamais.data ?? []) as string[]);
  const nomPole = new Map(poles.map((p) => [p.id, p.nom]));
  return profils.map((p) => ({
    ...p,
    statut: statutCompte({
      actif: p.actif,
      anonymise_le: p.anonymise_le,
      invitation_en_attente: attente.has(p.id),
    }),
    pole_nom: p.pole_id === null ? null : (nomPole.get(p.pole_id) ?? null),
  }));
}

export async function getSaisons(): Promise<Saison[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("saisons").select("*").order("date_debut");
  if (error) throw error;
  return data;
}

export async function getHoraires(saisonId: string, poleId: number): Promise<Horaire[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("horaires_poles")
    .select("*")
    .eq("saison_id", saisonId)
    .eq("pole_id", poleId)
    .order("jour_semaine");
  if (error) throw error;
  return data;
}

export async function getFermetures(): Promise<Fermeture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fermetures_exceptionnelles")
    .select("*")
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return data;
}

export type ReferentielLigne = {
  id: string;
  pole_id: number;
  nom: string;
  ordre: number;
  nb_produits: number;
};

/** Catégories ou lieux de stockage, avec le nombre de produits qui les utilisent (suppression bloquée si > 0). */
export async function getReferentiel(table: Referentiel): Promise<ReferentielLigne[]> {
  const supabase = await createClient();
  const colonne = table === "categories_produit" ? "categorie_id" : "lieu_stockage_id";
  const [lignes, produits] = await Promise.all([
    supabase.from(table).select("id, pole_id, nom, ordre").order("ordre").order("nom"),
    fetchAll<{ categorie_id: string | null; lieu_stockage_id: string | null }>((from, to) =>
      supabase.from("produits").select("categorie_id, lieu_stockage_id").range(from, to),
    ),
  ]);
  if (lignes.error) throw lignes.error;
  const compte = new Map<string, number>();
  for (const p of produits) {
    const id = p[colonne];
    if (id) compte.set(id, (compte.get(id) ?? 0) + 1);
  }
  return (lignes.data ?? []).map((l) => ({ ...l, nb_produits: compte.get(l.id) ?? 0 }));
}

export async function getWebhooks(): Promise<WebhookN8n[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webhooks_n8n").select("*").order("cle");
  if (error) throw error;
  return data;
}

export type WebhookRecu = Tables<"webhooks_recus">;

export async function getWebhooksRecus(limit = 15): Promise<WebhookRecu[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks_recus")
    .select("*")
    .order("recu_le", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Journal d'audit
// -----------------------------------------------------------------------------
export type AuditLigne = Pick<
  Tables<"audit_log">,
  | "id"
  | "cree_le"
  | "user_email"
  | "action"
  | "table_cible"
  | "cible_id"
  | "avant"
  | "apres"
  | "details"
>;

export type AuditFilters = {
  groupe?: keyof typeof GROUPES_AUDIT;
  q: string;
  du?: string;
  au?: string;
};

export function parseAuditFilters(params: SearchParams): AuditFilters {
  return {
    groupe: oneOf(first(params.groupe), GROUPES_AUDIT_IDS),
    q: sanitizeSearch(first(params.q)),
    du: dateOrUndefined(first(params.du)),
    au: dateOrUndefined(first(params.au)),
  };
}

export async function listAudit(f: AuditFilters, params: SearchParams) {
  const { from, to, page, pageSize } = parsePaging(params);
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, cree_le, user_email, action, table_cible, cible_id, avant, apres, details", {
      count: "exact",
    });
  if (f.groupe)
    query = query.or(GROUPES_AUDIT[f.groupe].prefixes.map((p) => `action.like.${p}*`).join(","));
  if (f.q) query = query.or(`action.ilike.%${f.q}%,user_email.ilike.%${f.q}%`);
  if (f.du) query = query.gte("cree_le", debutJourParis(f.du).toISOString());
  if (f.au) query = query.lt("cree_le", debutJourParis(addDays(f.au, 1)).toISOString());
  const { data, count, error } = await query
    .order("cree_le", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as AuditLigne[], total: count ?? 0, page, pageSize };
}

/** Nombre de lignes que la purge supprimerait maintenant (affiché avant de confirmer). */
export async function compterDonneesAPurger(
  prm: Pick<Parametres, "retention_appels_jours" | "retention_audit_jours">,
) {
  const supabase = await createClient();
  const jour = 86_400_000;
  const avant = (jours: number) => new Date(Date.now() - jours * jour).toISOString();
  const [appels, audit] = await Promise.all([
    supabase
      .from("appels_ia")
      .select("id", { count: "exact", head: true })
      .lt("debut", avant(prm.retention_appels_jours)),
    supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .lt("cree_le", avant(prm.retention_audit_jours)),
  ]);
  if (appels.error) throw appels.error;
  if (audit.error) throw audit.error;
  return { appels: appels.count ?? 0, audit: audit.count ?? 0 };
}
