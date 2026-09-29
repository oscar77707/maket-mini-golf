import type { Metadata } from "next";
import Link from "next/link";
import { Truck } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { formatEuro } from "@/lib/format";
import type { SearchParams } from "@/lib/table-params";
import { FournisseursFilters } from "@/features/fournisseurs/components/fournisseurs-filters";
import { NouveauFournisseurButton } from "@/features/fournisseurs/components/nouveau-fournisseur-button";
import { UrlPagination } from "@/features/stocks/components/url-pagination";
import { joursTexte, MODE_LABELS } from "@/features/fournisseurs/labels";
import { listFournisseurs, parseFournisseurFilters } from "@/features/fournisseurs/queries";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function FournisseursPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("gerant", "responsable");
  const params = await searchParams;
  const filters = parseFournisseurFilters(params);
  const { rows, total, page, pageSize } = await listFournisseurs(filters, params);
  const filtered = Boolean(filters.q || filters.mode || filters.archives);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fournisseurs</h1>
        <NouveauFournisseurButton />
      </div>
      <FournisseursFilters />

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={filtered ? "Aucun fournisseur ne correspond" : "Aucun fournisseur pour le moment"}
          description={
            filtered
              ? "Essayez d'autres mots ou retirez un filtre."
              : "Ajoutez vos fournisseurs pour pouvoir leur passer commande."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link href="/fournisseurs">Effacer les filtres</Link>
              </Button>
            ) : (
              <NouveauFournisseurButton />
            )
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH scope="col">Fournisseur</TH>
                  <TH scope="col">Mode</TH>
                  <TH scope="col">Jours de commande</TH>
                  <TH scope="col">Délai</TH>
                  <TH scope="col">Minimum</TH>
                  <TH scope="col">Conformité</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((f) => (
                  <TR key={f.id}>
                    <TD>
                      <Link
                        href={`/fournisseurs/${f.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {f.nom}
                      </Link>
                      {f.contact_nom && (
                        <p className="text-xs text-muted-foreground">{f.contact_nom}</p>
                      )}
                    </TD>
                    <TD>{MODE_LABELS[f.mode_commande]}</TD>
                    <TD>{joursTexte(f.jours_commande)}</TD>
                    <TD>{f.delai_livraison_jours} j</TD>
                    <TD>{f.minimum_commande_ht > 0 ? formatEuro(f.minimum_commande_ht) : "—"}</TD>
                    <TD>
                      {f.stats.taux_conformite_pct === null ? (
                        "—"
                      ) : (
                        <Badge
                          variant={
                            f.stats.taux_conformite_pct >= 90
                              ? "vert"
                              : f.stats.taux_conformite_pct >= 70
                                ? "orange"
                                : "rouge"
                          }
                        >
                          {f.stats.taux_conformite_pct} %
                        </Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((f) => (
              <li key={f.id} className="relative space-y-1 rounded-lg border bg-card p-4">
                <Link
                  href={`/fournisseurs/${f.id}`}
                  className="block text-lg font-semibold text-primary after:absolute after:inset-0"
                >
                  {f.nom}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {MODE_LABELS[f.mode_commande]} · commande {joursTexte(f.jours_commande)} · délai{" "}
                  {f.delai_livraison_jours} j
                </p>
                {f.minimum_commande_ht > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Minimum {formatEuro(f.minimum_commande_ht)}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <UrlPagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
