"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PoleBadge } from "@/components/ui/pole-badge";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { formatDate } from "@/lib/format";
import { createFermeture, deleteFermeture, updateFermeture } from "../actions-horaires";
import type { Fermeture } from "../queries";
import { fermetureSchema, type FermetureInput } from "../schemas";
import type { PoleOption } from "./role-pole-fields";

export function FermeturesListe({
  fermetures,
  poles,
  aujourdhui,
}: {
  fermetures: Fermeture[];
  poles: PoleOption[];
  aujourdhui: string;
}) {
  const router = useRouter();
  const [edition, setEdition] = useState<Fermeture | "nouvelle" | null>(null);
  const [pending, startTransition] = useTransition();

  const supprimer = (f: Fermeture) => {
    if (!window.confirm(`Supprimer la fermeture « ${f.motif} » ?`)) return;
    startTransition(async () => {
      const result = await deleteFermeture(f.id);
      if (notify(result)) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div className="space-y-1.5">
          <CardTitle>Fermetures exceptionnelles</CardTitle>
          <CardDescription>
            Travaux, contrôle sanitaire, événement privé, météo : un pôle ou tout le complexe.
          </CardDescription>
        </div>
        <Button onClick={() => setEdition("nouvelle")}>
          <Plus aria-hidden />
          Ajouter une fermeture
        </Button>
      </CardHeader>
      <CardContent>
        {fermetures.length === 0 ? (
          <p className="text-muted-foreground">Aucune fermeture exceptionnelle enregistrée.</p>
        ) : (
          <ul className="divide-y" aria-label="Fermetures exceptionnelles">
            {fermetures.map((f) => {
              const pole = poles.find((p) => p.id === f.pole_id);
              const terminee = f.date_fin < aujourdhui;
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {f.motif}
                      {pole ? (
                        <PoleBadge code={pole.code} nom={pole.nom} />
                      ) : (
                        <Badge>Tout le complexe</Badge>
                      )}
                      {terminee && <Badge>Terminée</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {f.date_debut === f.date_fin
                        ? `le ${formatDate(f.date_debut)}`
                        : `du ${formatDate(f.date_debut)} au ${formatDate(f.date_fin)}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Modifier la fermeture ${f.motif}`}
                      onClick={() => setEdition(f)}
                    >
                      <Pencil aria-hidden />
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      aria-label={`Supprimer la fermeture ${f.motif}`}
                      disabled={pending}
                      onClick={() => supprimer(f)}
                    >
                      <Trash2 aria-hidden />
                      Supprimer
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <Sheet open={edition !== null} onOpenChange={(open) => !open && setEdition(null)}>
        {edition && (
          <SheetContent
            title={edition === "nouvelle" ? "Nouvelle fermeture" : "Modifier la fermeture"}
            description="Les dates de début et de fin sont incluses."
          >
            <FermetureForm
              fermeture={edition === "nouvelle" ? undefined : edition}
              poles={poles}
              onDone={() => setEdition(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </Card>
  );
}

function FermetureForm({
  fermeture,
  poles,
  onDone,
}: {
  fermeture?: Fermeture;
  poles: PoleOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FermetureInput>({
    resolver: zodResolver(fermetureSchema),
    defaultValues: {
      pole_id:
        fermeture?.pole_id === null || fermeture?.pole_id === undefined
          ? ""
          : String(fermeture.pole_id),
      date_debut: fermeture?.date_debut ?? "",
      date_fin: fermeture?.date_fin ?? "",
      motif: fermeture?.motif ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = fermeture
        ? await updateFermeture(fermeture.id, values)
        : await createFermeture(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof FermetureInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      <FormField id="fermeture-motif" label="Motif" error={errors.motif?.message}>
        <Input
          id="fermeture-motif"
          autoComplete="off"
          autoFocus
          aria-invalid={!!errors.motif}
          {...register("motif")}
        />
      </FormField>
      <FormField id="fermeture-pole" label="Concerne" error={errors.pole_id?.message}>
        <Select id="fermeture-pole" {...register("pole_id")}>
          <option value="">Tout le complexe</option>
          {poles.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.nom}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="fermeture-debut" label="Du" error={errors.date_debut?.message}>
          <Input
            id="fermeture-debut"
            type="date"
            aria-invalid={!!errors.date_debut}
            {...register("date_debut")}
          />
        </FormField>
        <FormField id="fermeture-fin" label="Au" error={errors.date_fin?.message}>
          <Input
            id="fermeture-fin"
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
          {fermeture ? "Enregistrer" : "Ajouter la fermeture"}
        </Button>
      </div>
    </form>
  );
}
