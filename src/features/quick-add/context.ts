"use client";

import { createContext, useContext } from "react";
import type { AjoutId } from "./registry";

export type QuickAddContext = {
  /** Identifiant de la personne connectée : sert de clé aux brouillons de formulaire. */
  utilisateurId: string | null;
  ouvrir: (id: AjoutId) => void;
  menuOuvert: boolean;
  setMenuOuvert: (ouvert: boolean) => void;
  ouvrirPalette: () => void;
  ouvrirAide: () => void;
};

const vide: QuickAddContext = {
  utilisateurId: null,
  ouvrir: () => {},
  menuOuvert: false,
  setMenuOuvert: () => {},
  ouvrirPalette: () => {},
  ouvrirAide: () => {},
};

export const QuickAddCtx = createContext<QuickAddContext>(vide);
export const useQuickAdd = () => useContext(QuickAddCtx);
