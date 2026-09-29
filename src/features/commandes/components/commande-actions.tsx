"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Ban,
  CheckCheck,
  Copy,
  Loader2,
  PackageCheck,
  RotateCcw,
  Send,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import type { Role, StatutCommande } from "@/types/models";
import {
  annulerCommande,
  cloturerCommande,
  demarrerReception,
  dupliquerCommande,
  envoyerCommande,
  marquerConfirmee,
  repasserEnBrouillon,
  soumettreCommande,
  supprimerBrouillon,
} from "../actions";

/** Boutons de la commande, selon son statut et le rôle : le gérant est seul à « Valider et envoyer ». */
export function CommandeActions({
  id,
  statut,
  role,
  nbLignes,
}: {
  id: string;
  statut: StatutCommande;
  role: Role;
  nbLignes: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [annulation, setAnnulation] = useState(false);
  const isGerant = role === "gerant";

  const run = (fn: () => Promise<Parameters<typeof notify>[0]>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      const success = notify(result);
      router.refresh();
      if (success) after?.();
    });

  const recevoir = () =>
    startTransition(async () => {
      const result = await demarrerReception(id);
      if (!result.ok) return void notify(result);
      router.push(`/commandes/${id}/reception`);
    });

  const vide = nbLignes === 0;
  const annulable = ["brouillon", "a_valider", "envoyee", "confirmee", "en_retard"].includes(
    statut,
  );
  const spinner = (icon: React.ReactNode) =>
    pending ? <Loader2 aria-hidden className="animate-spin" /> : icon;

  return (
    <div className="flex flex-wrap gap-2">
      {(statut === "brouillon" || statut === "a_valider") && isGerant && (
        <Button size="lg" disabled={pending || vide} onClick={() => run(() => envoyerCommande(id))}>
          {spinner(<Send aria-hidden />)}
          Valider et envoyer
        </Button>
      )}
      {statut === "brouillon" && (
        <Button
          size="lg"
          variant={isGerant ? "outline" : "default"}
          disabled={pending || vide}
          onClick={() => run(() => soumettreCommande(id))}
        >
          {spinner(<CheckCheck aria-hidden />)}
          Soumettre au gérant
        </Button>
      )}
      {statut === "a_valider" && (
        <Button
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => repasserEnBrouillon(id))}
        >
          {spinner(<RotateCcw aria-hidden />)}
          Repasser en brouillon
        </Button>
      )}
      {(statut === "envoyee" || statut === "en_retard") && (
        <Button
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => marquerConfirmee(id))}
        >
          {spinner(<ThumbsUp aria-hidden />)}
          Marquer comme confirmée
        </Button>
      )}
      {(statut === "envoyee" || statut === "confirmee" || statut === "en_retard") && (
        <Button size="lg" disabled={pending} onClick={recevoir}>
          {spinner(<PackageCheck aria-hidden />)}
          Recevoir la livraison
        </Button>
      )}
      {statut === "livree" && (
        <Button size="lg" disabled={pending} onClick={() => run(() => cloturerCommande(id))}>
          {spinner(<CheckCheck aria-hidden />)}
          Clôturer la commande
        </Button>
      )}
      <Button
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await dupliquerCommande(id);
            if (notify(result) && result.ok) router.push(`/commandes/${result.data.id}`);
          })
        }
      >
        <Copy aria-hidden />
        Dupliquer
      </Button>
      {statut === "brouillon" && (
        <Button
          size="lg"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Supprimer ce brouillon ? Cette action est définitive."))
              run(
                () => supprimerBrouillon(id),
                () => router.push("/commandes"),
              );
          }}
        >
          <Trash2 aria-hidden />
          Supprimer le brouillon
        </Button>
      )}
      {annulable && statut !== "brouillon" && (
        <Button size="lg" variant="ghost" disabled={pending} onClick={() => setAnnulation(true)}>
          <Ban aria-hidden />
          Annuler la commande
        </Button>
      )}
      {annulable && statut === "brouillon" && (
        <Button size="lg" variant="ghost" disabled={pending} onClick={() => setAnnulation(true)}>
          <Ban aria-hidden />
          Annuler
        </Button>
      )}
      <Sheet open={annulation} onOpenChange={setAnnulation}>
        <SheetContent
          title="Annuler la commande"
          description={
            statut === "envoyee" || statut === "confirmee" || statut === "en_retard"
              ? "Cette commande a déjà été envoyée : pensez à prévenir le fournisseur."
              : "La commande sera conservée dans l'historique avec son motif."
          }
        >
          <AnnulationForm
            id={id}
            onDone={() => {
              setAnnulation(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AnnulationForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await annulerCommande({ id, motif });
          if (!result.ok) return setError(result.fieldErrors?.motif ?? result.message);
          notify(result);
          onDone();
        });
      }}
    >
      <FormField id="motif" label="Motif d'annulation" error={error ?? undefined}>
        <Textarea
          id="motif"
          rows={3}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          aria-invalid={!!error}
          autoFocus
        />
      </FormField>
      <div className="mt-auto pt-2">
        <Button type="submit" size="lg" variant="destructive" className="w-full" disabled={pending}>
          {pending && <Loader2 aria-hidden className="animate-spin" />}
          Annuler la commande
        </Button>
      </div>
    </form>
  );
}

/** Lien vers un pointage déjà commencé. */
export function ReprendreReception({ id }: { id: string }) {
  return (
    <Button asChild variant="outline">
      <Link href={`/commandes/${id}/reception`}>Reprendre le pointage</Link>
    </Button>
  );
}
