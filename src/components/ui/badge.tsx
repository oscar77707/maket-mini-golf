import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        rouge: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-400",
        orange: "border-orange-600/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
        vert: "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400",
        bleu: "border-sky-600/40 bg-sky-600/10 text-sky-700 dark:text-sky-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
