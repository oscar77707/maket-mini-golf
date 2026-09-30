"use client";

import { BarBlock, type BarPoint } from "@/components/charts/bar-block";
import { formatDate } from "@/lib/format";
import { joursEntre } from "@/lib/dates";
import type { PoleCode, StatsAppels } from "@/types/models";
import { ISSUE_LABELS } from "../labels";

const POLE_COLOR: Record<PoleCode, string> = {
  restaurant: "var(--pole-restaurant)",
  mini_golf: "var(--pole-mini-golf)",
  aquatique: "var(--pole-aquatique)",
};

const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const plural = (n: number) => (n > 1 ? "appels" : "appel");

export function AppelsCharts({
  stats,
  du,
  au,
  poles,
}: {
  stats: StatsAppels;
  du: string;
  au: string;
  poles: { code: PoleCode; nom: string }[];
}) {
  const parJour = new Map(stats.par_jour.map((j) => [j.jour, j.nb]));
  const jours: BarPoint[] = joursEntre(du, au).map((d) => ({
    label: shortDay(d),
    value: parJour.get(d) ?? 0,
    tooltip: formatDate(`${d}T12:00:00Z`),
  }));

  const parHeure = new Map(stats.par_heure.map((h) => [h.heure, h.nb]));
  const heures: BarPoint[] = Array.from({ length: 24 }, (_, h) => ({
    label: `${h} h`,
    value: parHeure.get(h) ?? 0,
    tooltip: `${h} h à ${h + 1} h`,
  }));
  const pointe = heures.reduce((a, b) => (b.value > a.value ? b : a));

  const parPole: BarPoint[] = stats.par_pole.map((p) => {
    const pole = poles.find((x) => x.code === p.pole);
    return {
      label: pole?.nom ?? "Général",
      value: p.nb,
      color: pole ? POLE_COLOR[pole.code] : "var(--muted-foreground)",
    };
  });
  const parIssue: BarPoint[] = stats.par_issue.map((i) => ({
    label: ISSUE_LABELS[i.issue],
    value: i.nb,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BarBlock
        className="lg:col-span-2"
        title="Appels par jour"
        unit="appels"
        data={jours}
        summary={`${stats.total} ${plural(stats.total)} du ${formatDate(`${du}T12:00:00Z`)} au ${formatDate(`${au}T12:00:00Z`)}.`}
      />
      <BarBlock
        title="Appels par heure de la journée"
        unit="appels"
        data={heures}
        height={440}
        summary={
          pointe.value > 0
            ? `Heure la plus chargée : ${pointe.label} avec ${pointe.value} ${plural(pointe.value)}.`
            : "Aucun appel sur la période."
        }
      />
      <div className="grid gap-4">
        <BarBlock
          title="Appels par pôle"
          unit="appels"
          data={parPole}
          horizontal
          height={Math.max(120, parPole.length * 44 + 32)}
          summary={parPole.map((p) => `${p.label} : ${p.value}`).join(", ") || "Aucun appel."}
        />
        <BarBlock
          title="Appels par issue"
          unit="appels"
          data={parIssue}
          horizontal
          height={Math.max(120, parIssue.length * 44 + 32)}
          summary={parIssue.map((p) => `${p.label} : ${p.value}`).join(", ") || "Aucun appel."}
        />
      </div>
    </div>
  );
}
