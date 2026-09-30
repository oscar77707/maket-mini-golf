import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoleBadge } from "@/components/ui/pole-badge";
import { ROLE_LABELS } from "@/lib/auth/navigation";
import type { CurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "./logout-button";

export function UserMenu({ user }: { user: CurrentUser }) {
  const { profile, pole } = user;
  const fullName = `${profile.prenom} ${profile.nom}`.trim() || profile.email;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{fullName}</p>
        <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          {ROLE_LABELS[profile.role]}
          {pole && <PoleBadge code={pole.code} nom={pole.nom} className="px-2 py-0 text-xs" />}
        </p>
      </div>
      <Button asChild variant="ghost" size="icon" aria-label="Mon compte">
        <Link href="/mon-compte">
          <UserRound aria-hidden />
        </Link>
      </Button>
      <LogoutButton />
    </div>
  );
}
