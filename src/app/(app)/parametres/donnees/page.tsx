import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AuditFiltres } from "@/features/parametres/components/audit-filtres";
import { RetentionForm } from "@/features/parametres/components/retention-form";
import { libelleAction } from "@/features/parametres/labels";
import {
  compterDonneesAPurger,
  getParametres,
  listAudit,
  parseAuditFilters,
} from "@/features/parametres/queries";
import { UrlPagination } from "@/features/stocks/components/url-pagination";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import type { SearchParams } from "@/lib/table-params";

export const metadata: Metadata = { title: "Données et RGPD" };

export default async function DonneesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("gerant");
  const params = await searchParams;
  const filtres = parseAuditFilters(params);
  const parametres = await getParametres();
  const [aPurger, audit] = await Promise.all([
    compterDonneesAPurger(parametres),
    listAudit(filtres, params),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <RetentionForm
        appels={parametres.retention_appels_jours}
        audit={parametres.retention_audit_jours}
        aPurger={aPurger}
      />

      <Card>
        <CardHeader>
          <CardTitle>Données personnelles</CardTitle>
          <CardDescription>Vos obligations RGPD, en pratique.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Export et anonymisation</strong> : ouvrez la fiche d&apos;une personne dans{" "}
            <Link href="/parametres/utilisateurs" className="font-medium text-primary underline">
              Utilisateurs
            </Link>{" "}
            pour télécharger toutes ses données ou effacer son identité. L&apos;historique de stock
            et de commandes est conservé, sans nom.
          </p>
          <p>
            <strong>Appels du standard IA</strong> : le numéro n&apos;est jamais enregistré en clair
            (version masquée et empreinte). Les appels sont supprimés après la durée ci-dessus.
          </p>
          <p>
            <strong>Chaque salarié</strong> peut télécharger ses propres données depuis « Mon compte
            ».
          </p>
        </CardContent>
      </Card>

      <section aria-label="Journal d'audit" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Journal d&apos;audit</h2>
          <p className="text-sm text-muted-foreground">
            Qui a modifié quoi, et quand. Réservé au gérant ; aucune entrée ne peut être modifiée.
          </p>
        </div>
        <AuditFiltres />
        {audit.rows.length === 0 ? (
          <EmptyState
            title="Aucune entrée"
            description="Aucune action ne correspond à ces filtres."
          />
        ) : (
          <>
            <Table aria-label="Journal d'audit">
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Par</TH>
                  <TH>Action</TH>
                  <TH>Détail</TH>
                </TR>
              </THead>
              <TBody>
                {audit.rows.map((l) => (
                  <TR key={l.id} data-testid="ligne-audit">
                    <TD className="whitespace-nowrap">{formatDateTime(l.cree_le)}</TD>
                    <TD>
                      {l.user_email ?? <span className="text-muted-foreground">Système</span>}
                    </TD>
                    <TD>
                      <span className="font-medium">{libelleAction(l.action)}</span>
                      {l.cible_id && (
                        <Badge className="ml-2 max-w-40 truncate align-middle">{l.cible_id}</Badge>
                      )}
                    </TD>
                    <TD>
                      <Detail avant={l.avant} apres={l.apres} details={l.details} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <UrlPagination page={audit.page} pageSize={audit.pageSize} total={audit.total} />
          </>
        )}
      </section>
    </div>
  );
}

function Detail({ avant, apres, details }: { avant: unknown; apres: unknown; details: unknown }) {
  const vide = (v: unknown) =>
    v === null ||
    v === undefined ||
    (typeof v === "object" && Object.keys(v as object).length === 0);
  if (vide(avant) && vide(apres) && vide(details))
    return <span className="text-muted-foreground">—</span>;
  return (
    <details>
      <summary className="cursor-pointer text-primary">Voir</summary>
      <div className="mt-2 space-y-2">
        {!vide(avant) && <Bloc titre="Avant" valeur={avant} />}
        {!vide(apres) && <Bloc titre="Après" valeur={apres} />}
        {!vide(details) && <Bloc titre="Détails" valeur={details} />}
      </div>
    </details>
  );
}

function Bloc({ titre, valeur }: { titre: string; valeur: unknown }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{titre}</p>
      <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
        {JSON.stringify(valeur, null, 2)}
      </pre>
    </div>
  );
}
