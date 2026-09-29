"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context, failed } from "@/lib/action-context";
import { toFrenchMessage } from "@/lib/errors";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { fournisseurProduitSchema, fournisseurSchema } from "./schemas";

const refresh = () => {
  revalidatePath("/fournisseurs", "layout");
  revalidatePath("/commandes", "layout");
};

function fournisseurError(error: { code?: string; message?: string }): ServerResult<never> {
  if (error.code === "23505")
    return fail("Un fournisseur porte déjà ce nom.", { nom: "Ce nom existe déjà." });
  if (error.code === "23514")
    return fail(
      "Vérifiez le mode de commande : l'e-mail ou l'adresse du portail correspondant est nécessaire.",
    );
  return fail(toFrenchMessage(error));
}

export async function createFournisseur(input: unknown): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = fournisseurSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("fournisseurs")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return fournisseurError(error);
  refresh();
  return ok({ id: data.id }, `Fournisseur « ${parsed.data.nom} » créé.`);
}

export async function updateFournisseur(id: string, input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Fournisseur invalide.");
  const parsed = fournisseurSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("fournisseurs")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return fournisseurError(error);
  if (!data?.length) return fail("Fournisseur introuvable.");
  refresh();
  return ok(null, "Fournisseur mis à jour.");
}

/** Désactive ou réactive un fournisseur : il disparaît des choix de commande mais l'historique reste. */
export async function setFournisseurActif(id: string, actif: boolean): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Fournisseur invalide.");
  const { data, error } = await ctx.supabase
    .from("fournisseurs")
    .update({ actif })
    .eq("id", id)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Fournisseur introuvable.");
  refresh();
  return ok(null, actif ? "Fournisseur réactivé." : "Fournisseur désactivé.");
}

/** Associe un produit à un fournisseur, ou met à jour référence, prix et conditionnement. */
export async function saveFournisseurProduit(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = fournisseurProduitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await ctx.supabase
    .from("fournisseur_produits")
    .upsert(parsed.data, { onConflict: "fournisseur_id,produit_id" });
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok(null, "Produit associé au fournisseur.");
}

export async function removeFournisseurProduit(
  fournisseurId: string,
  produitId: string,
): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(fournisseurId).success || !z.uuid().safeParse(produitId).success)
    return fail("Association invalide.");
  const { data, error } = await ctx.supabase
    .from("fournisseur_produits")
    .delete()
    .eq("fournisseur_id", fournisseurId)
    .eq("produit_id", produitId)
    .select("produit_id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Association introuvable.");
  refresh();
  return ok(null, "Produit retiré de ce fournisseur.");
}
