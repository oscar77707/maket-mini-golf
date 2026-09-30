import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  PackageOpen,
  PhoneCall,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { BarBlock } from "@/components/charts/bar-block";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoleBadge } from "@/components/ui/pole-badge";
import { requireRole } from "@/lib/auth/session";
import { todayParis } from "@/lib/dates";
import { formatDate, formatDateTime, formatEuro, formatNumber } from "@/lib/format";
import { getPoles } from "@/lib/poles";
import { avecPole } from "@/lib/urls";
import type { SearchParams } from "@/lib/table-params";
import { formatDuree, ISSUE_LABELS, ISSUE_VARIANT } from "@/features/appels/labels";
import { STATUT_LABELS, STATUT_VARIANT } from "@/features/commandes/labels";
import { KpiCard } from "@/features/tableau-de-bord/components/kpi-card";
import { ValeurStockChart } from "@/features/tableau-de-bord/components/valeur-stock-chart";
import { ValiderEnvoyerButton } from "@/features/tableau-de-bord/components/valider-envoyer-button";
import {
  getEvolutionValeurStock,
  getIndicateurs,
  getTopConsommes,
  listCommandesAValider,
  listDerniersAppels,
  listLivraisonsAttendues,
  listProduitsSousSeuil,
  type CommandeResume,
} from "@/features/tableau-de-bord/queries";
import { tachesDuJour } from "@/features/tableau-de-bord/todo";
import { selectedPoleId } from "@/features/stocks/queries";
import { UNITE_LABELS } from "@/features/stocks/labels";
import type { Pole } from "@/types/models";

export const metadata: Metadata = { title: "Tableau de bord" };

const plural = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);
const jourLong = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${iso}T12:00:00Z`));

function Panneau({
  id,
  titre,
  total,
  lien,
  children,
}: {
  id?: string;
  titre: string;
  total?: number;
  lien?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-lg">
          {titre}
          {total !== undefined && <span className="ml-2 text-muted-foreground">({total})</span>}
        </CardTitle>
        {lien && (
          <Link
            href={lien.href}
            className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm text-primary underline-offset-4 hover:underline"
          >
            {lien.label}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Vide = ({ children }: { children: React.ReactNode }) => (
  <p className="py-2 text-muted-foreground">{children}</p>
);

function LigneCommande({
  c,
  poles,
  montrerPole,
  action,
}: {
  c: CommandeResume;
  poles: Pole[];
  montrerPole: boolean;
  action: React.ReactNode;
}) {
  const pole = poles.find((p) => p.id === c.pole_id);
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/commandes/${c.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            {c.reference}
          </Link>
          {montrerPole && pole && (
            <PoleBadge code={pole.code} nom={pole.nom} className="px-2 py-0 text-xs" />
          )}
        </div>
        <p className="truncate">{c.fournisseur_nom}</p>
        <p className="text-sm text-muted-foreground">
          {c.nb_lignes} {plural(c.nb_lignes, "ligne", "lignes")} · {formatEuro(c.montant_ht)}
          {c.date_livraison_prevue
            ? ` · livraison le ${formatDate(`${c.date_livraison_prevue}T12:00:00Z`)}`
            : ""}
        </p>
      </div>
      <div className="shrink-0 [&>button]:w-full sm:[&>button]:w-auto">{action}</div>
    </li>
  );
}

export default async function TableauDeBordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("gerant", "responsable");
  const role = user.profile.role === "gerant" ? "gerant" : "responsable";
  const params = await searchParams;
  const poles = await getPoles();
  const poleId = selectedPoleId(user, poles, params);
  const pole = poles.find((p) => p.id === poleId);
  const isGerant = role === "gerant";

  const [ind, aValider, attendues, sousSeuil, appels, valeur, top] = await Promise.all([
    getIndicateurs(poleId),
    listCommandesAValider(poleId),
    listLivraisonsAttendues(poleId),
    listProduitsSousSeuil(poleId),
    isGerant ? listDerniersAppels(poleId) : Promise.resolve([]),
    getEvolutionValeurStock(poleId),
    getTopConsommes(poleId),
  ]);

  // Les liens gardent le pôle choisi par le gérant (un responsable est de toute façon limité au sien).
  const lien = (chemin: string) => (isGerant ? avecPole(chemin, pole?.code) : chemin);
  const taches = tachesDuJour(ind, role, lien);
  const montrerPole = isGerant && !pole;
  const aujourdhui = todayParis();

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        name="tableau-de-bord"
        tables={[
          "mouvements_stock",
          "commandes",
          "livraisons",
          "lots_dlc",
          "inventaires",
          "appels_ia",
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-muted-foreground first-letter:uppercase">
          {jourLong(aujourdhui)}
          {!isGerant && pole ? ` · ${pole.nom}` : pole && isGerant ? ` · ${pole.nom}` : ""}
        </p>
      </div>

      <section
        aria-label="Chiffres clés"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      >
        <KpiCard
          href={lien("/stocks/alertes")}
          icon={AlertTriangle}
          label="Produits sous le seuil"
          value={formatNumber(ind.rouges, 0)}
          detail={
            ind.oranges > 0
              ? `${ind.oranges} ${plural(ind.oranges, "proche du seuil", "proches du seuil")}`
              : undefined
          }
          tone={ind.rouges > 0 ? "alerte" : "neutre"}
        />
        <KpiCard
          href={lien("/commandes?statut=a_valider")}
          icon={ClipboardCheck}
          label="Commandes à valider"
          value={formatNumber(ind.a_valider, 0)}
          tone={ind.a_valider > 0 ? "attention" : "neutre"}
        />
        <KpiCard
          href={lien("/commandes?attendues=aujourdhui")}
          icon={Truck}
          label="Livraisons aujourd'hui"
          value={formatNumber(ind.attendues_aujourdhui, 0)}
        />
        <KpiCard
          href={lien("/commandes?statut=en_retard")}
          icon={Timer}
          label="Commandes en retard"
          value={formatNumber(ind.en_retard, 0)}
          tone={ind.en_retard > 0 ? "alerte" : "neutre"}
        />
        <KpiCard
          href={lien("/stocks/alertes#dlc")}
          icon={CalendarClock}
          label="DLC à surveiller"
          value={formatNumber(ind.dlc, 0)}
          tone={ind.dlc > 0 ? "attention" : "neutre"}
        />
        {isGerant ? (
          <KpiCard
            href={lien(`/appels?du=${aujourdhui}&au=${aujourdhui}`)}
            icon={PhoneCall}
            label="Appels aujourd'hui"
            value={formatNumber(ind.appels_aujourdhui, 0)}
          />
        ) : (
          <KpiCard
            href="/stocks"
            icon={Wallet}
            label="Valeur du stock"
            value={formatEuro(ind.valeur_stock_ht)}
          />
        )}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">À faire aujourd&apos;hui</CardTitle>
        </CardHeader>
        <CardContent>
          {taches.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-muted-foreground">
              <CircleCheck aria-hidden className="size-5 text-green-600" />
              Rien d&apos;urgent : les stocks, les commandes et les livraisons sont à jour.
            </p>
          ) : (
            <ul className="divide-y">
              {taches.map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.href}
                    className="flex min-h-12 items-center justify-between gap-3 py-2 hover:text-primary"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`size-2.5 shrink-0 rounded-full ${t.niveau === "urgent" ? "bg-red-600" : "bg-orange-500"}`}
                      />
                      {t.texte}
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panneau
          id="commandes-a-valider"
          titre="Commandes à valider"
          total={ind.a_valider}
          lien={{ href: lien("/commandes?statut=a_valider"), label: "Tout voir" }}
        >
          {aValider.length === 0 ? (
            <Vide>Aucune commande n&apos;attend de validation.</Vide>
          ) : (
            <ul className="divide-y">
              {aValider.map((c) => (
                <LigneCommande
                  key={c.id}
                  c={c}
                  poles={poles}
                  montrerPole={montrerPole}
                  action={
                    isGerant ? (
                      <ValiderEnvoyerButton id={c.id} reference={c.reference} />
                    ) : (
                      <Badge variant="orange">En attente du gérant</Badge>
                    )
                  }
                />
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau
          titre="Livraisons attendues aujourd'hui"
          total={ind.attendues_aujourdhui}
          lien={{ href: lien("/commandes?attendues=aujourdhui"), label: "Tout voir" }}
        >
          {attendues.length === 0 ? (
            <Vide>Aucune livraison n&apos;est prévue aujourd&apos;hui.</Vide>
          ) : (
            <ul className="divide-y">
              {attendues.map((c) => (
                <LigneCommande
                  key={c.id}
                  c={c}
                  poles={poles}
                  montrerPole={montrerPole}
                  action={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <Badge variant={STATUT_VARIANT[c.statut]}>{STATUT_LABELS[c.statut]}</Badge>
                      <Link
                        href={`/commandes/${c.id}`}
                        className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                      >
                        <PackageOpen aria-hidden className="size-4" />
                        Réceptionner
                      </Link>
                    </span>
                  }
                />
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau
          titre="Produits sous le seuil"
          total={ind.rouges}
          lien={{ href: lien("/stocks/alertes"), label: "Voir les alertes" }}
        >
          {sousSeuil.length === 0 ? (
            <Vide>Aucun produit sous son seuil minimum.</Vide>
          ) : (
            <ul className="divide-y">
              {sousSeuil.map((p) => {
                const pDuPole = poles.find((x) => x.id === p.pole_id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <Link
                        href={`/stocks/${p.id}`}
                        className="flex min-h-11 items-center truncate font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {p.nom}
                      </Link>
                      {montrerPole && pDuPole && (
                        <span className="text-sm text-muted-foreground">{pDuPole.nom}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <Badge variant="rouge">
                        {formatNumber(Number(p.stock_actuel), 2)} {UNITE_LABELS[p.unite]}
                      </Badge>
                      <span className="block text-sm text-muted-foreground">
                        seuil {formatNumber(Number(p.seuil_minimum), 2)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panneau>

        {isGerant && (
          <Panneau
            titre="Derniers appels"
            lien={{ href: lien("/appels"), label: "Journal des appels" }}
          >
            {appels.length === 0 ? (
              <Vide>Aucun appel pour le moment.</Vide>
            ) : (
              <ul className="divide-y">
                {appels.map((a) => (
                  <li key={a.id} className="space-y-1 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/appels/${a.id}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {formatDateTime(a.debut)}
                      </Link>
                      <Badge variant={ISSUE_VARIANT[a.issue]}>{ISSUE_LABELS[a.issue]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="tabular-nums">{a.numero_masque}</span> ·{" "}
                      {formatDuree(a.duree_secondes)}
                    </p>
                    {a.resume && <p className="line-clamp-2">{a.resume}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ValeurStockChart points={valeur} />
        {top.length === 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top 10 des produits consommés (30 jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <Vide>Aucune sortie ni perte enregistrée sur les 30 derniers jours.</Vide>
            </CardContent>
          </Card>
        ) : (
          <BarBlock
            title="Top 10 des produits consommés (30 jours)"
            unit="€"
            valueFormat="euro"
            horizontal
            labelWidth={150}
            height={Math.max(220, top.length * 36 + 40)}
            data={top.map((p) => ({
              label: p.nom.length > 22 ? `${p.nom.slice(0, 21)}…` : p.nom,
              value: p.valeur_ht,
              tooltip: `${p.nom} : ${formatNumber(p.quantite, 2)} ${UNITE_LABELS[p.unite]}`,
            }))}
            summary={`Classés par valeur d'achat. En tête : ${top[0].nom}, ${formatEuro(top[0].valeur_ht)}.`}
          />
        )}
      </div>
    </div>
  );
}
