import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoleBadge } from "@/components/ui/pole-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getPoles } from "@/lib/poles";
import type { SearchParams } from "@/lib/table-params";
import { AppelsFilters } from "@/features/appels/components/appels-filters";
import { formatDuree, ISSUE_LABELS, ISSUE_VARIANT } from "@/features/appels/labels";
import {
  countAppelsParIssue,
  getRetentionAppelsJours,
  listAppels,
  parseAppelFilters,
  type AppelListe,
} from "@/features/appels/queries";
import { selectedPoleId } from "@/features/stocks/queries";
import { UrlPagination } from "@/features/stocks/components/url-pagination";
import type { Pole } from "@/types/models";

export const metadata: Metadata = { title: "Journal des appels IA" };

function PoleCell({ appel, poles }: { appel: AppelListe; poles: Pole[] }) {
  const pole = poles.find((p) => p.id === appel.pole_id);
  return pole ? (
    <PoleBadge code={pole.code} nom={pole.nom} className="px-2 py-0 text-xs" />
  ) : (
    <span className="text-sm text-muted-foreground">Général</span>
  );
}

export default async function AppelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("gerant");
  const params = await searchParams;
  const poles = await getPoles();
  const filters = parseAppelFilters(params, selectedPoleId(user, poles, params));
  const [{ rows, total, page, pageSize }, counts, retention] = await Promise.all([
    listAppels(filters, params),
    countAppelsParIssue(filters),
    getRetentionAppelsJours(),
  ]);
  const filtered = Boolean(filters.issue || filters.q || filters.du || filters.au);

  return (
    <div className="space-y-5">
      <RealtimeRefresh tables={["appels_ia"]} name="appels" />
      <AppelsFilters counts={counts} />
      {rows.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={filtered ? "Aucun appel ne correspond" : "Aucun appel pour le moment"}
          description={
            filtered
              ? "Essayez une autre issue, une autre période ou retirez un filtre."
              : "Les appels traités par le standard IA apparaissent ici dès que n8n les envoie."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link href="/appels">Effacer les filtres</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH scope="col">Date et heure</TH>
                  <TH scope="col">Numéro</TH>
                  <TH scope="col">Durée</TH>
                  <TH scope="col">Pôle</TH>
                  <TH scope="col">Résumé</TH>
                  <TH scope="col">Issue</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((a) => (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap">
                      <Link
                        href={`/appels/${a.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {formatDateTime(a.debut)}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums">{a.numero_masque}</TD>
                    <TD className="whitespace-nowrap">{formatDuree(a.duree_secondes)}</TD>
                    <TD>
                      <PoleCell appel={a} poles={poles} />
                    </TD>
                    <TD className="max-w-md">
                      <span className="line-clamp-2">{a.resume ?? "—"}</span>
                    </TD>
                    <TD>
                      <Badge variant={ISSUE_VARIANT[a.issue]}>{ISSUE_LABELS[a.issue]}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-3 lg:hidden">
            {rows.map((a) => (
              <li key={a.id} className="relative space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/appels/${a.id}`}
                    className="font-semibold text-primary after:absolute after:inset-0"
                  >
                    {formatDateTime(a.debut)}
                  </Link>
                  <Badge variant={ISSUE_VARIANT[a.issue]}>{ISSUE_LABELS[a.issue]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="tabular-nums">{a.numero_masque}</span> ·{" "}
                  {formatDuree(a.duree_secondes)}
                </p>
                {a.resume && <p className="line-clamp-3">{a.resume}</p>}
                <PoleCell appel={a} poles={poles} />
              </li>
            ))}
          </ul>
          <UrlPagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
      <p className="text-sm text-muted-foreground">
        Les numéros sont masqués et les appels supprimés automatiquement après {retention} jours.
      </p>
    </div>
  );
}
