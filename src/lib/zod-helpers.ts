import { z } from "zod";
import { parseDecimal } from "@/lib/csv";

/** Nombre saisi dans un champ texte : accepte la virgule française ; vide = manquant. */
export const decimal = (label: string) =>
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

export const nonNegative = (label: string) =>
  decimal(label).pipe(
    z
      .number()
      .min(0, `${label} ne peut pas être négatif.`)
      .max(1_000_000, `${label} est trop élevé.`),
  );

export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
    z.string().trim().max(max, `Maximum ${max} caractères.`).nullable(),
  );

export const optionalUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.uuid("Choix invalide.").nullable(),
);

export const dateString = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
    .nullable(),
);

export const optionalEmail = z.preprocess(
  (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
  z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Adresse e-mail trop longue.")
    .pipe(z.email("Adresse e-mail invalide."))
    .nullable(),
);

/** Numéro de téléphone facultatif : chiffres, espaces et + ( ) . - (même règle que la base). */
export const optionalPhone = z.preprocess(
  (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
  z
    .string()
    .trim()
    .regex(
      /^[0-9 +().-]{6,20}$/,
      "Numéro de téléphone invalide (6 à 20 chiffres ou signes + ( ) . -).",
    )
    .nullable(),
);

/** Entier saisi dans un champ texte, avec bornes (messages français). */
export const integerBetween = (label: string, min: number, max: number) =>
  decimal(label).pipe(
    z
      .number()
      .int(`${label} : saisissez un nombre entier.`)
      .min(min, `${label} : au moins ${min}.`)
      .max(max, `${label} : au plus ${max}.`),
  );

const isRealDate = (v: string) => {
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Date obligatoire AAAA-MM-JJ (calendrier vérifié : le 31 février est refusé). */
export const requiredDate = (label: string) =>
  z
    .string({ error: `${label} : saisissez une date.` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} : saisissez une date.`)
    .refine(isRealDate, `${label} : cette date n'existe pas.`);
