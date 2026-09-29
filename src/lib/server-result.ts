import type { ZodError } from "zod";

/** Résultat commun des Server Actions : les erreurs sont des messages français prêts à afficher. */
export type ServerResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export const ok = <T = null>(data: T = null as T, message?: string): ServerResult<T> => ({
  ok: true,
  data,
  message,
});
export const fail = (
  message: string,
  fieldErrors?: Record<string, string>,
): ServerResult<never> => ({
  ok: false,
  message,
  fieldErrors,
});

/** Première erreur de chaque champ, indexée par nom de champ (pour l'afficher sous le champ). */
export function fieldErrorsOf(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function invalid(error: ZodError): ServerResult<never> {
  return fail(
    Object.values(fieldErrorsOf(error))[0] ?? "Certaines informations sont invalides.",
    fieldErrorsOf(error),
  );
}
