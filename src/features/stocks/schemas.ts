import { z } from "zod";
import { parseDecimal } from "@/lib/csv";

/** Nombre saisi dans un champ texte : accepte la virgule française ; vide = manquant. */
const decimal = (label: string) =>
  z.preprocess(
    (v) => {
      if (typeof v === "number") return v;
      if (typeof v !== "string" || v.trim() === "") return undefined;
      return parseDecimal(v);
    },
    z
      .number({ error: `${label} : saisissez un nombre.` })
      .refine(Number.isFinite, `${label} : saisissez un nombre.`),
  );

const nonNegative = (label: string) =>
  decimal(label).pipe(
    z
      .number()
      .min(0, `${label} ne peut pas être négatif.`)
      .max(1_000_000, `${label} est trop élevé.`),
  );

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max, `Maximum ${max} caractères.`).nullable(),
  );

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.uuid("Choix invalide.").nullable(),
);

export const produitSchema = z.object({
  pole_id: z.coerce.number({ error: "Choisissez un pôle." }).int().positive("Choisissez un pôle."),
  nom: z
    .string({ error: "Saisissez le nom du produit." })
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long (120 caractères)."),
  reference: optionalText(60),
  categorie_id: optionalUuid,
  unite: z.enum(["kg", "L", "piece"], { error: "Choisissez une unité." }),
  lieu_stockage_id: optionalUuid,
  fournisseur_principal_id: optionalUuid,
  prix_achat_ht: nonNegative("Le prix d'achat"),
  seuil_minimum: nonNegative("Le seuil minimum"),
  quantite_reappro: nonNegative("La quantité de réapprovisionnement"),
  suivi_dlc: z.boolean(),
  notes: optionalText(500),
});
export type ProduitInput = z.input<typeof produitSchema>;
export type ProduitValues = z.output<typeof produitSchema>;

const dateString = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
    .nullable(),
);

export const mouvementSchema = z
  .object({
    produit_id: z.uuid("Produit invalide."),
    type: z.enum(["entree", "sortie", "perte", "correction"], {
      error: "Choisissez le type de mouvement.",
    }),
    /** Entrée/sortie/perte : quantité en mouvement. Correction : stock réel constaté après comptage. */
    quantite: nonNegative("La quantité"),
    motif: optionalText(200),
    dlc: dateString,
    numero_lot: optionalText(60),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "correction" && v.quantite <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantite"],
        message: "La quantité doit être supérieure à zéro.",
      });
    }
    if ((v.type === "perte" || v.type === "correction") && !v.motif) {
      ctx.addIssue({ code: "custom", path: ["motif"], message: "Indiquez le motif." });
    }
  });
export type MouvementInput = z.input<typeof mouvementSchema>;
export type MouvementValues = z.output<typeof mouvementSchema>;

export const inventaireCreationSchema = z.object({
  pole_id: z.coerce.number({ error: "Choisissez un pôle." }).int().positive("Choisissez un pôle."),
  lieu_stockage_id: optionalUuid,
  commentaire: optionalText(200),
});
export type InventaireCreationInput = z.input<typeof inventaireCreationSchema>;

export const comptageSchema = z.object({
  ligne_id: z.uuid(),
  quantite: z.union([z.null(), nonNegative("La quantité comptée")]),
});

/** En-têtes du CSV d'import / export (identiques dans les deux sens : on peut réimporter un export). */
export const CSV_HEADERS = [
  "Nom",
  "Référence",
  "Pôle",
  "Catégorie",
  "Unité",
  "Lieu de stockage",
  "Fournisseur principal",
  "Prix d'achat HT",
  "Stock actuel",
  "Seuil minimum",
  "Quantité de réappro",
  "DLC suivie",
] as const;

export const importRowSchema = z.object({
  ligne: z.number().int().positive(),
  nom: z.string().trim().min(2, "Nom manquant ou trop court.").max(120, "Nom trop long."),
  reference: z.string().trim().max(60).default(""),
  pole: z.string().trim().default(""),
  categorie: z.string().trim().max(60).default(""),
  unite: z.string().trim().default(""),
  lieu: z.string().trim().max(60).default(""),
  fournisseur: z.string().trim().max(120).default(""),
  prix: z.number().min(0, "Prix négatif.").max(1_000_000),
  stock: z.number().min(0, "Stock négatif.").max(1_000_000),
  seuil: z.number().min(0, "Seuil négatif.").max(1_000_000),
  reappro: z.number().min(0, "Quantité de réappro négative.").max(1_000_000),
  dlc: z.boolean(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const importPayloadSchema = z.object({
  pole_id: z.number().int().positive().nullable(),
  creer_referentiels: z.boolean(),
  // les lignes sont validées une à une (voir splitImportRows) : une ligne invalide ne bloque pas le fichier
  rows: z
    .array(z.unknown())
    .min(1, "Le fichier ne contient aucune ligne.")
    .max(2000, "Maximum 2000 lignes par import."),
});
export type ImportPayload = {
  pole_id: number | null;
  creer_referentiels: boolean;
  rows: ImportRow[];
};

/** Valide les lignes une à une : une ligne invalide est signalée (avec son numéro) et ignorée. */
export function splitImportRows(rows: unknown[]) {
  const valid: ImportRow[] = [];
  const rejected: { ligne: number; nom: string; statut: "erreur"; messages: string[] }[] = [];
  rows.forEach((raw, index) => {
    const result = importRowSchema.safeParse(raw);
    if (result.success) return void valid.push(result.data);
    const { ligne, nom } = (raw ?? {}) as { ligne?: unknown; nom?: unknown };
    rejected.push({
      ligne: typeof ligne === "number" ? ligne : index + 2,
      nom: typeof nom === "string" ? nom.trim() : "",
      statut: "erreur",
      messages: [...new Set(result.error.issues.map((issue) => issue.message))],
    });
  });
  return { valid, rejected };
}
