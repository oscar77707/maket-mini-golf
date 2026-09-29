import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoleBadge } from "@/components/ui/pole-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatEuro } from "@/lib/format";
import type { SearchParams } from "@/lib/table-params";
import { CommandesFilters } from "@/features/commandes/components/commandes-filters";
import { NouvelleCommandeButton } from "@/features/commandes/components/nouvelle-commande-button";
import { STATUT_LABELS, STATUT_VARIANT } from "@/features/commandes/labels";
import {
  countCommandesParStatut,
  listCommandes,
  parseCommandeFilters,
} from "@/features/commandes/queries";
import { getReferentiels, selectedPoleId } from "@/features/stocks/queries";
import { UrlPagination } from "@/features/stocks/components/url-pagination";
import type { CommandeVue } from "@/types/models";

export const metadata: Metadata = { title: "Commandes" };

function StatutBadges({ c }: { c: CommandeVue }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={STATUT_VARIANT[c.statut]}>{STATUT_LABELS[c.statut]}</Badge>
      {c.est_en_retard && c.statut !== "en_retard" && <Badge variant="rouge">En retard</Badge>}
    </span>
  );
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("gerant", "responsable");
  const params = await searchParams;
  const referentiels = await getReferentiels();
  const poleId = selectedPoleId(user, referentiels.poles, params);
  const filters = parseCommandeFilters(params, poleId);
  const [{ rows, total, page, pageSize }, counts] = await Promise.all([
    listCommandes(filters, params),
    countCommandesParStatut(filters),
  ]);
  const isGerant = user.profile.role === "gerant";
  const poleById = new Map(referentiels.poles.map((p) => [p.id, p]));
  const filtered = Boolean(
    filters.statut || filters.q || filters.fournisseurId || filters.du || filters.au,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Commandes</h1>
        <NouvelleCommandeButton
          fournisseurs={referentiels.fournisseurs}
          poles={referentiels.poles}
          isGerant={isGerant}
          defaultPoleId={poleId ?? user.profile.pole_id}
        />
      </div>
      <CommandesFilters counts={counts} fournisseurs={referentiels.fournisseurs} />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "Aucune commande ne correspond" : "Aucune commande pour le moment"}
          description={
            filtered
              ? "Essayez un autre statut ou retirez un filtre."
              : "Créez une commande, ou utilisez « Commander » depuis les alertes de stock."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link href="/commandes">Effacer les filtres</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/stocks/alertes">Voir les alertes de stock</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH scope="col">Commande</TH>
                  <TH scope="col">Fournisseur</TH>
                  <TH scope="col">Statut</TH>
                  <TH scope="col" className="hidden xl:table-cell">
                    Lignes
                  </TH>
                  <TH scope="col">Total HT</TH>
                  <TH scope="col">Livraison prévue</TH>
                  <TH scope="col" className="hidden xl:table-cell">
                    Créée le
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link
                        href={`/commandes/${c.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {c.reference}
                      </Link>
                      {isGerant && !poleId && poleById.get(c.pole_id) && (
                        <PoleBadge
                          code={poleById.get(c.pole_id)!.code}
                          nom={poleById.get(c.pole_id)!.nom}
                          className="ml-2 px-2 py-0 text-xs"
                        />
                      )}
                    </TD>
                    <TD>{c.fournisseur_nom}</TD>
                    <TD>
                      <StatutBadges c={c} />
                    </TD>
                    <TD className="hidden xl:table-cell">{c.nb_lignes}</TD>
                    <TD>{formatEuro(c.montant_ht)}</TD>
                    <TD>{c.date_livraison_prevue ? formatDate(c.date_livraison_prevue) : "—"}</TD>
                    <TD className="hidden xl:table-cell">{formatDate(c.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-3 lg:hidden">
            {rows.map((c) => (
              <li key={c.id} className="relative space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/commandes/${c.id}`}
                    className="text-lg font-semibold text-primary after:absolute after:inset-0"
                  >
                    {c.reference}
                  </Link>
                  <StatutBadges c={c} />
                </div>
                <p>{c.fournisseur_nom}</p>
                <p className="text-sm text-muted-foreground">
                  {c.nb_lignes} ligne{c.nb_lignes > 1 ? "s" : ""} · {formatEuro(c.montant_ht)}
                  {c.date_livraison_prevue
                    ? ` · livraison le ${formatDate(c.date_livraison_prevue)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
          <UrlPagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
