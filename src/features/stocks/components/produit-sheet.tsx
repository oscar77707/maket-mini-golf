"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Produit } from "@/types/models";
import type { Referentiels } from "../queries";
import { createProduit, updateProduit } from "../actions";
import { UNITE_OPTIONS } from "../labels";
import { produitSchema, type ProduitInput, type ProduitValues } from "../schemas";

type Props = {
  referentiels: Referentiels;
  isGerant: boolean;
  defaultPoleId: number | null;
  produit?: Produit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProduitSheet({ open, onOpenChange, produit, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={produit ? `Modifier « ${produit.nom} »` : "Nouveau produit"}
        description={produit ? undefined : "Le stock de départ se saisit ensuite avec une entrée."}
      >
        <ProduitForm {...rest} produit={produit} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ProduitForm({
  referentiels,
  isGerant,
  defaultPoleId,
  produit,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = !!produit;
  const firstPole = defaultPoleId ?? referentiels.poles[0]?.id ?? "";

  const blank = (pole: number | "") => ({
    pole_id: pole,
    nom: "",
    reference: "",
    categorie_id: "",
    unite: "kg" as const,
    lieu_stockage_id: "",
    fournisseur_principal_id: "",
    prix_achat_ht: "",
    seuil_minimum: "",
    quantite_reappro: "",
    suivi_dlc: false,
    notes: "",
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<ProduitInput, unknown, ProduitValues>({
    resolver: zodResolver(produitSchema),
    defaultValues: produit
      ? {
          pole_id: produit.pole_id,
          nom: produit.nom,
          reference: produit.reference ?? "",
          categorie_id: produit.categorie_id ?? "",
          unite: produit.unite,
          lieu_stockage_id: produit.lieu_stockage_id ?? "",
          fournisseur_principal_id: produit.fournisseur_principal_id ?? "",
          prix_achat_ht: String(produit.prix_achat_ht).replace(".", ","),
          seuil_minimum: String(produit.seuil_minimum).replace(".", ","),
          quantite_reappro: String(produit.quantite_reappro).replace(".", ","),
          suivi_dlc: produit.suivi_dlc,
          notes: produit.notes ?? "",
        }
      : blank(firstPole),
  });
  const poleId = Number(useWatch({ control, name: "pole_id" }));
  const categories = referentiels.categories.filter((c) => c.pole_id === poleId);
  const lieux = referentiels.lieux.filter((l) => l.pole_id === poleId);

  const submit = (another: boolean) =>
    handleSubmit((values) => {
      setServerError(null);
      startTransition(async () => {
        const result = editing
          ? await updateProduit(produit.id, values)
          : await createProduit(values);
        if (!result.ok) {
          setServerError(result.message);
          for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
            setError(field as keyof ProduitInput, { message });
          return;
        }
        notify(result);
        router.refresh();
        if (another) {
          // « Enregistrer et ajouter un autre » : on garde pôle, unité, catégorie, lieu et fournisseur.
          reset({
            ...blank(values.pole_id),
            unite: values.unite,
            categorie_id: values.categorie_id ?? "",
            lieu_stockage_id: values.lieu_stockage_id ?? "",
            fournisseur_principal_id: values.fournisseur_principal_id ?? "",
          });
          setFocus("nom");
        } else onDone();
      });
    });

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-1 flex-col gap-4">
      <FormField id="nom" label="Nom du produit" error={errors.nom?.message}>
        <Input
          id="nom"
          autoComplete="off"
          autoFocus={!editing}
          aria-invalid={!!errors.nom}
          {...register("nom")}
        />
      </FormField>

      {isGerant && !editing && (
        <FormField id="pole_id" label="Pôle" error={errors.pole_id?.message}>
          <Select id="pole_id" {...register("pole_id")}>
            {referentiels.poles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="categorie_id" label="Catégorie" error={errors.categorie_id?.message}>
          <Select id="categorie_id" {...register("categorie_id")}>
            <option value="">Aucune</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="unite" label="Unité" error={errors.unite?.message}>
          <Select id="unite" {...register("unite")}>
            {UNITE_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="lieu_stockage_id"
          label="Lieu de stockage"
          error={errors.lieu_stockage_id?.message}
        >
          <Select id="lieu_stockage_id" {...register("lieu_stockage_id")}>
            <option value="">Non précisé</option>
            {lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="fournisseur_principal_id"
          label="Fournisseur principal"
          error={errors.fournisseur_principal_id?.message}
        >
          <Select id="fournisseur_principal_id" {...register("fournisseur_principal_id")}>
            <option value="">Aucun</option>
            {referentiels.fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="prix_achat_ht"
          label="Prix d'achat HT (€)"
          error={errors.prix_achat_ht?.message}
        >
          <Input
            id="prix_achat_ht"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!errors.prix_achat_ht}
            {...register("prix_achat_ht")}
          />
        </FormField>
        <FormField id="seuil_minimum" label="Seuil minimum" error={errors.seuil_minimum?.message}>
          <Input
            id="seuil_minimum"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!errors.seuil_minimum}
            {...register("seuil_minimum")}
          />
        </FormField>
        <FormField
          id="quantite_reappro"
          label="Quantité conseillée"
          error={errors.quantite_reappro?.message}
        >
          <Input
            id="quantite_reappro"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!errors.quantite_reappro}
            {...register("quantite_reappro")}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="reference" label="Référence (facultatif)" error={errors.reference?.message}>
          <Input id="reference" autoComplete="off" {...register("reference")} />
        </FormField>
        <label className="flex items-center gap-3 self-end pb-3 text-base">
          <Checkbox {...register("suivi_dlc")} />
          Suivre la DLC de ce produit
        </label>
      </div>

      <FormField id="notes" label="Notes (facultatif)" error={errors.notes?.message}>
        <Textarea id="notes" {...register("notes")} />
      </FormField>

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
        {!editing && (
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
