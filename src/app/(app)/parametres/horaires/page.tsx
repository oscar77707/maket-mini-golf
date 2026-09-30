import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { FermeturesListe } from "@/features/parametres/components/fermetures-liste";
import { HorairesEditeur } from "@/features/parametres/components/horaires-editeur";
import { SaisonsListe } from "@/features/parametres/components/saisons-liste";
import {
  getFermetures,
  getHoraires,
  getSaisons,
  getTousLesPoles,
} from "@/features/parametres/queries";
import { requireRole } from "@/lib/auth/session";
import { todayParis } from "@/lib/dates";
import { first, oneOf, uuidOrUndefined, type SearchParams } from "@/lib/table-params";

export const metadata: Metadata = { title: "Horaires" };

export default async function HorairesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("gerant");
  const params = await searchParams;
  const [saisons, poles, fermetures] = await Promise.all([
    getSaisons(),
    getTousLesPoles(),
    getFermetures(),
  ]);
  const aujourdhui = todayParis();

  // saison choisie dans l'adresse, sinon celle d'aujourd'hui, sinon la première à venir, sinon la dernière
  const demandee = uuidOrUndefined(first(params.saison));
  const saison =
    saisons.find((s) => s.id === demandee) ??
    saisons.find((s) => s.date_debut <= aujourdhui && aujourdhui <= s.date_fin) ??
    saisons.find((s) => s.date_debut > aujourdhui) ??
    saisons.at(-1);
  const codePole = oneOf(
    first(params.pole),
    poles.map((p) => p.code),
  );
  const pole = poles.find((p) => p.code === codePole) ?? poles[0];
  const horaires = saison && pole ? await getHoraires(saison.id, pole.id) : [];
  const options = poles.map((p) => ({ id: p.id, code: p.code, nom: p.nom }));

  return (
    <div className="max-w-3xl space-y-6">
      <SaisonsListe saisons={saisons} />
      {saison && pole ? (
        <HorairesEditeur
          saisons={saisons}
          poles={options}
          saisonId={saison.id}
          poleId={pole.id}
          horaires={horaires}
        />
      ) : (
        <EmptyState
          title="Pas encore de saison"
          description="Créez d'abord une saison pour régler les horaires d'ouverture."
        />
      )}
      <FermeturesListe fermetures={fermetures} poles={options} aujourdhui={aujourdhui} />
    </div>
  );
}
