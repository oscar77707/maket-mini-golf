import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { CSV_HEADERS } from "@/features/stocks/schemas";
import { UNITE_LABELS } from "@/features/stocks/labels";
import {
  getReferentiels,
  listAllProduits,
  parseProduitFilters,
  selectedPoleId,
} from "@/features/stocks/queries";
import { uuidOrUndefined } from "@/lib/table-params";

/** Export CSV du catalogue (filtres de la page, ou sélection par identifiants). Même format que l'import. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non connecté.", { status: 401 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const ids = (params.ids ?? "")
    .split(",")
    .map(uuidOrUndefined)
    .filter((x): x is string => !!x)
    .slice(0, 500);
  const ref = await getReferentiels();
  const filters = parseProduitFilters(params, selectedPoleId(user, ref.poles, params));
  const produits = await listAllProduits(
    ids.length
      ? {
          ...filters,
          q: "",
          categorieId: undefined,
          lieuId: undefined,
          fournisseurId: undefined,
          alerte: undefined,
        }
      : filters,
    ids,
  );

  const pole = new Map(ref.poles.map((p) => [p.id, p.nom]));
  const categorie = new Map(ref.categories.map((c) => [c.id, c.nom]));
  const lieu = new Map(ref.lieux.map((l) => [l.id, l.nom]));
  const fournisseur = new Map(ref.fournisseurs.map((f) => [f.id, f.nom]));
  const csv = toCsv(
    [...CSV_HEADERS],
    produits.map((p) => [
      p.nom,
      p.reference,
      pole.get(p.pole_id),
      p.categorie_id ? categorie.get(p.categorie_id) : "",
      p.unite === "piece" ? "pièce" : UNITE_LABELS[p.unite],
      p.lieu_stockage_id ? lieu.get(p.lieu_stockage_id) : "",
      p.fournisseur_principal_id ? fournisseur.get(p.fournisseur_principal_id) : "",
      p.prix_achat_ht,
      p.stock_actuel,
      p.seuil_minimum,
      p.quantite_reappro,
      p.suivi_dlc,
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produits-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
