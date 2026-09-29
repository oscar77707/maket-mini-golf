"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import { demarrerReception } from "../actions";

/** Affiché quand on arrive sur la page de réception sans pointage commencé. */
export function DemarrerReception({ commandeId }: { commandeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <PackageCheck aria-hidden className="size-10 text-muted-foreground" />
      <p className="text-muted-foreground">Aucun pointage en cours pour cette commande.</p>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (notify(await demarrerReception(commandeId))) router.refresh();
          })
        }
      >
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        Commencer le pointage
      </Button>
    </div>
  );
}
