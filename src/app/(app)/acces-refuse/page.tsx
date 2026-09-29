import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { homePathFor } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Accès refusé" };

export default async function AccesRefusePage() {
  const { profile } = await requireUser();
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Accès refusé"
      description="Votre rôle ne donne pas accès à cette page. Si c'est une erreur, contactez le gérant."
      action={
        <Button asChild>
          <Link href={homePathFor(profile.role)}>Retour à mon espace</Link>
        </Button>
      }
    />
  );
}
