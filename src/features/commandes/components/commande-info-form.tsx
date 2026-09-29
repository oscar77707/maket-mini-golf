"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { updateCommandeInfo } from "../actions";

/** Date de livraison souhaitée et commentaire, modifiables tant que la commande n'est pas envoyée. */
export function CommandeInfoForm({
  id,
  date,
  commentaire,
}: {
  id: string;
  date: string | null;
  commentaire: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ date: date ?? "", commentaire: commentaire ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = values.date !== (date ?? "") || values.commentaire !== (commentaire ?? "");

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-[14rem_1fr_auto] sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateCommandeInfo(id, {
            date_livraison_prevue: values.date,
            commentaire: values.commentaire,
          });
          setErrors(result.ok ? {} : (result.fieldErrors ?? { _: result.message }));
          if (notify(result)) router.refresh();
        });
      }}
    >
      <FormField
        id="date_livraison_prevue"
        label="Livraison souhaitée"
        error={errors.date_livraison_prevue}
      >
        <Input
          id="date_livraison_prevue"
          type="date"
          value={values.date}
          onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
        />
      </FormField>
      <FormField
        id="commentaire"
        label="Commentaire pour le fournisseur"
        error={errors.commentaire}
      >
        <Textarea
          id="commentaire"
          rows={2}
          value={values.commentaire}
          onChange={(e) => setValues((v) => ({ ...v, commentaire: e.target.value }))}
        />
      </FormField>
      <div className="sm:pt-7">
        <Button type="submit" variant="outline" disabled={pending || !dirty}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
