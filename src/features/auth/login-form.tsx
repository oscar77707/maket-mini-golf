"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "./actions";
import { FormField } from "./form-field";
import { loginSchema, type LoginValues } from "./schemas";

export function LoginForm({ redirection, notice }: { redirection?: string; notice?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", redirection },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await login(values);
      if (result && !result.ok) setServerError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {notice && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-erreur" : undefined}
          {...register("email")}
        />
      </FormField>
      <FormField id="password" label="Mot de passe" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-erreur" : undefined}
          {...register("password")}
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
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        Se connecter
      </Button>
      <p className="text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="text-primary underline underline-offset-4">
          Mot de passe oublié ?
        </Link>
      </p>
    </form>
  );
}
