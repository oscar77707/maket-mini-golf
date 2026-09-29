"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/stocks", label: "Catalogue", exact: true },
  { href: "/stocks/alertes", label: "Alertes" },
  { href: "/stocks/mouvements", label: "Mouvements" },
  { href: "/stocks/inventaires", label: "Inventaires" },
  { href: "/stocks/import", label: "Import / export", manager: true },
];

export function StocksNav({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des stocks" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 border-b">
        {TABS.filter((t) => !t.manager || canManage).map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 font-medium",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
