import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { isPublicPath } from "@/lib/auth/routes";

/**
 * Rafraîchit la session Supabase et redirige les visiteurs non connectés vers /connexion.
 * Les utilisateurs connectés ne sont pas renvoyés ici : seul le profil (actif ou non) décide, côté page.
 */
export async function updateSession(request: NextRequest) {
  const env = publicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valide le jeton auprès de Supabase (getSession() ne suffit pas côté serveur).
  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!data.user && !isPublicPath(pathname)) {
    // une requête d'interface (fetch) reçoit une réponse JSON plutôt qu'une page de connexion
    if (pathname.startsWith("/api/"))
      return NextResponse.json({ message: "Session expirée." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("redirection", pathname);
    return NextResponse.redirect(url);
  }
  return response;
}
