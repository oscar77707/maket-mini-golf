import type { z } from "zod";

/** Résultat d'un traitement de webhook : code HTTP + corps JSON renvoyé à n8n. */
export type WebhookOutcome = {
  status: 200 | 400 | 404 | 409;
  body: Record<string, unknown>;
};

export const reply = (
  status: WebhookOutcome["status"],
  body: Record<string, unknown>,
): WebhookOutcome => ({ status, body });

/** Erreurs Zod → liste `{ champ, message }` lisible par n8n. */
export const issuesOf = (error: z.ZodError) =>
  error.issues.map((i) => ({ champ: i.path.join(".") || "corps", message: i.message }));
