import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "@/features/auth/new-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ReinitialiserPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Nouveau mot de passe</h1>
      {data.user ? (
        <NewPasswordForm />
      ) : (
        <div className="space-y-5">
          <p role="alert">Ce lien a expiré ou a déjà été utilisé.</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </Button>
        </div>
      )}
    </>
  );
}
