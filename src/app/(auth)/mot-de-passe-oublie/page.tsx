import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function MotDePasseOubliePage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Mot de passe oublié</h1>
      <ForgotPasswordForm />
    </>
  );
}
