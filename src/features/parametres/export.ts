import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Réponse de téléchargement du fichier JSON des données personnelles (RGPD) : le sien, ou celui d'un compte pour le gérant. */
export async function exportDonneesResponse(userId: string): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Session expirée.", { status: 401 });
  if (userId !== user.profile.id && user.profile.role !== "gerant")
    return new Response("Accès refusé.", { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exporter_donnees_utilisateur", { p_user_id: userId });
  if (error || !data) return new Response("Export impossible.", { status: 500 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="donnees-personnelles-${userId.slice(0, 8)}.json"`,
      "cache-control": "no-store",
    },
  });
}
