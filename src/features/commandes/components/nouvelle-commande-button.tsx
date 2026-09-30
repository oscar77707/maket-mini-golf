"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BrouillonBanner } from "@/components/feedback/brouillon-banner";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { useQuickAdd } from "@/features/quick-add/context";
import { useFormDraft } from "@/hooks/use-form-draft";
import type { Fournisseur, Pole } from "@/types/models";
import { creerCommande } from "../actions";
import {
  commandeCreationSchema,
  type CommandeCreationInput,
  type CommandeCreationValues,
} from "../schemas";

type Props = {
  fournisseurs: Pick<Fournisseur, "id" | "nom">[];
  poles: Pick<Pole, "id" | "nom">[];
  isGerant: boolean;
  defaultPoleId: number | null;
  /** Fournisseur présélectionné (fiche fournisseur). */
  fournisseurId?: string;
};

export function NouvelleCommandeButton({
  variant,
  children = "Nouvelle commande",
  ...props
}: Props & { variant?: ButtonProps["variant"]; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {children}
      </Button>
      <NouvelleCommandeSheet {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Tiroir de création d'un brouillon, aussi ouvert par « + Ajouter », la palette et la touche N. */
export function NouvelleCommandeSheet({
  open,
  onOpenChange,
  ...props
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Nouvelle commande"
        description="La commande est créée en brouillon : vous ajoutez ensuite les produits."
      >
        <Form {...props} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function Form({
  fournisseurs,
  poles,
  isGerant,
  defaultPoleId,
  fournisseurId,
  onDone,
}: Props & { onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const vierge: CommandeCreationInput = {
    fournisseur_id: fournisseurId ?? "",
    pole_id: defaultPoleId ?? poles[0]?.id ?? "",
    date_livraison_prevue: "",
    commentaire: "",
  };
  const form = useForm<CommandeCreationInput, unknown, CommandeCreationValues>({
    resolver: zodResolver(commandeCreationSchema),
    defaultValues: vierge,
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  const { utilisateurId } = useQuickAdd();
  // un brouillon par pôle proposé : rouvrir le tiroir sous un autre filtre de pôle repart de zéro
  const brouillon = useFormDraft(form, {
    cle: `commande-${vierge.pole_id}`,
    utilisateurId,
    actif: !fournisseurId,
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await creerCommande(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof CommandeCreationInput, { message });
        return;
      }
      notify(result);
      brouillon.clear();
      onDone();
      router.push(`/commandes/${result.data.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      {brouillon.repris && <BrouillonBanner onEffacer={() => brouillon.discard(vierge)} />}
      <FormField id="fournisseur_id" label="Fournisseur" error={errors.fournisseur_id?.message}>
        <Select
          id="fournisseur_id"
          autoFocus={!fournisseurId}
          aria-invalid={!!errors.fournisseur_id}
          {...register("fournisseur_id")}
          onKeyDown={(e) => {
            // Entrée sur la liste fermée valide le formulaire (une liste ne le fait pas d'elle-même)
            if (e.key === "Enter") {
              e.preventDefault();
              if (!pending && !e.repeat) void onSubmit();
            }
          }}
        >
          <option value="">Choisissez un fournisseur</option>
          {fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </Select>
      </FormField>
      {isGerant && (
        <FormField id="pole_id" label="Pôle" error={errors.pole_id?.message}>
          <Select id="pole_id" {...register("pole_id")}>
            {poles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <FormField
        id="date_livraison_prevue"
        label="Livraison souhaitée (facultatif)"
        hint="Laissez vide pour utiliser le délai habituel du fournisseur."
        error={errors.date_livraison_prevue?.message}
      >
        <Input id="date_livraison_prevue" type="date" {...register("date_livraison_prevue")} />
      </FormField>
      <FormField
        id="commentaire"
        label="Commentaire pour le fournisseur (facultatif)"
        error={errors.commentaire?.message}
      >
        <Textarea id="commentaire" rows={3} {...register("commentaire")} />
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
          Créer le brouillon
        </Button>
      </div>
    </form>
  );
}
