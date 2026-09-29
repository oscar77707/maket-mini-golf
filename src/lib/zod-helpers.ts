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
