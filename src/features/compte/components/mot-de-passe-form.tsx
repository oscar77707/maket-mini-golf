"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { newPasswordSchema, type NewPasswordValues } from "@/features/auth/schemas";
import { changerMotDePasse } from "../actions";

export function MotDePasseForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await changerMotDePasse(values);
      if (!result.ok) {
        setServerError(result.message);
        return;
      }
      notify(result);
      reset();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Changer de mot de passe">
      <FormField
        id="nouveau-mot-de-passe"
        label="Nouveau mot de passe"
        error={errors.password?.message}
        hint="8 caractères minimum."
      >
        <Input
          id="nouveau-mot-de-passe"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </FormField>
      <FormField
        id="confirmation-mot-de-passe"
        label="Confirmer le mot de passe"
        error={errors.confirmation?.message}
      >
        <Input
          id="confirmation-mot-de-passe"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmation}
          {...register("confirmation")}
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
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        Changer le mot de passe
      </Button>
    </form>
  );
}
