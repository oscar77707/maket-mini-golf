import { createHmac } from "node:crypto";

/** Chiffres seuls, avec le préfixe international ramené à « + » (0033… et +33… sont équivalents). */
function chiffres(numero: string) {
  const compact = numero.trim().replace(/[^\d+]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  return { international: international.startsWith("+"), digits: international.replace(/\D/g, "") };
}

/** Numéro normalisé (E.164 sans espaces) ; les numéros français à 10 chiffres passent en +33. */
export function normaliserNumero(numero: string): string | null {
  const { international, digits } = chiffres(numero);
  if (digits.length < 6) return null;
  if (international) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+33${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Numéro affiché dans le journal : jamais en clair. Français : « 06 •• •• •• 42 ».
 * Autre pays : « +•• •• •• •• 42 ». Numéro absent ou masqué par l'appelant : « Numéro masqué ».
 */
export function masquerNumero(numero: string): string {
  const normalise = normaliserNumero(numero);
  if (!normalise) return "Numéro masqué";
  const fin = normalise.slice(-2);
  if (normalise.startsWith("+33") && normalise.length === 12) {
    return `0${normalise[3]} •• •• •• ${fin}`;
  }
  return `+•• •• •• •• ${fin}`;
}

/** Empreinte HMAC du numéro normalisé : permet de regrouper les appels d'un même numéro sans le conserver. */
export function empreinteNumero(numero: string, secret: string): string | null {
  const normalise = normaliserNumero(numero);
  if (!normalise || !secret) return null;
  return createHmac("sha256", secret).update(normalise).digest("hex");
}
