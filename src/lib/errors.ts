/** Traduit les erreurs Supabase / Postgres / Auth en messages français compréhensibles. */
type ErrorLike = { code?: string; message?: string; status?: number };

const POSTGRES_MESSAGES: Record<string, string> = {
  "23505": "Cet élément existe déjà.",
  "23503": "Cet élément est encore utilisé ailleurs et ne peut pas être supprimé.",
  "23514": "Une valeur saisie n'est pas acceptable.",
  "23502": "Un champ obligatoire est vide.",
  "42501": "Vous n'avez pas le droit d'effectuer cette action.",
  PGRST301: "Votre session a expiré. Reconnectez-vous.",
};

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed: "Cette adresse e-mail n'a pas encore été confirmée.",
  user_banned: "Ce compte est désactivé. Contactez le gérant.",
  over_request_rate_limit: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  over_email_send_rate_limit: "Trop de demandes d'e-mail. Patientez quelques minutes avant de réessayer.",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  weak_password: "Ce mot de passe est trop faible. Utilisez au moins 8 caractères.",
  session_not_found: "Votre session a expiré. Reconnectez-vous.",
};

export const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

export function toFrenchMessage(error: unknown): string {
  if (!error || typeof error !== "object") return GENERIC_ERROR;
  const { code, message } = error as ErrorLike;
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (code && POSTGRES_MESSAGES[code]) return POSTGRES_MESSAGES[code];
  // Nos fonctions et triggers SQL lèvent déjà des messages en français (P0001, P0002, 22xxx...).
  if (message && /[àâçéèêëîïôûùüÿœ]|^(Impossible|Seul|Ce |Cet |La |Le |Les |Indiquez|Passage|Produit)/i.test(message)) {
    return message;
  }
  return GENERIC_ERROR;
}
