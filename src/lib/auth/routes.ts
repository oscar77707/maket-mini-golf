import type { Role } from "@/types/models";

const PUBLIC_PATHS = [
  "/connexion",
  "/mot-de-passe-oublie",
  "/reinitialiser",
  "/auth/callback",
  "/auth/acces-impossible",
  "/api/webhooks",
];

/** Routes appelées par n8n : elles s'authentifient elles-mêmes (jeton + signature), sans session. */
export const isWebhookPath = (pathname: string) =>
  pathname === "/api/webhooks" || pathname.startsWith("/api/webhooks/");

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Page d'accueil après connexion : le gérant arrive sur le tableau de bord, les autres sur les stocks. */
export function homePathFor(role: Role) {
  return role === "gerant" ? "/tableau-de-bord" : "/stocks";
}

/** N'accepte que des chemins internes pour éviter les redirections ouvertes. */
export function safeRedirect(target: string | null | undefined, fallback = "/") {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }
  return target;
}
