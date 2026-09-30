import { z } from "zod";
import { exportDonneesResponse } from "@/features/parametres/export";
import { getCurrentUser } from "@/lib/auth/session";

/** Téléchargement du fichier RGPD d'un compte (gérant uniquement). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Compte invalide.", { status: 400 });
  const user = await getCurrentUser();
  if (user?.profile.role !== "gerant") return new Response("Accès refusé.", { status: 403 });
  return exportDonneesResponse(id);
}
