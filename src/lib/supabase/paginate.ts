type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;

/** PostgREST plafonne chaque réponse (1000 lignes par défaut sur Supabase) : on lit par paquets jusqu'à épuisement. */
export async function fetchAll<T>(
  page: (from: number, to: number) => Page<T>,
  max = 20_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Filtres `in (...)` : une liste trop longue dépasse la taille maximale d'URL, on découpe en paquets. */
export async function inChunks<T>(
  ids: string[],
  query: (chunk: string[]) => Page<T>,
  size = 150,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await query(ids.slice(i, i + size));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}
