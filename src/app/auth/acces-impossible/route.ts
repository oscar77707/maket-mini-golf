import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Termine la session d'un compte désactivé (ou expiré) puis renvoie vers la connexion. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/connexion?erreur=acces-impossible", request.nextUrl.origin));
}
