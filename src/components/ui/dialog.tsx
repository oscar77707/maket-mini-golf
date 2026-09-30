"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fenêtre centrée (palette, aide) ; pour un formulaire, préférer le tiroir `Sheet`. */
export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle = false,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  hideTitle?: boolean;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-[8vh] z-50 flex max-h-[84dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border bg-card shadow-xl",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-4",
            hideTitle ? "sr-only" : "p-6 pb-2",
          )}
        >
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-xl font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description
              className={description ? "text-sm text-muted-foreground" : "sr-only"}
            >
              {description ?? title}
            </DialogPrimitive.Description>
          </div>
        </div>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Fermer"
          >
            <X aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
