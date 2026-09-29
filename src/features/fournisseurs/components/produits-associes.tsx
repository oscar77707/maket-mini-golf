"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PoleBadge } from "@/components/ui/pole-badge";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { UNITE_LABELS } from "@/features/stocks/labels";
import { formatEuro, formatNumber } from "@/lib/format";
import type { Pole, Unite } from "@/types/models";
import { removeFournisseurProduit, saveFournisseurProduit } from "../actions";
import type { ProduitAssocie } from "../queries";
import {
  fournisseurProduitSchema,
  type FournisseurProduitInput,
  type FournisseurProduitValues,
} from "../schemas";

export type ProduitAssociable = {
  id: string;
  nom: string;
  unite: Unite;
  pole_id: number;
  prix_achat_ht: number;
};

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : String(n).replace(".", ",");

export function ProduitsAssocies({
  fournisseurId,
  liens,
  associables,
  poles,
}: {
  fournisseurId: string;
  liens: ProduitAssocie[];
  associables: ProduitAssociable[];
  poles: Pole[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<{ lien?: ProduitAssocie } | null>(null);
  const poleById = new Map(poles.map((p) => [p.id, p]));
  // le nom du pôle n'est utile que si l'on mélange plusieurs pôles (gérant) ; un responsable n'en voit qu'un
  const multiPoles =
    new Set([...liens.map((l) => l.pole_id), ...associables.map((a) => a.pole_id)]).size > 1;

  const nomProduit = (l: ProduitAssocie) => (
    <Link
      href={`/stocks/${l.produit_id}`}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {l.produit_nom}
    </Link>
  );
  const poleBadge = (l: ProduitAssocie, className: string) =>
    multiPoles &&
    poleById.get(l.pole_id) && (
      <PoleBadge
        code={poleById.get(l.pole_id)!.code}
        nom={poleById.get(l.pole_id)!.nom}
        className={`${className} px-2 py-0 text-xs`}
      />
    );
  const prix = (l: ProduitAssocie) =>
    l.prix_ht === null ? (
      <span className="text-muted-foreground">{formatEuro(l.prix_achat_ht)} (produit)</span>
    ) : (
      formatEuro(l.prix_ht)
    );
  const conditionnement = (l: ProduitAssocie) =>
    `${formatNumber(l.conditionnement, 3)} ${UNITE_LABELS[l.unite]}`;
  const actions = (l: ProduitAssocie) => (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Modifier ${l.produit_nom}`}
        onClick={() => setSheet({ lien: l })}
      >
        <Pencil aria-hidden className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Retirer ${l.produit_nom}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Retirer « ${l.produit_nom} » de ce fournisseur ?`)) return;
          startTransition(async () => {
            notify(await removeFournisseurProduit(fournisseurId, l.produit_id));
            router.refresh();
          });
        }}
      >
        <Trash2 aria-hidden className="size-4" />
      </Button>
    </div>
  );

  return (
    <section className="space-y-3" aria-labelledby="produits-associes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="produits-associes" className="text-lg font-semibold">
          Produits de ce fournisseur
        </h2>
        <Button variant="outline" onClick={() => setSheet({})} disabled={associables.length === 0}>
          <Plus aria-hidden />
          Associer un produit
        </Button>
      </div>

      {liens.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-6 text-center text-muted-foreground">
          Aucun produit associé. Associez les produits que ce fournisseur vous livre pour connaître
          leur prix et leur conditionnement.
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH scope="col">Produit</TH>
                  <TH scope="col">Réf. fournisseur</TH>
                  <TH scope="col">Prix HT</TH>
                  <TH scope="col">Conditionnement</TH>
                  <TH scope="col">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {liens.map((l) => (
                  <TR key={l.produit_id}>
                    <TD>
                      {nomProduit(l)}
                      {poleBadge(l, "ml-2")}
                    </TD>
                    <TD>{l.reference_fournisseur ?? "—"}</TD>
                    <TD>{prix(l)}</TD>
                    <TD>{conditionnement(l)}</TD>
                    <TD className="text-right">{actions(l)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {liens.map((l) => (
              <li key={l.produit_id} className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    {nomProduit(l)}
                    {poleBadge(l, "ml-0 block w-fit")}
                  </div>
                  {actions(l)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {prix(l)} · {conditionnement(l)}
                  {l.reference_fournisseur ? ` · réf. ${l.reference_fournisseur}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent
          title={sheet?.lien ? `Modifier « ${sheet.lien.produit_nom} »` : "Associer un produit"}
          description="Le prix et le conditionnement servent aux commandes pré-remplies."
        >
          {sheet && (
            <LienForm
              key={sheet.lien?.produit_id ?? "nouveau"}
              fournisseurId={fournisseurId}
              lien={sheet.lien}
              associables={associables}
              poles={poles}
              multiPoles={multiPoles}
              onDone={() => setSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function LienForm({
  fournisseurId,
  lien,
  associables,
  poles,
  multiPoles,
  onDone,
}: {
  fournisseurId: string;
  lien?: ProduitAssocie;
  associables: ProduitAssociable[];
  poles: Pole[];
  multiPoles: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const poleById = new Map(poles.map((p) => [p.id, p.nom]));
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FournisseurProduitInput, unknown, FournisseurProduitValues>({
    resolver: zodResolver(fournisseurProduitSchema),
    defaultValues: {
      fournisseur_id: fournisseurId,
      produit_id: lien?.produit_id ?? "",
      reference_fournisseur: lien?.reference_fournisseur ?? "",
      prix_ht: num(lien?.prix_ht),
      conditionnement: num(lien?.conditionnement ?? 1),
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveFournisseurProduit(values);
      if (!result.ok) return setServerError(result.message);
      notify(result);
      router.refresh();
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      <input type="hidden" {...register("fournisseur_id")} />
      {lien ? (
        <input type="hidden" {...register("produit_id")} />
      ) : (
        <FormField id="produit_id" label="Produit" error={errors.produit_id?.message}>
          <Select
            id="produit_id"
            aria-invalid={!!errors.produit_id}
            {...register("produit_id", {
              onChange: (e) => {
                const p = associables.find((a) => a.id === e.target.value);
                if (p) setValue("prix_ht", num(p.prix_achat_ht));
              },
            })}
          >
            <option value="">Choisissez un produit</option>
            {associables.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
                {multiPoles ? ` (${poleById.get(p.pole_id)})` : ""}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <FormField
        id="reference_fournisseur"
        label="Référence chez le fournisseur (facultatif)"
        error={errors.reference_fournisseur?.message}
      >
        <Input
          id="reference_fournisseur"
          autoComplete="off"
          {...register("reference_fournisseur")}
        />
      </FormField>
      <FormField
        id="prix_ht"
        label="Prix d'achat HT (€, facultatif)"
        hint="Laissez vide pour utiliser le prix d'achat du produit."
        error={errors.prix_ht?.message}
      >
        <Input id="prix_ht" inputMode="decimal" {...register("prix_ht")} />
      </FormField>
      <FormField
        id="conditionnement"
        label="Conditionnement"
        hint="Les commandes sont arrondies à ce multiple (ex. carton de 6)."
        error={errors.conditionnement?.message}
      >
        <Input
          id="conditionnement"
          inputMode="decimal"
          aria-invalid={!!errors.conditionnement}
          {...register("conditionnement")}
        />
      </FormField>
      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}
      <div className="mt-auto pt-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
