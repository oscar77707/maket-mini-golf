import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/routes";

/**
 * Reçoit le lien d'un e-mail Supabase, crée la session, puis redirige.
 * - `code` : réinitialisation de mot de passe demandée depuis l'application (flux PKCE) ;
 * - `token_hash` + `type` : invitation envoyée par le gérant (le serveur ne peut pas faire de PKCE ;
 *   le modèle d'e-mail Supabase pointe ici, voir README).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirect(searchParams.get("next"), "/");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && (type === "invite" || type === "recovery")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/connexion?erreur=lien-invalide`);
}
