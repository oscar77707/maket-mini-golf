"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Fournisseur } from "@/types/models";
import { createFournisseur, updateFournisseur } from "../actions";
import { MODE_LABELS } from "../labels";
import { fournisseurSchema, type FournisseurInput, type FournisseurValues } from "../schemas";
import { JoursSelect } from "./jours-select";

const num = (n: number) => String(n).replace(".", ",");

export function FournisseurSheet({
  open,
  onOpenChange,
  fournisseur,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fournisseur?: Fournisseur;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={fournisseur ? `Modifier « ${fournisseur.nom} »` : "Nouveau fournisseur"}
        description="Ces informations servent à préparer et envoyer les commandes."
      >
        <FournisseurForm fournisseur={fournisseur} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function FournisseurForm({
  fournisseur,
  onDone,
}: {
  fournisseur?: Fournisseur;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FournisseurInput, unknown, FournisseurValues>({
    resolver: zodResolver(fournisseurSchema),
    defaultValues: fournisseur
      ? {
          nom: fournisseur.nom,
          contact_nom: fournisseur.contact_nom ?? "",
          email: fournisseur.email ?? "",
          telephone: fournisseur.telephone ?? "",
          mode_commande: fournisseur.mode_commande,
          url_portail: fournisseur.url_portail ?? "",
          jours_commande: fournisseur.jours_commande,
          jours_livraison: fournisseur.jours_livraison,
          delai_livraison_jours: num(fournisseur.delai_livraison_jours),
          minimum_commande_ht: num(fournisseur.minimum_commande_ht),
          adresse: fournisseur.adresse ?? "",
          notes: fournisseur.notes ?? "",
        }
      : {
          nom: "",
          contact_nom: "",
          email: "",
          telephone: "",
          mode_commande: "email",
          url_portail: "",
          jours_commande: [],
          jours_livraison: [],
          delai_livraison_jours: "1",
          minimum_commande_ht: "0",
          adresse: "",
          notes: "",
        },
  });
  const mode = useWatch({ control, name: "mode_commande" });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = fournisseur
        ? await updateFournisseur(fournisseur.id, values)
        : await createFournisseur(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof FournisseurInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      onDone();
      if (result.data && "id" in result.data) router.push(`/fournisseurs/${result.data.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      <FormField id="nom" label="Nom du fournisseur" error={errors.nom?.message}>
        <Input
          id="nom"
          autoComplete="off"
          autoFocus={!fournisseur}
          aria-invalid={!!errors.nom}
          {...register("nom")}
        />
      </FormField>
      <FormField id="mode_commande" label="Mode de commande" error={errors.mode_commande?.message}>
        <Select id="mode_commande" {...register("mode_commande")}>
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        id="email"
        label={mode === "email" ? "Adresse e-mail (obligatoire)" : "Adresse e-mail"}
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      {mode === "portail" && (
        <FormField
          id="url_portail"
          label="Adresse du portail de commande"
          error={errors.url_portail?.message}
        >
          <Input
            id="url_portail"
            inputMode="url"
            placeholder="https://"
            aria-invalid={!!errors.url_portail}
            {...register("url_portail")}
          />
        </FormField>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contact_nom" label="Contact" error={errors.contact_nom?.message}>
          <Input id="contact_nom" autoComplete="off" {...register("contact_nom")} />
        </FormField>
        <FormField id="telephone" label="Téléphone" error={errors.telephone?.message}>
          <Input
            id="telephone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            {...register("telephone")}
          />
        </FormField>
      </div>
      <div className="space-y-2">
        <Label>Jours où l&apos;on peut commander</Label>
        <Controller
          control={control}
          name="jours_commande"
          render={({ field }) => (
            <JoursSelect
              label="Jours de commande"
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="space-y-2">
        <Label>Jours de livraison</Label>
        <Controller
          control={control}
          name="jours_livraison"
          render={({ field }) => (
            <JoursSelect
              label="Jours de livraison"
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="delai_livraison_jours"
          label="Délai de livraison (jours)"
          error={errors.delai_livraison_jours?.message}
        >
          <Input
            id="delai_livraison_jours"
            inputMode="numeric"
            aria-invalid={!!errors.delai_livraison_jours}
            {...register("delai_livraison_jours")}
          />
        </FormField>
        <FormField
          id="minimum_commande_ht"
          label="Minimum de commande HT (€)"
          error={errors.minimum_commande_ht?.message}
        >
          <Input
            id="minimum_commande_ht"
            inputMode="decimal"
            aria-invalid={!!errors.minimum_commande_ht}
            {...register("minimum_commande_ht")}
          />
        </FormField>
      </div>
      <FormField id="adresse" label="Adresse (facultatif)" error={errors.adresse?.message}>
        <Input id="adresse" autoComplete="off" {...register("adresse")} />
      </FormField>
      <FormField id="notes" label="Notes (facultatif)" error={errors.notes?.message}>
        <Textarea id="notes" rows={3} {...register("notes")} />
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
          {fournisseur ? "Enregistrer" : "Créer le fournisseur"}
        </Button>
      </div>
    </form>
  );
}
