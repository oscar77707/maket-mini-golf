"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import { annulerMouvement } from "../actions";

export function AnnulerMouvementButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Annuler le mouvement n°${id}`}
      onClick={() =>
        startTransition(async () => {
          notify(await annulerMouvement(id));
          router.refresh();
        })
      }
    >
      <Undo2 aria-hidden className="size-4" />
      Annuler
    </Button>
  );
}
