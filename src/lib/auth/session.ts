import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Pole, Profile, Role } from "@/types/models";

export type CurrentUser = { profile: Profile; pole: Pole | null };

/** Profil de l'utilisateur connecté (mis en cache pour la durée de la requête), ou null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || !profile.actif) return null;

  let pole: Pole | null = null;
  if (profile.pole_id !== null) {
    const { data } = await supabase
      .from("poles")
      .select("*")
      .eq("id", profile.pole_id)
      .maybeSingle();
    pole = data;
  }
  return { profile, pole };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // Le proxy a déjà écarté les visiteurs anonymes : ici la session est terminée ou le compte désactivé.
  if (!user) redirect("/auth/acces-impossible");
  return user;
}

/** Réserve une page à certains rôles ; les autres sont renvoyés vers /acces-refuse. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.profile.role)) redirect("/acces-refuse");
  return user;
}
