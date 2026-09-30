"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { formatDateTime } from "@/lib/format";
import type { WebhookN8n } from "@/types/models";
import { saveWebhook, testWebhook } from "../actions-integrations";
import { webhookSchema, type WebhookInput } from "../schemas";

export function WebhookCarte({
  webhook,
  variableEnv,
}: {
  webhook: WebhookN8n;
  /** Nom de la variable d'environnement de repli et son état (jamais sa valeur). */
  variableEnv: { nom: string; definie: boolean } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [test, setTest] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<WebhookInput>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { cle: webhook.cle, url: webhook.url ?? "", actif: webhook.actif },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveWebhook(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof WebhookInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      reset(getValues());
    });
  });

  const tester = () => {
    setTest(true);
    startTransition(async () => {
      const result = await testWebhook(webhook.cle);
      notify(result);
      router.refresh();
      setTest(false);
    });
  };

  const statut = webhook.dernier_statut_http;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{webhook.libelle}</CardTitle>
        <CardDescription>
          Adresse du webhook n8n qui reçoit ces messages. Elle doit commencer par https://.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={webhook.libelle}>
          <FormField
            id={`url-${webhook.cle}`}
            label="Adresse du webhook"
            error={errors.url?.message}
            hint={
              variableEnv
                ? `Si ce champ est vide, l'application utilise la variable ${variableEnv.nom}${variableEnv.definie ? "" : " (non définie)"}.`
                : undefined
            }
          >
            <Input
              id={`url-${webhook.cle}`}
              inputMode="url"
              placeholder="https://n8n.exemple.fr/webhook/…"
              autoComplete="off"
              aria-invalid={!!errors.url}
              {...register("url")}
            />
          </FormField>
          <Controller
            control={control}
            name="actif"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`actif-${webhook.cle}`}
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <Label htmlFor={`actif-${webhook.cle}`}>Utiliser cette adresse</Label>
              </div>
            )}
          />
          <p
            className="text-sm text-muted-foreground"
            data-testid={`dernier-echange-${webhook.cle}`}
          >
            {webhook.derniere_utilisation ? (
              <>
                Dernier échange : {formatDateTime(webhook.derniere_utilisation)}{" "}
                {statut !== null &&
                  (statut >= 200 && statut < 300 ? (
                    <Badge variant="vert">Réponse {statut}</Badge>
                  ) : (
                    <Badge variant="rouge">
                      {statut === 0 ? "Sans réponse" : `Réponse ${statut}`}
                    </Badge>
                  ))}
              </>
            ) : (
              "Aucun échange pour l'instant."
            )}
          </p>
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
              {pending && !test && <Loader2 aria-hidden className="animate-spin" />}
              Enregistrer
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || isDirty}
              title={isDirty ? "Enregistrez d'abord vos modifications." : undefined}
              onClick={tester}
            >
              {pending && test ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Plug aria-hidden />
              )}
              Tester la connexion
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
