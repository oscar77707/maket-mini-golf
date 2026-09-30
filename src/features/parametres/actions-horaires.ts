"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context, failed } from "@/lib/action-context";
import { journaliser } from "@/lib/audit";
import { toFrenchMessage } from "@/lib/errors";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { fermetureSchema, horairesSchema, saisonSchema } from "./schemas";

const refresh = () => revalidatePath("/parametres/horaires");

export async function createSaison(input: unknown): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = saisonSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("saisons")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok({ id: data.id }, `Saison « ${parsed.data.nom} » créée.`);
}

export async function updateSaison(id: string, input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Saison invalide.");
  const parsed = saisonSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("saisons")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Saison introuvable.");
  refresh();
  return ok(null, "Saison mise à jour.");
}

/** Supprime la saison et, avec elle, ses horaires. */
export async function deleteSaison(id: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Saison invalide.");
  const { data, error } = await ctx.supabase.from("saisons").delete().eq("id", id).select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Saison introuvable.");
  refresh();
  return ok(null, "Saison supprimée avec ses horaires.");
}

/** Enregistre d'un coup les sept jours d'un pôle pour une saison. */
export async function saveHoraires(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = horairesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { saison_id, pole_id, jours } = parsed.data;
  const { error } = await ctx.supabase.from("horaires_poles").upsert(
    jours.map((j) => ({
      saison_id,
      pole_id,
      jour_semaine: j.jour_semaine,
      ferme: j.ferme,
      ouverture: j.ferme ? null : j.ouverture,
      fermeture: j.ferme ? null : j.fermeture,
    })),
    { onConflict: "pole_id,saison_id,jour_semaine" },
  );
  if (error) return fail(toFrenchMessage(error));
  await journaliser(ctx.supabase, "horaires.modification", "horaires_poles", null, {
    saison_id,
    pole_id,
  });
  refresh();
  return ok(null, "Horaires enregistrés.");
}

export async function createFermeture(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = fermetureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await ctx.supabase.from("fermetures_exceptionnelles").insert(parsed.data);
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok(null, "Fermeture ajoutée.");
}

export async function updateFermeture(id: string, input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Fermeture invalide.");
  const parsed = fermetureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("fermetures_exceptionnelles")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Fermeture introuvable.");
  refresh();
  return ok(null, "Fermeture mise à jour.");
}

export async function deleteFermeture(id: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Fermeture invalide.");
  const { data, error } = await ctx.supabase
    .from("fermetures_exceptionnelles")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Fermeture introuvable.");
  refresh();
  return ok(null, "Fermeture supprimée.");
}
