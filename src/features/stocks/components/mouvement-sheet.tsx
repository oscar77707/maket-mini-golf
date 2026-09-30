"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { TypeMouvement, Unite } from "@/types/models";
import { annulerMouvement, enregistrerMouvement } from "../actions";
import { MOTIFS_COURANTS, MOUVEMENT_LABELS, UNITE_LABELS } from "../labels";
import { mouvementSchema, type MouvementInput, type MouvementValues } from "../schemas";

export type MouvementProduit = {
  id: string;
  nom: string;
  unite: Unite;
  stock_actuel: number;
  suivi_dlc: boolean;
};

export function MouvementSheet({
  produit,
  type = "entree",
  canCorrect,
  open,
  onOpenChange,
  selecteur,
  onAutre,
  onChangerProduit,
}: {
  produit: MouvementProduit | null;
  type?: TypeMouvement;
  canCorrect: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ajout rapide : sélecteur de produit affiché tant qu'aucun produit n'est choisi. */
  selecteur?: React.ReactNode;
  /** Ajout rapide : « Enregistrer et ajouter un autre » (le type de mouvement est conservé). */
  onAutre?: (type: TypeMouvement) => void;
  onChangerProduit?: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={produit ? `Mouvement : ${produit.nom}` : "Mouvement de stock"}
        description={
          produit
            ? `Stock actuel : ${formatNumber(produit.stock_actuel, 3)} ${UNITE_LABELS[produit.unite]}`
            : "Choisissez d'abord le produit concerné."
        }
      >
        {produit ? (
          <>
            {onChangerProduit && (
              <button
                type="button"
                onClick={onChangerProduit}
                className="-mt-2 self-start text-sm font-medium text-primary underline underline-offset-4"
              >
                Changer de produit
              </button>
            )}
            <MouvementForm
              key={produit.id}
              produit={produit}
              initialType={type}
              canCorrect={canCorrect}
              onDone={() => onOpenChange(false)}
              onAutre={onAutre}
            />
          </>
        ) : (
          selecteur
        )}
      </SheetContent>
    </Sheet>
  );
}

function MouvementForm({
  produit,
  initialType,
  canCorrect,
  onDone,
  onAutre,
}: {
  produit: MouvementProduit;
  initialType: TypeMouvement;
  canCorrect: boolean;
  onDone: () => void;
  onAutre?: (type: TypeMouvement) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<MouvementInput, unknown, MouvementValues>({
    resolver: zodResolver(mouvementSchema),
    defaultValues: {
      produit_id: produit.id,
      type: initialType,
      quantite: "",
      motif: "",
      dlc: "",
      numero_lot: "",
    },
  });
  const type = useWatch({ control, name: "type" });
  const quantiteSaisie = String(useWatch({ control, name: "quantite" }) ?? "");
  const quantite = Number(quantiteSaisie.replace(",", "."));
  const unite = UNITE_LABELS[produit.unite];
  const types: TypeMouvement[] = canCorrect
    ? ["entree", "sortie", "perte", "correction"]
    : ["entree", "sortie", "perte"];
  const ecart =
    type === "correction" && Number.isFinite(quantite) && quantiteSaisie !== ""
      ? quantite - produit.stock_actuel
      : null;

  const submit = (autre: boolean) =>
    handleSubmit((values) => {
      setServerError(null);
      startTransition(async () => {
        const result = await enregistrerMouvement(values);
        if (!result.ok) {
          setServerError(result.message);
          for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
            if (field in values) setError(field as keyof MouvementInput, { message });
          }
          return;
        }
        const id = result.data.id;
        notify(result, {
          undo: {
            onClick: async () => {
              notify(await annulerMouvement(id));
              router.refresh();
            },
          },
        });
        router.refresh();
        if (autre && onAutre) onAutre(values.type);
        else onDone();
      });
    });

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-1 flex-col gap-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type de mouvement</legend>
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setValue("type", t, { shouldValidate: false })}
              className={cn(
                "h-12 rounded-md border text-base font-medium",
                type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {MOUVEMENT_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <FormField
        id="quantite"
        label={type === "correction" ? `Stock réel constaté (${unite})` : `Quantité (${unite})`}
        error={errors.quantite?.message}
        hint={
          type === "correction" && ecart !== null
            ? `Écart avec le stock actuel : ${ecart > 0 ? "+" : ""}${formatNumber(ecart, 3)} ${unite}`
            : undefined
        }
      >
        <Input
          id="quantite"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          className="h-14 text-2xl"
          aria-invalid={!!errors.quantite}
          {...register("quantite")}
        />
      </FormField>

      {type === "entree" && produit.suivi_dlc && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="dlc" label="DLC (date limite)" error={errors.dlc?.message}>
            <Input id="dlc" type="date" aria-invalid={!!errors.dlc} {...register("dlc")} />
          </FormField>
          <FormField
            id="numero_lot"
            label="N° de lot (facultatif)"
            error={errors.numero_lot?.message}
          >
            <Input id="numero_lot" autoComplete="off" {...register("numero_lot")} />
          </FormField>
        </div>
      )}

      <FormField
        id="motif"
        label={type === "perte" || type === "correction" ? "Motif" : "Motif (facultatif)"}
        error={errors.motif?.message}
      >
        <Input id="motif" autoComplete="off" aria-invalid={!!errors.motif} {...register("motif")} />
      </FormField>
      {(type === "perte" || type === "correction") && (
        <div className="-mt-3 flex flex-wrap gap-2">
          {MOTIFS_COURANTS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setValue("motif", m, { shouldValidate: true })}
              className="h-9 rounded-full border bg-card px-3 text-sm hover:bg-muted"
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row-reverse">
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          Enregistrer
        </Button>
        {onAutre && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={pending}
            onClick={() => void submit(true)()}
          >
            Enregistrer et ajouter un autre
          </Button>
        )}
      </div>
    </form>
  );
}
