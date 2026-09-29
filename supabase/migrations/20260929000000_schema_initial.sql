-- =============================================================================
-- La Palmeraie : gestion interne
-- Schéma de base de données (Supabase / PostgreSQL 15+)
--
-- Futur emplacement : supabase/migrations/20261001000000_schema_initial.sql
-- Données de démo    : supabase/seed.sql (fichier séparé : seed.sql)
--
-- Principes
--   * Le stock n'est JAMAIS stocké : il est la somme des mouvements (vue v_stock_produits).
--   * Les mouvements de stock sont immuables : on corrige par un contre-mouvement.
--   * Les droits sont appliqués en base (RLS) ; l'interface ne fait que les refléter.
--   * Les fonctions « security definer » vivent dans le schéma app (non exposé par l'API)
--     ou dans public quand elles doivent être appelées en RPC, avec search_path vide.
--   * Données personnelles (profils, appels) : RLS stricte, audit_log, purge automatique.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;   -- recherche floue

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. Types énumérés
-- -----------------------------------------------------------------------------
create type public.role_utilisateur  as enum ('gerant', 'responsable', 'salarie');
create type public.code_pole         as enum ('restaurant', 'mini_golf', 'aquatique');
create type public.unite_mesure      as enum ('kg', 'L', 'piece');
create type public.type_mouvement    as enum ('entree', 'sortie', 'perte', 'correction');
create type public.mode_commande     as enum ('email', 'telephone', 'portail');
create type public.statut_commande   as enum ('brouillon', 'a_valider', 'envoyee', 'confirmee',
                                              'livree', 'cloturee', 'annulee', 'en_retard');
create type public.statut_inventaire as enum ('en_cours', 'soumis', 'valide', 'annule');
create type public.statut_livraison  as enum ('en_cours', 'validee');
create type public.issue_appel       as enum ('renseigne', 'transfere', 'message_laisse', 'reservation');
create type public.origine_donnee    as enum ('app', 'n8n', 'import_csv', 'caisse');

-- -----------------------------------------------------------------------------
-- 2. Fonctions utilitaires génériques
-- -----------------------------------------------------------------------------
create function app.maj_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Référentiel : pôles, profils
-- -----------------------------------------------------------------------------
create table public.poles (
  id          smallint generated always as identity primary key,
  code        public.code_pole not null unique,
  nom         text not null check (length(btrim(nom)) between 2 and 60),
  couleur     text not null check (couleur ~ '^#[0-9A-Fa-f]{6}$'),
  icone       text not null default 'circle',            -- nom d'icône lucide-react
  ordre       smallint not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  prenom         text not null default '' check (length(prenom) <= 80),
  nom            text not null default '' check (length(nom) <= 80),
  telephone      text check (telephone is null or telephone ~ '^[0-9 +().-]{6,20}$'),
  role           public.role_utilisateur not null default 'salarie',
  pole_id        smallint references public.poles (id),
  saisonnier     boolean not null default false,
  fin_contrat    date,
  actif          boolean not null default true,
  preferences    jsonb not null default '{}'::jsonb,       -- thème, densité, dernier fournisseur...
  anonymise_le   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint profiles_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- responsable et salarié sont toujours rattachés à un pôle ; le gérant voit tout
  constraint profiles_pole_requis check (role = 'gerant' or pole_id is not null)
);
create unique index profiles_email_uniq on public.profiles (lower(email));
create index profiles_pole_idx on public.profiles (pole_id) where actif;

-- -----------------------------------------------------------------------------
-- 4. Fonctions de droits (utilisées par les politiques RLS)
--    security definer pour lire profiles sans récursion RLS.
--    Dans les politiques, on les appelle sous la forme (select app.xxx()) pour
--    qu'elles soient évaluées une seule fois par requête (initplan).
-- -----------------------------------------------------------------------------
create function app.role_courant() returns public.role_utilisateur
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.actif
$$;

create function app.pole_courant() returns smallint
language sql stable security definer set search_path = '' as $$
  select p.pole_id from public.profiles p where p.id = auth.uid() and p.actif
$$;

create function app.est_gerant() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'gerant' from public.profiles p
                   where p.id = auth.uid() and p.actif), false)
$$;

-- Voit les données du pôle : gérant, ou membre actif du pôle
create function app.acces_pole(p_pole smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.actif
                   and (p.role = 'gerant' or p.pole_id = p_pole))
$$;

-- Gère le pôle : gérant, ou responsable actif du pôle
create function app.gere_pole(p_pole smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.actif
                   and (p.role = 'gerant' or (p.role = 'responsable' and p.pole_id = p_pole)))
$$;

-- Appel système : service_role (routes webhooks n8n, tâches planifiées, seed)
create function app.appel_systeme() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is null
$$;

revoke all on all functions in schema app from public;
grant execute on function app.role_courant(), app.pole_courant(), app.est_gerant(),
  app.acces_pole(smallint), app.gere_pole(smallint), app.appel_systeme()
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Journal d'audit (actions sensibles)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  cree_le      timestamptz not null default now(),
  user_id      uuid,                 -- pas de FK : l'entrée survit à la suppression du compte
  user_email   text,                 -- instantané, anonymisé avec le compte
  action       text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  table_cible  text,
  cible_id     text,
  avant        jsonb,
  apres        jsonb,
  details      jsonb not null default '{}'::jsonb
);
create index audit_log_date_idx  on public.audit_log (cree_le desc);
create index audit_log_cible_idx on public.audit_log (table_cible, cible_id);
create index audit_log_user_idx  on public.audit_log (user_id, cree_le desc);

-- Écriture d'une entrée métier (appelée depuis les fonctions)
create function app.journaliser(p_action text, p_table text, p_cible text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, user_email, action, table_cible, cible_id, details)
  values (auth.uid(),
          (select email from public.profiles where id = auth.uid()),
          p_action, p_table, p_cible, coalesce(p_details, '{}'::jsonb));
$$;

-- Trigger générique : n'enregistre que les colonnes modifiées
create function app.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_avant jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_apres jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_diff_avant jsonb := '{}'; v_diff_apres jsonb := '{}';
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_apres) loop
      continue when k in ('updated_at');
      if v_avant -> k is distinct from v_apres -> k then
        v_diff_avant := v_diff_avant || jsonb_build_object(k, v_avant -> k);
        v_diff_apres := v_diff_apres || jsonb_build_object(k, v_apres -> k);
      end if;
    end loop;
    if v_diff_apres = '{}'::jsonb then return new; end if;
    v_avant := v_diff_avant; v_apres := v_diff_apres;
  end if;
  insert into public.audit_log (user_id, user_email, action, table_cible, cible_id, avant, apres)
  values (auth.uid(),
          (select email from public.profiles where id = auth.uid()),
          lower(tg_table_name || '.' || tg_op),
          tg_table_name,
          coalesce(v_apres ->> 'id', v_avant ->> 'id', v_apres ->> 'cle', v_avant ->> 'cle'),
          v_avant, v_apres);
  return coalesce(new, old);
end $$;

-- -----------------------------------------------------------------------------
-- 6. Paramètres du complexe
-- -----------------------------------------------------------------------------
create table public.parametres (
  id                      boolean primary key default true check (id),   -- ligne unique
  nom_complexe            text not null default 'La Palmeraie',
  logo_path               text,                                          -- Supabase Storage
  couleur_principale      text not null default '#0F766E' check (couleur_principale ~ '^#[0-9A-Fa-f]{6}$'),
  couleur_secondaire      text not null default '#F59E0B' check (couleur_secondaire ~ '^#[0-9A-Fa-f]{6}$'),
  adresse                 text,
  telephone               text,
  email_contact           text,
  seuil_dlc_jours         smallint not null default 3  check (seuil_dlc_jours between 0 and 30),
  marge_alerte_pct        smallint not null default 25 check (marge_alerte_pct between 0 and 200),
  retention_appels_jours  smallint not null default 90 check (retention_appels_jours between 7 and 1095),
  retention_audit_jours   smallint not null default 730 check (retention_audit_jours between 90 and 3650),
  decrement_auto_recettes boolean not null default false,                -- recettes : désactivé
  fuseau_horaire          text not null default 'Europe/Paris',
  updated_at              timestamptz not null default now(),
  updated_by              uuid references public.profiles (id) on delete set null
);

-- URLs des webhooks sortants vers n8n (les secrets restent en variables d'environnement)
create table public.webhooks_n8n (
  cle                  text primary key check (cle ~ '^[a-z_]+$'),     -- ex. order_send
  libelle              text not null,
  url                  text check (url is null or url ~ '^https://'),
  actif                boolean not null default true,
  derniere_utilisation timestamptz,
  dernier_statut_http  smallint,
  updated_at           timestamptz not null default now()
);

-- Journal des webhooks entrants (anti-rejeu / idempotence / diagnostic)
create table public.webhooks_recus (
  id               bigint generated always as identity primary key,
  source           text not null check (source in ('n8n_orders', 'n8n_calls')),
  idempotency_key  text not null,
  evenement        text,
  statut_http      smallint not null,
  erreur           text,
  recu_le          timestamptz not null default now(),
  unique (source, idempotency_key)
);
create index webhooks_recus_date_idx on public.webhooks_recus (recu_le desc);

-- Saisons, horaires, fermetures
create table public.saisons (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  date_debut  date not null,
  date_fin    date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint saisons_dates check (date_fin >= date_debut)
);

create table public.horaires_poles (
  id           uuid primary key default gen_random_uuid(),
  pole_id      smallint not null references public.poles (id) on delete cascade,
  saison_id    uuid not null references public.saisons (id) on delete cascade,
  jour_semaine smallint not null check (jour_semaine between 1 and 7),   -- 1 = lundi (ISO)
  ferme        boolean not null default false,
  ouverture    time,
  fermeture    time,                                                      -- < ouverture = après minuit
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pole_id, saison_id, jour_semaine),
  constraint horaires_coherents check (ferme or (ouverture is not null and fermeture is not null))
);

create table public.fermetures_exceptionnelles (
  id          uuid primary key default gen_random_uuid(),
  pole_id     smallint references public.poles (id) on delete cascade,  -- null = tout le complexe
  date_debut  date not null,
  date_fin    date not null,
  motif       text not null check (length(btrim(motif)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint fermetures_dates check (date_fin >= date_debut)
);
create index fermetures_dates_idx on public.fermetures_exceptionnelles (date_debut, date_fin);

-- -----------------------------------------------------------------------------
-- 7. Fournisseurs
-- -----------------------------------------------------------------------------
create table public.fournisseurs (
  id                     uuid primary key default gen_random_uuid(),
  nom                    text not null check (length(btrim(nom)) between 2 and 120),
  contact_nom            text,
  email                  text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telephone              text,
  mode_commande          public.mode_commande not null default 'email',
  url_portail            text check (url_portail is null or url_portail ~ '^https?://'),
  jours_commande         smallint[] not null default '{}'
                         check (jours_commande <@ array[1,2,3,4,5,6,7]::smallint[]),
  jours_livraison        smallint[] not null default '{}'
                         check (jours_livraison <@ array[1,2,3,4,5,6,7]::smallint[]),
  delai_livraison_jours  smallint not null default 1 check (delai_livraison_jours between 0 and 60),
  minimum_commande_ht    numeric(10,2) not null default 0 check (minimum_commande_ht >= 0),
  adresse                text,
  notes                  text,
  actif                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint fournisseurs_email_si_mail   check (mode_commande <> 'email'   or email is not null),
  constraint fournisseurs_url_si_portail  check (mode_commande <> 'portail' or url_portail is not null)
);
create unique index fournisseurs_nom_uniq on public.fournisseurs (lower(nom));
create index fournisseurs_nom_trgm on public.fournisseurs using gin (nom extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 8. Produits et référentiels de stock
-- -----------------------------------------------------------------------------
create table public.categories_produit (
  id          uuid primary key default gen_random_uuid(),
  pole_id     smallint not null references public.poles (id),
  nom         text not null check (length(btrim(nom)) between 2 and 60),
  ordre       smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, pole_id),
  unique (pole_id, nom)
);

create table public.lieux_stockage (
  id          uuid primary key default gen_random_uuid(),
  pole_id     smallint not null references public.poles (id),
  nom         text not null check (length(btrim(nom)) between 2 and 60),
  ordre       smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, pole_id),
  unique (pole_id, nom)
);

create table public.produits (
  id                        uuid primary key default gen_random_uuid(),
  pole_id                   smallint not null references public.poles (id),
  nom                       text not null check (length(btrim(nom)) between 2 and 120),
  reference                 text,
  categorie_id              uuid,
  unite                     public.unite_mesure not null,
  lieu_stockage_id          uuid,
  fournisseur_principal_id  uuid references public.fournisseurs (id) on delete set null,
  prix_achat_ht             numeric(12,4) not null default 0 check (prix_achat_ht >= 0),
  seuil_minimum             numeric(12,3) not null default 0 check (seuil_minimum >= 0),
  quantite_reappro          numeric(12,3) not null default 0 check (quantite_reappro >= 0),
  suivi_dlc                 boolean not null default false,
  actif                     boolean not null default true,
  notes                     text,
  cree_par                  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- la catégorie et le lieu appartiennent forcément au pôle du produit
  foreign key (categorie_id, pole_id)     references public.categories_produit (id, pole_id)
    on delete set null (categorie_id),
  foreign key (lieu_stockage_id, pole_id) references public.lieux_stockage (id, pole_id)
    on delete set null (lieu_stockage_id)
);
create unique index produits_nom_uniq      on public.produits (pole_id, lower(nom)) where actif;
create index produits_pole_idx             on public.produits (pole_id) where actif;
create index produits_categorie_idx        on public.produits (categorie_id);
create index produits_lieu_idx             on public.produits (lieu_stockage_id);
create index produits_fournisseur_idx      on public.produits (fournisseur_principal_id);
create index produits_nom_trgm             on public.produits using gin (nom extensions.gin_trgm_ops);

-- Produits proposés par chaque fournisseur (fiche fournisseur « produits associés »)
create table public.fournisseur_produits (
  fournisseur_id         uuid not null references public.fournisseurs (id) on delete cascade,
  produit_id             uuid not null references public.produits (id) on delete cascade,
  reference_fournisseur  text,
  prix_ht                numeric(12,4) check (prix_ht is null or prix_ht >= 0),
  conditionnement        numeric(12,3) not null default 1 check (conditionnement > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (fournisseur_id, produit_id)
);
create index fournisseur_produits_produit_idx on public.fournisseur_produits (produit_id);

-- -----------------------------------------------------------------------------
-- 9. Commandes, livraisons
-- -----------------------------------------------------------------------------
create table public.commandes (
  id                     uuid primary key default gen_random_uuid(),
  numero                 bigint generated always as identity unique,   -- affiché « CMD-000123 »
  fournisseur_id         uuid not null references public.fournisseurs (id) on delete restrict,
  pole_id                smallint not null references public.poles (id),
  statut                 public.statut_commande not null default 'brouillon',
  date_livraison_prevue  date,
  commentaire            text,
  origine                public.origine_donnee not null default 'app',
  commande_source_id     uuid references public.commandes (id) on delete set null,  -- duplication
  cree_par               uuid references public.profiles (id) on delete set null default auth.uid(),
  soumise_le             timestamptz,
  valide_par             uuid references public.profiles (id) on delete set null,
  valide_le              timestamptz,
  envoyee_le             timestamptz,
  confirmee_le           timestamptz,
  livree_le              timestamptz,
  cloturee_le            timestamptz,
  annulee_le             timestamptz,
  motif_annulation       text,
  derniere_erreur_envoi  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint commandes_motif_annulation check (statut <> 'annulee' or motif_annulation is not null)
);
create index commandes_pole_statut_idx   on public.commandes (pole_id, statut);
create index commandes_statut_date_idx   on public.commandes (statut, date_livraison_prevue);
create index commandes_fournisseur_idx   on public.commandes (fournisseur_id, created_at desc);

create table public.commande_lignes (
  id                uuid primary key default gen_random_uuid(),
  commande_id       uuid not null references public.commandes (id) on delete cascade,
  produit_id        uuid not null references public.produits (id) on delete restrict,
  quantite          numeric(12,3) not null check (quantite > 0),
  prix_unitaire_ht  numeric(12,4) not null default 0 check (prix_unitaire_ht >= 0),
  montant_ht        numeric(12,2) generated always as (round(quantite * prix_unitaire_ht, 2)) stored,
  commentaire       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (commande_id, produit_id)
);
create index commande_lignes_produit_idx on public.commande_lignes (produit_id);

create table public.livraisons (
  id                     uuid primary key default gen_random_uuid(),
  commande_id            uuid not null references public.commandes (id) on delete restrict,
  pole_id                smallint not null references public.poles (id),   -- recopié de la commande
  statut                 public.statut_livraison not null default 'en_cours',
  numero_bon_livraison   text,
  photo_bl_path          text,                                              -- Supabase Storage
  conforme               boolean,                                           -- calculé à la validation
  commentaire            text,
  recue_par              uuid references public.profiles (id) on delete set null default auth.uid(),
  recue_le               timestamptz not null default now(),
  validee_le             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index livraisons_commande_idx on public.livraisons (commande_id);
create index livraisons_pole_date_idx on public.livraisons (pole_id, recue_le desc);

create table public.livraison_lignes (
  id                  uuid primary key default gen_random_uuid(),
  livraison_id        uuid not null references public.livraisons (id) on delete cascade,
  commande_ligne_id   uuid references public.commande_lignes (id) on delete set null,  -- null = hors commande
  produit_id          uuid not null references public.produits (id) on delete restrict,
  quantite_commandee  numeric(12,3) not null default 0 check (quantite_commandee >= 0),
  quantite_recue      numeric(12,3) not null default 0 check (quantite_recue >= 0),
  ecart               numeric(12,3) generated always as (quantite_recue - quantite_commandee) stored,
  prix_unitaire_ht    numeric(12,4) check (prix_unitaire_ht is null or prix_unitaire_ht >= 0),
  motif_ecart         text check (motif_ecart is null or motif_ecart in
                        ('manquant', 'abime', 'erreur_produit', 'surplus', 'dlc_courte', 'autre')),
  dlc                 date,
  numero_lot          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (livraison_id, produit_id)
);
create index livraison_lignes_produit_idx on public.livraison_lignes (produit_id);

-- -----------------------------------------------------------------------------
-- 10. Inventaires
-- -----------------------------------------------------------------------------
create table public.inventaires (
  id                uuid primary key default gen_random_uuid(),
  pole_id           smallint not null references public.poles (id),
  lieu_stockage_id  uuid references public.lieux_stockage (id) on delete set null,  -- null = tout le pôle
  statut            public.statut_inventaire not null default 'en_cours',
  commentaire       text,
  cree_par          uuid references public.profiles (id) on delete set null default auth.uid(),
  soumis_le         timestamptz,
  valide_par        uuid references public.profiles (id) on delete set null,
  valide_le         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- un seul inventaire ouvert par pôle et par lieu
create unique index inventaires_ouvert_uniq on public.inventaires
  (pole_id, coalesce(lieu_stockage_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where statut in ('en_cours', 'soumis');
create index inventaires_pole_idx on public.inventaires (pole_id, created_at desc);

create table public.inventaire_lignes (
  id                uuid primary key default gen_random_uuid(),
  inventaire_id     uuid not null references public.inventaires (id) on delete cascade,
  produit_id        uuid not null references public.produits (id) on delete restrict,
  stock_theorique   numeric(12,3),          -- figé au moment du comptage (trigger)
  quantite_comptee  numeric(12,3) check (quantite_comptee is null or quantite_comptee >= 0),
  ecart             numeric(12,3) generated always as (quantite_comptee - stock_theorique) stored,
  commentaire       text,
  compte_par        uuid references public.profiles (id) on delete set null,
  compte_le         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (inventaire_id, produit_id)
);
create index inventaire_lignes_produit_idx on public.inventaire_lignes (produit_id);

-- -----------------------------------------------------------------------------
-- 11. Mouvements de stock (source de vérité du stock) et lots à DLC
-- -----------------------------------------------------------------------------
create table public.mouvements_stock (
  id                    bigint generated always as identity primary key,
  produit_id            uuid not null references public.produits (id) on delete restrict,
  pole_id               smallint not null references public.poles (id),  -- recopié du produit (trigger)
  type                  public.type_mouvement not null,
  quantite              numeric(12,3) not null,       -- variation signée : + entre, - sort
  prix_unitaire_ht      numeric(12,4) check (prix_unitaire_ht is null or prix_unitaire_ht >= 0),
  motif                 text,
  date_mouvement        timestamptz not null default now(),
  cree_par              uuid references public.profiles (id) on delete set null default auth.uid(),
  origine               public.origine_donnee not null default 'app',
  livraison_ligne_id    uuid references public.livraison_lignes (id) on delete set null,
  inventaire_ligne_id   uuid references public.inventaire_lignes (id) on delete set null,
  annule_mouvement_id   bigint unique references public.mouvements_stock (id),  -- contre-passation
  created_at            timestamptz not null default now(),
  constraint mouvements_signe check (
       (type = 'entree' and quantite > 0)
    or (type in ('sortie', 'perte') and quantite < 0)
    or (type = 'correction' and quantite <> 0)),
  constraint mouvements_motif_requis check (
    type not in ('perte', 'correction') or nullif(btrim(motif), '') is not null)
);
create index mouvements_produit_idx on public.mouvements_stock (produit_id, date_mouvement desc)
  include (quantite);
create index mouvements_pole_date_idx on public.mouvements_stock (pole_id, date_mouvement desc);
create index mouvements_type_date_idx on public.mouvements_stock (type, date_mouvement desc);
create index mouvements_auteur_idx on public.mouvements_stock (cree_par);

create table public.lots_dlc (
  id                   uuid primary key default gen_random_uuid(),
  produit_id           uuid not null references public.produits (id) on delete cascade,
  pole_id              smallint not null references public.poles (id),
  mouvement_entree_id  bigint unique references public.mouvements_stock (id) on delete set null,
  dlc                  date not null,
  quantite_initiale    numeric(12,3) not null check (quantite_initiale > 0),
  numero_lot           text,
  solde_le             timestamptz,           -- lot consommé / jeté : plus d'alerte
  solde_par            uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index lots_dlc_ouverts_idx on public.lots_dlc (pole_id, dlc) where solde_le is null;
create index lots_dlc_produit_idx on public.lots_dlc (produit_id);

-- -----------------------------------------------------------------------------
-- 12. Recettes (préparées pour un futur décrément automatique par la caisse)
-- -----------------------------------------------------------------------------
create table public.recettes (
  id              uuid primary key default gen_random_uuid(),
  pole_id         smallint not null references public.poles (id),
  nom             text not null check (length(btrim(nom)) between 2 and 120),
  code_caisse     text unique,
  prix_vente_ttc  numeric(10,2) check (prix_vente_ttc is null or prix_vente_ttc >= 0),
  actif           boolean not null default false,        -- désactivé par défaut
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.recette_ingredients (
  recette_id  uuid not null references public.recettes (id) on delete cascade,
  produit_id  uuid not null references public.produits (id) on delete restrict,
  quantite    numeric(12,4) not null check (quantite > 0),  -- dans l'unité du produit
  primary key (recette_id, produit_id)
);
create index recette_ingredients_produit_idx on public.recette_ingredients (produit_id);

-- -----------------------------------------------------------------------------
-- 13. Journal des appels IA (alimenté par n8n, lecture seule dans l'app)
-- -----------------------------------------------------------------------------
create table public.appels_ia (
  id              uuid primary key default gen_random_uuid(),
  id_externe      text not null unique,          -- identifiant d'appel côté n8n (idempotence)
  debut           timestamptz not null,
  duree_secondes  integer not null check (duree_secondes between 0 and 86400),
  numero_masque   text not null check (length(numero_masque) between 4 and 25),  -- « 06 •• •• •• 42 »
  numero_hash     text,                          -- HMAC du numéro : regrouper sans stocker en clair
  pole_id         smallint references public.poles (id),   -- pôle demandé ; null = général
  issue           public.issue_appel not null,
  resume          text,
  transcription   text,
  metadonnees     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index appels_ia_debut_idx on public.appels_ia (debut desc);
create index appels_ia_pole_idx  on public.appels_ia (pole_id, debut desc);
create index appels_ia_issue_idx on public.appels_ia (issue, debut desc);

-- =============================================================================
-- 14. Triggers métier
-- =============================================================================

-- updated_at sur toutes les tables qui ont la colonne
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.maj_updated_at()', t);
  end loop;
end $$;

-- Création automatique du profil à l'inscription (invitation par le gérant).
-- Rôle et pôle sont lus dans raw_app_meta_data, modifiable uniquement côté serveur.
create function app.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.role_utilisateur :=
    coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'salarie')::public.role_utilisateur;
  v_pole smallint :=
    (select id from public.poles where code::text = new.raw_app_meta_data ->> 'pole');
begin
  insert into public.profiles (id, email, prenom, nom, role, pole_id)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'prenom', ''),
          coalesce(new.raw_user_meta_data ->> 'nom', ''),
          v_role,
          case when v_role = 'gerant' then null else v_pole end);
  return new;
end $$;

create trigger trg_auth_users_creer_profil
  after insert on auth.users for each row execute function app.creer_profil();

-- Protection des champs sensibles du profil
create function app.proteger_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not app.appel_systeme() and not app.est_gerant() then
    if new.role is distinct from old.role or new.pole_id is distinct from old.pole_id
       or new.actif is distinct from old.actif or new.email is distinct from old.email
       or new.saisonnier is distinct from old.saisonnier or new.fin_contrat is distinct from old.fin_contrat
       or new.anonymise_le is distinct from old.anonymise_le then
      raise exception 'Seul le gérant peut modifier le rôle, le pôle ou le statut d''un compte.'
        using errcode = '42501';
    end if;
  end if;
  -- il reste toujours au moins un gérant actif
  if old.role = 'gerant' and old.actif and (new.role <> 'gerant' or not new.actif)
     and not exists (select 1 from public.profiles
                     where role = 'gerant' and actif and id <> old.id) then
    raise exception 'Impossible : ce compte est le dernier gérant actif.' using errcode = 'P0001';
  end if;
  if new.role = 'gerant' then new.pole_id := null; end if;
  return new;
end $$;

create trigger trg_profiles_proteger before update on public.profiles
  for each row execute function app.proteger_profil();

-- Mouvements : pôle recopié du produit, auteur forcé, prix par défaut
create function app.preparer_mouvement() returns trigger
language plpgsql set search_path = '' as $$
declare v_produit public.produits;
begin
  select * into v_produit from public.produits where id = new.produit_id;
  if not found then
    raise exception 'Produit introuvable.' using errcode = 'P0002';
  end if;
  new.pole_id := v_produit.pole_id;
  new.cree_par := coalesce(auth.uid(), new.cree_par);
  new.prix_unitaire_ht := coalesce(new.prix_unitaire_ht, v_produit.prix_achat_ht);
  if new.date_mouvement > now() + interval '5 minutes' then
    raise exception 'La date d''un mouvement ne peut pas être dans le futur.' using errcode = '22008';
  end if;
  return new;
end $$;

create trigger trg_mouvements_preparer before insert on public.mouvements_stock
  for each row execute function app.preparer_mouvement();

-- Mouvements immuables
create function app.interdire_modification() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Les mouvements de stock ne se modifient pas : enregistrez un mouvement de correction.'
    using errcode = '42501';
end $$;

create trigger trg_mouvements_immuables before update or delete on public.mouvements_stock
  for each row execute function app.interdire_modification();

-- Stock retombé à zéro : les lots DLC du produit sont soldés automatiquement
create function app.solder_lots_si_stock_nul() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.quantite < 0 and (select coalesce(sum(quantite), 0) from public.mouvements_stock
                           where produit_id = new.produit_id) <= 0 then
    update public.lots_dlc set solde_le = now()
    where produit_id = new.produit_id and solde_le is null;
  end if;
  return null;
end $$;

create trigger trg_mouvements_solder_lots after insert on public.mouvements_stock
  for each row execute function app.solder_lots_si_stock_nul();

-- Lots DLC : pôle recopié du produit
create function app.pole_depuis_produit() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.pole_id := (select pole_id from public.produits where id = new.produit_id);
  return new;
end $$;

create trigger trg_lots_dlc_pole before insert or update of produit_id on public.lots_dlc
  for each row execute function app.pole_depuis_produit();

-- Livraisons : pôle recopié de la commande
create function app.pole_depuis_commande() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.pole_id := (select pole_id from public.commandes where id = new.commande_id);
  return new;
end $$;

create trigger trg_livraisons_pole before insert or update of commande_id on public.livraisons
  for each row execute function app.pole_depuis_commande();

-- Cohérence des pôles : un produit ne peut aller que dans une commande / livraison /
-- inventaire de son propre pôle
create function app.controler_pole_produit() returns trigger
language plpgsql set search_path = '' as $$
declare v_pole_parent smallint; v_pole_produit smallint;
begin
  v_pole_produit := (select pole_id from public.produits where id = new.produit_id);
  if tg_table_name = 'commande_lignes' then
    v_pole_parent := (select pole_id from public.commandes where id = new.commande_id);
  elsif tg_table_name = 'livraison_lignes' then
    v_pole_parent := (select pole_id from public.livraisons where id = new.livraison_id);
  elsif tg_table_name = 'inventaire_lignes' then
    v_pole_parent := (select pole_id from public.inventaires where id = new.inventaire_id);
  else
    v_pole_parent := (select pole_id from public.recettes where id = new.recette_id);
  end if;
  if v_pole_parent is distinct from v_pole_produit then
    raise exception 'Ce produit appartient à un autre pôle.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_commande_lignes_pole before insert or update of produit_id on public.commande_lignes
  for each row execute function app.controler_pole_produit();
create trigger trg_livraison_lignes_pole before insert or update of produit_id on public.livraison_lignes
  for each row execute function app.controler_pole_produit();
create trigger trg_inventaire_lignes_pole before insert or update of produit_id on public.inventaire_lignes
  for each row execute function app.controler_pole_produit();
create trigger trg_recette_ingredients_pole before insert or update of produit_id on public.recette_ingredients
  for each row execute function app.controler_pole_produit();

-- Comptage d'inventaire : stock théorique figé au moment de la saisie
create function app.figer_stock_theorique() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.quantite_comptee is distinct from old.quantite_comptee or tg_op = 'INSERT' then
    if new.quantite_comptee is not null then
      new.stock_theorique := (select coalesce(sum(quantite), 0) from public.mouvements_stock
                              where produit_id = new.produit_id);
      new.compte_par := coalesce(auth.uid(), new.compte_par);
      new.compte_le := now();
    end if;
  end if;
  return new;
end $$;

create trigger trg_inventaire_lignes_figer before insert or update on public.inventaire_lignes
  for each row execute function app.figer_stock_theorique();

-- Commandes : transitions de statut autorisées et horodatage
create function app.controler_statut_commande() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ok boolean := case old.statut
    when 'brouillon' then new.statut in ('a_valider', 'envoyee', 'annulee')
    when 'a_valider' then new.statut in ('brouillon', 'envoyee', 'annulee')
    when 'envoyee'   then new.statut in ('confirmee', 'livree', 'en_retard', 'annulee')
    when 'confirmee' then new.statut in ('livree', 'en_retard', 'annulee')
    when 'en_retard' then new.statut in ('confirmee', 'livree', 'annulee')
    when 'livree'    then new.statut in ('cloturee')
    else false
  end;
begin
  if new.statut = old.statut then return new; end if;
  if not ok then
    raise exception 'Passage de « % » à « % » impossible.', old.statut, new.statut using errcode = 'P0001';
  end if;
  -- envoi au fournisseur : gérant (ou n8n / système)
  if new.statut = 'envoyee' and not (app.appel_systeme() or app.est_gerant()) then
    raise exception 'Seul le gérant peut valider et envoyer une commande.' using errcode = '42501';
  end if;
  case new.statut
    when 'a_valider' then new.soumise_le := now();
    when 'envoyee'   then new.envoyee_le := now();
                          new.valide_le  := coalesce(new.valide_le, now());
                          new.valide_par := coalesce(new.valide_par, auth.uid());
    when 'confirmee' then new.confirmee_le := now();
    when 'livree'    then new.livree_le := now();
    when 'cloturee'  then new.cloturee_le := now();
    when 'annulee'   then new.annulee_le := now();
    else null;
  end case;
  return new;
end $$;

create trigger trg_commandes_statut before update of statut on public.commandes
  for each row execute function app.controler_statut_commande();

-- Audit des actions sensibles
create trigger trg_audit_profiles after insert or update or delete on public.profiles
  for each row execute function app.audit_trigger();
create trigger trg_audit_parametres after update on public.parametres
  for each row execute function app.audit_trigger();
create trigger trg_audit_webhooks after insert or update or delete on public.webhooks_n8n
  for each row execute function app.audit_trigger();
create trigger trg_audit_fournisseurs after update or delete on public.fournisseurs
  for each row execute function app.audit_trigger();
create trigger trg_audit_produits after update or delete on public.produits
  for each row execute function app.audit_trigger();
create trigger trg_audit_commandes after update of statut or delete on public.commandes
  for each row execute function app.audit_trigger();
create trigger trg_audit_inventaires after update of statut on public.inventaires
  for each row execute function app.audit_trigger();

-- =============================================================================
-- 15. Vues (security_invoker : la RLS de l'utilisateur s'applique)
-- =============================================================================

-- Stock courant, valeur et niveau d'alerte par produit
create view public.v_stock_produits with (security_invoker = true) as
select
  p.*,
  coalesce(s.stock, 0)                                         as stock_actuel,
  round(coalesce(s.stock, 0) * p.prix_achat_ht, 2)             as valeur_stock_ht,
  s.dernier_mouvement,
  case
    when p.seuil_minimum > 0 and coalesce(s.stock, 0) <= p.seuil_minimum then 'rouge'
    when p.seuil_minimum > 0
     and coalesce(s.stock, 0) <= p.seuil_minimum * (1 + prm.marge_alerte_pct / 100.0) then 'orange'
    else 'ok'
  end                                                          as niveau_alerte,
  greatest(p.quantite_reappro, p.seuil_minimum - coalesce(s.stock, 0), 0) as quantite_a_commander
from public.produits p
cross join public.parametres prm
left join lateral (
  select sum(m.quantite) as stock, max(m.date_mouvement) as dernier_mouvement
  from public.mouvements_stock m where m.produit_id = p.id
) s on true;

-- Lots dont la DLC tombe dans le délai paramétré (J-3 par défaut) ou est dépassée
create view public.v_alertes_dlc with (security_invoker = true) as
select l.id, l.produit_id, p.nom as produit_nom, l.pole_id, l.dlc, l.numero_lot, l.quantite_initiale,
       (l.dlc - current_date) as jours_restants
from public.lots_dlc l
join public.produits p on p.id = l.produit_id
cross join public.parametres prm
where l.solde_le is null
  and l.dlc <= current_date + prm.seuil_dlc_jours;

-- Commandes avec totaux
create view public.v_commandes with (security_invoker = true) as
select c.*,
       'CMD-' || lpad(c.numero::text, 6, '0')                     as reference,
       f.nom                                                      as fournisseur_nom,
       coalesce(t.nb_lignes, 0)                                   as nb_lignes,
       coalesce(t.montant_ht, 0)                                  as montant_ht,
       (c.statut in ('envoyee', 'confirmee') and c.date_livraison_prevue < current_date) as est_en_retard
from public.commandes c
join public.fournisseurs f on f.id = c.fournisseur_id
left join lateral (
  select count(*) as nb_lignes, sum(l.montant_ht) as montant_ht
  from public.commande_lignes l where l.commande_id = c.id
) t on true;

-- Statistiques fournisseur : délai réel moyen, taux de conformité
create view public.v_stats_fournisseurs with (security_invoker = true) as
select f.id as fournisseur_id, f.nom,
       count(distinct c.id) filter (where c.statut not in ('brouillon', 'annulee')) as nb_commandes,
       round(avg(extract(epoch from (c.livree_le - c.envoyee_le)) / 86400.0)
             filter (where c.livree_le is not null and c.envoyee_le is not null), 1) as delai_reel_moyen_jours,
       round(100.0 * avg(case when lv.conforme then 1 else 0 end)
             filter (where lv.statut = 'validee'), 0)                              as taux_conformite_pct,
       sum(lg.montant_ht) filter (where c.statut not in ('brouillon', 'annulee'))  as montant_total_ht
from public.fournisseurs f
left join public.commandes c on c.fournisseur_id = f.id
left join public.livraisons lv on lv.commande_id = c.id
left join lateral (select sum(montant_ht) as montant_ht from public.commande_lignes
                   where commande_id = c.id) lg on true
group by f.id, f.nom;

-- Historique des prix réellement facturés (livraisons validées)
create view public.v_historique_prix with (security_invoker = true) as
select ll.produit_id, c.fournisseur_id, lv.validee_le::date as date_prix, ll.prix_unitaire_ht
from public.livraison_lignes ll
join public.livraisons lv on lv.id = ll.livraison_id and lv.statut = 'validee'
join public.commandes c on c.id = lv.commande_id
where ll.prix_unitaire_ht is not null;

-- =============================================================================
-- 16. Fonctions RPC (appelées depuis les Server Actions)
-- =============================================================================

-- Saisie d'un mouvement (+ lot DLC si besoin). security invoker : la RLS s'applique.
create function public.enregistrer_mouvement(
  p_produit_id uuid, p_type public.type_mouvement, p_quantite numeric,
  p_motif text default null, p_dlc date default null, p_numero_lot text default null
) returns bigint language plpgsql set search_path = '' as $$
declare
  v_id bigint;
  v_signe numeric := case p_type when 'entree' then 1 when 'correction' then 1 else -1 end;
begin
  if p_quantite is null or p_quantite = 0 then
    raise exception 'La quantité doit être différente de zéro.' using errcode = '22023';
  end if;
  insert into public.mouvements_stock (produit_id, type, quantite, motif)
  values (p_produit_id, p_type, case when p_type = 'correction' then p_quantite
                                     else v_signe * abs(p_quantite) end, p_motif)
  returning id into v_id;
  if p_type = 'entree' and p_dlc is not null then
    insert into public.lots_dlc (produit_id, mouvement_entree_id, dlc, quantite_initiale, numero_lot)
    values (p_produit_id, v_id, p_dlc, abs(p_quantite), p_numero_lot);
  end if;
  return v_id;
end $$;

-- « Annuler » (toast) : contre-passation d'un mouvement, par son auteur dans les
-- 10 minutes, ou par un responsable du pôle / le gérant à tout moment
create function public.annuler_mouvement(p_mouvement_id bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare m public.mouvements_stock; v_id bigint;
begin
  select * into m from public.mouvements_stock where id = p_mouvement_id;
  if not found then raise exception 'Mouvement introuvable.' using errcode = 'P0002'; end if;
  if not (app.gere_pole(m.pole_id)
          or (m.cree_par = auth.uid() and m.created_at > now() - interval '10 minutes')) then
    raise exception 'Vous ne pouvez plus annuler ce mouvement.' using errcode = '42501';
  end if;
  if m.annule_mouvement_id is not null
     or exists (select 1 from public.mouvements_stock where annule_mouvement_id = m.id) then
    raise exception 'Ce mouvement a déjà été annulé.' using errcode = 'P0001';
  end if;
  insert into public.mouvements_stock (produit_id, type, quantite, prix_unitaire_ht, motif, annule_mouvement_id)
  values (m.produit_id, 'correction', -m.quantite, m.prix_unitaire_ht,
          'Annulation du mouvement n°' || m.id, m.id)
  returning id into v_id;
  delete from public.lots_dlc where mouvement_entree_id = m.id;
  return v_id;
end $$;

-- Validation d'une réception de livraison : entrées de stock, lots DLC, statut commande
create function public.valider_livraison(p_livraison_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  lv public.livraisons;
  l record;
  v_mvt bigint;
  v_conforme boolean;
begin
  select * into lv from public.livraisons where id = p_livraison_id for update;
  if not found then raise exception 'Livraison introuvable.' using errcode = 'P0002'; end if;
  if not (app.appel_systeme() or app.gere_pole(lv.pole_id)) then
    raise exception 'Seul un responsable du pôle peut valider cette livraison.' using errcode = '42501';
  end if;
  if lv.statut = 'validee' then raise exception 'Livraison déjà validée.' using errcode = 'P0001'; end if;

  -- contrôles : motif pour chaque écart, DLC pour les produits suivis
  for l in select ll.*, p.nom, p.suivi_dlc from public.livraison_lignes ll
           join public.produits p on p.id = ll.produit_id where ll.livraison_id = lv.id loop
    if l.ecart <> 0 and l.motif_ecart is null then
      raise exception 'Indiquez le motif de l''écart pour « % ».', l.nom using errcode = '23514';
    end if;
    if l.suivi_dlc and l.quantite_recue > 0 and l.dlc is null then
      raise exception 'La DLC est obligatoire pour « % ».', l.nom using errcode = '23514';
    end if;
  end loop;

  for l in select ll.* from public.livraison_lignes ll
           where ll.livraison_id = lv.id and ll.quantite_recue > 0 loop
    insert into public.mouvements_stock (produit_id, type, quantite, prix_unitaire_ht, motif,
                                         livraison_ligne_id, cree_par, origine)
    values (l.produit_id, 'entree', l.quantite_recue, l.prix_unitaire_ht,
            'Livraison ' || coalesce(lv.numero_bon_livraison, ''), l.id, lv.recue_par, 'app')
    returning id into v_mvt;
    if l.dlc is not null then
      insert into public.lots_dlc (produit_id, mouvement_entree_id, dlc, quantite_initiale, numero_lot)
      values (l.produit_id, v_mvt, l.dlc, l.quantite_recue, l.numero_lot);
    end if;
    -- le dernier prix payé devient le prix d'achat du produit
    if l.prix_unitaire_ht is not null then
      update public.produits set prix_achat_ht = l.prix_unitaire_ht
      where id = l.produit_id and prix_achat_ht is distinct from l.prix_unitaire_ht;
    end if;
  end loop;

  v_conforme := not exists (select 1 from public.livraison_lignes
                            where livraison_id = lv.id and ecart <> 0)
            and not exists (select 1 from public.commande_lignes cl
                            where cl.commande_id = lv.commande_id
                              and not exists (select 1 from public.livraison_lignes ll
                                              where ll.livraison_id = lv.id and ll.commande_ligne_id = cl.id));

  update public.livraisons set statut = 'validee', validee_le = now(), conforme = v_conforme
  where id = lv.id;
  update public.commandes set statut = 'livree'
  where id = lv.commande_id and statut in ('envoyee', 'confirmee', 'en_retard');

  perform app.journaliser('livraison.validee', 'livraisons', lv.id::text,
                          jsonb_build_object('conforme', v_conforme));
end $$;

-- Validation d'un inventaire : une correction par écart
create function public.valider_inventaire(p_inventaire_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare inv public.inventaires; v_nb integer;
begin
  select * into inv from public.inventaires where id = p_inventaire_id for update;
  if not found then raise exception 'Inventaire introuvable.' using errcode = 'P0002'; end if;
  if not app.gere_pole(inv.pole_id) then
    raise exception 'Seul un responsable du pôle peut valider l''inventaire.' using errcode = '42501';
  end if;
  if inv.statut not in ('en_cours', 'soumis') then
    raise exception 'Cet inventaire est déjà clôturé.' using errcode = 'P0001';
  end if;

  insert into public.mouvements_stock (produit_id, type, quantite, motif, inventaire_ligne_id)
  select il.produit_id, 'correction', il.ecart,
         'Inventaire du ' || to_char(coalesce(inv.soumis_le, now()), 'DD/MM/YYYY'), il.id
  from public.inventaire_lignes il
  where il.inventaire_id = inv.id and il.quantite_comptee is not null and il.ecart <> 0;
  get diagnostics v_nb = row_count;

  update public.inventaires set statut = 'valide', valide_par = auth.uid(), valide_le = now()
  where id = inv.id;
  return v_nb;
end $$;

-- Brouillons « Commander tous les produits en alerte » : une commande par fournisseur principal
create function public.creer_brouillons_reappro(p_pole_id smallint, p_produit_ids uuid[] default null)
returns setof uuid language plpgsql set search_path = '' as $$
declare f record; v_cmd uuid;
begin
  if not app.gere_pole(p_pole_id) then
    raise exception 'Seul un responsable du pôle peut créer des commandes.' using errcode = '42501';
  end if;
  for f in
    select s.fournisseur_principal_id as fid
    from public.v_stock_produits s
    where s.pole_id = p_pole_id and s.actif and s.fournisseur_principal_id is not null
      and (p_produit_ids is null or s.id = any (p_produit_ids))
      and (p_produit_ids is not null or s.niveau_alerte = 'rouge')
    group by s.fournisseur_principal_id
  loop
    -- on complète le brouillon existant du fournisseur plutôt que d'en créer un second
    select id into v_cmd from public.commandes
    where pole_id = p_pole_id and fournisseur_id = f.fid and statut = 'brouillon'
    order by created_at desc limit 1;
    if v_cmd is null then
      insert into public.commandes (fournisseur_id, pole_id, date_livraison_prevue)
      select f.fid, p_pole_id, current_date + fo.delai_livraison_jours
      from public.fournisseurs fo where fo.id = f.fid
      returning id into v_cmd;
    end if;
    insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
    select v_cmd, s.id,
           -- arrondi au conditionnement du fournisseur
           ceil(greatest(s.quantite_a_commander, 0.001) / coalesce(fp.conditionnement, 1))
             * coalesce(fp.conditionnement, 1),
           coalesce(fp.prix_ht, s.prix_achat_ht)
    from public.v_stock_produits s
    left join public.fournisseur_produits fp on fp.fournisseur_id = f.fid and fp.produit_id = s.id
    where s.pole_id = p_pole_id and s.actif and s.fournisseur_principal_id = f.fid
      and (p_produit_ids is null or s.id = any (p_produit_ids))
      and (p_produit_ids is not null or s.niveau_alerte = 'rouge')
    on conflict (commande_id, produit_id) do update set quantite = excluded.quantite;
    return next v_cmd;
    v_cmd := null;
  end loop;
end $$;

-- « Dupliquer la dernière commande » d'un fournisseur
create function public.dupliquer_commande(p_commande_id uuid) returns uuid
language plpgsql set search_path = '' as $$
declare c public.commandes; v_id uuid;
begin
  select * into c from public.commandes where id = p_commande_id;   -- RLS appliquée
  if not found then raise exception 'Commande introuvable.' using errcode = 'P0002'; end if;
  insert into public.commandes (fournisseur_id, pole_id, commande_source_id, date_livraison_prevue)
  select c.fournisseur_id, c.pole_id, c.id, current_date + f.delai_livraison_jours
  from public.fournisseurs f where f.id = c.fournisseur_id
  returning id into v_id;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_id, l.produit_id, l.quantite, p.prix_achat_ht
  from public.commande_lignes l join public.produits p on p.id = l.produit_id
  where l.commande_id = c.id and p.actif;
  return v_id;
end $$;

-- Graphique : valeur du stock jour par jour
create function public.evolution_valeur_stock(p_jours integer default 30, p_pole_id smallint default null)
returns table (jour date, valeur_ht numeric)
language sql stable set search_path = '' as $$
  -- valeur de départ + cumul des variations journalières (une seule lecture des mouvements)
  with debut as (select current_date - (p_jours - 1) as d),
  base as (
    select coalesce(sum(m.quantite * coalesce(m.prix_unitaire_ht, 0)), 0) as valeur
    from public.mouvements_stock m, debut
    where m.date_mouvement < debut.d and (p_pole_id is null or m.pole_id = p_pole_id)
  ),
  variations as (
    select m.date_mouvement::date as jour, sum(m.quantite * coalesce(m.prix_unitaire_ht, 0)) as delta
    from public.mouvements_stock m, debut
    where m.date_mouvement >= debut.d and (p_pole_id is null or m.pole_id = p_pole_id)
    group by 1
  )
  select j.d::date,
         round(base.valeur + coalesce(sum(v.delta) over (order by j.d), 0), 2)
  from debut, base,
       generate_series(debut.d, current_date, interval '1 day') j(d)
  left join variations v on v.jour = j.d::date
  order by 1
$$;

-- Graphique : top des produits consommés (sorties + pertes)
create function public.top_produits_consommes(p_debut date, p_fin date,
                                              p_pole_id smallint default null, p_limite integer default 10)
returns table (produit_id uuid, nom text, unite public.unite_mesure, quantite numeric, valeur_ht numeric)
language sql stable set search_path = '' as $$
  select p.id, p.nom, p.unite, sum(-m.quantite), round(sum(-m.quantite * coalesce(m.prix_unitaire_ht, 0)), 2)
  from public.mouvements_stock m join public.produits p on p.id = m.produit_id
  where m.type in ('sortie', 'perte')
    and m.date_mouvement >= p_debut and m.date_mouvement < p_fin + 1
    and (p_pole_id is null or m.pole_id = p_pole_id)
  group by p.id, p.nom, p.unite
  order by 5 desc
  limit least(greatest(p_limite, 1), 50)
$$;

-- Statistiques des appels (RLS : gérant uniquement)
create function public.stats_appels(p_debut date, p_fin date)
returns jsonb language sql stable set search_path = '' as $$
  with a as (select * from public.appels_ia
             where debut >= p_debut and debut < p_fin + 1)
  select jsonb_build_object(
    'total', (select count(*) from a),
    'duree_moyenne_s', (select round(avg(duree_secondes)) from a),
    'taux_transfert_pct', (select round(100.0 * avg((issue = 'transfere')::int), 1) from a),
    'par_jour', (select coalesce(jsonb_agg(x order by x.jour), '[]') from
                 (select (debut at time zone 'Europe/Paris')::date as jour, count(*) as nb
                  from a group by 1) x),
    'par_heure', (select coalesce(jsonb_agg(x order by x.heure), '[]') from
                  (select extract(hour from debut at time zone 'Europe/Paris')::int as heure, count(*) as nb
                   from a group by 1) x),
    'par_pole', (select coalesce(jsonb_agg(x), '[]') from
                 (select coalesce(p.code::text, 'general') as pole, count(*) as nb
                  from a left join public.poles p on p.id = a.pole_id group by 1) x),
    'par_issue', (select coalesce(jsonb_agg(x), '[]') from
                  (select issue, count(*) as nb from a group by 1) x)
  )
$$;

-- RGPD : export des données d'un utilisateur (lui-même ou le gérant)
create function public.exporter_donnees_utilisateur(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not (app.est_gerant() or p_user_id = auth.uid()) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'exporte_le', now(),
    'profil', (select to_jsonb(p) from public.profiles p where p.id = p_user_id),
    'mouvements_saisis', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.mouvements_stock m
                          where m.cree_par = p_user_id),
    'commandes_creees', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.commandes c
                         where c.cree_par = p_user_id),
    'comptages_inventaire', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.inventaire_lignes i
                             where i.compte_par = p_user_id),
    'journal_audit', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.audit_log a
                      where a.user_id = p_user_id)
  ) into v;
  perform app.journaliser('rgpd.export', 'profiles', p_user_id::text);
  return v;
end $$;

-- RGPD : anonymisation d'un compte (l'historique métier est conservé sans identité).
-- La Server Action bloque ensuite le compte Auth via l'API admin (clé service_role).
create function public.anonymiser_utilisateur(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.est_gerant() then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas anonymiser votre propre compte.' using errcode = 'P0001';
  end if;
  update public.profiles
  set prenom = 'Ancien', nom = 'collaborateur', telephone = null, preferences = '{}',
      email = 'anonyme+' || id || '@palmeraie.invalid', actif = false, anonymise_le = now()
  where id = p_user_id;
  update public.audit_log set user_email = null where user_id = p_user_id;
  update public.audit_log set avant = avant - 'email' - 'prenom' - 'nom' - 'telephone',
                              apres = apres - 'email' - 'prenom' - 'nom' - 'telephone'
  where table_cible = 'profiles' and cible_id = p_user_id::text;
  perform app.journaliser('rgpd.anonymisation', 'profiles', p_user_id::text);
end $$;

-- Tâches planifiées (pg_cron) : purge RGPD et passage « en retard »
create function app.purger_donnees() returns void
language plpgsql security definer set search_path = '' as $$
declare v_appels integer; v_audit integer; prm public.parametres;
begin
  select * into prm from public.parametres;
  delete from public.appels_ia where debut < now() - make_interval(days => prm.retention_appels_jours);
  get diagnostics v_appels = row_count;
  delete from public.audit_log where cree_le < now() - make_interval(days => prm.retention_audit_jours);
  get diagnostics v_audit = row_count;
  delete from public.webhooks_recus where recu_le < now() - interval '30 days';
  perform app.journaliser('rgpd.purge', null, null,
                          jsonb_build_object('appels', v_appels, 'audit', v_audit));
end $$;

create function app.marquer_commandes_en_retard() returns void
language sql security definer set search_path = '' as $$
  update public.commandes set statut = 'en_retard'
  where statut in ('envoyee', 'confirmee') and date_livraison_prevue < current_date;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('palmeraie-purge-rgpd', '15 3 * * *', 'select app.purger_donnees()');
    perform cron.schedule('palmeraie-commandes-retard', '0 6 * * *', 'select app.marquer_commandes_en_retard()');
  end if;
end $$;

-- =============================================================================
-- 17. Row Level Security
--   gerant      : tout
--   responsable : lecture + écriture sur SON pôle (stock, commandes, livraisons, inventaires)
--   salarie     : lecture de SON pôle ; saisit mouvements (hors correction) et comptages
--   anon        : rien
-- =============================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Pôles, paramètres, saisons, horaires, fermetures : lecture par tout compte actif
create policy poles_lecture on public.poles for select to authenticated
  using ((select app.role_courant()) is not null);
create policy poles_gerant on public.poles for all to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));

create policy parametres_lecture on public.parametres for select to authenticated
  using ((select app.role_courant()) is not null);
create policy parametres_gerant on public.parametres for update to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));

create policy saisons_lecture on public.saisons for select to authenticated
  using ((select app.role_courant()) is not null);
create policy saisons_gerant on public.saisons for all to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));

create policy horaires_lecture on public.horaires_poles for select to authenticated
  using ((select app.role_courant()) is not null);
create policy horaires_gerant on public.horaires_poles for all to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));

create policy fermetures_lecture on public.fermetures_exceptionnelles for select to authenticated
  using ((select app.role_courant()) is not null);
create policy fermetures_gerant on public.fermetures_exceptionnelles for all to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));

-- Webhooks, journal d'audit : gérant uniquement (écritures via triggers / service_role)
create policy webhooks_gerant on public.webhooks_n8n for all to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));
create policy webhooks_recus_gerant on public.webhooks_recus for select to authenticated
  using ((select app.est_gerant()));
create policy audit_gerant on public.audit_log for select to authenticated
  using ((select app.est_gerant()));

-- Profils : chacun voit le sien ; le responsable voit son équipe ; le gérant voit et gère tout
create policy profiles_lecture on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or (select app.est_gerant())
         or ((select app.role_courant()) = 'responsable' and pole_id = (select app.pole_courant())));
create policy profiles_maj_soi on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));   -- champs sensibles : trigger
create policy profiles_gerant on public.profiles for update to authenticated
  using ((select app.est_gerant())) with check ((select app.est_gerant()));

-- Fournisseurs (partagés entre pôles) : lecture pour tous ; création/modif gérant + responsables ;
-- suppression gérant
create policy fournisseurs_lecture on public.fournisseurs for select to authenticated
  using ((select app.role_courant()) is not null);
create policy fournisseurs_creation on public.fournisseurs for insert to authenticated
  with check ((select app.role_courant()) in ('gerant', 'responsable'));
create policy fournisseurs_modif on public.fournisseurs for update to authenticated
  using ((select app.role_courant()) in ('gerant', 'responsable'))
  with check ((select app.role_courant()) in ('gerant', 'responsable'));
create policy fournisseurs_suppression on public.fournisseurs for delete to authenticated
  using ((select app.est_gerant()));

-- Tables rattachées à un pôle : lecture membres du pôle, écriture responsables du pôle
do $$
declare t text;
begin
  foreach t in array array['categories_produit', 'lieux_stockage', 'produits', 'commandes',
                           'livraisons', 'inventaires', 'recettes'] loop
    execute format($f$
      create policy %1$s_lecture on public.%1$I for select to authenticated
        using ((select app.est_gerant()) or pole_id = (select app.pole_courant()));
      create policy %1$s_ecriture on public.%1$I for all to authenticated
        using ((select app.est_gerant())
               or ((select app.role_courant()) = 'responsable' and pole_id = (select app.pole_courant())))
        with check ((select app.est_gerant())
               or ((select app.role_courant()) = 'responsable' and pole_id = (select app.pole_courant())));
    $f$, t);
  end loop;
end $$;

-- Lignes enfants : visibles si le parent l'est (la RLS du parent filtre le pôle)
create policy fournisseur_produits_lecture on public.fournisseur_produits for select to authenticated
  using (exists (select 1 from public.produits p where p.id = produit_id));
create policy fournisseur_produits_ecriture on public.fournisseur_produits for all to authenticated
  using (exists (select 1 from public.produits p where p.id = produit_id and app.gere_pole(p.pole_id)))
  with check (exists (select 1 from public.produits p where p.id = produit_id and app.gere_pole(p.pole_id)));

create policy commande_lignes_lecture on public.commande_lignes for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));
create policy commande_lignes_ecriture on public.commande_lignes for all to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id
                 and c.statut in ('brouillon', 'a_valider') and app.gere_pole(c.pole_id)))
  with check (exists (select 1 from public.commandes c where c.id = commande_id
                 and c.statut in ('brouillon', 'a_valider') and app.gere_pole(c.pole_id)));

create policy livraison_lignes_lecture on public.livraison_lignes for select to authenticated
  using (exists (select 1 from public.livraisons l where l.id = livraison_id));
create policy livraison_lignes_ecriture on public.livraison_lignes for all to authenticated
  using (exists (select 1 from public.livraisons l where l.id = livraison_id
                 and l.statut = 'en_cours' and app.gere_pole(l.pole_id)))
  with check (exists (select 1 from public.livraisons l where l.id = livraison_id
                 and l.statut = 'en_cours' and app.gere_pole(l.pole_id)));

create policy recette_ingredients_lecture on public.recette_ingredients for select to authenticated
  using (exists (select 1 from public.recettes r where r.id = recette_id));
create policy recette_ingredients_ecriture on public.recette_ingredients for all to authenticated
  using (exists (select 1 from public.recettes r where r.id = recette_id and app.gere_pole(r.pole_id)))
  with check (exists (select 1 from public.recettes r where r.id = recette_id and app.gere_pole(r.pole_id)));

-- Inventaire : tous les membres du pôle comptent tant que l'inventaire est en cours
create policy inventaire_lignes_lecture on public.inventaire_lignes for select to authenticated
  using (exists (select 1 from public.inventaires i where i.id = inventaire_id));
create policy inventaire_lignes_comptage on public.inventaire_lignes for insert to authenticated
  with check (exists (select 1 from public.inventaires i where i.id = inventaire_id
                      and i.statut = 'en_cours' and app.acces_pole(i.pole_id)));
create policy inventaire_lignes_maj on public.inventaire_lignes for update to authenticated
  using (exists (select 1 from public.inventaires i where i.id = inventaire_id
                 and i.statut in ('en_cours', 'soumis') and app.acces_pole(i.pole_id)))
  with check (exists (select 1 from public.inventaires i where i.id = inventaire_id
                 and i.statut in ('en_cours', 'soumis') and app.acces_pole(i.pole_id)));
create policy inventaire_lignes_suppression on public.inventaire_lignes for delete to authenticated
  using (exists (select 1 from public.inventaires i where i.id = inventaire_id
                 and i.statut = 'en_cours' and app.gere_pole(i.pole_id)));

-- Mouvements : lecture pôle ; insertion par tout membre du pôle ; corrections réservées
-- aux responsables (les salariés corrigent via annuler_mouvement). Ni UPDATE ni DELETE.
create policy mouvements_lecture on public.mouvements_stock for select to authenticated
  using ((select app.est_gerant()) or pole_id = (select app.pole_courant()));
create policy mouvements_insertion on public.mouvements_stock for insert to authenticated
  with check (
    exists (select 1 from public.produits p where p.id = produit_id and p.actif
            and (app.gere_pole(p.pole_id)
                 or (app.acces_pole(p.pole_id) and type <> 'correction'))));

-- Lots DLC
create policy lots_dlc_lecture on public.lots_dlc for select to authenticated
  using ((select app.est_gerant()) or pole_id = (select app.pole_courant()));
create policy lots_dlc_insertion on public.lots_dlc for insert to authenticated
  with check (exists (select 1 from public.produits p where p.id = produit_id
                      and app.acces_pole(p.pole_id)));
create policy lots_dlc_maj on public.lots_dlc for update to authenticated   -- « lot consommé / jeté »
  using ((select app.est_gerant()) or pole_id = (select app.pole_courant()))
  with check ((select app.est_gerant()) or pole_id = (select app.pole_courant()));

-- Appels IA : gérant uniquement, lecture seule (n8n écrit avec service_role)
create policy appels_ia_gerant on public.appels_ia for select to authenticated
  using ((select app.est_gerant()));

-- =============================================================================
-- 18. Droits d'accès API et Realtime
-- =============================================================================
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- appels_ia et audit_log : aucune écriture possible depuis le navigateur
revoke insert, update, delete on public.appels_ia, public.audit_log, public.webhooks_recus
  from authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.mouvements_stock, public.commandes, public.livraisons, public.appels_ia, public.lots_dlc;
  end if;
end $$;
