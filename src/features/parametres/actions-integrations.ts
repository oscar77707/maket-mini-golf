"use server";

import { revalidatePath } from "next/cache";
import { context, failed } from "@/lib/action-context";
import { journaliser } from "@/lib/audit";
import { toFrenchMessage } from "@/lib/errors";
import { postSignedToN8n } from "@/features/commandes/n8n";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { webhookSchema } from "./schemas";

const refresh = () => revalidatePath("/parametres/integrations");

export async function saveWebhook(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { cle, url, actif } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("webhooks_n8n")
    .update({ url, actif })
    .eq("cle", cle)
    .select("cle");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Webhook introuvable.");
  refresh();
  return ok(null, "Webhook enregistré.");
}

/** Envoie un message de test signé (« test.ping ») à l'adresse enregistrée, ou à défaut à celle de l'environnement. */
export async function testWebhook(cle: string): Promise<ServerResult<{ statut: number | null }>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const { data: webhook } = await ctx.supabase
    .from("webhooks_n8n")
    .select("cle, url")
    .eq("cle", cle)
    .maybeSingle();
  if (!webhook) return fail("Webhook introuvable.");
  const url =
    webhook.url ?? (cle === "order_send" ? process.env.N8N_WEBHOOK_ORDER_SEND?.trim() : undefined);
  if (!url) return fail("Aucune adresse n'est enregistrée pour ce webhook.");

  const envoi = await postSignedToN8n(
    url,
    { evenement: "test.ping", webhook: cle, envoye_le: new Date().toISOString() },
    `test.ping:${crypto.randomUUID()}`,
  );
  const statut = envoi.ok ? envoi.status : envoi.status;
  await ctx.supabase
    .from("webhooks_n8n")
    .update({ derniere_utilisation: new Date().toISOString(), dernier_statut_http: statut ?? 0 })
    .eq("cle", cle);
  await journaliser(ctx.supabase, "integration.test", "webhooks_n8n", cle, {
    statut: statut ?? 0,
    reussi: envoi.ok,
  });
  refresh();
  if (!envoi.ok) return fail(`Le test a échoué : ${envoi.message}`);
  return ok({ statut }, "Test réussi : n8n a bien répondu.");
}
