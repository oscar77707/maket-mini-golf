"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context, failed } from "@/lib/action-context";
import { toFrenchMessage } from "@/lib/errors";
import { fail, ok, type ServerResult } from "@/lib/server-result";
import { referentielNomSchema, REFERENTIELS, type Referentiel } from "./schemas";

const refresh = () => {
  revalidatePath("/parametres/stocks");
  revalidatePath("/stocks", "layout");
};

const tableSchema = z.enum(REFERENTIELS, { error: "Liste inconnue." });
const NOMS: Record<Referentiel, { un: string; article: string }> = {
  categories_produit: { un: "catégorie", article: "Cette" },
  lieux_stockage: { un: "lieu de stockage", article: "Ce" },
};

function doublon(table: Referentiel): ServerResult<never> {
  return fail(
    `Ce pôle a déjà ${table === "categories_produit" ? "une catégorie" : "un lieu"} portant ce nom.`,
    {
      nom: "Ce nom existe déjà.",
    },
  );
}

export async function createReferentiel(
  table: Referentiel,
  poleId: number,
  nom: string,
): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const t = tableSchema.safeParse(table);
  const n = referentielNomSchema.safeParse(nom);
  if (!t.success) return fail(t.error.issues[0].message);
  if (!n.success) return fail(n.error.issues[0].message, { nom: n.error.issues[0].message });
  if (!Number.isInteger(poleId) || poleId <= 0) return fail("Pôle invalide.");

  const { data: derniere } = await ctx.supabase
    .from(t.data)
    .select("ordre")
    .eq("pole_id", poleId)
    .order("ordre", { ascending: false })
    .limit(1);
  const { error } = await ctx.supabase
    .from(t.data)
    .insert({ pole_id: poleId, nom: n.data, ordre: (derniere?.[0]?.ordre ?? 0) + 1 });
  if (error) return error.code === "23505" ? doublon(t.data) : fail(toFrenchMessage(error));
  refresh();
  return ok(null, `« ${n.data} » ajouté.`);
}

export async function renameReferentiel(
  table: Referentiel,
  id: string,
  nom: string,
): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const t = tableSchema.safeParse(table);
  const n = referentielNomSchema.safeParse(nom);
  if (!t.success) return fail(t.error.issues[0].message);
  if (!n.success) return fail(n.error.issues[0].message, { nom: n.error.issues[0].message });
  if (!z.uuid().safeParse(id).success) return fail("Élément invalide.");
  const { data, error } = await ctx.supabase
    .from(t.data)
    .update({ nom: n.data })
    .eq("id", id)
    .select("id");
  if (error) return error.code === "23505" ? doublon(t.data) : fail(toFrenchMessage(error));
  if (!data?.length) return fail("Élément introuvable.");
  refresh();
  return ok(null, "Nom modifié.");
}

/** Suppression refusée tant que des produits utilisent l'élément (ils perdraient leur classement). */
export async function deleteReferentiel(
  table: Referentiel,
  id: string,
): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const t = tableSchema.safeParse(table);
  if (!t.success) return fail(t.error.issues[0].message);
  if (!z.uuid().safeParse(id).success) return fail("Élément invalide.");

  const colonne = t.data === "categories_produit" ? "categorie_id" : "lieu_stockage_id";
  const { count, error: countError } = await ctx.supabase
    .from("produits")
    .select("id", { count: "exact", head: true })
    .eq(colonne, id);
  if (countError) return fail(toFrenchMessage(countError));
  if (count) {
    const { article, un } = NOMS[t.data];
    return fail(
      `${article} ${un} est utilisé${un === "catégorie" ? "e" : ""} par ${count} produit${count > 1 ? "s" : ""}. Changez d'abord le classement de ces produits.`,
    );
  }
  const { data, error } = await ctx.supabase.from(t.data).delete().eq("id", id).select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Élément introuvable.");
  refresh();
  return ok(null, "Élément supprimé.");
}

/** Monte ou descend un élément dans l'ordre d'affichage de son pôle. */
export async function moveReferentiel(
  table: Referentiel,
  id: string,
  sens: "haut" | "bas",
): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const t = tableSchema.safeParse(table);
  if (!t.success) return fail(t.error.issues[0].message);
  if (!z.uuid().safeParse(id).success || (sens !== "haut" && sens !== "bas"))
    return fail("Déplacement invalide.");

  const { data: cible } = await ctx.supabase
    .from(t.data)
    .select("pole_id")
    .eq("id", id)
    .maybeSingle();
  if (!cible) return fail("Élément introuvable.");
  const { data: liste, error } = await ctx.supabase
    .from(t.data)
    .select("id, ordre, nom")
    .eq("pole_id", cible.pole_id)
    .order("ordre")
    .order("nom");
  if (error) return fail(toFrenchMessage(error));
  const ids = (liste ?? []).map((l) => l.id);
  const i = ids.indexOf(id);
  const j = sens === "haut" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ok(null);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  // renumérote toute la liste : évite les ex æquo laissés par des ajouts anciens
  for (const [index, autre] of ids.entries()) {
    const ancien = liste?.find((l) => l.id === autre);
    if (ancien && ancien.ordre === index + 1) continue;
    const { error: majError } = await ctx.supabase
      .from(t.data)
      .update({ ordre: index + 1 })
      .eq("id", autre);
    if (majError) return fail(toFrenchMessage(majError));
  }
  refresh();
  return ok(null);
}
