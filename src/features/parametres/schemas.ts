import { z } from "zod";
import { contrastRatio, TEXT_ON_PRIMARY, TEXT_ON_SECONDARY } from "@/lib/colors";
import {
  integerBetween,
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredDate,
} from "@/lib/zod-helpers";

const emptyToNull = (v: unknown) => (v === undefined || v === "" ? null : v);

const hexColor = (label: string) =>
  z
    .string({ error: `${label} : choisissez une couleur.` })
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, `${label} : choisissez une couleur.`)
    .transform((c) => c.toUpperCase());

// -----------------------------------------------------------------------------
// Complexe et pôles
// -----------------------------------------------------------------------------
export const complexeSchema = z.object({
  nom_complexe: z
    .string({ error: "Saisissez le nom du complexe." })
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(80, "Le nom est trop long (80 caractères)."),
  couleur_principale: hexColor("La couleur principale").refine(
    (c) => contrastRatio(c, TEXT_ON_PRIMARY) >= 4.5,
    "Cette couleur est trop claire : le texte blanc des boutons serait difficile à lire. Choisissez une teinte plus foncée.",
  ),
  couleur_secondaire: hexColor("La couleur secondaire").refine(
    (c) => contrastRatio(c, TEXT_ON_SECONDARY) >= 4.5,
    "Cette couleur est trop sombre : le texte brun des éléments secondaires serait difficile à lire. Choisissez une teinte plus claire.",
  ),
  adresse: optionalText(200),
  telephone: optionalText(30),
  email_contact: optionalEmail,
  seuil_dlc_jours: integerBetween("Le délai d'alerte DLC", 0, 30),
  marge_alerte_pct: integerBetween("La marge d'alerte", 0, 200),
});
export type ComplexeInput = z.input<typeof complexeSchema>;
export type ComplexeValues = z.output<typeof complexeSchema>;

export const polesSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      nom: z
        .string({ error: "Saisissez le nom du pôle." })
        .trim()
        .min(2, "Le nom doit contenir au moins 2 caractères.")
        .max(60, "Le nom est trop long (60 caractères)."),
      couleur: hexColor("La couleur du pôle").refine(
        (c) => contrastRatio(c, TEXT_ON_PRIMARY) >= 3,
        "Cette couleur est trop claire : le texte blanc des pastilles serait difficile à lire.",
      ),
    }),
  )
  .min(1)
  .max(10);
export type PolesInput = z.input<typeof polesSchema>;

// -----------------------------------------------------------------------------
// Utilisateurs
// -----------------------------------------------------------------------------
const ROLES = ["gerant", "responsable", "salarie"] as const;
const POLES = ["restaurant", "mini_golf", "aquatique"] as const;

const utilisateurChamps = {
  prenom: z
    .string({ error: "Saisissez le prénom." })
    .trim()
    .min(1, "Saisissez le prénom.")
    .max(80, "Le prénom est trop long (80 caractères)."),
  nom: z
    .string({ error: "Saisissez le nom." })
    .trim()
    .min(1, "Saisissez le nom.")
    .max(80, "Le nom est trop long (80 caractères)."),
  telephone: optionalPhone,
  role: z.enum(ROLES, { error: "Choisissez un rôle." }),
  pole: z.preprocess(emptyToNull, z.enum(POLES, { error: "Choisissez un pôle." }).nullable()),
  saisonnier: z.boolean(),
  fin_contrat: z.preprocess(emptyToNull, requiredDate("La fin de contrat").nullable()),
};

type ChampsUtilisateur = {
  role: (typeof ROLES)[number];
  pole: (typeof POLES)[number] | null;
  saisonnier: boolean;
  fin_contrat: string | null;
};

/** Règles communes : un responsable ou un salarié a toujours un pôle ; le gérant n'en a pas. */
function regleRolePole(v: ChampsUtilisateur, ctx: z.RefinementCtx) {
  if (v.role !== "gerant" && !v.pole) {
    ctx.addIssue({
      code: "custom",
      path: ["pole"],
      message: "Choisissez le pôle de cette personne.",
    });
  }
  if (v.role === "gerant" && v.saisonnier) {
    ctx.addIssue({
      code: "custom",
      path: ["saisonnier"],
      message: "Le gérant ne peut pas être saisonnier.",
    });
  }
  if (v.fin_contrat && !v.saisonnier) {
    ctx.addIssue({
      code: "custom",
      path: ["fin_contrat"],
      message: "Une date de fin de contrat ne s'applique qu'aux saisonniers.",
    });
  }
}

export const invitationSchema = z
  .object({
    email: z
      .string({ error: "Saisissez l'adresse e-mail." })
      .trim()
      .toLowerCase()
      .max(120, "Adresse e-mail trop longue.")
      .pipe(z.email("Saisissez une adresse e-mail valide.")),
    ...utilisateurChamps,
  })
  .superRefine(regleRolePole);
export type InvitationInput = z.input<typeof invitationSchema>;
export type InvitationValues = z.output<typeof invitationSchema>;

export const utilisateurSchema = z.object(utilisateurChamps).superRefine(regleRolePole);
export type UtilisateurInput = z.input<typeof utilisateurSchema>;
export type UtilisateurValues = z.output<typeof utilisateurSchema>;

// -----------------------------------------------------------------------------
// Saisons, horaires, fermetures
// -----------------------------------------------------------------------------
export const saisonSchema = z
  .object({
    nom: z
      .string({ error: "Saisissez le nom de la saison." })
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(60, "Le nom est trop long (60 caractères)."),
    date_debut: requiredDate("Le début"),
    date_fin: requiredDate("La fin"),
  })
  .refine((v) => v.date_fin >= v.date_debut, {
    path: ["date_fin"],
    message: "La fin ne peut pas précéder le début.",
  });
export type SaisonInput = z.input<typeof saisonSchema>;

const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM).");

export const horairesSchema = z
  .object({
    saison_id: z.uuid("Saison invalide."),
    pole_id: z.number().int().positive("Pôle invalide."),
    jours: z
      .array(
        z.object({
          jour_semaine: z.number().int().min(1).max(7),
          ferme: z.boolean(),
          ouverture: z.string(),
          fermeture: z.string(),
        }),
      )
      .length(7, "Les sept jours de la semaine sont nécessaires."),
  })
  .superRefine((v, ctx) => {
    const vus = new Set(v.jours.map((j) => j.jour_semaine));
    if (vus.size !== 7)
      ctx.addIssue({
        code: "custom",
        path: ["jours"],
        message: "Chaque jour doit apparaître une fois.",
      });
    v.jours.forEach((j, i) => {
      if (j.ferme) return;
      for (const champ of ["ouverture", "fermeture"] as const) {
        if (!heure.safeParse(j[champ]).success)
          ctx.addIssue({
            code: "custom",
            path: ["jours", i, champ],
            message: "Indiquez l'heure (HH:MM).",
          });
      }
      if (j.ouverture && j.ouverture === j.fermeture)
        ctx.addIssue({
          code: "custom",
          path: ["jours", i, "fermeture"],
          message: "L'ouverture et la fermeture ne peuvent pas être identiques.",
        });
    });
  });
export type HorairesInput = z.input<typeof horairesSchema>;

export const fermetureSchema = z
  .object({
    pole_id: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
      z.number().int().positive("Pôle invalide.").nullable(),
    ),
    date_debut: requiredDate("Le début"),
    date_fin: requiredDate("La fin"),
    motif: z
      .string({ error: "Indiquez le motif." })
      .trim()
      .min(2, "Indiquez le motif de la fermeture.")
      .max(120, "Le motif est trop long (120 caractères)."),
  })
  .refine((v) => v.date_fin >= v.date_debut, {
    path: ["date_fin"],
    message: "La fin ne peut pas précéder le début.",
  });
export type FermetureInput = z.input<typeof fermetureSchema>;

// -----------------------------------------------------------------------------
// Catégories et lieux de stockage
// -----------------------------------------------------------------------------
export const REFERENTIELS = ["categories_produit", "lieux_stockage"] as const;
export type Referentiel = (typeof REFERENTIELS)[number];

export const referentielNomSchema = z
  .string({ error: "Saisissez un nom." })
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères.")
  .max(60, "Le nom est trop long (60 caractères).");

// -----------------------------------------------------------------------------
// Intégrations et données
// -----------------------------------------------------------------------------
export const webhookSchema = z.object({
  cle: z.string().regex(/^[a-z_]+$/, "Webhook inconnu."),
  url: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(300, "Adresse trop longue.")
      .regex(/^https:\/\/\S+$/i, "L'adresse doit commencer par https://.")
      .refine((raw) => {
        try {
          const u = new URL(raw);
          return !u.username && !u.password && u.hostname.length > 0;
        } catch {
          return false;
        }
      }, "Adresse invalide (sans identifiant ni mot de passe).")
      .nullable(),
  ),
  actif: z.boolean(),
});
export type WebhookInput = z.input<typeof webhookSchema>;

export const retentionSchema = z.object({
  retention_appels_jours: integerBetween("La durée de conservation des appels", 7, 1095),
  retention_audit_jours: integerBetween("La durée de conservation du journal", 90, 3650),
});
export type RetentionInput = z.input<typeof retentionSchema>;

export const anonymisationSchema = z.object({
  confirmation: z.literal("ANONYMISER", { error: "Tapez ANONYMISER pour confirmer." }),
});
