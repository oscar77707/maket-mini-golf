import "server-only";
import { z } from "zod";
import { addDays, todayParis } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/types/database";

type Admin = ReturnType<typeof createAdminClient>;

export type WebhookOutcome = { status: 200 | 400 | 404 | 409; body: Record<string, unknown> };
const reply = (
  status: WebhookOutcome["status"],
  body: Record<string, unknown>,
): WebhookOutcome => ({
  status,
  body,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.");

const draftCreate = z
  .object({
    evenement: z.literal("draft.create"),
    pole: z.enum(["restaurant", "mini_golf", "aquatique"], {
      error: "pole doit valoir restaurant, mini_golf ou aquatique.",
    }),
    fournisseurId: z.uuid().optional(),
    fournisseur: z.string().trim().min(1).max(120).optional(),
    date_livraison_prevue: isoDate.optional(),
    commentaire: z.string().trim().max(500).optional(),
    lignes: z
      .array(
        z.object({
          produitId: z.uuid().optional(),
          produit: z.string().trim().min(1).max(120).optional(),
          quantite: z.number().positive("quantite doit être positive.").max(1_000_000),
          prix_unitaire_ht: z.number().min(0).max(1_000_000).optional(),
        }),
      )
      .min(1, "Au moins une ligne est nécessaire.")
      .max(200, "200 lignes au maximum."),
  })
  .refine((v) => v.fournisseurId || v.fournisseur, {
    message: "Indiquez fournisseurId ou fournisseur.",
    path: ["fournisseur"],
  })
  .refine((v) => v.lignes.every((l) => l.produitId || l.produit), {
    message: "Chaque ligne doit indiquer produitId ou produit.",
    path: ["lignes"],
  });

/** Statuts que n8n peut poser. « livree » est refusé : la réception se pointe dans l'application (stock). */
const STATUTS_N8N = ["confirmee", "en_retard", "annulee"] as const;

const statusUpdate = z
  .object({
    evenement: z.literal("status.update"),
    commandeId: z.uuid().optional(),
    reference: z
      .string()
      .trim()
      .regex(/^(CMD-)?\d{1,9}$/i, "reference attendue sous la forme CMD-000123.")
      .optional(),
    statut: z.string().optional(),
    date_livraison_prevue: isoDate.optional(),
    motif: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.commandeId || v.reference, {
    message: "Indiquez commandeId ou reference.",
    path: ["commandeId"],
  })
  .refine((v) => v.statut || v.date_livraison_prevue, {
    message: "Indiquez statut et/ou date_livraison_prevue.",
    path: ["statut"],
  });

export const orderEventSchema = z.discriminatedUnion("evenement", [draftCreate, statusUpdate], {
  error: "evenement doit valoir draft.create ou status.update.",
});
export type OrderEvent = z.infer<typeof orderEventSchema>;

export const issuesOf = (error: z.ZodError) =>
  error.issues.map((i) => ({ champ: i.path.join(".") || "corps", message: i.message }));

const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

async function creerBrouillon(
  admin: Admin,
  e: z.infer<typeof draftCreate>,
): Promise<WebhookOutcome> {
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

  const fournisseurs = await admin
    .from("fournisseurs")
    .select("id, nom, delai_livraison_jours")
    .eq("actif", true);
  const fournisseur = (fournisseurs.data ?? []).find((f) =>
    e.fournisseurId
      ? f.id === e.fournisseurId
      : normalise(f.nom) === normalise(e.fournisseur ?? ""),
  );
  if (!fournisseur)
    return reply(400, {
      error: "Fournisseur introuvable ou désactivé.",
      details: [{ champ: "fournisseur", message: e.fournisseurId ?? e.fournisseur ?? "" }],
    });

  const [produits, liens] = await Promise.all([
    admin
      .from("produits")
      .select("id, nom, prix_achat_ht")
      .eq("pole_id", pole.id)
      .eq("actif", true)
      .limit(5000),
    admin
      .from("fournisseur_produits")
      .select("produit_id, prix_ht")
      .eq("fournisseur_id", fournisseur.id),
  ]);
  const lienPrix = new Map((liens.data ?? []).map((l) => [l.produit_id, l.prix_ht]));

  const details: { champ: string; message: string }[] = [];
  const lignes = new Map<string, { produit_id: string; quantite: number; prix: number }>();
  e.lignes.forEach((l, i) => {
    const produit = (produits.data ?? []).find((p) =>
      l.produitId ? p.id === l.produitId : normalise(p.nom) === normalise(l.produit ?? ""),
    );
    if (!produit) {
      details.push({
        champ: `lignes.${i}`,
        message: `Produit introuvable dans ce pôle : ${l.produitId ?? l.produit}.`,
      });
      return;
    }
    const prix = l.prix_unitaire_ht ?? lienPrix.get(produit.id) ?? produit.prix_achat_ht;
    const existante = lignes.get(produit.id);
    lignes.set(produit.id, {
      produit_id: produit.id,
      quantite: (existante?.quantite ?? 0) + l.quantite,
      prix,
    });
  });
  if (details.length) return reply(400, { error: "Certaines lignes sont invalides.", details });

  const { data: commande, error } = await admin
    .from("commandes")
    .insert({
      fournisseur_id: fournisseur.id,
      pole_id: pole.id,
      origine: "n8n",
      commentaire: e.commentaire ?? null,
      date_livraison_prevue:
        e.date_livraison_prevue ?? addDays(todayParis(), fournisseur.delai_livraison_jours),
    })
    .select("id, numero")
    .single();
  if (error)
    return reply(400, {
      error: "Création impossible.",
      details: [{ champ: "corps", message: error.message }],
    });

  const { error: e2 } = await admin.from("commande_lignes").insert(
    [...lignes.values()].map((l) => ({
      commande_id: commande.id,
      produit_id: l.produit_id,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix,
    })),
  );
  if (e2) {
    await admin.from("commandes").delete().eq("id", commande.id);
    return reply(400, {
      error: "Création impossible.",
      details: [{ champ: "lignes", message: e2.message }],
    });
  }
  return reply(200, {
    commandeId: commande.id,
    reference: `CMD-${String(commande.numero).padStart(6, "0")}`,
    statut: "brouillon",
    lignes: lignes.size,
  });
}

async function majStatut(admin: Admin, e: z.infer<typeof statusUpdate>): Promise<WebhookOutcome> {
  if (e.statut && !(STATUTS_N8N as readonly string[]).includes(e.statut)) {
    return reply(400, {
      error:
        e.statut === "livree"
          ? "La livraison se pointe dans l'application (elle met le stock à jour) : n8n ne peut pas la poser."
          : "Statut non autorisé pour n8n.",
      details: [{ champ: "statut", message: `Valeurs acceptées : ${STATUTS_N8N.join(", ")}.` }],
    });
  }
  if (e.statut === "annulee" && !e.motif)
    return reply(400, {
      error: "Un motif est obligatoire pour annuler.",
      details: [{ champ: "motif", message: "Obligatoire." }],
    });

  let query = admin.from("commandes").select("id, statut, numero");
  if (e.commandeId) query = query.eq("id", e.commandeId);
  else query = query.eq("numero", Number(e.reference!.replace(/^CMD-/i, "")));
  const { data: commande } = await query.maybeSingle();
  if (!commande) return reply(404, { error: "Commande introuvable." });

  const patch: TablesUpdate<"commandes"> = {};
  if (e.statut) patch.statut = e.statut as (typeof STATUTS_N8N)[number];
  if (e.statut === "annulee") patch.motif_annulation = e.motif;
  if (e.date_livraison_prevue) patch.date_livraison_prevue = e.date_livraison_prevue;
  const { error } = await admin.from("commandes").update(patch).eq("id", commande.id);
  if (error) {
    // Transition refusée par le trigger de statuts (message français) ou valeur invalide.
    return reply(409, { error: error.message, statut_actuel: commande.statut });
  }
  return reply(200, {
    commandeId: commande.id,
    reference: `CMD-${String(commande.numero).padStart(6, "0")}`,
    statut: e.statut ?? commande.statut,
  });
}

export function traiterEvenement(admin: Admin, event: OrderEvent): Promise<WebhookOutcome> {
  return event.evenement === "draft.create"
    ? creerBrouillon(admin, event)
    : majStatut(admin, event);
}
