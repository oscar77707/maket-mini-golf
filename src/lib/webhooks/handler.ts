import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  HEADER_IDEMPOTENCY,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  verifyInbound,
} from "@/lib/webhooks/signature";
import { issuesOf, type WebhookOutcome } from "@/lib/webhooks/outcome";

type Admin = ReturnType<typeof createAdminClient>;

const MAX_BODY = 200_000;
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

/** Réserve la clé d'idempotence : un renvoi d'une requête déjà traitée ne crée pas de doublon. */
async function reserver(admin: Admin, source: string, key: string, evenement: string | null) {
  const { error } = await admin
    .from("webhooks_recus")
    .insert({ source, idempotency_key: key, evenement, statut_http: 202 });
  if (!error) return "reserve" as const;
  if (error.code !== "23505") throw error;
  const { data } = await admin
    .from("webhooks_recus")
    .select("statut_http, recu_le")
    .eq("source", source)
    .eq("idempotency_key", key)
    .single();
  if (data && data.statut_http >= 200 && data.statut_http < 300 && data.statut_http !== 202)
    return "doublon" as const;
  const enCours = data?.statut_http === 202 && Date.now() - Date.parse(data.recu_le) < 60_000;
  if (enCours) return "en_cours" as const;
  // tentative précédente refusée (4xx) ou abandonnée : la clé peut être réutilisée
  await admin
    .from("webhooks_recus")
    .update({ statut_http: 202, erreur: null, recu_le: new Date().toISOString(), evenement })
    .eq("source", source)
    .eq("idempotency_key", key);
  return "reserve" as const;
}

/**
 * Réception d'un webhook n8n → application : jeton Bearer, signature HMAC, horodatage récent,
 * clé d'idempotence, validation du corps, puis traitement par la route.
 * Codes : 200 traité ou doublon, 400 corps invalide, 401 authentification, 409 déjà en cours, 500 erreur interne.
 */
export async function handleInboundWebhook<T extends { evenement?: string }>(
  request: Request,
  route: {
    /** Identifiant de la route dans `webhooks_recus.source`. */
    source: string;
    schema: z.ZodType<T>;
    /** Nom d'événement enregistré quand le corps n'en indique pas. */
    evenementParDefaut?: string;
    traiter: (admin: Admin, event: T) => Promise<WebhookOutcome>;
  },
): Promise<NextResponse> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(400, { error: "Corps trop volumineux." });

  const check = verifyInbound({
    token: process.env.N8N_INBOUND_TOKEN ?? "",
    secret: process.env.N8N_INBOUND_SECRET ?? "",
    authorization: request.headers.get("authorization"),
    timestamp: request.headers.get(HEADER_TIMESTAMP),
    signature: request.headers.get(HEADER_SIGNATURE),
    body: raw,
  });
  if (!check.ok) return json(401, { error: check.reason });

  const key = request.headers.get(HEADER_IDEMPOTENCY)?.trim();
  if (!key || key.length > 200)
    return json(400, {
      error: "L'en-tête X-Idempotency-Key est obligatoire (200 caractères au maximum).",
    });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "Le corps n'est pas du JSON valide." });
  }
  const parsed = route.schema.safeParse(payload);
  if (!parsed.success)
    return json(400, { error: "Corps invalide.", details: issuesOf(parsed.error) });

  const admin = createAdminClient();
  const evenement = parsed.data.evenement ?? route.evenementParDefaut ?? null;
  const reservation = await reserver(admin, route.source, key, evenement);
  if (reservation === "doublon")
    return json(200, { doublon: true, message: "Requête déjà traitée." });
  if (reservation === "en_cours")
    return json(409, { error: "Cette requête est déjà en cours de traitement." });

  const noter = (statut_http: number, erreur: string | null) =>
    admin
      .from("webhooks_recus")
      .update({ statut_http, erreur })
      .eq("source", route.source)
      .eq("idempotency_key", key);

  try {
    const outcome = await route.traiter(admin, parsed.data);
    await noter(
      outcome.status,
      outcome.status === 200 ? null : String(outcome.body.error ?? "").slice(0, 500),
    );
    return json(outcome.status, outcome.body);
  } catch {
    await noter(500, "Erreur interne.");
    return json(500, { error: "Erreur interne." });
  }
}
