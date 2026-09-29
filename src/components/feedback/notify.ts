import { toast } from "sonner";
import type { ServerResult } from "@/lib/server-result";

/** Affiche le résultat d'une Server Action sous forme de message ; renvoie true si elle a réussi. */
export function notify<T>(
  result: ServerResult<T>,
  options: { success?: string; undo?: { label?: string; onClick: () => void } } = {},
) {
  if (!result.ok) {
    toast.error(result.message);
    return false;
  }
  const message = options.success ?? result.message;
  if (message) {
    toast.success(
      message,
      options.undo
        ? {
            action: { label: options.undo.label ?? "Annuler", onClick: options.undo.onClick },
            duration: 10_000,
          }
        : undefined,
    );
  }
  return true;
}
