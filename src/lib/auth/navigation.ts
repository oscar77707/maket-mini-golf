import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  PhoneCall,
  Settings,
  Truck,
  Warehouse,
} from "lucide-react";
import type { Role } from "@/types/models";

/**
 * `shortLabel` : intitulé de la barre du bas sur téléphone, où six entrées se partagent 390 px.
 * `key` : lettre du raccourci « G puis … » (aller à la page).
 */
export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  key: string;
  icon: LucideIcon;
  roles: Role[];
};

/** Entrées de menu par rôle. La sécurité réelle reste la RLS : ce menu ne fait que guider. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/tableau-de-bord",
    label: "Tableau de bord",
    shortLabel: "Accueil",
    key: "t",
    icon: LayoutDashboard,
    roles: ["gerant", "responsable"],
  },
  {
    href: "/stocks",
    label: "Stocks",
    key: "s",
    icon: Warehouse,
    roles: ["gerant", "responsable", "salarie"],
  },
  {
    href: "/commandes",
    label: "Commandes",
    key: "c",
    icon: ClipboardList,
    roles: ["gerant", "responsable"],
  },
  {
    href: "/fournisseurs",
    label: "Fournisseurs",
    key: "f",
    icon: Truck,
    roles: ["gerant", "responsable"],
  },
  {
    href: "/appels",
    label: "Appels IA",
    shortLabel: "Appels",
    key: "a",
    icon: PhoneCall,
    roles: ["gerant"],
  },
  { href: "/parametres", label: "Paramètres", key: "p", icon: Settings, roles: ["gerant"] },
];

export const navFor = (role: Role) => NAV_ITEMS.filter((i) => i.roles.includes(role));

export const ROLE_LABELS: Record<Role, string> = {
  gerant: "Gérant",
  responsable: "Responsable",
  salarie: "Salarié",
};
