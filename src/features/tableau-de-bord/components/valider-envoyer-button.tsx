"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { notify } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";
import { envoyerCommande } from "@/features/commandes/actions";

/** « Valider et envoyer » en un clic depuis le tableau de bord (gérant) : n8n reçoit la commande signée. */
export function ValiderEnvoyerButton({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      aria-label={`Valider et envoyer la commande ${reference}`}
      onClick={() =>
        startTransition(async () => {
          notify(await envoyerCommande(id));
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
      Valider et envoyer
    </Button>
  );
}
