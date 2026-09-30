"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CopyCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notify } from "@/components/feedback/notify";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDate } from "@/lib/format";
import { saveHoraires } from "../actions-horaires";
import { JOURS } from "../labels";
import type { Horaire, Saison } from "../queries";
import { horairesSchema, type HorairesInput } from "../schemas";
import type { PoleOption } from "./role-pole-fields";

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function HorairesEditeur({
  saisons,
  poles,
  saisonId,
  poleId,
  horaires,
}: {
  saisons: Saison[];
  poles: PoleOption[];
  saisonId: string;
  poleId: number;
  horaires: Horaire[];
}) {
  const { update, pending: navigation } = useUrlState();
  const pole = poles.find((p) => p.id === poleId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Horaires d&apos;ouverture</CardTitle>
        <CardDescription>
          Une fermeture avant l&apos;ouverture veut dire « après minuit » (par exemple 18:00 à
          01:00).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4" aria-busy={navigation}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="choix-saison" className="text-sm font-medium">
              Saison
            </label>
            <Select
              id="choix-saison"
              value={saisonId}
              onChange={(e) => update({ saison: e.target.value })}
            >
              {saisons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom} ({formatDate(s.date_debut)} au {formatDate(s.date_fin)})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="choix-pole" className="text-sm font-medium">
              Pôle
            </label>
            <Select
              id="choix-pole"
              value={pole?.code ?? ""}
              onChange={(e) => update({ pole: e.target.value })}
            >
              {poles.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nom}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <SemaineForm
          key={`${saisonId}-${poleId}-${horaires.map((h) => h.updated_at).join()}`}
          saisonId={saisonId}
          poleId={poleId}
          horaires={horaires}
        />
      </CardContent>
    </Card>
  );
}

function SemaineForm({
  saisonId,
  poleId,
  horaires,
}: {
  saisonId: string;
  poleId: number;
  horaires: Horaire[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const parJour = new Map(horaires.map((h) => [h.jour_semaine, h]));
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<HorairesInput>({
    resolver: zodResolver(horairesSchema),
    defaultValues: {
      saison_id: saisonId,
      pole_id: poleId,
      jours: JOURS.map((j) => {
        const h = parJour.get(j.id);
        return {
          jour_semaine: j.id,
          // jour jamais réglé : proposé ouvert sur une plage courante, à ajuster
          ferme: h ? h.ferme : false,
          ouverture: hhmm(h?.ouverture) || "10:00",
          fermeture: hhmm(h?.fermeture) || "19:00",
        };
      }),
    },
  });
  const { fields } = useFieldArray({ control, name: "jours" });

  const appliquerLundi = () => {
    const lundi = getValues("jours.0");
    for (let i = 1; i < 7; i++) {
      setValue(`jours.${i}.ferme`, lundi.ferme, { shouldDirty: true });
      setValue(`jours.${i}.ouverture`, lundi.ouverture, { shouldDirty: true });
      setValue(`jours.${i}.fermeture`, lundi.fermeture, { shouldDirty: true });
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveHoraires(values);
      if (!result.ok) {
        setServerError(result.message);
        return;
      }
      notify(result);
      router.refresh();
    });
  });

  const jourErreur = (i: number) => errors.jours?.[i];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Horaires de la semaine">
      <ul className="divide-y rounded-lg border">
        {fields.map((f, i) => {
          const jour = JOURS[i];
          const erreur = jourErreur(i);
          return (
            <li key={f.id} className="grid items-center gap-2 p-3 sm:grid-cols-[8rem_auto_1fr_1fr]">
              <span className="font-medium">{jour.label}</span>
              <Controller
                control={control}
                name={`jours.${i}.ferme`}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      aria-label={`${jour.label} : fermé`}
                    />
                    Fermé
                  </label>
                )}
              />
              <Controller
                control={control}
                name={`jours.${i}.ferme`}
                render={({ field: ferme }) => (
                  <>
                    <div className="space-y-1">
                      <Input
                        type="time"
                        aria-label={`${jour.label} : ouverture`}
                        disabled={!!ferme.value}
                        aria-invalid={!!erreur?.ouverture}
                        {...register(`jours.${i}.ouverture`)}
                      />
                      {erreur?.ouverture && (
                        <p role="alert" className="text-sm text-destructive">
                          {erreur.ouverture.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Input
                        type="time"
                        aria-label={`${jour.label} : fermeture`}
                        disabled={!!ferme.value}
                        aria-invalid={!!erreur?.fermeture}
                        {...register(`jours.${i}.fermeture`)}
                      />
                      {erreur?.fermeture && (
                        <p role="alert" className="text-sm text-destructive">
                          {erreur.fermeture.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
              />
            </li>
          );
        })}
      </ul>
      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !isDirty}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          Enregistrer les horaires
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 whitespace-normal py-2 text-left"
          onClick={appliquerLundi}
        >
          <CopyCheck aria-hidden />
          Recopier le lundi sur toute la semaine
        </Button>
      </div>
    </form>
  );
}
