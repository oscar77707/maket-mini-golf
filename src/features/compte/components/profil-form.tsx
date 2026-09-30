"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Profile } from "@/types/models";
import { updateProfil } from "../actions";
import { profilSchema, type ProfilInput } from "../schemas";

export function ProfilForm({
  profile,
}: {
  profile: Pick<Profile, "prenom" | "nom" | "telephone">;
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
  } = useForm<ProfilInput>({
    resolver: zodResolver(profilSchema),
    defaultValues: {
      prenom: profile.prenom,
      nom: profile.nom,
      telephone: profile.telephone ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateProfil(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof ProfilInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      reset(getValues());
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Mes informations">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="prenom" label="Prénom" error={errors.prenom?.message}>
          <Input
            id="prenom"
            autoComplete="given-name"
            aria-invalid={!!errors.prenom}
            {...register("prenom")}
          />
        </FormField>
        <FormField id="nom" label="Nom" error={errors.nom?.message}>
          <Input
            id="nom"
            autoComplete="family-name"
            aria-invalid={!!errors.nom}
            {...register("nom")}
          />
        </FormField>
      </div>
      <FormField id="telephone" label="Téléphone (facultatif)" error={errors.telephone?.message}>
        <Input
          id="telephone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={!!errors.telephone}
          {...register("telephone")}
        />
      </FormField>
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
        Enregistrer
      </Button>
    </form>
  );
}
