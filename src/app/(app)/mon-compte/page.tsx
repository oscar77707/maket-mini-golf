import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PoleBadge } from "@/components/ui/pole-badge";
import { MotDePasseForm } from "@/features/compte/components/mot-de-passe-form";
import { ProfilForm } from "@/features/compte/components/profil-form";
import { ROLE_LABELS } from "@/lib/auth/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon compte" };

export default async function MonComptePage() {
  const { profile, pole } = await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <Card>
        <CardHeader>
          <CardTitle>Mes informations</CardTitle>
          <CardDescription>Votre rôle et votre pôle sont réglés par le gérant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd>{profile.email}</dd>
            <dt className="text-muted-foreground">Rôle</dt>
            <dd>{ROLE_LABELS[profile.role]}</dd>
            <dt className="text-muted-foreground">Pôle</dt>
            <dd>{pole ? <PoleBadge code={pole.code} nom={pole.nom} /> : "Tous les pôles"}</dd>
          </dl>
          <ProfilForm profile={profile} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <MotDePasseForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mes données</CardTitle>
          <CardDescription>
            Téléchargez une copie de toutes les informations que l&apos;application garde sur vous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/mon-compte/export" download>
              <Download aria-hidden />
              Télécharger mes données
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
