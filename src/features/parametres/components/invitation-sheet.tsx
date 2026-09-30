"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { inviteUtilisateur } from "../actions-utilisateurs";
import {
  invitationSchema,
  type InvitationInput,
  type InvitationValues,
  type UtilisateurInput,
} from "../schemas";
import { RolePoleFields, type PoleOption } from "./role-pole-fields";

export function InviterButton({ poles }: { poles: PoleOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Inviter une personne
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          title="Inviter une personne"
          description="Elle reçoit un e-mail et choisit elle-même son mot de passe."
        >
          <InvitationForm poles={poles} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function InvitationForm({ poles, onDone }: { poles: PoleOption[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<InvitationInput, unknown, InvitationValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      role: "salarie",
      pole: "",
      saisonnier: false,
      fin_contrat: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await inviteUtilisateur(values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof InvitationInput, { message });
        return;
      }
      notify(result);
      router.refresh();
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="prenom" label="Prénom" error={errors.prenom?.message}>
          <Input
            id="prenom"
            autoComplete="off"
            autoFocus
            aria-invalid={!!errors.prenom}
            {...register("prenom")}
          />
        </FormField>
        <FormField id="nom" label="Nom" error={errors.nom?.message}>
          <Input id="nom" autoComplete="off" aria-invalid={!!errors.nom} {...register("nom")} />
        </FormField>
      </div>
      <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      <FormField id="telephone" label="Téléphone (facultatif)" error={errors.telephone?.message}>
        <Input
          id="telephone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          {...register("telephone")}
        />
      </FormField>
      <RolePoleFields
        control={control as unknown as Control<UtilisateurInput>}
        register={register as unknown as UseFormRegister<UtilisateurInput>}
        errors={errors as unknown as FieldErrors<UtilisateurInput>}
        poles={poles}
      />
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
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
          Envoyer l&apos;invitation
        </Button>
      </div>
    </form>
  );
}
