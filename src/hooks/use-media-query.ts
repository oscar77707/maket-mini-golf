"use client";

import { useSyncExternalStore } from "react";

/** Suit une media query ; `serveur` est la valeur utilisée avant l'hydratation (rendu serveur). */
export function useMediaQuery(requete: string, serveur = false) {
  return useSyncExternalStore(
    (notifier) => {
      const mql = window.matchMedia(requete);
      mql.addEventListener("change", notifier);
      return () => mql.removeEventListener("change", notifier);
    },
    () => window.matchMedia(requete).matches,
    () => serveur,
  );
}
