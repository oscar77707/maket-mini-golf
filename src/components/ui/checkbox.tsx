import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input type="checkbox" className={cn("size-5 accent-[var(--primary)]", className)} {...props} />
  );
}
