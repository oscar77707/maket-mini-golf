"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/feedback/notify";
import type { Pole } from "@/types/models";
import { updatePoles } from "../actions-complexe";
import { polesSchema } from "../schemas";
import { ColorField } from "./color-field";

const formSchema = z.object({ poles: polesSchema });
type FormValues = z.input<typeof formSchema>;

export function PolesForm({ poles }: { poles: Pole[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { poles: poles.map((p) => ({ id: p.id, nom: p.nom, couleur: p.couleur })) },
  });
  const { fields } = useFieldArray({ control, name: "poles" });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updatePoles(values.poles);
      if (!result.ok) {
        setServerError(result.message);
        return;
      }
      notify(result);
      router.refresh();
      reset(getValues());
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Pôles">
      <Card>
        <CardHeader>
          <CardTitle>Pôles</CardTitle>
          <CardDescription>
            Le nom et la couleur de chaque pôle. Les trois pôles sont fixes : le restaurant, le
            mini-golf et les aires aquatiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((f, i) => {
            const erreur = errors.poles?.[i];
            return (
              <div key={f.id} className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`pole-nom-${i}`}>Nom du pôle {i + 1}</Label>
                  <Input
                    id={`pole-nom-${i}`}
                    autoComplete="off"
                    aria-invalid={!!erreur?.nom}
                    {...register(`poles.${i}.nom`)}
                  />
                  {erreur?.nom && (
                    <p role="alert" className="text-sm text-destructive">
                      {erreur.nom.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`pole-couleur-${i}`}>Couleur du pôle {i + 1}</Label>
                  <Controller
                    control={control}
                    name={`poles.${i}.couleur`}
                    render={({ field }) => (
                      <ColorField
                        id={`pole-couleur-${i}`}
                        label={`Couleur du pôle ${i + 1}`}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        invalid={!!erreur?.couleur}
                      />
                    )}
                  />
                  {erreur?.couleur && (
                    <p role="alert" className="text-sm text-destructive">
                      {erreur.couleur.message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
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
            Enregistrer les pôles
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
