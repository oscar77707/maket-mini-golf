import { Palmtree } from "lucide-react";
import { Suspense } from "react";
import { RechercheButton } from "@/components/command-palette/recherche-button";
import { QuickAddButton } from "@/features/quick-add/components/quick-add-button";
import { QuickAddProvider } from "@/features/quick-add/quick-add-provider";
import type { ReferentielsAjout } from "@/features/quick-add/types";
import { navFor } from "@/lib/auth/navigation";
import type { CurrentUser } from "@/lib/auth/session";
import type { PoleCode } from "@/types/models";
import { BottomNav, SidebarLinks } from "./nav-links";
import { PoleFilter } from "./pole-filter";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** Logo du complexe (envoyé dans Paramètres), sinon le palmier. */
function Marque({ logoUrl, className }: { logoUrl: string | null; className: string }) {
  if (!logoUrl) return <Palmtree aria-hidden className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- adresse Supabase Storage variable
  return <img src={logoUrl} alt="" data-testid="logo" className={`${className} object-contain`} />;
}

export function AppShell({
  user,
  complexName,
  logoUrl = null,
  poles,
  referentiels,
  children,
}: {
  user: CurrentUser;
  complexName: string;
  logoUrl?: string | null;
  poles: { code: PoleCode; nom: string }[];
  referentiels: ReferentielsAjout;
  children: React.ReactNode;
}) {
  const role = user.profile.role;
  const items = navFor(role).map(({ href, label }) => ({ href, label }));
  return (
    <QuickAddProvider
      role={role}
      utilisateurId={user.profile.id}
      poleUtilisateurId={user.profile.pole_id}
      referentiels={referentiels}
    >
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r bg-card lg:flex lg:flex-col lg:gap-6 lg:p-4">
          <div className="flex items-center gap-2 px-2 pt-2 text-primary">
            <Marque logoUrl={logoUrl} className="size-9 shrink-0" />
            <span className="text-xl font-bold tracking-tight">{complexName}</span>
          </div>
          <SidebarLinks items={items} />
        </aside>

        <div className="flex min-w-0 flex-col pb-40 lg:pb-0">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-8">
            <div className="flex min-w-0 items-center gap-2 text-primary lg:hidden">
              <Marque logoUrl={logoUrl} className="size-8 shrink-0" />
              <span className="truncate font-bold">{complexName}</span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <RechercheButton />
              <QuickAddButton role={role} emplacement="entete" />
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
        <QuickAddButton role={role} emplacement="flottant" />
        <BottomNav items={items} />
      </div>
    </QuickAddProvider>
  );
}
