"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "./actions";
import { FormField } from "./form-field";
import { forgotPasswordSchema, type ForgotPasswordValues } from "./schemas";

export function ForgotPasswordForm() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setResult(null);
    startTransition(async () => setResult(await requestPasswordReset(values)));
  });

  if (result?.ok) {
    return (
      <div className="space-y-5">
        <p role="status" className="rounded-md bg-muted px-3 py-3">
          {result.message}
        </p>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/connexion">Retour à la connexion</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField
        id="email"
        label="Adresse e-mail"
        error={errors.email?.message}
        hint="Nous vous envoyons un lien pour choisir un nouveau mot de passe."
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      {result && !result.ok && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {result.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        Envoyer le lien
      </Button>
      <p className="text-center text-sm">
        <Link href="/connexion" className="text-primary underline underline-offset-4">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
