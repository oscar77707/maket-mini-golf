import "server-only";
import type { Client } from "@/lib/action-context";

/**
 * Inscrit au journal d'audit un événement qui ne passe pas par une table auditée (invitation, test de
 * webhook, logo...). Le journal ne doit jamais bloquer l'action elle-même : l'échec est seulement tracé.
 */
export async function journaliser(
  supabase: Client,
  action: string,
  table: string | null,
  cible: string | null,
  details: Record<string, string | number | boolean | null> = {},
) {
  const { error } = await supabase.rpc("journaliser_evenement", {
    p_action: action,
    p_table: table ?? "",
    p_cible: cible ?? "",
    p_details: details,
  });
  if (error) console.error("Journal d'audit : écriture impossible", error.message);
}
