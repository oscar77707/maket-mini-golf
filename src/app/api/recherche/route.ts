import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rechercher } from "@/features/quick-add/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recherche de la palette Ctrl/⌘ K. Réservée aux personnes connectées ; les droits viennent de la RLS. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Session expirée." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const resultats = await rechercher(user.profile.role, q);
    return NextResponse.json(resultats, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "La recherche a échoué." }, { status: 500 });
  }
}
