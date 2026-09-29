import { z } from "zod";
import { decimal, nonNegative, optionalText } from "@/lib/zod-helpers";

const jours = z
  .array(z.number().int().min(1).max(7))
  .transform((list) => [...new Set(list)].sort((a, b) => a - b));

const optionalEmail = z.preprocess(
  (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
  z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Adresse e-mail trop longue.")
    .pipe(z.email("Adresse e-mail invalide."))
    .nullable(),
);

const optionalUrl = z.preprocess(
  (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
  z
    .string()
    .trim()
    .max(300, "Adresse trop longue.")
    .regex(/^https?:\/\/\S+$/i, "L'adresse doit commencer par http:// ou https://.")
    .nullable(),
);

export const fournisseurSchema = z
  .object({
    nom: z
      .string({ error: "Saisissez le nom du fournisseur." })
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(120, "Le nom est trop long (120 caractères)."),
    contact_nom: optionalText(120),
    email: optionalEmail,
    telephone: optionalText(30),
    mode_commande: z.enum(["email", "telephone", "portail"], {
      error: "Choisissez le mode de commande.",
    }),
    url_portail: optionalUrl,
    jours_commande: jours,
    jours_livraison: jours,
    delai_livraison_jours: decimal("Le délai de livraison").pipe(
      z
        .number()
        .int("Le délai doit être un nombre entier de jours.")
        .min(0, "Le délai ne peut pas être négatif.")
        .max(60, "Le délai ne peut pas dépasser 60 jours."),
    ),
    minimum_commande_ht: nonNegative("Le minimum de commande"),
    adresse: optionalText(200),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.mode_commande === "email" && !v.email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Une adresse e-mail est nécessaire pour commander par e-mail.",
      });
    }
    if (v.mode_commande === "portail" && !v.url_portail) {
      ctx.addIssue({
        code: "custom",
        path: ["url_portail"],
        message: "L'adresse du portail est nécessaire pour ce mode de commande.",
      });
    }
  });
export type FournisseurInput = z.input<typeof fournisseurSchema>;
export type FournisseurValues = z.output<typeof fournisseurSchema>;

export const fournisseurProduitSchema = z.object({
  fournisseur_id: z.uuid("Fournisseur invalide."),
  produit_id: z.uuid("Choisissez un produit."),
  reference_fournisseur: optionalText(60),
  prix_ht: z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
    nonNegative("Le prix").nullable(),
  ),
  conditionnement: decimal("Le conditionnement").pipe(
    z.number().gt(0, "Le conditionnement doit être supérieur à zéro.").max(100_000, "Trop élevé."),
  ),
});
export type FournisseurProduitInput = z.input<typeof fournisseurProduitSchema>;
export type FournisseurProduitValues = z.output<typeof fournisseurProduitSchema>;
