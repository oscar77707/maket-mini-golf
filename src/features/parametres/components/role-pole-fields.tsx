"use client";

import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormField } from "@/features/auth/form-field";
import { ROLE_LABELS } from "@/lib/auth/navigation";
import type { PoleCode, Role } from "@/types/models";
import { ROLE_DESCRIPTIONS } from "../labels";
import type { UtilisateurInput } from "../schemas";

export type PoleOption = { id: number; code: PoleCode; nom: string };

/** Rôle, pôle et contrat : champs communs à l'invitation et à la fiche d'un compte. */
export function RolePoleFields({
  control,
  register,
  errors,
  poles,
  roleFixe = false,
}: {
  control: Control<UtilisateurInput>;
  register: UseFormRegister<UtilisateurInput>;
  errors: FieldErrors<UtilisateurInput>;
  poles: PoleOption[];
  /** Compte de la personne connectée : son rôle ne se change pas ici. */
  roleFixe?: boolean;
}) {
  const role = useWatch({ control, name: "role" }) as Role;
  const saisonnier = useWatch({ control, name: "saisonnier" });
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="role" label="Rôle" error={errors.role?.message}>
          <Select id="role" disabled={roleFixe} {...register("role")}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </FormField>
        {role !== "gerant" && (
          <FormField id="pole" label="Pôle" error={errors.pole?.message}>
            <Select id="pole" aria-invalid={!!errors.pole} {...register("pole")}>
              <option value="">Choisir…</option>
              {poles.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nom}
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role] ?? ""}</p>
      {role !== "gerant" && (
        <div className="space-y-3">
          <Controller
            control={control}
            name="saisonnier"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="saisonnier"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <Label htmlFor="saisonnier">Contrat saisonnier</Label>
              </div>
            )}
          />
          {saisonnier && (
            <FormField
              id="fin_contrat"
              label="Fin de contrat"
              error={errors.fin_contrat?.message}
              hint="Facultatif : sert de rappel pour désactiver le compte."
            >
              <Input
                id="fin_contrat"
                type="date"
                aria-invalid={!!errors.fin_contrat}
                {...register("fin_contrat")}
              />
            </FormField>
          )}
        </div>
      )}
    </>
  );
}
