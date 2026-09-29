"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { toFrenchMessage } from "@/lib/errors";
import { safeRedirect } from "@/lib/auth/routes";
import {
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  type ActionResult,
} from "./schemas";

export async function login(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !signIn.user) return { ok: false, message: toFrenchMessage(error) };

  // Un compte désactivé par le gérant ne doit pas entrer, même avec un mot de passe valide.
  const { data: profile } = await supabase.from("profiles").select("actif").eq("id", signIn.user.id).maybeSingle();
  if (!profile?.actif) {
    await supabase.auth.signOut();
    return { ok: false, message: "Ce compte est désactivé. Contactez le gérant." };
  }

  redirect(safeRedirect(parsed.data.redirection));
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const origin = (await headers()).get("origin") ?? publicEnv().NEXT_PUBLIC_APP_URL;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reinitialiser`,
  });
  // Seules les limites de débit sont signalées : ne jamais révéler si une adresse existe.
  if (error && error.code === "over_email_send_rate_limit") {
    return { ok: false, message: toFrenchMessage(error) };
  }
  return {
    ok: true,
    message: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.",
  };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, message: "Le lien a expiré. Demandez un nouvel e-mail de réinitialisation." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: toFrenchMessage(error) };

  redirect("/?mot-de-passe=modifie");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
