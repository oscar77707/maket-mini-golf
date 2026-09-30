import { handleInboundWebhook } from "@/lib/webhooks/handler";
import { callEventSchema, enregistrerAppel } from "@/features/appels/webhook-calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrée n8n → application : un appel du standard IA vient de se terminer. */
export function POST(request: Request) {
  return handleInboundWebhook(request, {
    source: "n8n_calls",
    schema: callEventSchema,
    evenementParDefaut: "call.completed",
    traiter: enregistrerAppel,
  });
}
