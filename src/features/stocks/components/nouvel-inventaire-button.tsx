"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Referentiels } from "../queries";
import { creerInventaire } from "../actions";
import { inventaireCreationSchema, type InventaireCreationInput } from "../schemas";

export function NouvelInventaireButton({
  referentiels,
  isGerant,
  defaultPoleId,
}: {
  referentiels: Referentiels;
  isGerant: boolean;
  defaultPoleId: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ClipboardCheck aria-hidden />
        Nouvel inventaire
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          title="Nouvel inventaire"
          description="Tous les produits actifs du lieu choisi seront à compter."
        >
          <Form referentiels={referentiels} isGerant={isGerant} defaultPoleId={defaultPoleId} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function Form({
  referentiels,
  isGerant,
  defaultPoleId,
}: {
  referentiels: Referentiels;
  isGerant: boolean;
  defaultPoleId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<InventaireCreationInput, unknown, ReturnType<typeof inventaireCreationSchema.parse>>({
    resolver: zodResolver(inventaireCreationSchema),
    defaultValues: {
      pole_id: defaultPoleId ?? referentiels.poles[0]?.id ?? "",
      lieu_stockage_id: "",
      commentaire: "",
    },
  });
  const poleId = Number(useWatch({ control, name: "pole_id" }));
  const lieux = referentiels.lieux.filter((l) => l.pole_id === poleId);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await creerInventaire(values);
      if (!result.ok) return setServerError(result.message);
      notify(result);
      router.push(`/stocks/inventaires/${result.data.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      {isGerant && (
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
      <FormField
        id="lieu_stockage_id"
        label="Lieu de stockage"
        error={errors.lieu_stockage_id?.message}
        hint="Comptez un lieu à la fois : c'est plus rapide et plus fiable."
      >
        <Select id="lieu_stockage_id" {...register("lieu_stockage_id")}>
          <option value="">Tout le pôle</option>
          {lieux.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nom}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        id="commentaire"
        label="Commentaire (facultatif)"
        error={errors.commentaire?.message}
      >
        <Input id="commentaire" autoComplete="off" {...register("commentaire")} />
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
          Commencer l&apos;inventaire
        </Button>
      </div>
    </form>
  );
}
