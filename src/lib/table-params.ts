export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type SearchParams = Record<string, string | string[] | undefined>;

/** Première valeur d'un paramètre d'URL (Next peut fournir un tableau si le paramètre est répété). */
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePaging(params: SearchParams) {
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  const requested = Number(first(params.taille));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(requested)
    ? requested
    : DEFAULT_PAGE_SIZE;
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

/** Retire les caractères qui casseraient la syntaxe des filtres PostgREST (virgules, parenthèses, jokers). */
export function sanitizeSearch(value: string | undefined): string {
  return (value ?? "")
    .replace(/[,()%*\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Valeur d'un paramètre si elle fait partie de la liste autorisée. */
export function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((a) => a === value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidOrUndefined = (value: string | undefined) =>
  value && UUID.test(value) ? value : undefined;
export const dateOrUndefined = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : undefined;
