import { z } from "zod";
import { dateString, decimal, nonNegative, optionalText } from "@/lib/zod-helpers";

export const commandeCreationSchema = z.object({
  fournisseur_id: z.uuid("Choisissez un fournisseur."),
  pole_id: z.coerce.number({ error: "Choisissez un pôle." }).int().positive("Choisissez un pôle."),
  date_livraison_prevue: dateString,
  commentaire: optionalText(500),
});
export type CommandeCreationInput = z.input<typeof commandeCreationSchema>;
export type CommandeCreationValues = z.output<typeof commandeCreationSchema>;

export const commandeInfoSchema = z.object({
  date_livraison_prevue: dateString,
  commentaire: optionalText(500),
});
export type CommandeInfoInput = z.input<typeof commandeInfoSchema>;

export const ligneCommandeSchema = z.object({
  commande_id: z.uuid("Commande invalide."),
  produit_id: z.uuid("Choisissez un produit."),
  quantite: decimal("La quantité").pipe(
    z.number().gt(0, "La quantité doit être supérieure à zéro.").max(1_000_000, "Trop élevée."),
  ),
  prix_unitaire_ht: nonNegative("Le prix"),
});
export type LigneCommandeInput = z.input<typeof ligneCommandeSchema>;

export const annulationSchema = z.object({
  id: z.uuid("Commande invalide."),
  motif: z
    .string({ error: "Indiquez le motif d'annulation." })
    .trim()
    .min(3, "Indiquez le motif d'annulation.")
    .max(200, "Le motif est trop long (200 caractères)."),
});

const motif = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.enum(["manquant", "abime", "erreur_produit", "surplus", "dlc_courte", "autre"]).nullable(),
);

export const receptionSchema = z.object({
  livraison_id: z.uuid("Livraison invalide."),
  numero_bon_livraison: optionalText(60),
  commentaire: optionalText(500),
  valider: z.boolean(),
  lignes: z
    .array(
      z.object({
        id: z.uuid("Ligne invalide."),
        quantite_recue: nonNegative("La quantité reçue"),
        prix_unitaire_ht: z.preprocess(
          (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
          nonNegative("Le prix").nullable(),
        ),
        motif_ecart: motif,
        dlc: dateString,
        numero_lot: optionalText(60),
      }),
    )
    .min(1, "La livraison ne contient aucune ligne."),
});
export type ReceptionInput = z.input<typeof receptionSchema>;
export type ReceptionValues = z.output<typeof receptionSchema>;

/** Contenu de l'appel signé envoyé à n8n quand le gérant valide une commande. */
export type OrderSendPayload = {
  evenement: "order.send";
  commandeId: string;
  reference: string;
  pole: { code: string; nom: string };
  fournisseur: {
    id: string;
    nom: string;
    mode_commande: string;
    email: string | null;
    telephone: string | null;
    url_portail: string | null;
    contact_nom: string | null;
  };
  date_livraison_prevue: string | null;
  commentaire: string | null;
  total_ht: number;
  lignes: {
    produit_id: string;
    produit: string;
    reference_fournisseur: string | null;
    unite: string;
    quantite: number;
    prix_unitaire_ht: number;
    montant_ht: number;
  }[];
};
