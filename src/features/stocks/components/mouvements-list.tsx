import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { TypeMouvement } from "@/types/models";
import type { MouvementRow } from "../queries";
import { MOUVEMENT_LABELS, UNITE_LABELS } from "../labels";
import { AnnulerMouvementButton } from "./annuler-mouvement-button";

const VARIANT: Record<TypeMouvement, "vert" | "bleu" | "rouge" | "orange"> = {
  entree: "vert",
  sortie: "bleu",
  perte: "rouge",
  correction: "orange",
};

function Quantite({ m }: { m: MouvementRow }) {
  const sign = m.quantite > 0 ? "+" : "−";
  return (
    <span
      className={
        m.quantite > 0 ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold"
      }
    >
      {sign}
      {formatNumber(Math.abs(m.quantite), 3)} {m.unite ? UNITE_LABELS[m.unite] : ""}
    </span>
  );
}

/** Journal des mouvements. `annulables` = identifiants que l'utilisateur a le droit d'annuler. */
export function MouvementsList({
  rows,
  annulables,
  showProduit = true,
}: {
  rows: MouvementRow[];
  annulables: Set<number>;
  showProduit?: boolean;
}) {
  const statut = (m: MouvementRow) =>
    m.annule ? <Badge>Annulé</Badge> : m.est_annulation ? <Badge>Annulation</Badge> : null;
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH scope="col">Date</TH>
              {showProduit && <TH scope="col">Produit</TH>}
              <TH scope="col">Type</TH>
              <TH scope="col">Quantité</TH>
              <TH scope="col" className="hidden xl:table-cell">
                Motif
              </TH>
              <TH scope="col" className="hidden xl:table-cell">
                Par
              </TH>
              <TH scope="col">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((m) => (
              <TR
                key={m.id}
                className={m.annule ? "text-muted-foreground line-through decoration-1" : undefined}
              >
                <TD className="whitespace-nowrap">
                  {formatDateTime(m.date_mouvement)}
                  <span className="block text-xs text-muted-foreground xl:hidden">{m.auteur}</span>
                </TD>
                {showProduit && (
                  <TD>
                    <Link
                      href={`/stocks/${m.produit_id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {m.produit_nom}
                    </Link>
                  </TD>
                )}
                <TD>
                  <Badge variant={VARIANT[m.type]}>{MOUVEMENT_LABELS[m.type]}</Badge> {statut(m)}
                  {m.motif && (
                    <span
                      className="mt-1 block max-w-36 truncate text-xs text-muted-foreground xl:hidden"
                      title={m.motif}
                    >
                      {m.motif}
                    </span>
                  )}
                </TD>
                <TD className="whitespace-nowrap">
                  <Quantite m={m} />
                </TD>
                <TD className="hidden max-w-64 truncate xl:table-cell" title={m.motif ?? undefined}>
                  {m.motif ?? "—"}
                </TD>
                <TD className="hidden xl:table-cell">{m.auteur}</TD>
                <TD className="text-right">
                  {annulables.has(m.id) && <AnnulerMouvementButton id={m.id} />}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((m) => (
          <li key={m.id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                {showProduit && (
                  <Link href={`/stocks/${m.produit_id}`} className="font-semibold text-primary">
                    {m.produit_nom}
                  </Link>
                )}
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(m.date_mouvement)} · {m.auteur}
                </p>
              </div>
              <p className="text-lg">
                <Quantite m={m} />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={VARIANT[m.type]}>{MOUVEMENT_LABELS[m.type]}</Badge>
              {statut(m)}
              {m.motif && <span className="text-sm text-muted-foreground">{m.motif}</span>}
            </div>
            {annulables.has(m.id) && <AnnulerMouvementButton id={m.id} />}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Un mouvement s'annule s'il n'est ni déjà annulé, ni une annulation ; les salariés : les leurs, sous 10 minutes. */
export function annulableIds(rows: MouvementRow[], opts: { canManage: boolean; userId: string }) {
  return new Set(
    rows
      .filter((m) => !m.annule && !m.est_annulation)
      .filter(
        (m) =>
          opts.canManage ||
          (m.cree_par === opts.userId && Date.now() - Date.parse(m.date_mouvement) < 10 * 60_000),
      )
      .map((m) => m.id),
  );
}
