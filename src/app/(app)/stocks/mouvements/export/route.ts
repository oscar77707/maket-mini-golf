import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { MOUVEMENT_LABELS, UNITE_LABELS } from "@/features/stocks/labels";
import {
  getReferentiels,
  listMouvements,
  parseMouvementFilters,
  selectedPoleId,
} from "@/features/stocks/queries";
import { uuidOrUndefined } from "@/lib/table-params";

/** Export CSV du journal des mouvements (jusqu'à 5 000 lignes, avec les filtres de la page). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non connecté.", { status: 401 });
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const { poles } = await getReferentiels();
  const filters = parseMouvementFilters(
    params,
    selectedPoleId(user, poles, params),
    uuidOrUndefined(params.produit),
  );
  const { rows } = await listMouvements(filters, params, true);
  const csv = toCsv(
    ["Date", "Produit", "Type", "Quantité", "Unité", "Motif", "Par", "Statut"],
    rows.map((m) => [
      new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date(m.date_mouvement)),
      m.produit_nom,
      MOUVEMENT_LABELS[m.type],
      m.quantite,
      m.unite ? UNITE_LABELS[m.unite] : "",
      m.motif,
      m.auteur,
      m.annule ? "Annulé" : m.est_annulation ? "Annulation" : "",
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mouvements-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
