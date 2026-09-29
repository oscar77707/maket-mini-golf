/**
 * Types de la base, générés depuis le schéma (même forme que `supabase gen types typescript`).
 * Régénérer après chaque migration : `supabase gen types typescript --local > src/types/database.ts`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appels_ia: {
        Row: {
          id: string;
          id_externe: string;
          debut: string;
          duree_secondes: number;
          numero_masque: string;
          numero_hash: string | null;
          pole_id: number | null;
          issue: Database["public"]["Enums"]["issue_appel"];
          resume: string | null;
          transcription: string | null;
          metadonnees: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          id_externe: string;
          debut: string;
          duree_secondes: number;
          numero_masque: string;
          numero_hash?: string | null;
          pole_id?: number | null;
          issue: Database["public"]["Enums"]["issue_appel"];
          resume?: string | null;
          transcription?: string | null;
          metadonnees?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          id_externe?: string;
          debut?: string;
          duree_secondes?: number;
          numero_masque?: string;
          numero_hash?: string | null;
          pole_id?: number | null;
          issue?: Database["public"]["Enums"]["issue_appel"];
          resume?: string | null;
          transcription?: string | null;
          metadonnees?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appels_ia_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          cree_le: string;
          user_id: string | null;
          user_email: string | null;
          action: string;
          table_cible: string | null;
          cible_id: string | null;
          avant: Json | null;
          apres: Json | null;
          details: Json;
        };
        Insert: {
          id?: never;
          cree_le?: string;
          user_id?: string | null;
          user_email?: string | null;
          action: string;
          table_cible?: string | null;
          cible_id?: string | null;
          avant?: Json | null;
          apres?: Json | null;
          details?: Json;
        };
        Update: {
          id?: never;
          cree_le?: string;
          user_id?: string | null;
          user_email?: string | null;
          action?: string;
          table_cible?: string | null;
          cible_id?: string | null;
          avant?: Json | null;
          apres?: Json | null;
          details?: Json;
        };
        Relationships: [];
      };
      categories_produit: {
        Row: {
          id: string;
          pole_id: number;
          nom: string;
          ordre: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id: number;
          nom: string;
          ordre?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number;
          nom?: string;
          ordre?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_produit_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      commande_lignes: {
        Row: {
          id: string;
          commande_id: string;
          produit_id: string;
          quantite: number;
          prix_unitaire_ht: number;
          montant_ht: number | null;
          commentaire: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commande_id: string;
          produit_id: string;
          quantite: number;
          prix_unitaire_ht?: number;
          montant_ht?: never;
          commentaire?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commande_id?: string;
          produit_id?: string;
          quantite?: number;
          prix_unitaire_ht?: number;
          montant_ht?: never;
          commentaire?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commande_lignes_commande_id_fkey";
            columns: ["commande_id"];
            isOneToOne: false;
            referencedRelation: "commandes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commande_lignes_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
        ];
      };
      commandes: {
        Row: {
          id: string;
          numero: number;
          fournisseur_id: string;
          pole_id: number;
          statut: Database["public"]["Enums"]["statut_commande"];
          date_livraison_prevue: string | null;
          commentaire: string | null;
          origine: Database["public"]["Enums"]["origine_donnee"];
          commande_source_id: string | null;
          cree_par: string | null;
          soumise_le: string | null;
          valide_par: string | null;
          valide_le: string | null;
          envoyee_le: string | null;
          confirmee_le: string | null;
          livree_le: string | null;
          cloturee_le: string | null;
          annulee_le: string | null;
          motif_annulation: string | null;
          derniere_erreur_envoi: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          numero?: never;
          fournisseur_id: string;
          pole_id: number;
          statut?: Database["public"]["Enums"]["statut_commande"];
          date_livraison_prevue?: string | null;
          commentaire?: string | null;
          origine?: Database["public"]["Enums"]["origine_donnee"];
          commande_source_id?: string | null;
          cree_par?: string | null;
          soumise_le?: string | null;
          valide_par?: string | null;
          valide_le?: string | null;
          envoyee_le?: string | null;
          confirmee_le?: string | null;
          livree_le?: string | null;
          cloturee_le?: string | null;
          annulee_le?: string | null;
          motif_annulation?: string | null;
          derniere_erreur_envoi?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          numero?: never;
          fournisseur_id?: string;
          pole_id?: number;
          statut?: Database["public"]["Enums"]["statut_commande"];
          date_livraison_prevue?: string | null;
          commentaire?: string | null;
          origine?: Database["public"]["Enums"]["origine_donnee"];
          commande_source_id?: string | null;
          cree_par?: string | null;
          soumise_le?: string | null;
          valide_par?: string | null;
          valide_le?: string | null;
          envoyee_le?: string | null;
          confirmee_le?: string | null;
          livree_le?: string | null;
          cloturee_le?: string | null;
          annulee_le?: string | null;
          motif_annulation?: string | null;
          derniere_erreur_envoi?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commandes_commande_source_id_fkey";
            columns: ["commande_source_id"];
            isOneToOne: false;
            referencedRelation: "commandes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commandes_cree_par_fkey";
            columns: ["cree_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commandes_fournisseur_id_fkey";
            columns: ["fournisseur_id"];
            isOneToOne: false;
            referencedRelation: "fournisseurs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commandes_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commandes_valide_par_fkey";
            columns: ["valide_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fermetures_exceptionnelles: {
        Row: {
          id: string;
          pole_id: number | null;
          date_debut: string;
          date_fin: string;
          motif: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id?: number | null;
          date_debut: string;
          date_fin: string;
          motif: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number | null;
          date_debut?: string;
          date_fin?: string;
          motif?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fermetures_exceptionnelles_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      fournisseur_produits: {
        Row: {
          fournisseur_id: string;
          produit_id: string;
          reference_fournisseur: string | null;
          prix_ht: number | null;
          conditionnement: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          fournisseur_id: string;
          produit_id: string;
          reference_fournisseur?: string | null;
          prix_ht?: number | null;
          conditionnement?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          fournisseur_id?: string;
          produit_id?: string;
          reference_fournisseur?: string | null;
          prix_ht?: number | null;
          conditionnement?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fournisseur_produits_fournisseur_id_fkey";
            columns: ["fournisseur_id"];
            isOneToOne: false;
            referencedRelation: "fournisseurs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fournisseur_produits_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
        ];
      };
      fournisseurs: {
        Row: {
          id: string;
          nom: string;
          contact_nom: string | null;
          email: string | null;
          telephone: string | null;
          mode_commande: Database["public"]["Enums"]["mode_commande"];
          url_portail: string | null;
          jours_commande: number[];
          jours_livraison: number[];
          delai_livraison_jours: number;
          minimum_commande_ht: number;
          adresse: string | null;
          notes: string | null;
          actif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          contact_nom?: string | null;
          email?: string | null;
          telephone?: string | null;
          mode_commande?: Database["public"]["Enums"]["mode_commande"];
          url_portail?: string | null;
          jours_commande?: number[];
          jours_livraison?: number[];
          delai_livraison_jours?: number;
          minimum_commande_ht?: number;
          adresse?: string | null;
          notes?: string | null;
          actif?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          contact_nom?: string | null;
          email?: string | null;
          telephone?: string | null;
          mode_commande?: Database["public"]["Enums"]["mode_commande"];
          url_portail?: string | null;
          jours_commande?: number[];
          jours_livraison?: number[];
          delai_livraison_jours?: number;
          minimum_commande_ht?: number;
          adresse?: string | null;
          notes?: string | null;
          actif?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      horaires_poles: {
        Row: {
          id: string;
          pole_id: number;
          saison_id: string;
          jour_semaine: number;
          ferme: boolean;
          ouverture: string | null;
          fermeture: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id: number;
          saison_id: string;
          jour_semaine: number;
          ferme?: boolean;
          ouverture?: string | null;
          fermeture?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number;
          saison_id?: string;
          jour_semaine?: number;
          ferme?: boolean;
          ouverture?: string | null;
          fermeture?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "horaires_poles_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "horaires_poles_saison_id_fkey";
            columns: ["saison_id"];
            isOneToOne: false;
            referencedRelation: "saisons";
            referencedColumns: ["id"];
          },
        ];
      };
      inventaire_lignes: {
        Row: {
          id: string;
          inventaire_id: string;
          produit_id: string;
          stock_theorique: number | null;
          quantite_comptee: number | null;
          ecart: number | null;
          commentaire: string | null;
          compte_par: string | null;
          compte_le: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inventaire_id: string;
          produit_id: string;
          stock_theorique?: number | null;
          quantite_comptee?: number | null;
          ecart?: never;
          commentaire?: string | null;
          compte_par?: string | null;
          compte_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inventaire_id?: string;
          produit_id?: string;
          stock_theorique?: number | null;
          quantite_comptee?: number | null;
          ecart?: never;
          commentaire?: string | null;
          compte_par?: string | null;
          compte_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventaire_lignes_compte_par_fkey";
            columns: ["compte_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventaire_lignes_inventaire_id_fkey";
            columns: ["inventaire_id"];
            isOneToOne: false;
            referencedRelation: "inventaires";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventaire_lignes_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
        ];
      };
      inventaires: {
        Row: {
          id: string;
          pole_id: number;
          lieu_stockage_id: string | null;
          statut: Database["public"]["Enums"]["statut_inventaire"];
          commentaire: string | null;
          cree_par: string | null;
          soumis_le: string | null;
          valide_par: string | null;
          valide_le: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id: number;
          lieu_stockage_id?: string | null;
          statut?: Database["public"]["Enums"]["statut_inventaire"];
          commentaire?: string | null;
          cree_par?: string | null;
          soumis_le?: string | null;
          valide_par?: string | null;
          valide_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number;
          lieu_stockage_id?: string | null;
          statut?: Database["public"]["Enums"]["statut_inventaire"];
          commentaire?: string | null;
          cree_par?: string | null;
          soumis_le?: string | null;
          valide_par?: string | null;
          valide_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventaires_cree_par_fkey";
            columns: ["cree_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventaires_lieu_stockage_id_fkey";
            columns: ["lieu_stockage_id"];
            isOneToOne: false;
            referencedRelation: "lieux_stockage";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventaires_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventaires_valide_par_fkey";
            columns: ["valide_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lieux_stockage: {
        Row: {
          id: string;
          pole_id: number;
          nom: string;
          ordre: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id: number;
          nom: string;
          ordre?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number;
          nom?: string;
          ordre?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lieux_stockage_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      livraison_lignes: {
        Row: {
          id: string;
          livraison_id: string;
          commande_ligne_id: string | null;
          produit_id: string;
          quantite_commandee: number;
          quantite_recue: number;
          ecart: number | null;
          prix_unitaire_ht: number | null;
          motif_ecart: string | null;
          dlc: string | null;
          numero_lot: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          livraison_id: string;
          commande_ligne_id?: string | null;
          produit_id: string;
          quantite_commandee?: number;
          quantite_recue?: number;
          ecart?: never;
          prix_unitaire_ht?: number | null;
          motif_ecart?: string | null;
          dlc?: string | null;
          numero_lot?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          livraison_id?: string;
          commande_ligne_id?: string | null;
          produit_id?: string;
          quantite_commandee?: number;
          quantite_recue?: number;
          ecart?: never;
          prix_unitaire_ht?: number | null;
          motif_ecart?: string | null;
          dlc?: string | null;
          numero_lot?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "livraison_lignes_commande_ligne_id_fkey";
            columns: ["commande_ligne_id"];
            isOneToOne: false;
            referencedRelation: "commande_lignes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "livraison_lignes_livraison_id_fkey";
            columns: ["livraison_id"];
            isOneToOne: false;
            referencedRelation: "livraisons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "livraison_lignes_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
        ];
      };
      livraisons: {
        Row: {
          id: string;
          commande_id: string;
          pole_id: number;
          statut: Database["public"]["Enums"]["statut_livraison"];
          numero_bon_livraison: string | null;
          photo_bl_path: string | null;
          conforme: boolean | null;
          commentaire: string | null;
          recue_par: string | null;
          recue_le: string;
          validee_le: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commande_id: string;
          pole_id: number;
          statut?: Database["public"]["Enums"]["statut_livraison"];
          numero_bon_livraison?: string | null;
          photo_bl_path?: string | null;
          conforme?: boolean | null;
          commentaire?: string | null;
          recue_par?: string | null;
          recue_le?: string;
          validee_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commande_id?: string;
          pole_id?: number;
          statut?: Database["public"]["Enums"]["statut_livraison"];
          numero_bon_livraison?: string | null;
          photo_bl_path?: string | null;
          conforme?: boolean | null;
          commentaire?: string | null;
          recue_par?: string | null;
          recue_le?: string;
          validee_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "livraisons_commande_id_fkey";
            columns: ["commande_id"];
            isOneToOne: false;
            referencedRelation: "commandes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "livraisons_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "livraisons_recue_par_fkey";
            columns: ["recue_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lots_dlc: {
        Row: {
          id: string;
          produit_id: string;
          pole_id: number;
          mouvement_entree_id: number | null;
          dlc: string;
          quantite_initiale: number;
          numero_lot: string | null;
          solde_le: string | null;
          solde_par: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          produit_id: string;
          pole_id: number;
          mouvement_entree_id?: number | null;
          dlc: string;
          quantite_initiale: number;
          numero_lot?: string | null;
          solde_le?: string | null;
          solde_par?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          produit_id?: string;
          pole_id?: number;
          mouvement_entree_id?: number | null;
          dlc?: string;
          quantite_initiale?: number;
          numero_lot?: string | null;
          solde_le?: string | null;
          solde_par?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lots_dlc_mouvement_entree_id_fkey";
            columns: ["mouvement_entree_id"];
            isOneToOne: false;
            referencedRelation: "mouvements_stock";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lots_dlc_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lots_dlc_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lots_dlc_solde_par_fkey";
            columns: ["solde_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mouvements_stock: {
        Row: {
          id: number;
          produit_id: string;
          pole_id: number;
          type: Database["public"]["Enums"]["type_mouvement"];
          quantite: number;
          prix_unitaire_ht: number | null;
          motif: string | null;
          date_mouvement: string;
          cree_par: string | null;
          origine: Database["public"]["Enums"]["origine_donnee"];
          livraison_ligne_id: string | null;
          inventaire_ligne_id: string | null;
          annule_mouvement_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          produit_id: string;
          pole_id: number;
          type: Database["public"]["Enums"]["type_mouvement"];
          quantite: number;
          prix_unitaire_ht?: number | null;
          motif?: string | null;
          date_mouvement?: string;
          cree_par?: string | null;
          origine?: Database["public"]["Enums"]["origine_donnee"];
          livraison_ligne_id?: string | null;
          inventaire_ligne_id?: string | null;
          annule_mouvement_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          produit_id?: string;
          pole_id?: number;
          type?: Database["public"]["Enums"]["type_mouvement"];
          quantite?: number;
          prix_unitaire_ht?: number | null;
          motif?: string | null;
          date_mouvement?: string;
          cree_par?: string | null;
          origine?: Database["public"]["Enums"]["origine_donnee"];
          livraison_ligne_id?: string | null;
          inventaire_ligne_id?: string | null;
          annule_mouvement_id?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_annule_mouvement_id_fkey";
            columns: ["annule_mouvement_id"];
            isOneToOne: false;
            referencedRelation: "mouvements_stock";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mouvements_stock_cree_par_fkey";
            columns: ["cree_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mouvements_stock_inventaire_ligne_id_fkey";
            columns: ["inventaire_ligne_id"];
            isOneToOne: false;
            referencedRelation: "inventaire_lignes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mouvements_stock_livraison_ligne_id_fkey";
            columns: ["livraison_ligne_id"];
            isOneToOne: false;
            referencedRelation: "livraison_lignes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mouvements_stock_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mouvements_stock_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
        ];
      };
      parametres: {
        Row: {
          id: boolean;
          nom_complexe: string;
          logo_path: string | null;
          couleur_principale: string;
          couleur_secondaire: string;
          adresse: string | null;
          telephone: string | null;
          email_contact: string | null;
          seuil_dlc_jours: number;
          marge_alerte_pct: number;
          retention_appels_jours: number;
          retention_audit_jours: number;
          decrement_auto_recettes: boolean;
          fuseau_horaire: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          nom_complexe?: string;
          logo_path?: string | null;
          couleur_principale?: string;
          couleur_secondaire?: string;
          adresse?: string | null;
          telephone?: string | null;
          email_contact?: string | null;
          seuil_dlc_jours?: number;
          marge_alerte_pct?: number;
          retention_appels_jours?: number;
          retention_audit_jours?: number;
          decrement_auto_recettes?: boolean;
          fuseau_horaire?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          nom_complexe?: string;
          logo_path?: string | null;
          couleur_principale?: string;
          couleur_secondaire?: string;
          adresse?: string | null;
          telephone?: string | null;
          email_contact?: string | null;
          seuil_dlc_jours?: number;
          marge_alerte_pct?: number;
          retention_appels_jours?: number;
          retention_audit_jours?: number;
          decrement_auto_recettes?: boolean;
          fuseau_horaire?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "parametres_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      poles: {
        Row: {
          id: number;
          code: Database["public"]["Enums"]["code_pole"];
          nom: string;
          couleur: string;
          icone: string;
          ordre: number;
          actif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: never;
          code: Database["public"]["Enums"]["code_pole"];
          nom: string;
          couleur: string;
          icone?: string;
          ordre?: number;
          actif?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: never;
          code?: Database["public"]["Enums"]["code_pole"];
          nom?: string;
          couleur?: string;
          icone?: string;
          ordre?: number;
          actif?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      produits: {
        Row: {
          id: string;
          pole_id: number;
          nom: string;
          reference: string | null;
          categorie_id: string | null;
          unite: Database["public"]["Enums"]["unite_mesure"];
          lieu_stockage_id: string | null;
          fournisseur_principal_id: string | null;
          prix_achat_ht: number;
          seuil_minimum: number;
          quantite_reappro: number;
          suivi_dlc: boolean;
          actif: boolean;
          notes: string | null;
          cree_par: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id: number;
          nom: string;
          reference?: string | null;
          categorie_id?: string | null;
          unite: Database["public"]["Enums"]["unite_mesure"];
          lieu_stockage_id?: string | null;
          fournisseur_principal_id?: string | null;
          prix_achat_ht?: number;
          seuil_minimum?: number;
          quantite_reappro?: number;
          suivi_dlc?: boolean;
          actif?: boolean;
          notes?: string | null;
          cree_par?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number;
          nom?: string;
          reference?: string | null;
          categorie_id?: string | null;
          unite?: Database["public"]["Enums"]["unite_mesure"];
          lieu_stockage_id?: string | null;
          fournisseur_principal_id?: string | null;
          prix_achat_ht?: number;
          seuil_minimum?: number;
          quantite_reappro?: number;
          suivi_dlc?: boolean;
          actif?: boolean;
          notes?: string | null;
          cree_par?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "produits_categorie_id_pole_id_fkey";
            columns: ["pole_id", "categorie_id"];
            isOneToOne: false;
            referencedRelation: "categories_produit";
            referencedColumns: ["id", "pole_id"];
          },
          {
            foreignKeyName: "produits_cree_par_fkey";
            columns: ["cree_par"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produits_fournisseur_principal_id_fkey";
            columns: ["fournisseur_principal_id"];
            isOneToOne: false;
            referencedRelation: "fournisseurs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produits_lieu_stockage_id_pole_id_fkey";
            columns: ["pole_id", "lieu_stockage_id"];
            isOneToOne: false;
            referencedRelation: "lieux_stockage";
            referencedColumns: ["id", "pole_id"];
          },
          {
            foreignKeyName: "produits_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          prenom: string;
          nom: string;
          telephone: string | null;
          role: Database["public"]["Enums"]["role_utilisateur"];
          pole_id: number | null;
          saisonnier: boolean;
          fin_contrat: string | null;
          actif: boolean;
          preferences: Json;
          anonymise_le: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          prenom?: string;
          nom?: string;
          telephone?: string | null;
          role?: Database["public"]["Enums"]["role_utilisateur"];
          pole_id?: number | null;
          saisonnier?: boolean;
          fin_contrat?: string | null;
          actif?: boolean;
          preferences?: Json;
          anonymise_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          prenom?: string;
          nom?: string;
          telephone?: string | null;
          role?: Database["public"]["Enums"]["role_utilisateur"];
          pole_id?: number | null;
          saisonnier?: boolean;
          fin_contrat?: string | null;
          actif?: boolean;
          preferences?: Json;
          anonymise_le?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      recette_ingredients: {
        Row: {
          recette_id: string;
          produit_id: string;
          quantite: number;
        };
        Insert: {
          recette_id: string;
          produit_id: string;
          quantite: number;
        };
        Update: {
          recette_id?: string;
          produit_id?: string;
          quantite?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recette_ingredients_produit_id_fkey";
            columns: ["produit_id"];
            isOneToOne: false;
            referencedRelation: "produits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recette_ingredients_recette_id_fkey";
            columns: ["recette_id"];
            isOneToOne: false;
            referencedRelation: "recettes";
            referencedColumns: ["id"];
          },
        ];
      };
      recettes: {
        Row: {
          id: string;
          pole_id: number;
          nom: string;
          code_caisse: string | null;
          prix_vente_ttc: number | null;
          actif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pole_id: number;
          nom: string;
          code_caisse?: string | null;
          prix_vente_ttc?: number | null;
          actif?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pole_id?: number;
          nom?: string;
          code_caisse?: string | null;
          prix_vente_ttc?: number | null;
          actif?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recettes_pole_id_fkey";
            columns: ["pole_id"];
            isOneToOne: false;
            referencedRelation: "poles";
            referencedColumns: ["id"];
          },
        ];
      };
      saisons: {
        Row: {
          id: string;
          nom: string;
          date_debut: string;
          date_fin: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          date_debut: string;
          date_fin: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          date_debut?: string;
          date_fin?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhooks_n8n: {
        Row: {
          cle: string;
          libelle: string;
          url: string | null;
          actif: boolean;
          derniere_utilisation: string | null;
          dernier_statut_http: number | null;
          updated_at: string;
        };
        Insert: {
          cle: string;
          libelle: string;
          url?: string | null;
          actif?: boolean;
          derniere_utilisation?: string | null;
          dernier_statut_http?: number | null;
          updated_at?: string;
        };
        Update: {
          cle?: string;
          libelle?: string;
          url?: string | null;
          actif?: boolean;
          derniere_utilisation?: string | null;
          dernier_statut_http?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhooks_recus: {
        Row: {
          id: number;
          source: string;
          idempotency_key: string;
          evenement: string | null;
          statut_http: number;
          erreur: string | null;
          recu_le: string;
        };
        Insert: {
          id?: never;
          source: string;
          idempotency_key: string;
          evenement?: string | null;
          statut_http: number;
          erreur?: string | null;
          recu_le?: string;
        };
        Update: {
          id?: never;
          source?: string;
          idempotency_key?: string;
          evenement?: string | null;
          statut_http?: number;
          erreur?: string | null;
          recu_le?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_alertes_dlc: {
        Row: {
          id: string | null;
          produit_id: string | null;
          produit_nom: string | null;
          pole_id: number | null;
          dlc: string | null;
          numero_lot: string | null;
          quantite_initiale: number | null;
          jours_restants: number | null;
        };
        Relationships: [];
      };
      v_commandes: {
        Row: {
          id: string | null;
          numero: number | null;
          fournisseur_id: string | null;
          pole_id: number | null;
          statut: Database["public"]["Enums"]["statut_commande"] | null;
          date_livraison_prevue: string | null;
          commentaire: string | null;
          origine: Database["public"]["Enums"]["origine_donnee"] | null;
          commande_source_id: string | null;
          cree_par: string | null;
          soumise_le: string | null;
          valide_par: string | null;
          valide_le: string | null;
          envoyee_le: string | null;
          confirmee_le: string | null;
          livree_le: string | null;
          cloturee_le: string | null;
          annulee_le: string | null;
          motif_annulation: string | null;
          derniere_erreur_envoi: string | null;
          created_at: string | null;
          updated_at: string | null;
          reference: string | null;
          fournisseur_nom: string | null;
          nb_lignes: number | null;
          montant_ht: number | null;
          est_en_retard: boolean | null;
        };
        Relationships: [];
      };
      v_historique_prix: {
        Row: {
          produit_id: string | null;
          fournisseur_id: string | null;
          date_prix: string | null;
          prix_unitaire_ht: number | null;
        };
        Relationships: [];
      };
      v_stats_fournisseurs: {
        Row: {
          fournisseur_id: string | null;
          nom: string | null;
          nb_commandes: number | null;
          delai_reel_moyen_jours: number | null;
          taux_conformite_pct: number | null;
          montant_total_ht: number | null;
        };
        Relationships: [];
      };
      v_stock_produits: {
        Row: {
          id: string | null;
          pole_id: number | null;
          nom: string | null;
          reference: string | null;
          categorie_id: string | null;
          unite: Database["public"]["Enums"]["unite_mesure"] | null;
          lieu_stockage_id: string | null;
          fournisseur_principal_id: string | null;
          prix_achat_ht: number | null;
          seuil_minimum: number | null;
          quantite_reappro: number | null;
          suivi_dlc: boolean | null;
          actif: boolean | null;
          notes: string | null;
          cree_par: string | null;
          created_at: string | null;
          updated_at: string | null;
          stock_actuel: number | null;
          valeur_stock_ht: number | null;
          dernier_mouvement: string | null;
          niveau_alerte: string | null;
          quantite_a_commander: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      annuler_mouvement: {
        Args: {
          p_mouvement_id: number;
        };
        Returns: number;
      };
      anonymiser_utilisateur: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      creer_brouillons_reappro: {
        Args: {
          p_pole_id: number;
          p_produit_ids?: string[];
        };
        Returns: string[];
      };
      dupliquer_commande: {
        Args: {
          p_commande_id: string;
        };
        Returns: string;
      };
      enregistrer_mouvement: {
        Args: {
          p_produit_id: string;
          p_type: Database["public"]["Enums"]["type_mouvement"];
          p_quantite: number;
          p_motif?: string;
          p_dlc?: string;
          p_numero_lot?: string;
        };
        Returns: number;
      };
      evolution_valeur_stock: {
        Args: {
          p_jours?: number;
          p_pole_id?: number;
        };
        Returns: { jour: string; valeur_ht: number }[];
      };
      exporter_donnees_utilisateur: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
      soumettre_inventaire: {
        Args: {
          p_inventaire_id: string;
        };
        Returns: undefined;
      };
      stats_appels: {
        Args: {
          p_debut: string;
          p_fin: string;
        };
        Returns: Json;
      };
      top_produits_consommes: {
        Args: {
          p_debut: string;
          p_fin: string;
          p_pole_id?: number;
          p_limite?: number;
        };
        Returns: {
          produit_id: string;
          nom: string;
          unite: Database["public"]["Enums"]["unite_mesure"];
          quantite: number;
          valeur_ht: number;
        }[];
      };
      valider_inventaire: {
        Args: {
          p_inventaire_id: string;
        };
        Returns: number;
      };
      valider_livraison: {
        Args: {
          p_livraison_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      code_pole: "restaurant" | "mini_golf" | "aquatique";
      issue_appel: "renseigne" | "transfere" | "message_laisse" | "reservation";
      mode_commande: "email" | "telephone" | "portail";
      origine_donnee: "app" | "n8n" | "import_csv" | "caisse";
      role_utilisateur: "gerant" | "responsable" | "salarie";
      statut_commande:
        | "brouillon"
        | "a_valider"
        | "envoyee"
        | "confirmee"
        | "livree"
        | "cloturee"
        | "annulee"
        | "en_retard";
      statut_inventaire: "en_cours" | "soumis" | "valide" | "annule";
      statut_livraison: "en_cours" | "validee";
      type_mouvement: "entree" | "sortie" | "perte" | "correction";
      unite_mesure: "kg" | "L" | "piece";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
