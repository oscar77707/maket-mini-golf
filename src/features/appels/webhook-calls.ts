import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { reply, type WebhookOutcome } from "@/lib/webhooks/outcome";
import { empreinteNumero, masquerNumero } from "@/features/appels/phone";
import { ISSUES } from "@/features/appels/labels";
import type { Json } from "@/types/database";

type Admin = ReturnType<typeof createAdminClient>;

const DAY_MS = 86_400_000;

const textOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .optional()
    .transform((v) => (v ? v : null));

/**
 * Un appel terminé, envoyé par n8n. Le numéro est reçu en clair mais n'est jamais enregistré :
 * l'application ne garde qu'une version masquée et une empreinte HMAC.
 */
export const callEventSchema = z.object({
  evenement: z
    .literal("call.completed", { error: "evenement doit valoir call.completed." })
    .optional(),
  id_externe: z.string().trim().min(1, "id_externe est obligatoire.").max(200),
  debut: z.iso.datetime({ offset: true, error: "debut attendu au format ISO 8601 avec fuseau." }),
  duree_secondes: z
    .number({ error: "duree_secondes doit être un nombre." })
    .int("duree_secondes doit être un entier.")
    .min(0)
    .max(86_400, "duree_secondes ne peut pas dépasser 86 400."),
  numero: z.string().trim().max(40, "40 caractères au maximum.").optional().default(""),
  pole: z
    .enum(["restaurant", "mini_golf", "aquatique"], {
      error: "pole doit valoir restaurant, mini_golf ou aquatique (ou être omis).",
    })
    .nullish(),
  issue: z.enum(ISSUES, {
    error: "issue doit valoir renseigne, reservation, transfere ou message_laisse.",
  }),
  resume: textOptionnel(2_000),
  transcription: textOptionnel(50_000),
  metadonnees: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .refine((m) => JSON.stringify(m).length <= 10_000, "metadonnees dépasse 10 000 caractères."),
});
export type CallEvent = z.infer<typeof callEventSchema>;

/** Enregistre un appel. Un même `id_externe` renvoyé deux fois n'est enregistré qu'une fois. */
export async function enregistrerAppel(admin: Admin, e: CallEvent): Promise<WebhookOutcome> {
  const debut = Date.parse(e.debut);
  if (debut > Date.now() + DAY_MS)
    return reply(400, {
      error: "Corps invalide.",
      details: [{ champ: "debut", message: "La date de début est dans le futur." }],
    });

  let poleId: number | null = null;
  if (e.pole) {
    const { data: pole } = await admin
      .from("poles")
      .select("id")
      .eq("code", e.pole)
      .eq("actif", true)
      .maybeSingle();
    if (!pole)
      return reply(400, {
        error: "Pôle inconnu ou inactif.",
        details: [{ champ: "pole", message: e.pole }],
      });
    poleId = pole.id;
  }

  const { data, error } = await admin
    .from("appels_ia")
    .insert({
      id_externe: e.id_externe,
      debut: new Date(debut).toISOString(),
      duree_secondes: e.duree_secondes,
      numero_masque: masquerNumero(e.numero),
      numero_hash: empreinteNumero(e.numero, process.env.PHONE_HASH_SECRET ?? ""),
      pole_id: poleId,
      issue: e.issue,
      resume: e.resume,
      transcription: e.transcription,
      metadonnees: e.metadonnees as Json,
    })
    .select("id")
    .single();
  if (error?.code === "23505")
    return reply(200, { doublon: true, message: "Appel déjà enregistré." });
  if (error) throw error;
  return reply(200, { appelId: data.id, numero: masquerNumero(e.numero) });
}
