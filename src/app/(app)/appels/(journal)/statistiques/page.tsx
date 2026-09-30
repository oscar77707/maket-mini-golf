import type { Metadata } from "next";
import { Clock, PhoneCall, PhoneForwarded, Sun } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { joursEntre } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { getPoles } from "@/lib/poles";
import type { SearchParams } from "@/lib/table-params";
import { AppelsCharts } from "@/features/appels/components/appels-charts";
import { AppelsPeriode } from "@/features/appels/components/appels-periode";
import { formatDuree } from "@/features/appels/labels";
import { parsePeriode } from "@/features/appels/periode";
import { getStatsAppels } from "@/features/appels/queries";
import { selectedPoleId } from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Statistiques des appels IA" };

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Icon aria-hidden className="size-8 shrink-0 text-primary" />
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function StatistiquesAppelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("gerant");
  const params = await searchParams;
  const poles = await getPoles();
  const { du, au, jours } = parsePeriode(params);
  const stats = await getStatsAppels(du, au, selectedPoleId(user, poles, params));
  const nbJours = joursEntre(du, au).length;

  return (
    <div className="space-y-5">
      <RealtimeRefresh tables={["appels_ia"]} name="appels-stats" />
      <AppelsPeriode du={du} au={au} jours={jours} />
      {stats.total === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="Aucun appel sur cette période"
          description="Choisissez une période plus large ou un autre pôle."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={PhoneCall} label="Appels" value={formatNumber(stats.total, 0)} />
            <Kpi
              icon={Clock}
              label="Durée moyenne"
              value={stats.duree_moyenne_s === null ? "—" : formatDuree(stats.duree_moyenne_s)}
            />
            <Kpi
              icon={PhoneForwarded}
              label="Taux de transfert"
              value={
                stats.taux_transfert_pct === null
                  ? "—"
                  : `${formatNumber(stats.taux_transfert_pct, 1)} %`
              }
            />
            <Kpi
              icon={Sun}
              label="Appels par jour"
              value={formatNumber(stats.total / nbJours, 1)}
            />
          </div>
          <AppelsCharts
            stats={stats}
            du={du}
            au={au}
            poles={poles.map((p) => ({ code: p.code, nom: p.nom }))}
          />
        </>
      )}
    </div>
  );
}
