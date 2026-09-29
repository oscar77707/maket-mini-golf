import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoleBadge } from "@/components/ui/pole-badge";
import { ROLE_LABELS } from "@/lib/auth/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon compte" };

export default async function MonComptePage() {
  const { profile, pole } = await requireUser();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            {profile.prenom} {profile.nom}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd>{profile.email}</dd>
            <dt className="text-muted-foreground">Rôle</dt>
            <dd>{ROLE_LABELS[profile.role]}</dd>
            <dt className="text-muted-foreground">Pôle</dt>
            <dd>{pole ? <PoleBadge code={pole.code} nom={pole.nom} /> : "Tous les pôles"}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
