import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border bg-card">
      <table className={cn("w-full caption-bottom text-left text-sm", className)} {...props} />
    </div>
  );
}
export const THead = (p: React.ComponentProps<"thead">) => (
  <thead className="border-b bg-muted/60" {...p} />
);
export const TBody = (p: React.ComponentProps<"tbody">) => (
  <tbody className="[&_tr:last-child]:border-0" {...p} />
);
export const TR = ({ className, ...p }: React.ComponentProps<"tr">) => (
  <tr
    className={cn("border-b hover:bg-muted/40 data-[state=selected]:bg-primary/5", className)}
    {...p}
  />
);
export const TH = ({ className, ...p }: React.ComponentProps<"th">) => (
  <th
    className={cn(
      "h-11 whitespace-nowrap px-3 text-sm font-semibold text-muted-foreground",
      className,
    )}
    {...p}
  />
);
export const TD = ({ className, ...p }: React.ComponentProps<"td">) => (
  <td className={cn("px-3 py-2 align-middle", className)} {...p} />
);
