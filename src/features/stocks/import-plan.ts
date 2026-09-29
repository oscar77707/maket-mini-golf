import "server-only";
import { fetchAll } from "@/lib/supabase/paginate";
import type { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/session";
import { normalizeName, normalizeUnite } from "./import-parse";
import type { ImportPayload, ImportRow } from "./schemas";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ImportLineReport = {
  ligne: number;
  nom: string;
  statut: "ok" | "avertissement" | "erreur";
  messages: string[];
};

export type PlannedRow = {
  row: ImportRow;
  pole_id: number;
  unite: "kg" | "L" | "piece";
  categorie: string | null;
  lieu: string | null;
  fournisseur_id: string | null;
};

export type ImportPlan = {
  reports: ImportLineReport[];
  planned: PlannedRow[];
  newCategories: { pole_id: number; nom: string }[];
  newLieux: { pole_id: number; nom: string }[];
};

/** Vérifie chaque ligne du fichier contre la base (pôles, catégories, lieux, fournisseurs, doublons). N'écrit rien. */
export async function planImport(
  supabase: Client,
  user: CurrentUser,
  payload: ImportPayload,
): Promise<ImportPlan> {
  const [poles, categories, lieux, fournisseurs, produits] = await Promise.all([
    supabase.from("poles").select("id, code, nom").eq("actif", true),
    supabase.from("categories_produit").select("pole_id, nom"),
    supabase.from("lieux_stockage").select("pole_id, nom"),
    supabase.from("fournisseurs").select("id, nom").eq("actif", true),
    fetchAll((a, b) =>
      supabase.from("produits").select("pole_id, nom").eq("actif", true).range(a, b),
    ),
  ]);
  for (const r of [poles, categories, lieux, fournisseurs]) if (r.error) throw r.error;

  const isGerant = user.profile.role === "gerant";
  const poleByName = new Map<string, number>();
  for (const p of poles.data ?? []) {
    poleByName.set(normalizeName(p.nom), p.id);
    poleByName.set(normalizeName(p.code), p.id);
  }
  const defaultPole = isGerant ? payload.pole_id : user.profile.pole_id;
  const catKey = (pole: number, nom: string) => `${pole}:${normalizeName(nom)}`;
  const knownCat = new Set((categories.data ?? []).map((c) => catKey(c.pole_id, c.nom)));
  const knownLieu = new Set((lieux.data ?? []).map((c) => catKey(c.pole_id, c.nom)));
  const supplier = new Map((fournisseurs.data ?? []).map((f) => [normalizeName(f.nom), f.id]));
  const taken = new Set(produits.map((p) => catKey(p.pole_id, p.nom)));

  const plan: ImportPlan = { reports: [], planned: [], newCategories: [], newLieux: [] };
  const seenNewCat = new Set<string>();
  const seenNewLieu = new Set<string>();

  for (const row of payload.rows) {
    const messages: string[] = [];
    const errors: string[] = [];

    let poleId = defaultPole;
    if (row.pole) {
      const found = poleByName.get(normalizeName(row.pole));
      if (found === undefined) errors.push(`Pôle inconnu : « ${row.pole} ».`);
      else if (!isGerant && found !== user.profile.pole_id)
        errors.push("Vous ne pouvez importer que dans votre pôle.");
      else poleId = found;
    }
    if (!poleId && errors.length === 0)
      errors.push("Pôle manquant : choisissez un pôle pour l'import.");

    const unite = normalizeUnite(row.unite);
    if (!unite) errors.push(`Unité inconnue : « ${row.unite} » (attendu : kg, L ou pièce).`);

    if (poleId) {
      if (taken.has(catKey(poleId, row.nom))) errors.push("Ce produit existe déjà dans ce pôle.");
      if (row.categorie && !knownCat.has(catKey(poleId, row.categorie))) {
        if (payload.creer_referentiels) {
          if (!seenNewCat.has(catKey(poleId, row.categorie))) {
            seenNewCat.add(catKey(poleId, row.categorie));
            plan.newCategories.push({ pole_id: poleId, nom: row.categorie });
          }
          messages.push(`La catégorie « ${row.categorie} » sera créée.`);
        } else errors.push(`Catégorie inconnue : « ${row.categorie} ».`);
      }
      if (row.lieu && !knownLieu.has(catKey(poleId, row.lieu))) {
        if (payload.creer_referentiels) {
          if (!seenNewLieu.has(catKey(poleId, row.lieu))) {
            seenNewLieu.add(catKey(poleId, row.lieu));
            plan.newLieux.push({ pole_id: poleId, nom: row.lieu });
          }
          messages.push(`Le lieu « ${row.lieu} » sera créé.`);
        } else errors.push(`Lieu de stockage inconnu : « ${row.lieu} ».`);
      }
    }

    let fournisseurId: string | null = null;
    if (row.fournisseur) {
      fournisseurId = supplier.get(normalizeName(row.fournisseur)) ?? null;
      if (!fournisseurId)
        messages.push(
          `Fournisseur « ${row.fournisseur} » inconnu : produit importé sans fournisseur principal.`,
        );
    }

    if (errors.length > 0) {
      plan.reports.push({ ligne: row.ligne, nom: row.nom, statut: "erreur", messages: errors });
      continue;
    }
    // un même nom deux fois dans le fichier : la seconde ligne est refusée
    taken.add(catKey(poleId!, row.nom));
    plan.planned.push({
      row,
      pole_id: poleId!,
      unite: unite!,
      categorie: row.categorie || null,
      lieu: row.lieu || null,
      fournisseur_id: fournisseurId,
    });
    plan.reports.push({
      ligne: row.ligne,
      nom: row.nom,
      statut: messages.length ? "avertissement" : "ok",
      messages,
    });
  }
  return plan;
}
