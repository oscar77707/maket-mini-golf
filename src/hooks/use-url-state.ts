"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

/** État d'un tableau stocké dans l'URL : liens partageables, retour arrière fiable, rendu côté serveur. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Adresse demandée mais pas encore affichée : deux changements rapprochés (deux dates, par
  // exemple) partent de la même base au lieu de s'écraser pendant le rechargement du serveur.
  const demandee = useRef<string | null>(null);
  const courante = params.toString();

  // dès qu'aucun rechargement n'est en cours, l'adresse affichée fait foi
  useEffect(() => {
    if (!pending) demandee.current = null;
  }, [courante, pending]);

  const update = useCallback(
    (changes: Record<string, string | null | undefined>, options: { keepPage?: boolean } = {}) => {
      const next = new URLSearchParams(demandee.current ?? courante);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (!options.keepPage) next.delete("page");
      const query = next.toString();
      demandee.current = query;
      startTransition(() =>
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
      );
    },
    [courante, pathname, router],
  );

  return { params, update, pending };
}
