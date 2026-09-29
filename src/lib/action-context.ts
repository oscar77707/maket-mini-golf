import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, type ServerResult } from "@/lib/server-result";
import type { Role } from "@/types/models";

export const DENIED = "Vous n'avez pas le droit d'effectuer cette action.";
export type Client = Awaited<ReturnType<typeof createClient>>;

/** Début de chaque Server Action : utilisateur connecté, rôle autorisé, client Supabase sous RLS. */
export async function context(
  ...roles: Role[]
): Promise<{ user: CurrentUser; supabase: Client } | ServerResult<never>> {
  const user = await getCurrentUser();
  if (!user) return fail("Votre session a expiré. Reconnectez-vous.");
  if (roles.length > 0 && !roles.includes(user.profile.role)) return fail(DENIED);
  return { user, supabase: await createClient() };
}

/** Vrai quand `context` a renvoyé un échec plutôt qu'un contexte utilisable. */
export const failed = (c: object): c is ServerResult<never> => "ok" in c;
