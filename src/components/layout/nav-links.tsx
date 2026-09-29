"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/auth/navigation";

type Item = { href: string; label: string };

const ICONS = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i.icon]));
const SHORT_LABELS = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i.shortLabel ?? i.label]));

export function SidebarLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1">
      {items.map(({ href, label }) => {
        const Icon = ICONS[href];
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 font-medium hover:bg-muted",
              active && "bg-primary/10 text-primary",
            )}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map(({ href, label }) => {
        const Icon = ICONS[href];
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon aria-hidden className="size-6" />
            <span className="truncate">{SHORT_LABELS[href]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
