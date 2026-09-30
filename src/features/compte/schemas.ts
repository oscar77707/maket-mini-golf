import { z } from "zod";
import { optionalPhone } from "@/lib/zod-helpers";

export const profilSchema = z.object({
  prenom: z
    .string({ error: "Saisissez votre prénom." })
    .trim()
    .min(1, "Saisissez votre prénom.")
    .max(80, "Le prénom est trop long (80 caractères)."),
  nom: z
    .string({ error: "Saisissez votre nom." })
    .trim()
    .min(1, "Saisissez votre nom.")
    .max(80, "Le nom est trop long (80 caractères)."),
  telephone: optionalPhone,
});
export type ProfilInput = z.input<typeof profilSchema>;
