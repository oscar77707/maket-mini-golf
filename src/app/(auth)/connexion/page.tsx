import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor, safeRedirect } from "@/lib/auth/routes";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Record<string, string> = {
  "lien-invalide": "Ce lien n'est plus valable. Demandez un nouvel e-mail de réinitialisation.",
  "acces-impossible":
    "Votre session est terminée ou votre compte est désactivé. Reconnectez-vous, ou contactez le gérant.",
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ redirection?: string; erreur?: string }>;
}) {
  const { redirection, erreur } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeRedirect(redirection, homePathFor(user.profile.role)));
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Connexion</h1>
      <LoginForm redirection={redirection} notice={erreur ? NOTICES[erreur] : undefined} />
    </>
  );
}
