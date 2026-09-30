import type { Metadata } from "next";
import { InviterButton } from "@/features/parametres/components/invitation-sheet";
import { UtilisateursTable } from "@/features/parametres/components/utilisateurs-table";
import { getTousLesPoles, getUtilisateurs } from "@/features/parametres/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UtilisateursPage() {
  const { profile } = await requireRole("gerant");
  const [utilisateurs, poles] = await Promise.all([getUtilisateurs(), getTousLesPoles()]);
  const options = poles.map((p) => ({ id: p.id, code: p.code, nom: p.nom }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {utilisateurs.length} compte{utilisateurs.length > 1 ? "s" : ""}. Le rôle décide de ce que
          chacun voit ; le pôle limite ses données à son secteur.
        </p>
        <InviterButton poles={options} />
      </div>
      <UtilisateursTable utilisateurs={utilisateurs} poles={options} currentUserId={profile.id} />
    </div>
  );
}
