"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2, MailPlus, ShieldOff, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import {
  anonymiserUtilisateur,
  resendInvitation,
  setUtilisateurActif,
  updateUtilisateur,
} from "../actions-utilisateurs";
import { STATUT_COMPTE_LABELS } from "../labels";
import type { Utilisateur } from "../queries";
import { utilisateurSchema, type UtilisateurInput, type UtilisateurValues } from "../schemas";
import { StatutBadge } from "./statut-badge";
import { RolePoleFields, type PoleOption } from "./role-pole-fields";

export function UtilisateurSheet({
  utilisateur,
  poles,
  soi,
  onClose,
}: {
  utilisateur: Utilisateur | null;
  poles: PoleOption[];
  soi: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!utilisateur} onOpenChange={(open) => !open && onClose()}>
      {utilisateur && (
        <SheetContent
          title={`${utilisateur.prenom} ${utilisateur.nom}`.trim() || utilisateur.email}
          description={utilisateur.email}
        >
          <StatutBadge statut={utilisateur.statut} />
          {utilisateur.statut === "anonymise" ? (
            <p className="text-sm text-muted-foreground">
              Ce compte est anonymisé : l&apos;identité a été effacée et la connexion est bloquée
              pour toujours. Ses saisies passées restent dans l&apos;historique, sans nom.
            </p>
          ) : (
            <>
              <FicheForm
                key={utilisateur.id + utilisateur.updated_at}
                utilisateur={utilisateur}
                poles={poles}
                soi={soi}
              />
              <Acces utilisateur={utilisateur} soi={soi} onClose={onClose} />
              <Rgpd utilisateur={utilisateur} soi={soi} onClose={onClose} />
            </>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}

function FicheForm({
  utilisateur,
  poles,
  soi,
}: {
  utilisateur: Utilisateur;
  poles: PoleOption[];
  soi: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const codePole = poles.find((p) => p.id === utilisateur.pole_id)?.code ?? "";
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<UtilisateurInput, unknown, UtilisateurValues>({
    resolver: zodResolver(utilisateurSchema),
    defaultValues: {
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      telephone: utilisateur.telephone ?? "",
      role: utilisateur.role,
      pole: codePole,
      saisonnier: utilisateur.saisonnier,
      fin_contrat: utilisateur.fin_contrat ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateUtilisateur(utilisateur.id, values);
      if (!result.ok) {
        setServerError(result.message);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          setError(field as keyof UtilisateurInput, { message });
        return;
      }
      notify(result);
      router.refresh();
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label="Informations du compte"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="prenom" label="Prénom" error={errors.prenom?.message}>
          <Input
            id="prenom"
            autoComplete="off"
            aria-invalid={!!errors.prenom}
            {...register("prenom")}
          />
        </FormField>
        <FormField id="nom" label="Nom" error={errors.nom?.message}>
          <Input id="nom" autoComplete="off" aria-invalid={!!errors.nom} {...register("nom")} />
        </FormField>
      </div>
      <FormField id="telephone" label="Téléphone" error={errors.telephone?.message}>
        <Input
          id="telephone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          {...register("telephone")}
        />
      </FormField>
      <RolePoleFields
        control={control}
        register={register}
        errors={errors}
        poles={poles}
        roleFixe={soi}
      />
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

function Acces({
  utilisateur,
  soi,
  onClose,
}: {
  utilisateur: Utilisateur;
  soi: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const actif = utilisateur.actif;

  const run = (action: () => Promise<Parameters<typeof notify>[0]>, fermer = false) =>
    startTransition(async () => {
      const result = await action();
      if (notify(result)) {
        router.refresh();
        if (fermer) onClose();
      }
    });

  return (
    <section className="space-y-3 border-t pt-4" aria-label="Accès au compte">
      <h3 className="font-semibold">Accès</h3>
      <p className="text-sm text-muted-foreground">
        État : {STATUT_COMPTE_LABELS[utilisateur.statut]}.
        {utilisateur.statut === "invite" &&
          " La personne n'a pas encore choisi son mot de passe ; le lien expire au bout de 24 heures."}
      </p>
      <div className="flex flex-wrap gap-2">
        {utilisateur.statut === "invite" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => resendInvitation(utilisateur.id))}
          >
            <MailPlus aria-hidden />
            Renvoyer l&apos;invitation
          </Button>
        )}
        {actif ? (
          <Button
            variant="outline"
            disabled={pending || soi}
            title={soi ? "Vous ne pouvez pas désactiver votre propre compte." : undefined}
            onClick={() => {
              if (
                window.confirm(
                  "Désactiver ce compte ? La personne ne pourra plus se connecter (l'historique est conservé).",
                )
              )
                run(() => setUtilisateurActif(utilisateur.id, false));
            }}
          >
            <ShieldOff aria-hidden />
            Désactiver le compte
          </Button>
        ) : (
          <Button
            disabled={pending}
            onClick={() => run(() => setUtilisateurActif(utilisateur.id, true))}
          >
            <UserCheck aria-hidden />
            Réactiver le compte
          </Button>
        )}
      </div>
    </section>
  );
}

function Rgpd({
  utilisateur,
  soi,
  onClose,
}: {
  utilisateur: Utilisateur;
  soi: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const anonymiser = () => {
    setErreur(null);
    startTransition(async () => {
      const result = await anonymiserUtilisateur(utilisateur.id, { confirmation });
      if (!result.ok) {
        setErreur(result.message);
        return;
      }
      notify(result);
      router.refresh();
      onClose();
    });
  };

  return (
    <section className="space-y-3 border-t pt-4" aria-label="Données personnelles">
      <h3 className="font-semibold">Données personnelles (RGPD)</h3>
      <Button asChild variant="outline">
        <a href={`/parametres/utilisateurs/${utilisateur.id}/export`} download>
          <Download aria-hidden />
          Exporter ses données
        </a>
      </Button>
      {!soi && (
        <div className="space-y-3">
          {!ouvert ? (
            <Button variant="outline" className="text-destructive" onClick={() => setOuvert(true)}>
              Anonymiser ce compte…
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-destructive/40 p-3">
              <p className="text-sm">
                L&apos;anonymisation efface le nom, l&apos;e-mail et le téléphone et bloque la
                connexion.
                <strong> Elle est définitive.</strong> Les mouvements et commandes déjà saisis
                restent, sans nom.
              </p>
              <FormField
                id="confirmation-anonymisation"
                label="Tapez ANONYMISER pour confirmer"
                error={erreur ?? undefined}
              >
                <Input
                  id="confirmation-anonymisation"
                  autoComplete="off"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </FormField>
              <div className="flex gap-2">
                <Button variant="destructive" disabled={pending} onClick={anonymiser}>
                  {pending && <Loader2 aria-hidden className="animate-spin" />}
                  Anonymiser définitivement
                </Button>
                <Button variant="ghost" onClick={() => setOuvert(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
