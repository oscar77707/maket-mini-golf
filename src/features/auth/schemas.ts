import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Saisissez une adresse e-mail valide."));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Saisissez votre mot de passe."),
  redirection: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      .max(72, "Le mot de passe est trop long (72 caractères maximum)."),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
