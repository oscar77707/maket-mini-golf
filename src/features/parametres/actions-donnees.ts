"use server";

import { revalidatePath } from "next/cache";
import { context, failed } from "@/lib/action-context";
import { toFrenchMessage } from "@/lib/errors";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { retentionSchema } from "./schemas";

const refresh = () => {
  revalidatePath("/parametres/donnees");
  revalidatePath("/appels", "layout");
};

export async function saveRetention(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = retentionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("parametres")
    .update({ ...parsed.data, updated_by: ctx.user.profile.id })
    .eq("id", true)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Paramètres introuvables.");
  refresh();
  return ok(null, "Durées de conservation enregistrées.");
}

/** Lance tout de suite la purge que `pg_cron` fait chaque nuit ; renvoie ce qui a été supprimé. */
export async function purgerMaintenant(): Promise<
  ServerResult<{ appels: number; audit: number; webhooks: number }>
> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const { data, error } = await ctx.supabase.rpc("purger_donnees_maintenant");
  if (error) return fail(toFrenchMessage(error));
  const r = data as { appels: number; audit: number; webhooks: number };
  refresh();
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  return ok(
    r,
    `Purge terminée : ${pluriel(r.appels, "appel")}, ${pluriel(r.audit, "entrée")} du journal et ${pluriel(r.webhooks, "échange")} supprimés.`,
  );
}
