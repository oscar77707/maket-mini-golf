"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { purgerMaintenant, saveRetention } from "../actions-donnees";
import { retentionSchema, type RetentionInput } from "../schemas";

export function RetentionForm({
  appels,
  audit,
  aPurger,
}: {
  appels: number;
  audit: number;
  aPurger: { appels: number; audit: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setError,
    formState: { errors, isDirty },
  } = useForm<RetentionInput>({
    resolver: zodResolver(retentionSchema),
    defaultValues: { retention_appels_jours: String(appels), retention_audit_jours: String(audit) },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveRetention(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof RetentionInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      reset(getValues());
    });
  });

  const purger = () => {
    if (
      !window.confirm(
        "Supprimer maintenant les appels et les entrées du journal qui ont dépassé leur durée de conservation ? Cette action est définitive.",
      )
    )
      return;
    startTransition(async () => {
      const result = await purgerMaintenant();
      if (notify(result)) router.refresh();
    });
  };

  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Durées de conservation</CardTitle>
        <CardDescription>
          Au-delà de ces durées, les données sont supprimées chaque nuit vers 3 h 15.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={onSubmit}
          noValidate
          className="space-y-4"
          aria-label="Durées de conservation"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="retention_appels_jours"
              label="Appels du standard IA (jours)"
              error={errors.retention_appels_jours?.message}
              hint="De 7 jours à 3 ans. 90 jours par défaut."
            >
              <Input
                id="retention_appels_jours"
                inputMode="numeric"
                aria-invalid={!!errors.retention_appels_jours}
                {...register("retention_appels_jours")}
              />
            </FormField>
            <FormField
              id="retention_audit_jours"
              label="Journal d'audit (jours)"
              error={errors.retention_audit_jours?.message}
              hint="De 90 jours à 10 ans. 2 ans par défaut."
            >
              <Input
                id="retention_audit_jours"
                inputMode="numeric"
                aria-invalid={!!errors.retention_audit_jours}
                {...register("retention_audit_jours")}
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
          <Button type="submit" disabled={pending || !isDirty}>
            {pending && <Loader2 aria-hidden className="animate-spin" />}
            Enregistrer les durées
          </Button>
        </form>
        <div className="space-y-3 border-t pt-4">
          <p data-testid="a-purger">
            {aPurger.appels + aPurger.audit === 0
              ? "Rien à supprimer pour le moment : toutes les données sont dans leur durée de conservation."
              : `Actuellement au-delà de la durée : ${pluriel(aPurger.appels, "appel")} et ${pluriel(aPurger.audit, "entrée")} du journal.`}
          </p>
          <Button variant="outline" onClick={purger} disabled={pending}>
            <Trash2 aria-hidden />
            Purger maintenant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
