"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context, failed } from "@/lib/action-context";
import { addDays, todayParis } from "@/lib/dates";
import { toFrenchMessage } from "@/lib/errors";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { getCommande } from "./queries";
import { postOrderToN8n, resolveOrderWebhookUrl } from "./n8n";
import {
  annulationSchema,
  commandeCreationSchema,
  commandeInfoSchema,
  ligneCommandeSchema,
  receptionSchema,
  type OrderSendPayload,
} from "./schemas";

const EDITABLES = ["brouillon", "a_valider"] as const;
const ANNULABLES = ["brouillon", "a_valider", "envoyee", "confirmee", "en_retard"] as const;
const RECEPTIONNABLES = ["envoyee", "confirmee", "en_retard"] as const;
const uuid = z.uuid("Commande invalide.");

const refresh = () => {
  revalidatePath("/commandes", "layout");
  revalidatePath("/stocks", "layout");
  revalidatePath("/fournisseurs", "layout");
};

// -----------------------------------------------------------------------------------------------
// Création, duplication, modification
// -----------------------------------------------------------------------------------------------
export async function creerCommande(input: unknown): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = commandeCreationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = ctx;

  const poleId =
    user.profile.role === "gerant"
      ? parsed.data.pole_id
      : (user.profile.pole_id ?? parsed.data.pole_id);
  const { data: fournisseur, error: e1 } = await supabase
    .from("fournisseurs")
    .select("actif, delai_livraison_jours")
    .eq("id", parsed.data.fournisseur_id)
    .maybeSingle();
  if (e1) return fail(toFrenchMessage(e1));
  if (!fournisseur) return fail("Fournisseur introuvable.");
  if (!fournisseur.actif) return fail("Ce fournisseur est désactivé.");

  const { data, error } = await supabase
    .from("commandes")
    .insert({
      fournisseur_id: parsed.data.fournisseur_id,
      pole_id: poleId,
      date_livraison_prevue:
        parsed.data.date_livraison_prevue ??
        addDays(todayParis(), fournisseur.delai_livraison_jours),
      commentaire: parsed.data.commentaire,
    })
    .select("id")
    .single();
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok({ id: data.id }, "Commande créée en brouillon.");
}

export async function dupliquerCommande(id: string): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(id).success) return fail("Commande invalide.");
  const { data, error } = await ctx.supabase.rpc("dupliquer_commande", { p_commande_id: id });
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok({ id: data }, "Commande dupliquée en brouillon avec les prix actuels.");
}

/** « Dupliquer la dernière commande » depuis la fiche d'un fournisseur. */
export async function dupliquerDerniereCommande(
  fournisseurId: string,
): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(fournisseurId).success) return fail("Fournisseur invalide.");
  const { data: last, error } = await ctx.supabase
    .from("commandes")
    .select("id")
    .eq("fournisseur_id", fournisseurId)
    .neq("statut", "annulee")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fail(toFrenchMessage(error));
  if (!last) return fail("Aucune commande à dupliquer pour ce fournisseur.");
  return dupliquerCommande(last.id);
}

export async function updateCommandeInfo(id: string, input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(id).success) return fail("Commande invalide.");
  const parsed = commandeInfoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await ctx.supabase
    .from("commandes")
    .update(parsed.data)
    .eq("id", id)
    .in("statut", [...EDITABLES])
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Cette commande n'est plus modifiable.");
  refresh();
  return ok(null, "Commande mise à jour.");
}

// -----------------------------------------------------------------------------------------------
// Lignes
// -----------------------------------------------------------------------------------------------
export async function saveLigne(input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = ligneCommandeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data: commande, error: e1 } = await ctx.supabase
    .from("commandes")
    .select("statut")
    .eq("id", parsed.data.commande_id)
    .maybeSingle();
  if (e1) return fail(toFrenchMessage(e1));
  if (!commande) return fail("Commande introuvable.");
  if (!(EDITABLES as readonly string[]).includes(commande.statut))
    return fail("Cette commande n'est plus modifiable.");

  const { error } = await ctx.supabase
    .from("commande_lignes")
    .upsert(parsed.data, { onConflict: "commande_id,produit_id" });
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok(null);
}

export async function removeLigne(ligneId: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(ligneId).success) return fail("Ligne invalide.");
  const { data, error } = await ctx.supabase
    .from("commande_lignes")
    .delete()
    .eq("id", ligneId)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Cette ligne n'existe plus ou la commande n'est plus modifiable.");
  refresh();
  return ok(null, "Ligne retirée.");
}

// -----------------------------------------------------------------------------------------------
// Statuts
// -----------------------------------------------------------------------------------------------
async function changerStatut(
  id: string,
  from: readonly string[],
  to: string,
  message: string,
  refused: string,
  extra: Record<string, unknown> = {},
): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(id).success) return fail("Commande invalide.");
  const { data, error } = await ctx.supabase
    .from("commandes")
    .update({ statut: to as never, ...extra })
    .eq("id", id)
    .in("statut", [...from] as never[])
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail(refused);
  refresh();
  return ok(null, message);
}

export async function soumettreCommande(id: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(id).success) return fail("Commande invalide.");
  const { count, error } = await ctx.supabase
    .from("commande_lignes")
    .select("id", { count: "exact", head: true })
    .eq("commande_id", id);
  if (error) return fail(toFrenchMessage(error));
  if (!count) return fail("Ajoutez au moins une ligne avant de soumettre la commande.");
  return changerStatut(
    id,
    ["brouillon"],
    "a_valider",
    "Commande soumise : le gérant peut maintenant la valider.",
    "Cette commande a déjà été soumise ou envoyée.",
  );
}

export async function repasserEnBrouillon(id: string): Promise<ServerResult<null>> {
  return changerStatut(
    id,
    ["a_valider"],
    "brouillon",
    "Commande repassée en brouillon.",
    "Cette commande n'est plus à valider.",
  );
}

export async function marquerConfirmee(id: string): Promise<ServerResult<null>> {
  return changerStatut(
    id,
    ["envoyee", "en_retard"],
    "confirmee",
    "Commande marquée comme confirmée par le fournisseur.",
    "Cette commande ne peut plus être marquée comme confirmée.",
  );
}

export async function cloturerCommande(id: string): Promise<ServerResult<null>> {
  return changerStatut(
    id,
    ["livree"],
    "cloturee",
    "Commande clôturée.",
    "Seule une commande livrée peut être clôturée.",
  );
}

export async function annulerCommande(input: unknown): Promise<ServerResult<null>> {
  const parsed = annulationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return changerStatut(
    parsed.data.id,
    ANNULABLES,
    "annulee",
    "Commande annulée.",
    "Cette commande ne peut plus être annulée.",
    { motif_annulation: parsed.data.motif },
  );
}

export async function supprimerBrouillon(id: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(id).success) return fail("Commande invalide.");
  const { data, error } = await ctx.supabase
    .from("commandes")
    .delete()
    .eq("id", id)
    .eq("statut", "brouillon")
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Seul un brouillon peut être supprimé.");
  refresh();
  return ok(null, "Brouillon supprimé.");
}

/** « Valider et envoyer » : réservé au gérant. La commande n'est « envoyée » que si n8n répond 2xx. */
export async function envoyerCommande(id: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(id).success) return fail("Commande invalide.");
  const { supabase } = ctx;

  const detail = await getCommande(id);
  if (!detail) return fail("Commande introuvable.");
  const { commande, fournisseur, lignes } = detail;
  if (!(EDITABLES as readonly string[]).includes(commande.statut))
    return fail("Cette commande a déjà été envoyée ou n'est plus à envoyer.");
  if (lignes.length === 0) return fail("Ajoutez au moins une ligne avant d'envoyer la commande.");
  if (!fournisseur.actif) return fail("Ce fournisseur est désactivé.");

  const url = await resolveOrderWebhookUrl(supabase);
  if (!url)
    return fail(
      "Aucun webhook n8n n'est configuré : renseignez N8N_WEBHOOK_ORDER_SEND (ou l'adresse dans les paramètres).",
    );

  // Le gérant valide : si l'envoi échoue, la commande reste « à valider » et peut être renvoyée.
  if (commande.statut === "brouillon") {
    const { error } = await supabase
      .from("commandes")
      .update({ statut: "a_valider" })
      .eq("id", id)
      .eq("statut", "brouillon");
    if (error) return fail(toFrenchMessage(error));
  }

  const { data: pole } = await supabase
    .from("poles")
    .select("code, nom")
    .eq("id", commande.pole_id)
    .single();
  const payload: OrderSendPayload = {
    evenement: "order.send",
    commandeId: commande.id,
    reference: commande.reference,
    pole: { code: pole?.code ?? "", nom: pole?.nom ?? "" },
    fournisseur: {
      id: fournisseur.id,
      nom: fournisseur.nom,
      mode_commande: fournisseur.mode_commande,
      email: fournisseur.email,
      telephone: fournisseur.telephone,
      url_portail: fournisseur.url_portail,
      contact_nom: fournisseur.contact_nom,
    },
    date_livraison_prevue: commande.date_livraison_prevue,
    commentaire: commande.commentaire,
    total_ht: commande.montant_ht,
    lignes: lignes.map((l) => ({
      produit_id: l.produit_id,
      produit: l.produit_nom,
      reference_fournisseur: l.reference_fournisseur,
      unite: l.unite,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      montant_ht: l.montant_ht ?? Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
    })),
  };

  const sent = await postOrderToN8n(url, payload);
  await supabase
    .from("webhooks_n8n")
    .update({
      derniere_utilisation: new Date().toISOString(),
      dernier_statut_http: sent.ok ? sent.status : (sent.status ?? 0),
    })
    .eq("cle", "order_send");

  if (!sent.ok) {
    await supabase.from("commandes").update({ derniere_erreur_envoi: sent.message }).eq("id", id);
    refresh();
    return fail(`L'envoi a échoué : ${sent.message} La commande reste à valider, réessayez.`);
  }

  const { data, error } = await supabase
    .from("commandes")
    .update({ statut: "envoyee", derniere_erreur_envoi: null })
    .eq("id", id)
    .in("statut", [...EDITABLES])
    .select("id");
  if (error || !data?.length)
    return fail(
      "La commande a bien été transmise à n8n, mais son statut n'a pas pu être mis à jour. Actualisez la page avant de renvoyer.",
    );
  refresh();
  return ok(null, `Commande ${commande.reference} envoyée à ${fournisseur.nom}.`);
}

// -----------------------------------------------------------------------------------------------
// Réception de livraison
// -----------------------------------------------------------------------------------------------
/** Ouvre le pointage : crée la livraison avec toutes les lignes reçues « comme commandées ». */
export async function demarrerReception(commandeId: string): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!uuid.safeParse(commandeId).success) return fail("Commande invalide.");
  const { supabase } = ctx;

  const { data: commande, error: e0 } = await supabase
    .from("commandes")
    .select("statut")
    .eq("id", commandeId)
    .maybeSingle();
  if (e0) return fail(toFrenchMessage(e0));
  if (!commande) return fail("Commande introuvable.");
  if (!(RECEPTIONNABLES as readonly string[]).includes(commande.statut))
    return fail("Cette commande ne peut pas être réceptionnée : elle doit d'abord être envoyée.");

  const { data: existante, error: e1 } = await supabase
    .from("livraisons")
    .select("id")
    .eq("commande_id", commandeId)
    .eq("statut", "en_cours")
    .limit(1)
    .maybeSingle();
  if (e1) return fail(toFrenchMessage(e1));
  if (existante) return ok({ id: existante.id });

  const { data: livraison, error: e2 } = await supabase
    .from("livraisons")
    .insert({ commande_id: commandeId } as never)
    .select("id")
    .single();
  if (e2) return fail(toFrenchMessage(e2));

  const { data: lignes, error: e3 } = await supabase
    .from("commande_lignes")
    .select("id, produit_id, quantite, prix_unitaire_ht")
    .eq("commande_id", commandeId);
  if (e3) return fail(toFrenchMessage(e3));
  const { error: e4 } = await supabase.from("livraison_lignes").insert(
    (lignes ?? []).map((l) => ({
      livraison_id: livraison.id,
      commande_ligne_id: l.id,
      produit_id: l.produit_id,
      quantite_commandee: l.quantite,
      quantite_recue: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
    })),
  );
  if (e4) {
    await supabase.from("livraisons").delete().eq("id", livraison.id);
    return fail(toFrenchMessage(e4));
  }
  refresh();
  return ok({ id: livraison.id });
}

/** Enregistre le pointage ; avec `valider`, entre les quantités reçues en stock (fonction SQL valider_livraison). */
export async function enregistrerReception(
  input: unknown,
): Promise<ServerResult<{ commandeId: string; conforme: boolean | null }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = receptionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = ctx;
  const v = parsed.data;

  const { data: livraison, error: e1 } = await supabase
    .from("livraisons")
    .select("id, commande_id, statut")
    .eq("id", v.livraison_id)
    .maybeSingle();
  if (e1) return fail(toFrenchMessage(e1));
  if (!livraison) return fail("Livraison introuvable.");
  if (livraison.statut === "validee") return fail("Cette livraison est déjà validée.");

  const { data: existantes, error: e2 } = await supabase
    .from("livraison_lignes")
    .select("id, produit_id, quantite_commandee")
    .eq("livraison_id", v.livraison_id);
  if (e2) return fail(toFrenchMessage(e2));
  const byId = new Map((existantes ?? []).map((l) => [l.id, l]));
  if (v.lignes.some((l) => !byId.has(l.id)))
    return fail("Une ligne ne fait pas partie de cette livraison.");

  if (v.valider) {
    const { data: produits } = await supabase
      .from("produits")
      .select("id, nom, suivi_dlc")
      .in(
        "id",
        (existantes ?? []).map((l) => l.produit_id),
      );
    const info = new Map((produits ?? []).map((p) => [p.id, p]));
    const today = todayParis();
    const errors: Record<string, string> = {};
    v.lignes.forEach((l, i) => {
      const base = byId.get(l.id)!;
      const p = info.get(base.produit_id);
      if (l.quantite_recue !== Number(base.quantite_commandee) && !l.motif_ecart)
        errors[`lignes.${i}.motif_ecart`] = "Indiquez le motif de l'écart.";
      if (p?.suivi_dlc && l.quantite_recue > 0 && !l.dlc)
        errors[`lignes.${i}.dlc`] = "La DLC est obligatoire pour ce produit.";
      if (l.dlc && l.dlc < today) errors[`lignes.${i}.dlc`] = "Cette DLC est déjà dépassée.";
    });
    const keys = Object.keys(errors);
    if (keys.length)
      return fail(
        `${keys.length} ligne${keys.length > 1 ? "s" : ""} à compléter avant de valider la livraison.`,
        errors,
      );
  }

  const results = await Promise.all(
    v.lignes.map((l) =>
      supabase
        .from("livraison_lignes")
        .update({
          quantite_recue: l.quantite_recue,
          prix_unitaire_ht: l.prix_unitaire_ht,
          motif_ecart: l.motif_ecart,
          dlc: l.dlc,
          numero_lot: l.numero_lot,
        })
        .eq("id", l.id)
        .eq("livraison_id", v.livraison_id),
    ),
  );
  const lineError = results.find((r) => r.error)?.error;
  if (lineError) return fail(toFrenchMessage(lineError));
  const { error: e3 } = await supabase
    .from("livraisons")
    .update({ numero_bon_livraison: v.numero_bon_livraison, commentaire: v.commentaire })
    .eq("id", v.livraison_id);
  if (e3) return fail(toFrenchMessage(e3));

  if (!v.valider) {
    refresh();
    return ok({ commandeId: livraison.commande_id, conforme: null }, "Pointage enregistré.");
  }
  const { error: e4 } = await supabase.rpc("valider_livraison", { p_livraison_id: v.livraison_id });
  if (e4) return fail(toFrenchMessage(e4));
  const { data: apres } = await supabase
    .from("livraisons")
    .select("conforme")
    .eq("id", v.livraison_id)
    .single();
  refresh();
  return ok(
    { commandeId: livraison.commande_id, conforme: apres?.conforme ?? null },
    apres?.conforme
      ? "Livraison validée : le stock est à jour."
      : "Livraison validée avec écarts : le stock est à jour.",
  );
}
