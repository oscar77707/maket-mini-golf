"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

const PREFIXE = "palmeraie:brouillon:";
const DUREE_MAX_MS = 24 * 3_600_000;
const PAUSE_MS = 400;

type Enveloppe = { le: number; valeurs: Record<string, unknown> };

/** Le stockage du navigateur peut être absent ou refusé (navigation privée) : on s'en passe sans erreur. */
function stockage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function lire(cle: string): Record<string, unknown> | null {
  try {
    const brut = stockage()?.getItem(cle);
    if (!brut) return null;
    const env = JSON.parse(brut) as Enveloppe;
    if (typeof env?.le !== "number" || Date.now() - env.le > DUREE_MAX_MS) {
      stockage()?.removeItem(cle);
      return null;
    }
    return env.valeurs && typeof env.valeurs === "object" ? env.valeurs : null;
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeurs: Record<string, unknown>) {
  try {
    stockage()?.setItem(cle, JSON.stringify({ le: Date.now(), valeurs } satisfies Enveloppe));
  } catch {
    /* stockage plein ou refusé : le brouillon est un confort, pas une donnée */
  }
}

function effacer(cle: string) {
  try {
    stockage()?.removeItem(cle);
  } catch {
    /* rien à faire */
  }
}

/** Supprime les brouillons périmés, et tous ceux de l'appareil quand `tous` est vrai (déconnexion). */
export function nettoyerBrouillons(tous = false) {
  const s = stockage();
  if (!s) return;
  try {
    const cles = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(
      (k): k is string => !!k && k.startsWith(PREFIXE),
    );
    for (const cle of cles) {
      if (tous) s.removeItem(cle);
      else lire(cle);
    }
  } catch {
    /* rien à faire */
  }
}

/**
 * Sauvegarde automatique d'un formulaire de création dans le navigateur de la personne.
 * - la clé contient l'identifiant de l'utilisateur : personne ne retrouve le brouillon d'un autre ;
 * - seuls les champs modifiés déclenchent une sauvegarde (un formulaire vierge n'écrit rien) ;
 * - un brouillon expire au bout de 24 h et disparaît à la déconnexion.
 * `clear()` après un enregistrement réussi ; `discard()` pour repartir d'une page blanche.
 */
export function useFormDraft<T extends FieldValues>(
  form: UseFormReturn<T, unknown, FieldValues>,
  { cle, utilisateurId, actif }: { cle: string; utilisateurId: string | null; actif: boolean },
) {
  const complete = utilisateurId && actif ? `${PREFIXE}${utilisateurId}:${cle}` : null;
  const [repris, setRepris] = useState(false);
  const { reset, getValues, subscribe } = form;
  const ignore = useRef(false);
  const modifie = useRef(false);
  const sale = useRef(false);

  // Reprise au premier affichage : les valeurs sont posées sans toucher aux valeurs par défaut,
  // le formulaire est donc « modifié » et le brouillon reste sauvegardé.
  useEffect(() => {
    if (!complete) return;
    const valeurs = lire(complete);
    if (!valeurs) return;
    reset({ ...getValues(), ...valeurs } as never, { keepDefaultValues: true });
    sale.current = true;
    // reprise volontaire après le premier rendu (le stockage n'existe pas côté serveur)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRepris(true);
  }, [complete, reset, getValues]);

  useEffect(() => {
    if (!complete) return;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const sauver = () => {
      if (ignore.current) return;
      if (sale.current) ecrire(complete, getValues() as Record<string, unknown>);
      else effacer(complete);
    };
    const abonnement = subscribe({
      formState: { values: true, isDirty: true },
      callback: ({ isDirty }) => {
        if (isDirty !== undefined) sale.current = isDirty;
        modifie.current = true;
        ignore.current = false;
        clearTimeout(minuteur);
        minuteur = setTimeout(sauver, PAUSE_MS);
      },
    });
    return () => {
      abonnement();
      clearTimeout(minuteur);
      // fermeture du tiroir en pleine frappe : on garde la dernière saisie
      if (modifie.current) sauver();
    };
  }, [complete, getValues, subscribe]);

  const clear = useCallback(() => {
    ignore.current = true;
    if (complete) effacer(complete);
    setRepris(false);
  }, [complete]);

  const discard = useCallback(
    (valeursVierges: T) => {
      clear();
      reset(valeursVierges);
    },
    [clear, reset],
  );

  return { repris, clear, discard };
}
