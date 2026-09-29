"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePassword } from "./actions";
import { FormField } from "./form-field";
import { newPasswordSchema, type NewPasswordValues } from "./schemas";

export function NewPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result && !result.ok) setServerError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField id="password" label="Nouveau mot de passe" error={errors.password?.message} hint="8 caractères minimum.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </FormField>
      <FormField id="confirmation" label="Confirmer le mot de passe" error={errors.confirmation?.message}>
        <Input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmation}
          {...register("confirmation")}
        />
      </FormField>
      {serverError && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
