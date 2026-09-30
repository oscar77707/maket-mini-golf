import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "@/features/auth/new-password-form";
import { Button } from "@/components/ui/button";
import { first, type SearchParams } from "@/lib/table-params";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ReinitialiserPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const invitation = first((await searchParams).invitation) === "1";
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">
        {invitation ? "Bienvenue" : "Nouveau mot de passe"}
      </h1>
      {invitation && data.user && (
        <p className="mb-6 text-muted-foreground">
          Choisissez votre mot de passe pour activer votre compte.
        </p>
      )}
      {!invitation && <div className="mb-4" />}
      {data.user ? (
        <NewPasswordForm />
      ) : (
        <div className="space-y-5">
          <p role="alert">
            {invitation
              ? "Ce lien d'invitation a expiré ou a déjà été utilisé. Demandez au gérant de vous renvoyer une invitation."
              : "Ce lien a expiré ou a déjà été utilisé."}
          </p>
          {!invitation && (
            <Button asChild size="lg" className="w-full">
              <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
