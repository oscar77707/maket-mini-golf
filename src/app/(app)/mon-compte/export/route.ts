import { exportDonneesResponse } from "@/features/parametres/export";
import { getCurrentUser } from "@/lib/auth/session";

/** Téléchargement de ses propres données personnelles (RGPD). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Session expirée.", { status: 401 });
  return exportDonneesResponse(user.profile.id);
}
