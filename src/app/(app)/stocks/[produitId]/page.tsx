import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoleBadge } from "@/components/ui/pole-badge";
import { requireUser } from "@/lib/auth/session";
import { formatEuro, formatNumber } from "@/lib/format";
import { uuidOrUndefined, type SearchParams } from "@/lib/table-params";
import { AlerteBadge } from "@/features/stocks/components/alert-badge";
import { LotsDlcListe } from "@/features/stocks/components/lots-dlc-liste";
import { annulableIds, MouvementsList } from "@/features/stocks/components/mouvements-list";
import { PriceChart } from "@/features/stocks/components/price-chart";
import { ProduitActions } from "@/features/stocks/components/produit-actions";
import { UrlPagination } from "@/features/stocks/components/url-pagination";
import { UNITE_LABELS } from "@/features/stocks/labels";
import {
  getProduit,
  getReferentiels,
  listHistoriquePrix,
  listLotsOuverts,
  listMouvements,
} from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Fiche produit" };

export default async function ProduitPage({
  params,
  searchParams,
}: {
  params: Promise<{ produitId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const id = uuidOrUndefined((await params).produitId);
  if (!id) notFound();
  const query = await searchParams;
  const produit = await getProduit(id);
  if (!produit) notFound();

  const [referentiels, lots, prix, historique] = await Promise.all([
    getReferentiels(),
    listLotsOuverts(id),
    listHistoriquePrix(id),
    listMouvements(
      { poleId: null, q: "", produitId: id, type: undefined, du: undefined, au: undefined },
      query,
    ),
  ]);
  const pole = referentiels.poles.find((p) => p.id === produit.pole_id);
  const categorie = referentiels.categories.find((c) => c.id === produit.categorie_id)?.nom;
  const lieu = referentiels.lieux.find((l) => l.id === produit.lieu_stockage_id)?.nom;
  const fournisseur = referentiels.fournisseurs.find(
    (f) => f.id === produit.fournisseur_principal_id,
  )?.nom;
  const canManage = user.profile.role !== "salarie";
  const unite = UNITE_LABELS[produit.unite];
  const today = new Date().toISOString().slice(0, 10);
  const lotsAffiches = lots.map((l) => ({
    id: l.id,
    produit_id: l.produit_id,
    dlc: l.dlc,
    numero_lot: l.numero_lot,
    quantite_initiale: l.quantite_initiale,
    jours_restants: Math.round((Date.parse(l.dlc) - Date.parse(today)) / 86_400_000),
  }));
  const annulables = annulableIds(historique.rows, { canManage, userId: user.profile.id });

  return (
    <div className="space-y-6">
      <Link
        href="/stocks"
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Retour au catalogue
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">{produit.nom}</h2>
          {pole && <PoleBadge code={pole.code} nom={pole.nom} />}
          <AlerteBadge niveau={produit.niveau_alerte} />
          {!produit.actif && <Badge>Archivé</Badge>}
        </div>
        <p className="text-muted-foreground">
          {[
            categorie,
            lieu && `Rangé : ${lieu}`,
            fournisseur && `Fournisseur : ${fournisseur}`,
            produit.reference && `Réf. ${produit.reference}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Aucune information complémentaire"}
        </p>
        <ProduitActions
          produit={produit}
          referentiels={referentiels}
          canManage={canManage}
          isGerant={user.profile.role === "gerant"}
        />
      </header>

      <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Stock actuel", value: `${formatNumber(produit.stock_actuel, 3)} ${unite}` },
          { label: "Seuil minimum", value: `${formatNumber(produit.seuil_minimum, 3)} ${unite}` },
          { label: "Valeur du stock (HT)", value: formatEuro(produit.valeur_stock_ht) },
          {
            label: "Prix d'achat (HT)",
            value: `${formatEuro(produit.prix_achat_ht)} / ${unite === "pièce(s)" ? "pièce" : unite}`,
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">{k.label}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {produit.suivi_dlc && (
        <section className="space-y-3" aria-labelledby="lots">
          <h3 id="lots" className="text-lg font-semibold">
            Lots à DLC en stock
          </h3>
          {lotsAffiches.length === 0 ? (
            <p className="text-muted-foreground">Aucun lot en cours de suivi.</p>
          ) : (
            <LotsDlcListe lots={lotsAffiches} showProduit={false} />
          )}
        </section>
      )}

      {prix.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution du prix d&apos;achat</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart points={prix} />
          </CardContent>
        </Card>
      )}

      <section className="space-y-3" aria-labelledby="historique">
        <h3 id="historique" className="text-lg font-semibold">
          Historique des mouvements
        </h3>
        {historique.rows.length === 0 ? (
          <p className="text-muted-foreground">Aucun mouvement enregistré pour ce produit.</p>
        ) : (
          <>
            <MouvementsList rows={historique.rows} annulables={annulables} showProduit={false} />
            <UrlPagination
              page={historique.page}
              pageSize={historique.pageSize}
              total={historique.total}
            />
          </>
        )}
      </section>
    </div>
  );
}
