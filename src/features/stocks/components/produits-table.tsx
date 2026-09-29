"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDown,
  ArrowUp,
  ArchiveRestore,
  Archive,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import { PoleBadge } from "@/components/ui/pole-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notify } from "@/components/feedback/notify";
import { useUrlState } from "@/hooks/use-url-state";
import { formatEuro, formatNumber } from "@/lib/format";
import type { Pole, ProduitStock, TypeMouvement } from "@/types/models";
import type { Referentiels } from "../queries";
import { archiverProduits } from "../actions";
import { UNITE_LABELS } from "../labels";
import { AlerteBadge } from "./alert-badge";
import { CommanderButton } from "./commander-button";
import { MouvementSheet, type MouvementProduit } from "./mouvement-sheet";

type Props = {
  rows: ProduitStock[];
  total: number;
  page: number;
  pageSize: number;
  referentiels: Referentiels;
  showPole: boolean;
  canManage: boolean;
  canCorrect: boolean;
  archived: boolean;
  sort: { tri: string; sens: "asc" | "desc" };
};

/** Colonnes secondaires masquées sur les écrans étroits (leur contenu est alors repris sous le nom ou le stock). */
const COLUMN_VISIBILITY: Record<string, string> = {
  categorie: "hidden 2xl:table-cell",
  fournisseur: "hidden 2xl:table-cell",
  seuil: "hidden xl:table-cell",
  valeur: "hidden xl:table-cell",
};

export function ProduitsTable({
  rows,
  total,
  page,
  pageSize,
  referentiels,
  showPole,
  canManage,
  canCorrect,
  archived,
  sort,
}: Props) {
  const router = useRouter();
  const { update } = useUrlState();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [mouvement, setMouvement] = useState<{
    produit: MouvementProduit;
    type: TypeMouvement;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const poleById = useMemo(
    () => new Map<number, Pole>(referentiels.poles.map((p) => [p.id, p])),
    [referentiels.poles],
  );
  const categorie = useMemo(
    () => new Map(referentiels.categories.map((c) => [c.id, c.nom])),
    [referentiels.categories],
  );
  const fournisseur = useMemo(
    () => new Map(referentiels.fournisseurs.map((f) => [f.id, f.nom])),
    [referentiels.fournisseurs],
  );

  const open = (p: ProduitStock, type: TypeMouvement) =>
    setMouvement({
      produit: {
        id: p.id,
        nom: p.nom,
        unite: p.unite,
        stock_actuel: p.stock_actuel,
        suivi_dlc: p.suivi_dlc,
      },
      type,
    });

  const sortButton = (key: string, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() =>
        update({ tri: key, sens: sort.tri === key && sort.sens === "asc" ? "desc" : "asc" })
      }
    >
      {label}
      {sort.tri === key &&
        (sort.sens === "asc" ? (
          <ArrowUp aria-label="tri croissant" className="size-4" />
        ) : (
          <ArrowDown aria-label="tri décroissant" className="size-4" />
        ))}
    </button>
  );

  const columns = useMemo<ColumnDef<ProduitStock>[]>(
    () => [
      ...(canManage
        ? [
            {
              id: "select",
              header: ({ table }) => (
                <Checkbox
                  aria-label="Tout sélectionner"
                  checked={table.getIsAllRowsSelected()}
                  onChange={table.getToggleAllRowsSelectedHandler()}
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  aria-label={`Sélectionner ${row.original.nom}`}
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                />
              ),
            } satisfies ColumnDef<ProduitStock>,
          ]
        : []),
      {
        id: "nom",
        header: () => sortButton("nom", "Produit"),
        cell: ({ row: { original: p } }) => (
          <div className="space-y-1">
            <Link
              href={`/stocks/${p.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {p.nom}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {p.categorie_id && (
                <span className="2xl:hidden">{categorie.get(p.categorie_id)}</span>
              )}
              {p.reference && <span>{p.reference}</span>}
              {showPole && poleById.get(p.pole_id) && (
                <PoleBadge
                  code={poleById.get(p.pole_id)!.code}
                  nom={poleById.get(p.pole_id)!.nom}
                  className="px-2 py-0 text-xs"
                />
              )}
            </div>
          </div>
        ),
      },
      {
        id: "categorie",
        header: "Catégorie",
        cell: ({ row: { original: p } }) => (p.categorie_id ? categorie.get(p.categorie_id) : "—"),
      },
      {
        id: "stock",
        header: () => sortButton("stock", "Stock"),
        cell: ({ row: { original: p } }) => (
          <div className="space-y-1">
            <span className="text-base font-semibold">
              {formatNumber(p.stock_actuel, 3)} {UNITE_LABELS[p.unite]}
            </span>
            <div>
              <AlerteBadge niveau={p.niveau_alerte} />
            </div>
            <p className="text-xs text-muted-foreground xl:hidden">
              seuil {formatNumber(p.seuil_minimum, 3)} {UNITE_LABELS[p.unite]}
            </p>
          </div>
        ),
      },
      {
        id: "seuil",
        header: "Seuil",
        cell: ({ row: { original: p } }) =>
          `${formatNumber(p.seuil_minimum, 3)} ${UNITE_LABELS[p.unite]}`,
      },
      {
        id: "valeur",
        header: () => sortButton("valeur", "Valeur"),
        cell: ({ row: { original: p } }) => formatEuro(p.valeur_stock_ht),
      },
      {
        id: "fournisseur",
        header: "Fournisseur",
        cell: ({ row: { original: p } }) =>
          p.fournisseur_principal_id ? fournisseur.get(p.fournisseur_principal_id) : "—",
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row: { original: p } }) =>
          archived ? null : (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => open(p, "entree")}
                aria-label={`Ajouter une entrée pour ${p.nom}`}
              >
                <ArrowDownToLine aria-hidden className="size-4" />
                Entrée
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => open(p, "sortie")}
                aria-label={`Ajouter une sortie pour ${p.nom}`}
              >
                <ArrowUpFromLine aria-hidden className="size-4" />
                Sortie
              </Button>
              {canManage && p.niveau_alerte !== "ok" && (
                <CommanderButton
                  size="sm"
                  variant="secondary"
                  produitIds={[p.id]}
                  aria-label={`Commander ${p.nom}`}
                >
                  Commander
                </CommanderButton>
              )}
            </div>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, showPole, archived, sort.tri, sort.sens, poleById, categorie, fournisseur],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: canManage,
  });

  const selectedIds = Object.keys(selection).filter((id) => selection[id]);

  const archive = (ids: string[], value: boolean) =>
    startTransition(async () => {
      const result = await archiverProduits(ids, value);
      notify(result, {
        undo: {
          onClick: async () => {
            notify(await archiverProduits(ids, !value));
            router.refresh();
          },
        },
      });
      setSelection({});
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Actions sur la sélection"
          className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm"
        >
          <span className="mr-2 font-medium">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <Button asChild variant="outline" size="sm">
            <a href={`/stocks/export?ids=${selectedIds.join(",")}${archived ? "&archives=1" : ""}`}>
              <Download aria-hidden />
              Exporter
            </a>
          </Button>
          {!archived && (
            <CommanderButton size="sm" variant="secondary" produitIds={selectedIds}>
              Commander
            </CommanderButton>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => archive(selectedIds, !archived)}
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? "Restaurer" : "Archiver"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
            Tout désélectionner
          </Button>
        </div>
      )}

      {/* Ordinateur : tableau */}
      <div className="hidden md:block">
        <Table>
          <THead>
            {table.getHeaderGroups().map((hg) => (
              <TR key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TH key={h.id} scope="col" className={COLUMN_VISIBILITY[h.column.id]}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TH>
                ))}
              </TR>
            ))}
          </THead>
          <TBody>
            {table.getRowModel().rows.map((row) => (
              <TR key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TD key={cell.id} className={COLUMN_VISIBILITY[cell.column.id]}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Téléphone : cartes avec gros boutons */}
      <ul className="space-y-3 md:hidden">
        {rows.map((p) => (
          <li key={p.id} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Link href={`/stocks/${p.id}`} className="block text-lg font-semibold text-primary">
                  {p.nom}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {p.categorie_id && <span>{categorie.get(p.categorie_id)}</span>}
                  {showPole && poleById.get(p.pole_id) && (
                    <PoleBadge
                      code={poleById.get(p.pole_id)!.code}
                      nom={poleById.get(p.pole_id)!.nom}
                      className="px-2 py-0 text-xs"
                    />
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold">
                  {formatNumber(p.stock_actuel, 3)}{" "}
                  <span className="text-base font-medium">{UNITE_LABELS[p.unite]}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  seuil {formatNumber(p.seuil_minimum, 3)}
                </p>
              </div>
            </div>
            <AlerteBadge niveau={p.niveau_alerte} />
            {!archived && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" variant="outline" onClick={() => open(p, "entree")}>
                  <ArrowDownToLine aria-hidden />+ Entrée
                </Button>
                <Button size="lg" variant="outline" onClick={() => open(p, "sortie")}>
                  <ArrowUpFromLine aria-hidden />+ Sortie
                </Button>
                {canManage && p.niveau_alerte !== "ok" && (
                  <CommanderButton
                    size="lg"
                    variant="secondary"
                    produitIds={[p.id]}
                    className="col-span-2"
                  >
                    Commander
                  </CommanderButton>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => update({ page: String(p) }, { keepPage: true })}
        onPageSizeChange={(s) => update({ taille: String(s) })}
      />
      <MouvementSheet
        produit={mouvement?.produit ?? null}
        type={mouvement?.type}
        canCorrect={canCorrect}
        open={mouvement !== null}
        onOpenChange={(o) => !o && setMouvement(null)}
      />
    </div>
  );
}
