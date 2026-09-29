import type { ModeCommande } from "@/types/models";

export const MODE_LABELS: Record<ModeCommande, string> = {
  email: "E-mail",
  telephone: "Téléphone",
  portail: "Portail web",
};

/** Jours de la semaine, numérotés comme en base (1 = lundi ... 7 = dimanche). */
export const JOURS = [
  { value: 1, court: "L", long: "Lundi" },
  { value: 2, court: "M", long: "Mardi" },
  { value: 3, court: "M", long: "Mercredi" },
  { value: 4, court: "J", long: "Jeudi" },
  { value: 5, court: "V", long: "Vendredi" },
  { value: 6, court: "S", long: "Samedi" },
  { value: 7, court: "D", long: "Dimanche" },
] as const;

const ABREGES = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** « lun., mer., ven. » ou « aucun » pour une liste vide. */
export function joursTexte(jours: number[] | null | undefined) {
  if (!jours?.length) return "Non précisé";
  return [...jours]
    .sort((a, b) => a - b)
    .map((j) => ABREGES[j - 1])
    .join(", ");
}
