/**
 * Types de la base. Version minimale écrite à la main pour l'étape 1 ; elle sera remplacée par
 * le fichier généré (`npm run types:generate`) dès qu'une base locale est disponible.
 */
export type Role = "gerant" | "responsable" | "salarie";
export type PoleCode = "restaurant" | "mini_golf" | "aquatique";

type ProfileRow = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  role: Role;
  pole_id: number | null;
  saisonnier: boolean;
  fin_contrat: string | null;
  actif: boolean;
  preferences: Record<string, unknown>;
  anonymise_le: string | null;
  created_at: string;
  updated_at: string;
};

type PoleRow = {
  id: number;
  code: PoleCode;
  nom: string;
  couleur: string;
  icone: string;
  ordre: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

type ParametresRow = {
  id: boolean;
  nom_complexe: string;
  logo_path: string | null;
  couleur_principale: string;
  couleur_secondaire: string;
  seuil_dlc_jours: number;
  marge_alerte_pct: number;
  retention_appels_jours: number;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id" | "email">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      poles: {
        Row: PoleRow;
        Insert: Partial<PoleRow> & Pick<PoleRow, "code" | "nom" | "couleur">;
        Update: Partial<PoleRow>;
        Relationships: [];
      };
      parametres: {
        Row: ParametresRow;
        Insert: Partial<ParametresRow>;
        Update: Partial<ParametresRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { role_utilisateur: Role; code_pole: PoleCode };
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = ProfileRow;
export type Pole = PoleRow;
export type Parametres = ParametresRow;
