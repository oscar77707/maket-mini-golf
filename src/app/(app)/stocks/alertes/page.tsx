import type { Metadata } from "next";
import { PartyPopper } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/table-params";
import { AlertesListe } from "@/features/stocks/components/alertes-liste";
import { CommanderButton } from "@/features/stocks/components/commander-button";
import { LotsDlcListe } from "@/features/stocks/components/lots-dlc-liste";
import { getReferentiels, listAlertes, selectedPoleId } from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Alertes de stock" };

export default async function AlertesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { poles } = await getReferentiels();
  const poleId = selectedPoleId(user, poles, params);
  const { rouges, oranges, lots } = await listAlertes(poleId);
  const canManage = user.profile.role !== "salarie";

  if (rouges.length + oranges.length + lots.length === 0) {
    return (
      <EmptyState
        icon={PartyPopper}
        title="Aucune alerte"
        description="Tous les stocks sont au-dessus des seuils et aucune DLC n'approche."
      />
    );
  }
  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="rouge">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rouge" className="text-lg font-semibold text-red-700 dark:text-red-400">
            Sous le seuil ({rouges.length})
          </h2>
          {canManage && rouges.length > 0 && (
            <CommanderButton poleId={poleId} variant="secondary">
              Commander tous les produits en alerte
            </CommanderButton>
          )}
        </div>
        {rouges.length === 0 ? (
          <p className="text-muted-foreground">Aucun produit sous le seuil.</p>
        ) : (
          <AlertesListe produits={rouges} canManage={canManage} />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="orange">
        <h2 id="orange" className="text-lg font-semibold text-orange-700 dark:text-orange-400">
          Proche du seuil ({oranges.length})
        </h2>
        {oranges.length === 0 ? (
          <p className="text-muted-foreground">Aucun produit proche du seuil.</p>
        ) : (
          <AlertesListe produits={oranges} canManage={canManage} />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="dlc">
        <h2 id="dlc" className="text-lg font-semibold">
          DLC proches ou dépassées ({lots.length})
        </h2>
        {lots.length === 0 ? (
          <p className="text-muted-foreground">Aucune DLC à surveiller.</p>
        ) : (
          <LotsDlcListe lots={lots} showProduit />
        )}
      </section>
    </div>
  );
}
