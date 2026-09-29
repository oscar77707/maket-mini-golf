import type { StatutCommande } from "@/types/models";

export const STATUT_LABELS: Record<StatutCommande, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  envoyee: "Envoyée",
  confirmee: "Confirmée",
  en_retard: "En retard",
  livree: "Livrée",
  cloturee: "Clôturée",
  annulee: "Annulée",
};

export const STATUT_VARIANT: Record<
  StatutCommande,
  "default" | "rouge" | "orange" | "vert" | "bleu"
> = {
  brouillon: "default",
  a_valider: "orange",
  envoyee: "bleu",
  confirmee: "bleu",
  en_retard: "rouge",
  livree: "vert",
  cloturee: "default",
  annulee: "default",
};

/** Onglets de la liste : « Toutes » puis chaque statut, dans l'ordre de vie d'une commande. */
export const STATUT_TABS: { id: "toutes" | StatutCommande; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "brouillon", label: "Brouillons" },
  { id: "a_valider", label: "À valider" },
  { id: "envoyee", label: "Envoyées" },
  { id: "confirmee", label: "Confirmées" },
  { id: "en_retard", label: "En retard" },
  { id: "livree", label: "Livrées" },
  { id: "cloturee", label: "Clôturées" },
  { id: "annulee", label: "Annulées" },
];

export const MOTIFS_ECART = [
  { value: "manquant", label: "Produit manquant" },
  { value: "abime", label: "Produit abîmé" },
  { value: "erreur_produit", label: "Erreur de produit" },
  { value: "surplus", label: "Surplus" },
  { value: "dlc_courte", label: "DLC trop courte" },
  { value: "autre", label: "Autre" },
] as const;
export type MotifEcart = (typeof MOTIFS_ECART)[number]["value"];

export const motifEcartLabel = (value: string | null) =>
  MOTIFS_ECART.find((m) => m.value === value)?.label ?? "—";
