"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context, failed, type Client } from "@/lib/action-context";
import { journaliser } from "@/lib/audit";
import { toFrenchMessage } from "@/lib/errors";
import { publicEnv } from "@/lib/env";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PoleCode } from "@/types/models";
import { anonymisationSchema, invitationSchema, utilisateurSchema } from "./schemas";

const refresh = () => revalidatePath("/parametres/utilisateurs");

/** Un compte banni ne peut plus se connecter (100 ans) ; « none » lève le blocage. */
const BLOCAGE = "876000h";

async function poleId(supabase: Client, code: PoleCode | null): Promise<number | null> {
  if (!code) return null;
  const { data } = await supabase.from("poles").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

function invitationError(error: { code?: string; message?: string }): ServerResult<never> {
  if (error.code === "email_exists")
    return fail("Un compte existe déjà avec cette adresse e-mail.", {
      email: "Cette adresse est déjà utilisée.",
    });
  if (error.code === "over_email_send_rate_limit")
    return fail("Trop d'e-mails envoyés en peu de temps. Patientez quelques minutes.");
  if (error.code === "email_address_invalid" || error.code === "validation_failed")
    return fail("Cette adresse e-mail n'est pas acceptée.", { email: "Adresse invalide." });
  return fail(
    "L'invitation n'a pas pu être envoyée. Vérifiez la configuration e-mail de Supabase.",
  );
}

/** Adresse d'arrivée du lien d'invitation (le modèle d'e-mail ajoute le jeton et la page de destination). */
const redirectInvitation = () => `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback`;

/** Invite une personne : Supabase lui envoie un e-mail, elle choisit son mot de passe et arrive avec le rôle prévu. */
export async function inviteUtilisateur(input: unknown): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const { data: existant } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("email", v.email)
    .maybeSingle();
  if (existant)
    return fail("Un compte existe déjà avec cette adresse e-mail.", {
      email: "Cette adresse est déjà utilisée.",
    });
  const pole = v.role === "gerant" ? null : await poleId(ctx.supabase, v.pole);
  if (v.role !== "gerant" && pole === null)
    return fail("Pôle introuvable.", { pole: "Pôle inconnu." });

  // 1. Le compte est créé avec rôle et pôle dans app_metadata (que le navigateur ne peut pas écrire) :
  //    le déclencheur de la base en tire le profil. 2. L'e-mail d'invitation part ensuite.
  const admin = createAdminClient();
  const { data: cree, error: creationError } = await admin.auth.admin.createUser({
    email: v.email,
    email_confirm: false,
    app_metadata: { role: v.role, pole: v.role === "gerant" ? null : v.pole },
    user_metadata: { prenom: v.prenom, nom: v.nom },
  });
  if (creationError || !cree.user) return invitationError(creationError ?? {});
  const idCree = cree.user.id;

  const { error } = await admin.auth.admin.inviteUserByEmail(v.email, {
    redirectTo: redirectInvitation(),
  });
  if (error) {
    await admin.auth.admin.deleteUser(idCree); // pas de compte à moitié créé
    return invitationError(error);
  }

  // Le profil existe : on y ajoute le reste (et on vérifie rôle et pôle, sans quoi le compte aurait
  // de mauvais droits).
  const { data: profil, error: majError } = await admin
    .from("profiles")
    .update({
      role: v.role,
      pole_id: pole,
      saisonnier: v.saisonnier,
      fin_contrat: v.saisonnier ? v.fin_contrat : null,
      telephone: v.telephone,
    })
    .eq("id", idCree)
    .select("id")
    .maybeSingle();
  if (majError || !profil) {
    await admin.auth.admin.deleteUser(idCree);
    return fail("Le compte n'a pas pu être préparé. Réessayez dans un instant.");
  }
  await journaliser(ctx.supabase, "utilisateur.invitation", "profiles", idCree, {
    role: v.role,
    pole: v.pole,
  });
  refresh();
  return ok({ id: idCree }, `Invitation envoyée à ${v.email}.`);
}

/** Renvoie l'e-mail d'invitation (le lien expire au bout de 24 heures). */
export async function resendInvitation(userId: string): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(userId).success) return fail("Compte invalide.");
  const { data: attente, error: attenteError } = await ctx.supabase.rpc("invitations_en_attente");
  if (attenteError) return fail(toFrenchMessage(attenteError));
  if (!(attente as string[]).includes(userId))
    return fail("Cette personne s'est déjà connectée : il n'y a plus d'invitation à renvoyer.");
  const { data: profil } = await ctx.supabase
    .from("profiles")
    .select("email, prenom, nom, role, actif, anonymise_le")
    .eq("id", userId)
    .maybeSingle();
  if (!profil || !profil.actif || profil.anonymise_le)
    return fail("Compte introuvable ou désactivé.");

  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(profil.email, {
    redirectTo: redirectInvitation(),
  });
  if (error) return invitationError(error);
  await journaliser(ctx.supabase, "utilisateur.reinvitation", "profiles", userId);
  return ok(null, `Invitation renvoyée à ${profil.email}.`);
}

export async function updateUtilisateur(id: string, input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Compte invalide.");
  const parsed = utilisateurSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const { data: actuel } = await ctx.supabase
    .from("profiles")
    .select("role, anonymise_le")
    .eq("id", id)
    .maybeSingle();
  if (!actuel) return fail("Compte introuvable.");
  if (actuel.anonymise_le) return fail("Ce compte est anonymisé : il ne peut plus être modifié.");
  if (id === ctx.user.profile.id && v.role !== actuel.role)
    return fail("Vous ne pouvez pas modifier votre propre rôle.", {
      role: "Demandez à un autre gérant de le faire.",
    });
  const pole = v.role === "gerant" ? null : await poleId(ctx.supabase, v.pole);
  if (v.role !== "gerant" && pole === null)
    return fail("Pôle introuvable.", { pole: "Pôle inconnu." });

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      prenom: v.prenom,
      nom: v.nom,
      telephone: v.telephone,
      role: v.role,
      pole_id: pole,
      saisonnier: v.saisonnier,
      fin_contrat: v.saisonnier ? v.fin_contrat : null,
    })
    .eq("id", id);
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok(null, "Compte mis à jour.");
}

/** Désactive ou réactive un compte : profil marqué inactif et connexion bloquée côté Supabase Auth. */
export async function setUtilisateurActif(id: string, actif: boolean): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Compte invalide.");
  if (id === ctx.user.profile.id && !actif)
    return fail("Vous ne pouvez pas désactiver votre propre compte.");
  const { data: actuel } = await ctx.supabase
    .from("profiles")
    .select("anonymise_le")
    .eq("id", id)
    .maybeSingle();
  if (!actuel) return fail("Compte introuvable.");
  if (actuel.anonymise_le) return fail("Ce compte est anonymisé : il ne peut pas être réactivé.");

  const admin = createAdminClient();
  if (actif) {
    // on lève d'abord le blocage : un profil actif dont la connexion resterait bloquée serait trompeur
    const { error: deblocage } = await admin.auth.admin.updateUserById(id, {
      ban_duration: "none",
    });
    if (deblocage) return fail("Le compte n'a pas pu être réactivé. Réessayez dans un instant.");
  }
  const { error } = await ctx.supabase.from("profiles").update({ actif }).eq("id", id);
  if (error) return fail(toFrenchMessage(error));
  if (!actif) {
    const { error: blocage } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOCAGE });
    if (blocage) {
      await ctx.supabase.from("profiles").update({ actif: true }).eq("id", id);
      return fail("Le compte n'a pas pu être désactivé. Réessayez dans un instant.");
    }
  }
  refresh();
  return ok(
    null,
    actif ? "Compte réactivé." : "Compte désactivé : la personne ne peut plus se connecter.",
  );
}

/** RGPD : efface l'identité (nom, e-mail, téléphone) et bloque définitivement la connexion. L'historique métier reste, sans nom. */
export async function anonymiserUtilisateur(
  id: string,
  input: unknown,
): Promise<ServerResult<null>> {
  const ctx = await context("gerant");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Compte invalide.");
  const parsed = anonymisationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id === ctx.user.profile.id) return fail("Vous ne pouvez pas anonymiser votre propre compte.");

  const { error } = await ctx.supabase.rpc("anonymiser_utilisateur", { p_user_id: id });
  if (error) return fail(toFrenchMessage(error));
  // Auth garde sinon l'adresse réelle : on la remplace et on bloque la connexion.
  const { error: authError } = await createAdminClient().auth.admin.updateUserById(id, {
    email: `anonyme+${id}@palmeraie.invalid`,
    email_confirm: true,
    ban_duration: BLOCAGE,
  });
  refresh();
  if (authError)
    return fail(
      "Le profil est anonymisé mais le compte de connexion n'a pas pu être bloqué. Cliquez de nouveau sur « Anonymiser » pour réessayer.",
    );
  return ok(null, "Compte anonymisé : l'identité a été effacée.");
}
