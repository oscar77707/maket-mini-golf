"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { formatDate } from "@/lib/format";
import { createSaison, deleteSaison, updateSaison } from "../actions-horaires";
import type { Saison } from "../queries";
import { saisonSchema, type SaisonInput } from "../schemas";

export function SaisonsListe({ saisons }: { saisons: Saison[] }) {
  const router = useRouter();
  const [edition, setEdition] = useState<Saison | "nouvelle" | null>(null);
  const [pending, startTransition] = useTransition();

  const supprimer = (s: Saison) => {
    if (!window.confirm(`Supprimer la saison « ${s.nom} » ? Ses horaires seront supprimés aussi.`))
      return;
    startTransition(async () => {
      const result = await deleteSaison(s.id);
      if (notify(result)) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div className="space-y-1.5">
          <CardTitle>Saisons</CardTitle>
          <CardDescription>
            Les horaires se règlent saison par saison. Deux saisons ne peuvent pas se chevaucher.
          </CardDescription>
        </div>
        <Button onClick={() => setEdition("nouvelle")}>
          <Plus aria-hidden />
          Nouvelle saison
        </Button>
      </CardHeader>
      <CardContent>
        {saisons.length === 0 ? (
          <p className="text-muted-foreground">
            Aucune saison : créez-en une pour régler les horaires.
          </p>
        ) : (
          <ul className="divide-y" aria-label="Saisons">
            {saisons.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{s.nom}</p>
                  <p className="text-sm text-muted-foreground">
                    du {formatDate(s.date_debut)} au {formatDate(s.date_fin)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Modifier la saison ${s.nom}`}
                    onClick={() => setEdition(s)}
                  >
                    <Pencil aria-hidden />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    aria-label={`Supprimer la saison ${s.nom}`}
                    disabled={pending}
                    onClick={() => supprimer(s)}
                  >
                    <Trash2 aria-hidden />
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Sheet open={edition !== null} onOpenChange={(open) => !open && setEdition(null)}>
        {edition && (
          <SheetContent
            title={edition === "nouvelle" ? "Nouvelle saison" : `Modifier « ${edition.nom} »`}
            description="Les dates de début et de fin sont incluses."
          >
            <SaisonForm
              saison={edition === "nouvelle" ? undefined : edition}
              onDone={() => setEdition(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </Card>
  );
}

function SaisonForm({ saison, onDone }: { saison?: Saison; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SaisonInput>({
    resolver: zodResolver(saisonSchema),
    defaultValues: {
      nom: saison?.nom ?? "",
      date_debut: saison?.date_debut ?? "",
      date_fin: saison?.date_fin ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = saison ? await updateSaison(saison.id, values) : await createSaison(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof SaisonInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      <FormField id="saison-nom" label="Nom de la saison" error={errors.nom?.message}>
        <Input
          id="saison-nom"
          autoComplete="off"
          autoFocus
          aria-invalid={!!errors.nom}
          {...register("nom")}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="saison-debut" label="Début" error={errors.date_debut?.message}>
          <Input
            id="saison-debut"
            type="date"
            aria-invalid={!!errors.date_debut}
            {...register("date_debut")}
          />
        </FormField>
        <FormField id="saison-fin" label="Fin" error={errors.date_fin?.message}>
          <Input
            id="saison-fin"
            type="date"
            aria-invalid={!!errors.date_fin}
            {...register("date_fin")}
          />
        </FormField>
      </div>
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
          {saison ? "Enregistrer" : "Créer la saison"}
        </Button>
      </div>
    </form>
  );
}
