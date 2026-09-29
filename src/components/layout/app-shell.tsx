import { Palmtree } from "lucide-react";
import { Suspense } from "react";
import { navFor } from "@/lib/auth/navigation";
import type { CurrentUser } from "@/lib/auth/session";
import type { PoleCode } from "@/types/database";
import { BottomNav, SidebarLinks } from "./nav-links";
import { PoleFilter } from "./pole-filter";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppShell({
  user,
  complexName,
  poles,
  children,
}: {
  user: CurrentUser;
  complexName: string;
  poles: { code: PoleCode; nom: string }[];
  children: React.ReactNode;
}) {
  const items = navFor(user.profile.role).map(({ href, label }) => ({ href, label }));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r bg-card lg:flex lg:flex-col lg:gap-6 lg:p-4">
        <div className="flex items-center gap-2 px-2 pt-2 text-primary">
          <Palmtree aria-hidden className="size-7" />
          <span className="text-xl font-bold tracking-tight">{complexName}</span>
        </div>
        <SidebarLinks items={items} />
      </aside>

      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 text-primary lg:hidden">
            <Palmtree aria-hidden className="size-6" />
            <span className="font-bold">{complexName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="flex-1 space-y-6 px-4 py-6 lg:px-8">
          {user.profile.role === "gerant" && poles.length > 0 && (
            <Suspense fallback={null}>
              <PoleFilter poles={poles} />
            </Suspense>
          )}
          {children}
        </main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}
