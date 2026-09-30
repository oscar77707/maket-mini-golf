import { handleInboundWebhook } from "@/lib/webhooks/handler";
import { orderEventSchema, traiterEvenement } from "@/features/commandes/webhook-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrée n8n → application : création de brouillons et mise à jour de statuts de commandes. */
export function POST(request: Request) {
  return handleInboundWebhook(request, {
    source: "n8n_orders",
    schema: orderEventSchema,
    traiter: traiterEvenement,
  });
}
