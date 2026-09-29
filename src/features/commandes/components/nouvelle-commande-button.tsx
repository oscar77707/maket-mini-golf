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
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Fournisseur, Pole } from "@/types/models";
import { creerCommande } from "../actions";
import {
  commandeCreationSchema,
  type CommandeCreationInput,
  type CommandeCreationValues,
} from "../schemas";

type Props = {
  fournisseurs: Pick<Fournisseur, "id" | "nom">[];
  poles: Pole[];
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          title="Nouvelle commande"
          description="La commande est créée en brouillon : vous ajoutez ensuite les produits."
        >
          <Form {...props} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function Form({ fournisseurs, poles, isGerant, defaultPoleId, fournisseurId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CommandeCreationInput, unknown, CommandeCreationValues>({
    resolver: zodResolver(commandeCreationSchema),
    defaultValues: {
      fournisseur_id: fournisseurId ?? "",
      pole_id: defaultPoleId ?? poles[0]?.id ?? "",
      date_livraison_prevue: "",
      commentaire: "",
    },
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
      router.push(`/commandes/${result.data.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      <FormField id="fournisseur_id" label="Fournisseur" error={errors.fournisseur_id?.message}>
        <Select
          id="fournisseur_id"
          aria-invalid={!!errors.fournisseur_id}
          {...register("fournisseur_id")}
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
