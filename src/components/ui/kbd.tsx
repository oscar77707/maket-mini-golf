"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const rien = () => () => {};

/** Vrai sur Mac et iPhone : la touche de raccourci s'appelle alors ⌘ au lieu de Ctrl. */
export function useEstMac() {
  return useSyncExternalStore(
    rien,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

/** Touche de raccourci affichée comme sur un clavier. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded border border-b-2 bg-muted px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** « Ctrl K » ou « ⌘ K » selon l'ordinateur. */
export function ToucheModificateur() {
  const mac = useEstMac();
  return <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>;
}
