import "server-only";
import type { Client } from "@/lib/action-context";
import {
  HEADER_IDEMPOTENCY,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  sign,
} from "@/lib/webhooks/signature";
import type { OrderSendPayload } from "./schemas";

const TIMEOUT_MS = 10_000;

export type SendResult =
  { ok: true; status: number } | { ok: false; status: number | null; message: string };

/** URL du webhook d'envoi : celle des paramètres (si active), sinon la variable d'environnement. */
export async function resolveOrderWebhookUrl(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from("webhooks_n8n")
    .select("url, actif")
    .eq("cle", "order_send")
    .maybeSingle();
  if (data?.actif && data.url) return data.url;
  return process.env.N8N_WEBHOOK_ORDER_SEND?.trim() || null;
}

/** En production seul https est accepté ; en développement http local reste possible (faux serveur n8n). */
export function isAllowedWebhookUrl(
  raw: string,
  production = process.env.NODE_ENV === "production",
) {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    return url.protocol === "https:" || (!production && url.protocol === "http:");
  } catch {
    return false;
  }
}

/** Envoie la commande à n8n, signée (HMAC-SHA256 de « horodatage.corps »). Ne lève jamais d'exception. */
export function postOrderToN8n(url: string, payload: OrderSendPayload): Promise<SendResult> {
  // n8n peut ignorer un second appel pour la même commande si la réponse s'est perdue
  return postSignedToN8n(url, payload, `order.send:${payload.commandeId}`);
}

/** POST JSON signé vers n8n (commande, test de connexion). Ne lève jamais d'exception. */
export async function postSignedToN8n(
  url: string,
  payload: object,
  idempotencyKey: string,
): Promise<SendResult> {
  const secret = process.env.N8N_OUTBOUND_SECRET?.trim();
  if (!secret)
    return { ok: false, status: null, message: "N8N_OUTBOUND_SECRET n'est pas configuré." };
  if (!isAllowedWebhookUrl(url))
    return {
      ok: false,
      status: null,
      message: "L'adresse du webhook n8n n'est pas acceptable (https requis).",
    };

  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        [HEADER_TIMESTAMP]: timestamp,
        [HEADER_SIGNATURE]: sign(secret, timestamp, body),
        [HEADER_IDEMPOTENCY]: idempotencyKey,
      },
      body,
    });
    if (response.ok) return { ok: true, status: response.status };
    return { ok: false, status: response.status, message: `n8n a répondu ${response.status}.` };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      status: null,
      message: timedOut ? "n8n n'a pas répondu à temps." : "n8n est injoignable.",
    };
  }
}
