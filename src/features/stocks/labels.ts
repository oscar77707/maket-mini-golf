import type { NiveauAlerte, TypeMouvement, Unite } from "@/types/models";

export const UNITE_LABELS: Record<Unite, string> = { kg: "kg", L: "L", piece: "pièce(s)" };
export const UNITE_OPTIONS: { value: Unite; label: string }[] = [
  { value: "kg", label: "Kilogrammes (kg)" },
  { value: "L", label: "Litres (L)" },
  { value: "piece", label: "Pièces" },
];

export const MOUVEMENT_LABELS: Record<TypeMouvement, string> = {
  entree: "Entrée",
  sortie: "Sortie",
  perte: "Perte / casse",
  correction: "Correction",
};

export const ALERTE_LABELS: Record<NiveauAlerte, string> = {
  rouge: "Sous le seuil",
  orange: "Proche du seuil",
  ok: "Correct",
};

export const STATUT_INVENTAIRE_LABELS = {
  en_cours: "En cours de comptage",
  soumis: "À valider",
  valide: "Validé",
  annule: "Annulé",
} as const;

export const MOTIFS_COURANTS = [
  "Produit abîmé",
  "Casse",
  "DLC dépassée",
  "Perte en service",
  "Erreur de saisie",
] as const;
