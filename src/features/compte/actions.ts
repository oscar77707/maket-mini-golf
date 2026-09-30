"use server";

import { revalidatePath } from "next/cache";
import { context, failed } from "@/lib/action-context";
import { toFrenchMessage } from "@/lib/errors";
import { newPasswordSchema } from "@/features/auth/schemas";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { profilSchema } from "./schemas";

export async function updateProfil(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  const parsed = profilSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await ctx.supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", ctx.user.profile.id);
  if (error) return fail(toFrenchMessage(error));
  revalidatePath("/", "layout");
  return ok(null, "Vos informations sont enregistrées.");
}

export async function changerMotDePasse(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(toFrenchMessage(error));
  return ok(null, "Mot de passe modifié.");
}
