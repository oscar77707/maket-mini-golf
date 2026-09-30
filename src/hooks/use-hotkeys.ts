"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const CLE_PREFERENCE = "palmeraie:touches-simples";
const EVENEMENT = "palmeraie:touches-simples";

/** Les touches à une lettre (N, /, ?, G…) peuvent être coupées par chaque personne (accessibilité). */
export function touchesSimplesActives() {
  try {
    return window.localStorage.getItem(CLE_PREFERENCE) !== "non";
  } catch {
    return true;
  }
}

export function reglerTouchesSimples(actif: boolean) {
  try {
    if (actif) window.localStorage.removeItem(CLE_PREFERENCE);
    else window.localStorage.setItem(CLE_PREFERENCE, "non");
  } catch {
    /* stockage refusé : le réglage ne dure que le temps de la page */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function useTouchesSimples() {
  return useSyncExternalStore(
    (notifier) => {
      window.addEventListener(EVENEMENT, notifier);
      window.addEventListener("storage", notifier);
      return () => {
        window.removeEventListener(EVENEMENT, notifier);
        window.removeEventListener("storage", notifier);
      };
    },
    touchesSimplesActives,
    () => true,
  );
}

/** Vrai quand la frappe part d'un champ de saisie : les raccourcis à une lettre doivent alors se taire. */
export function estChampDeSaisie(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Une fenêtre, un tiroir ou un menu est ouvert : la page derrière ne doit pas réagir au clavier. */
export function fenetreOuverte() {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]');
}

export type Raccourcis = {
  /** Ctrl ou ⌘ + K, même dans un champ de saisie. */
  palette: () => void;
  /** Touches simples (sans modificateur), hors champ de saisie et hors fenêtre ouverte. */
  touches: Record<string, () => void>;
  /** « G puis … » : touche suivante → action ; `debut` prévient l'interface qu'une suite est attendue. */
  aller: Record<string, () => void>;
  debut?: (attente: boolean) => void;
};

const DELAI_SUITE_MS = 1500;

/**
 * Raccourcis clavier globaux. Les touches sont lues par leur caractère (`event.key`), pas par leur
 * position : « / » et « ? » fonctionnent sur un clavier AZERTY comme sur un QWERTY.
 */
export function useHotkeys(raccourcis: Raccourcis) {
  const ref = useRef(raccourcis);
  useEffect(() => {
    ref.current = raccourcis;
  });

  useEffect(() => {
    let suite: ReturnType<typeof setTimeout> | undefined;
    const finSuite = () => {
      clearTimeout(suite);
      suite = undefined;
      ref.current.debut?.(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      const cle = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if ((e.metaKey || e.ctrlKey) && !e.altKey && cle === "k") {
        e.preventDefault(); // évite la barre de recherche du navigateur
        finSuite();
        ref.current.palette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Échap dans un champ de recherche rend le clavier à la page (N, G…) sans vider la recherche
      if (
        cle === "Escape" &&
        e.target instanceof HTMLInputElement &&
        e.target.type === "search" &&
        !fenetreOuverte()
      ) {
        e.preventDefault(); // sans cela le navigateur vide le champ de recherche
        e.target.blur();
        return;
      }
      if (!touchesSimplesActives()) return;
      if (estChampDeSaisie(e.target) || fenetreOuverte()) {
        if (suite) finSuite();
        return;
      }

      if (suite) {
        const action = ref.current.aller[cle];
        finSuite();
        if (action) {
          e.preventDefault();
          action();
        }
        return;
      }
      if (cle === "g" && !e.shiftKey) {
        e.preventDefault();
        ref.current.debut?.(true);
        suite = setTimeout(finSuite, DELAI_SUITE_MS);
        return;
      }
      const action = ref.current.touches[cle];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(suite);
    };
  }, []);
}
