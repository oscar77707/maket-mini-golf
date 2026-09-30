"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Parametres } from "@/types/models";
import { updateComplexe } from "../actions-complexe";
import { complexeSchema, type ComplexeInput, type ComplexeValues } from "../schemas";
import { ColorField } from "./color-field";

export function ComplexeForm({ parametres }: { parametres: Parametres }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<ComplexeInput, unknown, ComplexeValues>({
    resolver: zodResolver(complexeSchema),
    defaultValues: {
      nom_complexe: parametres.nom_complexe,
      couleur_principale: parametres.couleur_principale,
      couleur_secondaire: parametres.couleur_secondaire,
      adresse: parametres.adresse ?? "",
      telephone: parametres.telephone ?? "",
      email_contact: parametres.email_contact ?? "",
      seuil_dlc_jours: String(parametres.seuil_dlc_jours),
      marge_alerte_pct: String(parametres.marge_alerte_pct),
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateComplexe(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof ComplexeInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      reset(getValues());
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Réglages du complexe">
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
          <CardDescription>
            Le nom et les couleurs s&apos;appliquent à toute l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              id="nom_complexe"
              label="Nom du complexe"
              error={errors.nom_complexe?.message}
            >
              <Input
                id="nom_complexe"
                autoComplete="off"
                aria-invalid={!!errors.nom_complexe}
                {...register("nom_complexe")}
              />
            </FormField>
          </div>
          <FormField
            id="couleur_principale"
            label="Couleur principale"
            error={errors.couleur_principale?.message}
            hint="Boutons et éléments actifs (texte blanc dessus)."
          >
            <Controller
              control={control}
              name="couleur_principale"
              render={({ field }) => (
                <ColorField
                  id="couleur_principale"
                  label="Couleur principale"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.couleur_principale}
                />
              )}
            />
          </FormField>
          <FormField
            id="couleur_secondaire"
            label="Couleur secondaire"
            error={errors.couleur_secondaire?.message}
            hint="Accents et éléments secondaires."
          >
            <Controller
              control={control}
              name="couleur_secondaire"
              render={({ field }) => (
                <ColorField
                  id="couleur_secondaire"
                  label="Couleur secondaire"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.couleur_secondaire}
                />
              )}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
          <CardDescription>Affichées sur les commandes envoyées aux fournisseurs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField id="adresse" label="Adresse" error={errors.adresse?.message}>
              <Input id="adresse" autoComplete="off" {...register("adresse")} />
            </FormField>
          </div>
          <FormField id="telephone" label="Téléphone" error={errors.telephone?.message}>
            <Input
              id="telephone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              {...register("telephone")}
            />
          </FormField>
          <FormField
            id="email_contact"
            label="E-mail de contact"
            error={errors.email_contact?.message}
          >
            <Input
              id="email_contact"
              type="email"
              inputMode="email"
              autoComplete="off"
              aria-invalid={!!errors.email_contact}
              {...register("email_contact")}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertes de stock</CardTitle>
          <CardDescription>
            Ces seuils décident quand un produit passe en alerte (tableau de bord, stocks).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="seuil_dlc_jours"
            label="Alerte DLC (jours avant la date limite)"
            error={errors.seuil_dlc_jours?.message}
            hint="Un lot est signalé à partir de ce nombre de jours avant sa date limite."
          >
            <Input
              id="seuil_dlc_jours"
              inputMode="numeric"
              aria-invalid={!!errors.seuil_dlc_jours}
              {...register("seuil_dlc_jours")}
            />
          </FormField>
          <FormField
            id="marge_alerte_pct"
            label="Marge d'alerte orange (%)"
            error={errors.marge_alerte_pct?.message}
            hint="Un produit devient orange quand son stock dépasse le seuil d'au plus ce pourcentage."
          >
            <Input
              id="marge_alerte_pct"
              inputMode="numeric"
              aria-invalid={!!errors.marge_alerte_pct}
              {...register("marge_alerte_pct")}
            />
          </FormField>
        </CardContent>
      </Card>

      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || !isDirty}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        Enregistrer les réglages
      </Button>
    </form>
  );
}
