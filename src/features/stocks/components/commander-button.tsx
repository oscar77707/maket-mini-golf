"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { notify } from "@/components/feedback/notify";
import { commanderProduits } from "../actions";

/** Crée ou complète des brouillons de commande (un par fournisseur) avec les quantités conseillées. */
export function CommanderButton({
  produitIds,
  poleId,
  children,
  ...props
}: { produitIds?: string[]; poleId?: number | null; children: React.ReactNode } & Omit<
  ButtonProps,
  "onClick" | "children"
>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await commanderProduits({ produitIds, poleId });
          notify(result, {
            action:
              result.ok && result.data.commandes > 0
                ? {
                    label: "Voir les brouillons",
                    onClick: () => router.push("/commandes?statut=brouillon"),
                  }
                : undefined,
          });
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ShoppingCart aria-hidden />}
      {children}
    </Button>
  );
}
