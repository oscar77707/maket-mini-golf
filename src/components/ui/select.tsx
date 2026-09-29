import * as React from "react";
import { cn } from "@/lib/utils";

/** Liste déroulante native : accessible, et la roue de sélection du téléphone s'ouvre toute seule. */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-input bg-card px-3 text-base disabled:opacity-60 aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
