import type { Role } from "@/types/models";

/** Jour ISO (1 = lundi) → nom. */
export const JOURS = [
  { id: 1, label: "Lundi" },
  { id: 2, label: "Mardi" },
  { id: 3, label: "Mercredi" },
  { id: 4, label: "Jeudi" },
  { id: 5, label: "Vendredi" },
  { id: 6, label: "Samedi" },
  { id: 7, label: "Dimanche" },
] as const;

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  gerant: "Voit et règle tout : tous les pôles, les commandes, les appels, les paramètres.",
  responsable:
    "Gère les stocks, fournisseurs et commandes de son pôle ; le gérant valide les envois.",
  salarie: "Saisit les mouvements de stock et les comptages de son pôle.",
};

export type StatutCompte = "actif" | "invite" | "desactive" | "anonymise";

export const STATUT_COMPTE_LABELS: Record<StatutCompte, string> = {
  actif: "Actif",
  invite: "Invitation en attente",
  desactive: "Désactivé",
  anonymise: "Anonymisé",
};

export function statutCompte(p: {
  actif: boolean;
  anonymise_le: string | null;
  invitation_en_attente: boolean;
}): StatutCompte {
  if (p.anonymise_le) return "anonymise";
  if (!p.actif) return "desactive";
  return p.invitation_en_attente ? "invite" : "actif";
}

/** Libellés du journal d'audit ; une action inconnue s'affiche telle quelle. */
const ACTIONS_AUDIT: Record<string, string> = {
  "parametres.update": "Paramètres du complexe modifiés",
  "poles.update": "Pôle modifié",
  "poles.insert": "Pôle créé",
  "poles.delete": "Pôle supprimé",
  "profiles.insert": "Compte créé",
  "profiles.update": "Compte modifié",
  "profiles.delete": "Compte supprimé",
  "utilisateur.invitation": "Invitation envoyée",
  "utilisateur.reinvitation": "Invitation renvoyée",
  "webhooks_n8n.insert": "Webhook n8n créé",
  "webhooks_n8n.update": "Webhook n8n modifié",
  "webhooks_n8n.delete": "Webhook n8n supprimé",
  "integration.test": "Test de connexion n8n",
  "saisons.insert": "Saison créée",
  "saisons.update": "Saison modifiée",
  "saisons.delete": "Saison supprimée",
  "horaires.modification": "Horaires modifiés",
  "fermetures_exceptionnelles.insert": "Fermeture exceptionnelle ajoutée",
  "fermetures_exceptionnelles.update": "Fermeture exceptionnelle modifiée",
  "fermetures_exceptionnelles.delete": "Fermeture exceptionnelle supprimée",
  "categories_produit.insert": "Catégorie créée",
  "categories_produit.update": "Catégorie modifiée",
  "categories_produit.delete": "Catégorie supprimée",
  "lieux_stockage.insert": "Lieu de stockage créé",
  "lieux_stockage.update": "Lieu de stockage modifié",
  "lieux_stockage.delete": "Lieu de stockage supprimé",
  "logo.modification": "Logo remplacé",
  "logo.suppression": "Logo supprimé",
  "fournisseurs.update": "Fournisseur modifié",
  "fournisseurs.delete": "Fournisseur supprimé",
  "produits.update": "Produit modifié",
  "produits.delete": "Produit supprimé",
  "commandes.update": "Commande modifiée",
  "commandes.delete": "Commande supprimée",
  "inventaires.update": "Inventaire modifié",
  "rgpd.export": "Export de données personnelles",
  "rgpd.anonymisation": "Compte anonymisé",
  "rgpd.purge": "Purge des données anciennes",
};

export const libelleAction = (action: string) => ACTIONS_AUDIT[action] ?? action;

/** Familles d'actions proposées comme filtre du journal (préfixes de `audit_log.action`). */
export const GROUPES_AUDIT = {
  comptes: { label: "Comptes et invitations", prefixes: ["profiles.", "utilisateur."] },
  reglages: {
    label: "Réglages du complexe",
    prefixes: [
      "parametres.",
      "poles.",
      "saisons.",
      "horaires.",
      "fermetures_exceptionnelles.",
      "categories_produit.",
      "lieux_stockage.",
      "logo.",
    ],
  },
  integrations: { label: "Intégrations n8n", prefixes: ["webhooks_n8n.", "integration."] },
  donnees: { label: "Données personnelles", prefixes: ["rgpd."] },
  activite: {
    label: "Fournisseurs, stocks et commandes",
    prefixes: ["fournisseurs.", "produits.", "commandes.", "inventaires."],
  },
} as const;
export type GroupeAudit = keyof typeof GROUPES_AUDIT;
export const GROUPES_AUDIT_IDS = Object.keys(GROUPES_AUDIT) as GroupeAudit[];
