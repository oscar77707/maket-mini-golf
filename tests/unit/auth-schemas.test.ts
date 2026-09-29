import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, loginSchema, newPasswordSchema } from "@/features/auth/schemas";

describe("loginSchema", () => {
  it("normalise l'adresse e-mail", () => {
    const r = loginSchema.parse({ email: "  Gerant@Palmeraie.TEST ", password: "x" });
    expect(r.email).toBe("gerant@palmeraie.test");
  });
  it("refuse une adresse invalide avec un message français", () => {
    const r = loginSchema.safeParse({ email: "pas-un-mail", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Saisissez une adresse e-mail valide.");
  });
  it("refuse un mot de passe vide", () => {
    expect(loginSchema.safeParse({ email: "a@b.fr", password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepte une adresse valide", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
  });
});

describe("newPasswordSchema", () => {
  it("exige 8 caractères", () => {
    expect(newPasswordSchema.safeParse({ password: "court", confirmation: "court" }).success).toBe(
      false,
    );
  });
  it("exige deux mots de passe identiques", () => {
    const r = newPasswordSchema.safeParse({ password: "MotDePasse1", confirmation: "MotDePasse2" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["confirmation"]);
  });
  it("accepte un mot de passe valide", () => {
    expect(
      newPasswordSchema.safeParse({ password: "MotDePasse1", confirmation: "MotDePasse1" }).success,
    ).toBe(true);
  });
});
