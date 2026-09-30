import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Bot, ChevronLeft, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoleBadge } from "@/components/ui/pole-badge";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getPoles } from "@/lib/poles";
import { formatDuree, ISSUE_LABELS, ISSUE_VARIANT } from "@/features/appels/labels";
import { getAppel } from "@/features/appels/queries";
import { decouperTranscription } from "@/features/appels/transcription";

export const metadata: Metadata = { title: "Appel IA" };

export default async function AppelPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("gerant");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getAppel(id);
  if (!detail) notFound();
  const { appel: a, memeNumero, totalMemeNumero } = detail;
  const poles = await getPoles();
  const pole = poles.find((p) => p.id === a.pole_id);
  const repliques = a.transcription ? decouperTranscription(a.transcription) : [];
  const fin = new Date(Date.parse(a.debut) + a.duree_secondes * 1000);
  const metadonnees = Object.entries((a.metadonnees ?? {}) as Record<string, unknown>);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/appels"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Tous les appels
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Appel du {formatDateTime(a.debut)}</h1>
          <Badge variant={ISSUE_VARIANT[a.issue]}>{ISSUE_LABELS[a.issue]}</Badge>
          {pole ? <PoleBadge code={pole.code} nom={pole.nom} /> : <Badge>Général</Badge>}
        </div>
        <p className="text-muted-foreground">
          <span className="tabular-nums">{a.numero_masque}</span> · {formatDuree(a.duree_secondes)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Résumé</CardTitle>
            </CardHeader>
            <CardContent>
              {a.resume ? (
                <p className="whitespace-pre-wrap">{a.resume}</p>
              ) : (
                <p className="text-muted-foreground">Aucun résumé pour cet appel.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transcription</CardTitle>
            </CardHeader>
            <CardContent>
              {repliques.length === 0 ? (
                <p className="text-muted-foreground">Aucune transcription pour cet appel.</p>
              ) : (
                <ol className="space-y-3">
                  {repliques.map((r, i) => (
                    <li key={i} className="flex gap-3">
                      {r.locuteur === "ia" ? (
                        <Bot aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                      ) : (
                        <User
                          aria-hidden
                          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <p className="whitespace-pre-wrap">
                        {r.locuteur && (
                          <span className="font-semibold">
                            {r.locuteur === "ia" ? "Standard IA" : "Client"}
                            {" : "}
                          </span>
                        )}
                        {r.texte}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Détails</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Début</dt>
                <dd>{formatDateTime(a.debut)}</dd>
                <dt className="text-muted-foreground">Fin</dt>
                <dd>{formatDateTime(fin)}</dd>
                <dt className="text-muted-foreground">Durée</dt>
                <dd>{formatDuree(a.duree_secondes)}</dd>
                <dt className="text-muted-foreground">Numéro</dt>
                <dd className="tabular-nums">{a.numero_masque}</dd>
                <dt className="text-muted-foreground">Identifiant</dt>
                <dd className="break-all">{a.id_externe}</dd>
              </dl>
            </CardContent>
          </Card>

          {totalMemeNumero > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {totalMemeNumero === 1 ? "1 autre appel" : `${totalMemeNumero} autres appels`} de
                  ce numéro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {memeNumero.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/appels/${m.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {formatDateTime(m.debut)}
                      </Link>{" "}
                      <span className="text-muted-foreground">· {ISSUE_LABELS[m.issue]}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {metadonnees.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations techniques</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {metadonnees.map(([cle, valeur]) => (
                    <div key={cle} className="contents">
                      <dt className="text-muted-foreground">{cle}</dt>
                      <dd className="break-words">
                        {typeof valeur === "string" ? valeur : JSON.stringify(valeur)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
