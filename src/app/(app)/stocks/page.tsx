import type { Metadata } from "next";
import Link from "next/link";
import { Download, PackageSearch, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/table-params";
import { CatalogueFilters } from "@/features/stocks/components/catalogue-filters";
import { CommanderButton } from "@/features/stocks/components/commander-button";
import { NouveauProduitButton } from "@/features/stocks/components/nouveau-produit-button";
import { ProduitsTable } from "@/features/stocks/components/produits-table";
import {
  getReferentiels,
  listProduits,
  parseProduitFilters,
  selectedPoleId,
} from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Stocks" };

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const referentiels = await getReferentiels();
  const poleId = selectedPoleId(user, referentiels.poles, params);
  const filters = parseProduitFilters(params, poleId);
  const { rows, total, page, pageSize } = await listProduits(filters, params);

  const role = user.profile.role;
  const canManage = role !== "salarie";
  const isGerant = role === "gerant";
  const filtered = Boolean(
    filters.q ||
    filters.categorieId ||
    filters.lieuId ||
    filters.fournisseurId ||
    filters.alerte ||
    filters.archives,
  );
  const exportQuery = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === "string" && !["page", "taille"].includes(k) ? [[k, v]] : [],
    ),
  ).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <NouveauProduitButton
            referentiels={referentiels}
            isGerant={isGerant}
            defaultPoleId={poleId ?? user.profile.pole_id}
          />
        )}
        {canManage && !filters.archives && (
          <CommanderButton variant="secondary" poleId={poleId}>
            Commander tous les produits en alerte
          </CommanderButton>
        )}
        <Button asChild variant="outline">
          <a href={`/stocks/export${exportQuery ? `?${exportQuery}` : ""}`}>
            <Download aria-hidden />
            Exporter en CSV
          </a>
        </Button>
      </div>

      <CatalogueFilters referentiels={referentiels} poleId={poleId} />

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={PackageSearch}
            title="Aucun produit ne correspond"
            description="Essayez d'autres mots ou retirez un filtre."
            action={
              <Button asChild variant="outline">
                <Link
                  href={
                    poleId && isGerant
                      ? `/stocks?pole=${referentiels.poles.find((p) => p.id === poleId)?.code}`
                      : "/stocks"
                  }
                >
                  Effacer les filtres
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={TriangleAlert}
            title="Aucun produit pour le moment"
            description={
              canManage
                ? "Ajoutez votre premier produit ou importez votre fichier Excel au format CSV."
                : "Votre responsable n'a pas encore ajouté de produit."
            }
            action={
              canManage ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <NouveauProduitButton
                    referentiels={referentiels}
                    isGerant={isGerant}
                    defaultPoleId={poleId ?? user.profile.pole_id}
                  />
                  <Button asChild variant="outline">
                    <Link href="/stocks/import">Importer un fichier CSV</Link>
                  </Button>
                </div>
              ) : undefined
            }
          />
        )
      ) : (
        <ProduitsTable
          key={JSON.stringify(params)}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          referentiels={referentiels}
          showPole={isGerant && !poleId}
          canManage={canManage}
          canCorrect={canManage}
          archived={filters.archives}
          sort={{ tri: filters.tri, sens: filters.sens }}
        />
      )}
    </div>
  );
}
