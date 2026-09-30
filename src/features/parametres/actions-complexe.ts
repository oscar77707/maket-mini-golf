"use server";

import { revalidatePath } from "next/cache";
import { context, failed } from "@/lib/action-context";
import { journaliser } from "@/lib/audit";
import { toFrenchMessage } from "@/lib/errors";
import { detectLogoType, LOGO_MAX_BYTES } from "@/lib/logo";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { complexeSchema, polesSchema } from "./schemas";

/** Nom, couleurs et logo sont lus par toutes les pages : on rafraîchit tout l'habillage. */
const refresh = () => revalidatePath("/", "layout");

export async function updateComplexe(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = complexeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("parametres")
    .update({ ...parsed.data, updated_by: ctx.user.profile.id })
    .eq("id", true)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Paramètres introuvables.");
  refresh();
  return ok(null, "Paramètres enregistrés.");
}

export async function updatePoles(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = polesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  for (const pole of parsed.data) {
    const { data, error } = await ctx.supabase
      .from("poles")
      .update({ nom: pole.nom, couleur: pole.couleur })
      .eq("id", pole.id)
      .select("id");
    if (error) return fail(toFrenchMessage(error));
    if (!data?.length) return fail("Pôle introuvable.");
  }
  refresh();
  return ok(null, "Pôles enregistrés.");
}

/** Remplace le logo : PNG, JPEG ou WebP de 500 Ko au plus, reconnu à son contenu (pas à son extension). */
export async function uploadLogo(formData: FormData): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Choisissez une image.");
  if (file.size > LOGO_MAX_BYTES)
    return fail("L'image est trop lourde : 500 Ko au maximum. Réduisez-la puis réessayez.");
  const type = detectLogoType(new Uint8Array(await file.arrayBuffer()));
  if (!type) return fail("Format non pris en charge : utilisez une image PNG, JPEG ou WebP.");

  const { data: actuel } = await ctx.supabase.from("parametres").select("logo_path").single();
  const path = `logo-${Date.now()}.${type.ext}`;
  const envoi = await ctx.supabase.storage
    .from("logos")
    .upload(path, await file.arrayBuffer(), { contentType: type.mime, upsert: false });
  if (envoi.error) return fail("L'image n'a pas pu être enregistrée. Réessayez dans un instant.");

  const { error } = await ctx.supabase
    .from("parametres")
    .update({ logo_path: path, updated_by: ctx.user.profile.id })
    .eq("id", true);
  if (error) {
    await ctx.supabase.storage.from("logos").remove([path]);
    return fail(toFrenchMessage(error));
  }
  if (actuel?.logo_path) await ctx.supabase.storage.from("logos").remove([actuel.logo_path]);
  await journaliser(ctx.supabase, "logo.modification", "parametres", null);
  refresh();
  return ok(null, "Logo enregistré.");
}

export async function removeLogo(): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const { data: actuel } = await ctx.supabase.from("parametres").select("logo_path").single();
  if (!actuel?.logo_path) return fail("Aucun logo à supprimer.");
  const { error } = await ctx.supabase
    .from("parametres")
    .update({ logo_path: null, updated_by: ctx.user.profile.id })
    .eq("id", true);
  if (error) return fail(toFrenchMessage(error));
  await ctx.supabase.storage.from("logos").remove([actuel.logo_path]);
  await journaliser(ctx.supabase, "logo.suppression", "parametres", null);
  refresh();
  return ok(null, "Logo supprimé.");
}
