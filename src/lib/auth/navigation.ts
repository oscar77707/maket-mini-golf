import type { LucideIcon } from "lucide-react";
import { ClipboardList, LayoutDashboard, PhoneCall, Settings, Truck, Warehouse } from "lucide-react";
import type { Role } from "@/types/database";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };

/** Entrées de menu par rôle. La sécurité réelle reste la RLS : ce menu ne fait que guider. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard, roles: ["gerant"] },
  { href: "/stocks", label: "Stocks", icon: Warehouse, roles: ["gerant", "responsable", "salarie"] },
  { href: "/commandes", label: "Commandes", icon: ClipboardList, roles: ["gerant", "responsable"] },
  { href: "/fournisseurs", label: "Fournisseurs", icon: Truck, roles: ["gerant", "responsable"] },
  { href: "/appels", label: "Appels IA", icon: PhoneCall, roles: ["gerant"] },
  { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["gerant"] },
];

export const navFor = (role: Role) => NAV_ITEMS.filter((i) => i.roles.includes(role));

export const ROLE_LABELS: Record<Role, string> = {
  gerant: "Gérant",
  responsable: "Responsable",
  salarie: "Salarié",
};
