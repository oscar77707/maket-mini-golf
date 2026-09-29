-- =============================================================================
-- La Palmeraie : données de démonstration
-- Futur emplacement : supabase/seed.sql (exécuté par `supabase db reset`)
--
-- Toutes les dates sont relatives à la date du jour : la démo reste « fraîche ».
-- Comptes de démo (mot de passe commun : Palmeraie2026!) :
--   gerant@palmeraie.test                   gérant
--   resp.restaurant@palmeraie.test          responsable Restaurant
--   resp.minigolf@palmeraie.test            responsable Mini-golf
--   resp.aquatique@palmeraie.test           responsable Aires aquatiques
--   salarie.restaurant@palmeraie.test       salarié Restaurant (saisonnier)
--   salarie.minigolf@palmeraie.test         salarié Mini-golf
--   salarie.aquatique@palmeraie.test        salariée Aires aquatiques (saisonnière)
-- =============================================================================

select setseed(0.2026);   -- données aléatoires reproductibles

-- -----------------------------------------------------------------------------
-- Pôles et paramètres
-- -----------------------------------------------------------------------------
insert into public.poles (code, nom, couleur, icone, ordre) values
  ('restaurant', 'Restaurant',       '#EA580C', 'utensils', 1),
  ('mini_golf',  'Mini-golf',        '#16A34A', 'flag',     2),
  ('aquatique',  'Aires aquatiques', '#0284C7', 'waves',    3);

insert into public.parametres (nom_complexe, adresse, telephone, email_contact)
values ('La Palmeraie', '1 avenue des Pins, 83000 Exemple-sur-Mer', '04 00 00 00 00', 'contact@palmeraie.test');

insert into public.webhooks_n8n (cle, libelle) values
  ('order_send', 'Envoi d''une commande fournisseur');

-- -----------------------------------------------------------------------------
-- Utilisateurs (auth.users → le trigger crée les profils)
-- -----------------------------------------------------------------------------
with u (id, email, prenom, nom, role, pole) as (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'gerant@palmeraie.test',             'Marc',   'Delorme', 'gerant',      null),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'resp.restaurant@palmeraie.test',    'Nadia',  'Benali',  'responsable', 'restaurant'),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'resp.minigolf@palmeraie.test',      'Julien', 'Roux',    'responsable', 'mini_golf'),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'resp.aquatique@palmeraie.test',     'Camille','Faure',   'responsable', 'aquatique'),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'salarie.restaurant@palmeraie.test', 'Lucas',  'Martin',  'salarie',     'restaurant'),
  ('00000000-0000-4000-a000-000000000006'::uuid, 'salarie.minigolf@palmeraie.test',   'Hugo',   'Petit',   'salarie',     'mini_golf'),
  ('00000000-0000-4000-a000-000000000007'::uuid, 'salarie.aquatique@palmeraie.test',  'Emma',   'Girard',  'salarie',     'aquatique')
), ins as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         extensions.crypt('Palmeraie2026!', extensions.gen_salt('bf')), now(),
         jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', u.role, 'pole', u.pole),
         jsonb_build_object('prenom', u.prenom, 'nom', u.nom),
         now() - interval '120 days', now(), '', '', '', ''
  from u
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select ins.id::text, ins.id, jsonb_build_object('sub', ins.id::text, 'email', ins.email, 'email_verified', true),
       'email', now(), now(), now()
from ins;

update public.profiles set saisonnier = true, fin_contrat = date_trunc('year', current_date)::date + 303  -- ~31 octobre
where email in ('salarie.restaurant@palmeraie.test', 'salarie.aquatique@palmeraie.test');
update public.profiles set telephone = '06 12 34 56 7' || right(id::text, 1);

-- -----------------------------------------------------------------------------
-- Saisons, horaires, fermetures
-- -----------------------------------------------------------------------------
insert into public.saisons (nom, date_debut, date_fin)
select s.nom, make_date(extract(year from current_date)::int, s.m1, s.d1),
              make_date(extract(year from current_date)::int, s.m2, s.d2)
from (values ('Printemps', 4, 1, 6, 30), ('Été', 7, 1, 8, 31), ('Arrière-saison', 9, 1, 10, 31))
     s (nom, m1, d1, m2, d2);

insert into public.horaires_poles (pole_id, saison_id, jour_semaine, ferme, ouverture, fermeture)
select p.id, s.id, j,
       -- restaurant fermé le lundi hors été ; aquatique fermé en semaine au printemps
       (p.code = 'restaurant' and j = 1 and s.nom <> 'Été')
       or (p.code = 'aquatique' and s.nom = 'Printemps' and j < 6),
       case p.code when 'restaurant' then time '11:30' when 'mini_golf' then time '10:00' else time '10:30' end,
       case p.code when 'restaurant' then (case when s.nom = 'Été' then time '23:30' else time '22:00' end)
                   when 'mini_golf'  then (case when s.nom = 'Été' then time '23:00' else time '19:00' end)
                   else (case when s.nom = 'Été' then time '19:30' else time '18:30' end) end
from public.poles p cross join public.saisons s cross join generate_series(1, 7) j;

insert into public.fermetures_exceptionnelles (pole_id, date_debut, date_fin, motif) values
  ((select id from public.poles where code = 'aquatique'), current_date + 12, current_date + 13,
   'Vidange et contrôle sanitaire des bassins'),
  (null, make_date(extract(year from current_date)::int, 11, 1),
         make_date(extract(year from current_date)::int + 1, 3, 31), 'Fermeture hivernale');

-- -----------------------------------------------------------------------------
-- Fournisseurs
-- -----------------------------------------------------------------------------
insert into public.fournisseurs (nom, contact_nom, email, telephone, mode_commande, url_portail,
                                 jours_commande, jours_livraison, delai_livraison_jours,
                                 minimum_commande_ht, notes) values
  ('Grossiste Provence Alimentaire', 'Sandrine Vidal', 'commandes@provence-alimentaire.test', '04 11 22 33 44',
   'email', null, '{1,4}', '{2,5}', 1, 150, 'Franco de port à partir de 150 € HT.'),
  ('Primeurs du Littoral', 'Karim Haddad', 'karim@primeurs-littoral.test', '06 22 33 44 55',
   'telephone', null, '{1,2,3,4,5,6}', '{2,3,4,5,6,7}', 1, 50, 'Appeler avant 16 h pour une livraison le lendemain.'),
  ('Boucherie Ferrand', 'Paul Ferrand', 'pro@boucherie-ferrand.test', '04 22 33 44 55',
   'email', null, '{2,5}', '{3,6}', 1, 80, null),
  ('Boissons Méditerranée Distribution', 'Service clients', 'pro@boissons-med.test', '04 33 44 55 66',
   'portail', 'https://portail.boissons-med.test', '{1}', '{3}', 2, 300, 'Consigne des fûts reprise à la livraison.'),
  ('Glaces Artisanales du Midi', 'Léa Moreau', 'lea@glaces-midi.test', '04 44 55 66 77',
   'email', null, '{3}', '{5}', 2, 100, null),
  ('Aqua Traitement Services', 'Thomas Blanc', 'commandes@aqua-traitement.test', '04 55 66 77 88',
   'email', null, '{1}', '{4}', 3, 120, 'Produits dangereux : réception par un responsable uniquement.'),
  ('Loisirs Golf Équipement', null, 'boutique@loisirs-golf.test', '05 66 77 88 99',
   'portail', 'https://boutique.loisirs-golf.test', '{1,2,3,4,5}', '{1,2,3,4,5}', 5, 0, null),
  ('Fournitures Pro Hygiène', 'Julie Caron', 'julie@pro-hygiene.test', '04 77 88 99 00',
   'email', null, '{2}', '{4}', 2, 90, null),
  ('Azur Impression', 'Nicolas Perrin', 'devis@azur-impression.test', '04 88 99 00 11',
   'email', null, '{1,2,3,4,5}', '{1,2,3,4,5}', 5, 60, 'Bracelets et cartes de score personnalisés.');

-- -----------------------------------------------------------------------------
-- Catégories et lieux de stockage
-- -----------------------------------------------------------------------------
insert into public.categories_produit (pole_id, nom, ordre)
select p.id, c.nom, c.ordre from public.poles p join (values
  ('restaurant', 'Épicerie sèche', 1), ('restaurant', 'Fruits et légumes', 2), ('restaurant', 'Viandes', 3),
  ('restaurant', 'Produits laitiers', 4), ('restaurant', 'Surgelés', 5), ('restaurant', 'Boissons', 6),
  ('restaurant', 'Glaces', 7), ('restaurant', 'Consommables', 8),
  ('mini_golf', 'Matériel de jeu', 1), ('mini_golf', 'Accueil et caisse', 2), ('mini_golf', 'Snacking', 3),
  ('aquatique', 'Traitement de l''eau', 1), ('aquatique', 'Entretien', 2), ('aquatique', 'Accueil', 3),
  ('aquatique', 'Sécurité', 4)
) c (pole, nom, ordre) on c.pole = p.code::text;

insert into public.lieux_stockage (pole_id, nom, ordre)
select p.id, l.nom, l.ordre from public.poles p join (values
  ('restaurant', 'Réserve sèche', 1), ('restaurant', 'Chambre froide positive', 2),
  ('restaurant', 'Chambre froide négative', 3), ('restaurant', 'Cave à boissons', 4), ('restaurant', 'Bar', 5),
  ('mini_golf', 'Cabane d''accueil', 1), ('mini_golf', 'Local matériel', 2),
  ('aquatique', 'Local technique', 1), ('aquatique', 'Local accueil', 2)
) l (pole, nom, ordre) on l.pole = p.code::text;

-- -----------------------------------------------------------------------------
-- Produits (+ conso journalière moyenne et stock final visé, pour générer l'historique)
-- -----------------------------------------------------------------------------
create temporary table demo_produits (
  pole text, nom text, categorie text, unite public.unite_mesure, lieu text, fournisseur text,
  prix numeric, seuil numeric, reappro numeric, dlc boolean, conditionnement numeric,
  conso numeric, cible numeric
);

insert into demo_produits values
  -- Restaurant
  ('restaurant', 'Farine T55', 'Épicerie sèche', 'kg', 'Réserve sèche', 'Grossiste Provence Alimentaire', 0.85, 10, 25, false, 25, 1.2, 28),
  ('restaurant', 'Huile d''olive vierge extra', 'Épicerie sèche', 'L', 'Réserve sèche', 'Grossiste Provence Alimentaire', 7.90, 5, 10, false, 5, 0.4, 9),
  ('restaurant', 'Huile de friture', 'Épicerie sèche', 'L', 'Réserve sèche', 'Grossiste Provence Alimentaire', 2.40, 20, 40, false, 20, 2.5, 18),
  ('restaurant', 'Sel fin', 'Épicerie sèche', 'kg', 'Réserve sèche', 'Grossiste Provence Alimentaire', 0.60, 2, 5, false, 1, 0.1, 6),
  ('restaurant', 'Pâtes penne', 'Épicerie sèche', 'kg', 'Réserve sèche', 'Grossiste Provence Alimentaire', 1.90, 5, 10, false, 5, 0.6, 11),
  ('restaurant', 'Riz basmati', 'Épicerie sèche', 'kg', 'Réserve sèche', 'Grossiste Provence Alimentaire', 2.30, 3, 10, false, 5, 0.3, 7),
  ('restaurant', 'Tomates rondes', 'Fruits et légumes', 'kg', 'Chambre froide positive', 'Primeurs du Littoral', 2.20, 8, 20, true, 1, 2.5, 9),
  ('restaurant', 'Salade batavia', 'Fruits et légumes', 'piece', 'Chambre froide positive', 'Primeurs du Littoral', 0.95, 15, 30, true, 1, 5, 12),
  ('restaurant', 'Citrons jaunes', 'Fruits et légumes', 'kg', 'Chambre froide positive', 'Primeurs du Littoral', 2.80, 3, 6, false, 1, 0.5, 5),
  ('restaurant', 'Pommes de terre', 'Fruits et légumes', 'kg', 'Réserve sèche', 'Primeurs du Littoral', 0.90, 20, 50, false, 25, 4, 45),
  ('restaurant', 'Steak haché 15 %', 'Viandes', 'piece', 'Chambre froide négative', 'Boucherie Ferrand', 1.35, 60, 150, true, 10, 18, 130),
  ('restaurant', 'Filet de poulet', 'Viandes', 'kg', 'Chambre froide positive', 'Boucherie Ferrand', 8.50, 5, 10, true, 1, 1.2, 6),
  ('restaurant', 'Jambon blanc', 'Viandes', 'kg', 'Chambre froide positive', 'Boucherie Ferrand', 9.20, 2, 5, true, 1, 0.4, 3),
  ('restaurant', 'Mozzarella', 'Produits laitiers', 'kg', 'Chambre froide positive', 'Grossiste Provence Alimentaire', 7.40, 4, 8, true, 1, 0.8, 4.5),
  ('restaurant', 'Crème fraîche 30 %', 'Produits laitiers', 'L', 'Chambre froide positive', 'Grossiste Provence Alimentaire', 3.60, 3, 6, true, 1, 0.5, 5),
  ('restaurant', 'Beurre doux', 'Produits laitiers', 'kg', 'Chambre froide positive', 'Grossiste Provence Alimentaire', 8.10, 2, 5, true, 1, 0.3, 4),
  ('restaurant', 'Frites surgelées 9 mm', 'Surgelés', 'kg', 'Chambre froide négative', 'Grossiste Provence Alimentaire', 1.60, 40, 100, false, 10, 12, 95),
  ('restaurant', 'Nuggets de poulet', 'Surgelés', 'kg', 'Chambre froide négative', 'Grossiste Provence Alimentaire', 6.90, 5, 10, false, 1, 1, 9),
  ('restaurant', 'Coca-Cola 33 cl', 'Boissons', 'piece', 'Cave à boissons', 'Boissons Méditerranée Distribution', 0.52, 96, 240, false, 24, 30, 84),
  ('restaurant', 'Eau minérale 50 cl', 'Boissons', 'piece', 'Cave à boissons', 'Boissons Méditerranée Distribution', 0.28, 120, 300, false, 24, 45, 260),
  ('restaurant', 'Bière pression (fût 30 L)', 'Boissons', 'piece', 'Cave à boissons', 'Boissons Méditerranée Distribution', 78.00, 2, 4, false, 1, 0.25, 2),
  ('restaurant', 'Rosé de Provence 75 cl', 'Boissons', 'piece', 'Cave à boissons', 'Boissons Méditerranée Distribution', 5.40, 24, 48, false, 6, 3, 34),
  ('restaurant', 'Sirop de menthe', 'Boissons', 'L', 'Bar', 'Boissons Méditerranée Distribution', 3.10, 3, 6, false, 1, 0.3, 5),
  ('restaurant', 'Cornets vanille', 'Glaces', 'piece', 'Chambre froide négative', 'Glaces Artisanales du Midi', 0.75, 48, 120, false, 24, 14, 110),
  ('restaurant', 'Bac glace chocolat 5 L', 'Glaces', 'piece', 'Chambre froide négative', 'Glaces Artisanales du Midi', 16.50, 3, 6, false, 1, 0.5, 4),
  ('restaurant', 'Serviettes papier (paquet de 100)', 'Consommables', 'piece', 'Réserve sèche', 'Fournitures Pro Hygiène', 1.90, 20, 50, false, 10, 3, 38),
  ('restaurant', 'Gobelets compostables 25 cl (x50)', 'Consommables', 'piece', 'Réserve sèche', 'Fournitures Pro Hygiène', 3.20, 10, 30, false, 10, 2, 11),
  -- Mini-golf
  ('mini_golf', 'Balles de golf couleur', 'Matériel de jeu', 'piece', 'Local matériel', 'Loisirs Golf Équipement', 0.45, 100, 300, false, 50, 6, 85),
  ('mini_golf', 'Putters junior', 'Matériel de jeu', 'piece', 'Local matériel', 'Loisirs Golf Équipement', 14.90, 10, 10, false, 1, 0.1, 18),
  ('mini_golf', 'Putters adulte', 'Matériel de jeu', 'piece', 'Local matériel', 'Loisirs Golf Équipement', 17.90, 15, 10, false, 1, 0.1, 26),
  ('mini_golf', 'Cartes de score (paquet de 500)', 'Accueil et caisse', 'piece', 'Cabane d''accueil', 'Azur Impression', 12.00, 2, 5, false, 1, 0.15, 3),
  ('mini_golf', 'Crayons de golf (boîte de 144)', 'Accueil et caisse', 'piece', 'Cabane d''accueil', 'Loisirs Golf Équipement', 9.50, 2, 4, false, 1, 0.1, 1),
  ('mini_golf', 'Bouteilles d''eau 50 cl', 'Snacking', 'piece', 'Cabane d''accueil', 'Boissons Méditerranée Distribution', 0.28, 48, 120, false, 24, 8, 58),
  ('mini_golf', 'Glaces à l''eau', 'Snacking', 'piece', 'Cabane d''accueil', 'Glaces Artisanales du Midi', 0.35, 40, 100, false, 50, 7, 70),
  -- Aires aquatiques
  ('aquatique', 'Chlore choc granulés', 'Traitement de l''eau', 'kg', 'Local technique', 'Aqua Traitement Services', 6.80, 10, 25, false, 5, 0.8, 21),
  ('aquatique', 'Chlore lent galets', 'Traitement de l''eau', 'kg', 'Local technique', 'Aqua Traitement Services', 5.90, 15, 30, false, 5, 1, 13),
  ('aquatique', 'pH moins liquide', 'Traitement de l''eau', 'L', 'Local technique', 'Aqua Traitement Services', 2.10, 20, 40, false, 20, 2, 30),
  ('aquatique', 'Anti-algues', 'Traitement de l''eau', 'L', 'Local technique', 'Aqua Traitement Services', 7.50, 5, 10, false, 5, 0.2, 6),
  ('aquatique', 'Bandelettes d''analyse (x50)', 'Traitement de l''eau', 'piece', 'Local technique', 'Aqua Traitement Services', 8.90, 2, 5, false, 1, 0.1, 3),
  ('aquatique', 'Désinfectant surfaces 5 L', 'Entretien', 'piece', 'Local technique', 'Fournitures Pro Hygiène', 14.00, 2, 4, false, 1, 0.1, 3),
  ('aquatique', 'Bracelets d''accès journée', 'Accueil', 'piece', 'Local accueil', 'Azur Impression', 0.06, 500, 2000, false, 500, 120, 900),
  ('aquatique', 'Crème solaire SPF 50 (vente)', 'Accueil', 'piece', 'Local accueil', 'Fournitures Pro Hygiène', 6.50, 10, 24, false, 12, 0.8, 12),
  ('aquatique', 'Recharge trousse de secours', 'Sécurité', 'piece', 'Local technique', 'Fournitures Pro Hygiène', 24.00, 2, 2, false, 1, 0.05, 1);

insert into public.produits (pole_id, nom, categorie_id, unite, lieu_stockage_id, fournisseur_principal_id,
                             prix_achat_ht, seuil_minimum, quantite_reappro, suivi_dlc, cree_par)
select p.id, d.nom, c.id, d.unite, l.id, f.id, d.prix, d.seuil, d.reappro, d.dlc,
       (select id from public.profiles where role = 'responsable' and pole_id = p.id)
from demo_produits d
join public.poles p on p.code::text = d.pole
join public.categories_produit c on c.pole_id = p.id and c.nom = d.categorie
join public.lieux_stockage l on l.pole_id = p.id and l.nom = d.lieu
join public.fournisseurs f on f.nom = d.fournisseur;

insert into public.fournisseur_produits (fournisseur_id, produit_id, reference_fournisseur, prix_ht, conditionnement)
select pr.fournisseur_principal_id, pr.id,
       upper(left(regexp_replace(pr.nom, '[^A-Za-z]', '', 'g'), 4)) || '-' || lpad((row_number() over ())::text, 4, '0'),
       pr.prix_achat_ht, d.conditionnement
from public.produits pr join demo_produits d on d.nom = pr.nom;

-- -----------------------------------------------------------------------------
-- Historique sur 45 jours : livraisons hebdomadaires (commandes + réceptions + entrées)
-- et consommation quotidienne (sorties, quelques pertes). Le stock d'ouverture est
-- calculé pour que le stock du jour tombe sur la valeur visée (certains en alerte).
-- -----------------------------------------------------------------------------
do $$
declare
  f record; l record; d int; v_cmd uuid; v_liv uuid; v_ll uuid; v_cl uuid;
  v_recu numeric; v_commande numeric; v_jour timestamptz; v_resp uuid; v_offset int;
begin
  -- 1. Sorties et pertes quotidiennes (table de travail)
  create temporary table demo_sorties on commit drop as
  select pr.id as produit_id, pr.pole_id, g.jours_avant,
         case when pr.unite = 'piece'
              then round(d.conso * (0.5 + random()) * (case when extract(isodow from current_date - g.jours_avant) >= 6 then 1.4 else 1 end))
              else round((d.conso * (0.5 + random()) * (case when extract(isodow from current_date - g.jours_avant) >= 6 then 1.4 else 1 end))::numeric, 1)
         end as quantite,
         random() < 0.04 as est_perte
  from public.produits pr
  join demo_produits d on d.nom = pr.nom
  cross join generate_series(0, 44) g(jours_avant);
  delete from demo_sorties where quantite <= 0;

  -- 2. Livraisons hebdomadaires par fournisseur et par pôle
  create temporary table demo_entrees (produit_id uuid, jours_avant int, quantite numeric,
                                       livraison_ligne_id uuid) on commit drop;
  v_offset := 0;
  for f in select distinct pr.fournisseur_principal_id as fid, pr.pole_id, fo.delai_livraison_jours as delai
           from public.produits pr join public.fournisseurs fo on fo.id = pr.fournisseur_principal_id
           order by 1, 2 loop
    v_offset := v_offset + 1;
    v_resp := (select id from public.profiles where role = 'responsable' and pole_id = f.pole_id);
    for d in select generate_series(3 + (v_offset % 5), 42, 7) loop
      v_jour := (current_date - d) + time '09:30';
      insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par,
                                    soumise_le, valide_par, valide_le, envoyee_le, confirmee_le,
                                    livree_le, cloturee_le, created_at)
      values (f.fid, f.pole_id, case when d > 7 then 'cloturee' else 'livree' end::public.statut_commande,
              (current_date - d) - (case when random() < 0.2 then 1 else 0 end),   -- parfois en retard
              v_resp, v_jour - make_interval(days => f.delai + 1),
              '00000000-0000-4000-a000-000000000001', v_jour - make_interval(days => f.delai, hours => 20),
              v_jour - make_interval(days => f.delai, hours => 20),
              v_jour - make_interval(days => f.delai, hours => 18),
              v_jour, case when d > 7 then v_jour + interval '1 day' end,
              v_jour - make_interval(days => f.delai + 1))
      returning id into v_cmd;
      insert into public.livraisons (commande_id, statut, numero_bon_livraison, recue_par, recue_le, validee_le)
      values (v_cmd, 'en_cours', 'BL-' || to_char(v_jour, 'YYMMDD') || '-' || v_offset, v_resp, v_jour, null)
      returning id into v_liv;

      for l in select pr.id, pr.prix_achat_ht, dp.conso, dp.conditionnement
               from public.produits pr join demo_produits dp on dp.nom = pr.nom
               where pr.fournisseur_principal_id = f.fid and pr.pole_id = f.pole_id loop
        v_commande := greatest(ceil(l.conso * 7 / l.conditionnement), 1) * l.conditionnement;
        v_recu := case when random() < 0.08 then round(v_commande * 0.8 / l.conditionnement) * l.conditionnement
                       else v_commande end;
        insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
        values (v_cmd, l.id, v_commande, round(l.prix_achat_ht * (0.97 + random() * 0.06)::numeric, 2))
        returning id into v_cl;
        insert into public.livraison_lignes (livraison_id, commande_ligne_id, produit_id, quantite_commandee,
                                             quantite_recue, prix_unitaire_ht, motif_ecart)
        select v_liv, v_cl, l.id, v_commande, v_recu, cl.prix_unitaire_ht,
               case when v_recu < v_commande then 'manquant' end
        from public.commande_lignes cl where cl.id = v_cl
        returning id into v_ll;
        if v_recu > 0 then
          insert into demo_entrees values (l.id, d, v_recu, v_ll);
        end if;
      end loop;
      update public.livraisons
      set statut = 'validee', validee_le = v_jour + interval '15 minutes',
          conforme = not exists (select 1 from public.livraison_lignes where livraison_id = v_liv and ecart <> 0)
      where id = v_liv;
    end loop;
  end loop;

  -- 3. Stock d'ouverture (J-45) calculé pour atteindre la valeur visée aujourd'hui
  insert into public.mouvements_stock (produit_id, type, quantite, motif, date_mouvement, cree_par, origine)
  select pr.id, 'entree',
         greatest(dp.cible + coalesce(s.total, 0) - coalesce(e.total, 0), dp.conso * 3, 1),
         'Stock initial (import Excel)', (current_date - 45) + time '08:00',
         (select id from public.profiles where role = 'responsable' and pole_id = pr.pole_id), 'import_csv'
  from public.produits pr
  join demo_produits dp on dp.nom = pr.nom
  left join (select produit_id, sum(quantite) total from demo_sorties group by 1) s on s.produit_id = pr.id
  left join (select produit_id, sum(quantite) total from demo_entrees group by 1) e on e.produit_id = pr.id;

  -- 4. Entrées de livraison
  insert into public.mouvements_stock (produit_id, type, quantite, prix_unitaire_ht, motif, date_mouvement,
                                       cree_par, livraison_ligne_id)
  select e.produit_id, 'entree', e.quantite, ll.prix_unitaire_ht, 'Livraison ' || lv.numero_bon_livraison,
         lv.recue_le + interval '10 minutes', lv.recue_par, e.livraison_ligne_id
  from demo_entrees e
  join public.livraison_lignes ll on ll.id = e.livraison_ligne_id
  join public.livraisons lv on lv.id = ll.livraison_id;

  -- 5. Sorties et pertes
  insert into public.mouvements_stock (produit_id, type, quantite, motif, date_mouvement, cree_par)
  select s.produit_id,
         case when s.est_perte then 'perte' else 'sortie' end::public.type_mouvement,
         -s.quantite,
         case when s.est_perte then (array['Produit abîmé', 'Casse', 'DLC dépassée', 'Perte en service'])
                                    [1 + floor(random() * 4)::int]
              else 'Consommation du service' end,
         least((current_date - s.jours_avant) + time '14:00' + random() * interval '8 hours',
               now() - interval '5 minutes'),
         coalesce((select id from public.profiles where role = 'salarie' and pole_id = s.pole_id limit 1),
                  (select id from public.profiles where role = 'responsable' and pole_id = s.pole_id))
  from demo_sorties s;
end $$;

-- Lots à DLC (dernière entrée de chaque produit suivi) : certains arrivent à échéance
insert into public.lots_dlc (produit_id, mouvement_entree_id, dlc, quantite_initiale, numero_lot)
select distinct on (m.produit_id) m.produit_id, m.id,
       current_date + case p.nom when 'Crème fraîche 30 %' then 1 when 'Tomates rondes' then 2
                                 when 'Mozzarella' then 3 when 'Salade batavia' then 2
                                 when 'Jambon blanc' then 6 else 9 end,
       m.quantite, 'L' || to_char(m.date_mouvement, 'YYMMDD')
from public.mouvements_stock m join public.produits p on p.id = m.produit_id
where p.suivi_dlc and m.type = 'entree'
order by m.produit_id, m.date_mouvement desc;

-- -----------------------------------------------------------------------------
-- Commandes en cours (alimentent le tableau de bord)
-- -----------------------------------------------------------------------------
do $$
declare
  v_resto smallint := (select id from public.poles where code = 'restaurant');
  v_golf  smallint := (select id from public.poles where code = 'mini_golf');
  v_aqua  smallint := (select id from public.poles where code = 'aquatique');
  v_cmd uuid;
begin
  -- À valider : boissons du restaurant (soumise ce matin par la responsable)
  insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par, soumise_le, commentaire)
  values ((select id from public.fournisseurs where nom = 'Boissons Méditerranée Distribution'), v_resto,
          'a_valider', current_date + 2, '00000000-0000-4000-a000-000000000002', now() - interval '2 hours',
          'Week-end ensoleillé annoncé : on double les softs.')
  returning id into v_cmd;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_cmd, id, q, prix_achat_ht from public.produits
  join (values ('Coca-Cola 33 cl', 240), ('Eau minérale 50 cl', 288), ('Bière pression (fût 30 L)', 4),
               ('Rosé de Provence 75 cl', 24)) v (n, q) on v.n = nom where pole_id = v_resto;

  -- À valider : produits piscine
  insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par, soumise_le)
  values ((select id from public.fournisseurs where nom = 'Aqua Traitement Services'), v_aqua,
          'a_valider', current_date + 3, '00000000-0000-4000-a000-000000000004', now() - interval '1 day')
  returning id into v_cmd;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_cmd, id, q, prix_achat_ht from public.produits
  join (values ('Chlore lent galets', 30), ('pH moins liquide', 40)) v (n, q) on v.n = nom where pole_id = v_aqua;

  -- Brouillon : primeurs (créé par n8n à partir des alertes)
  insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par, origine)
  values ((select id from public.fournisseurs where nom = 'Primeurs du Littoral'), v_resto,
          'brouillon', current_date + 1, null, 'n8n')
  returning id into v_cmd;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_cmd, id, q, prix_achat_ht from public.produits
  join (values ('Tomates rondes', 20), ('Salade batavia', 30)) v (n, q) on v.n = nom where pole_id = v_resto;

  -- Envoyée, livraison attendue aujourd'hui : boucherie
  insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par,
                                valide_par, valide_le, envoyee_le)
  values ((select id from public.fournisseurs where nom = 'Boucherie Ferrand'), v_resto,
          'envoyee', current_date, '00000000-0000-4000-a000-000000000002',
          '00000000-0000-4000-a000-000000000001', now() - interval '1 day', now() - interval '1 day')
  returning id into v_cmd;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_cmd, id, q, prix_achat_ht from public.produits
  join (values ('Steak haché 15 %', 150), ('Filet de poulet', 10)) v (n, q) on v.n = nom where pole_id = v_resto;

  -- Confirmée, livraison attendue aujourd'hui : glaces du mini-golf
  insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par,
                                valide_par, valide_le, envoyee_le, confirmee_le)
  values ((select id from public.fournisseurs where nom = 'Glaces Artisanales du Midi'), v_golf,
          'confirmee', current_date, '00000000-0000-4000-a000-000000000003',
          '00000000-0000-4000-a000-000000000001', now() - interval '2 days', now() - interval '2 days',
          now() - interval '40 hours')
  returning id into v_cmd;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_cmd, id, 100, prix_achat_ht from public.produits where nom = 'Glaces à l''eau' and pole_id = v_golf;

  -- En retard : matériel de golf
  insert into public.commandes (fournisseur_id, pole_id, statut, date_livraison_prevue, cree_par,
                                valide_par, valide_le, envoyee_le)
  values ((select id from public.fournisseurs where nom = 'Loisirs Golf Équipement'), v_golf,
          'en_retard', current_date - 2, '00000000-0000-4000-a000-000000000003',
          '00000000-0000-4000-a000-000000000001', now() - interval '8 days', now() - interval '8 days')
  returning id into v_cmd;
  insert into public.commande_lignes (commande_id, produit_id, quantite, prix_unitaire_ht)
  select v_cmd, id, q, prix_achat_ht from public.produits
  join (values ('Balles de golf couleur', 300), ('Crayons de golf (boîte de 144)', 4)) v (n, q)
    on v.n = nom where pole_id = v_golf;

  -- Annulée
  insert into public.commandes (fournisseur_id, pole_id, statut, cree_par, annulee_le, motif_annulation)
  values ((select id from public.fournisseurs where nom = 'Azur Impression'), v_aqua, 'annulee',
          '00000000-0000-4000-a000-000000000004', now() - interval '5 days', 'Doublon avec la commande du portail');
end $$;

-- -----------------------------------------------------------------------------
-- Inventaire en cours : chambre froide positive du restaurant, partiellement compté
-- -----------------------------------------------------------------------------
with inv as (
  insert into public.inventaires (pole_id, lieu_stockage_id, statut, cree_par, commentaire)
  select p.id, l.id, 'en_cours', '00000000-0000-4000-a000-000000000002', 'Inventaire de fin de mois'
  from public.poles p join public.lieux_stockage l on l.pole_id = p.id and l.nom = 'Chambre froide positive'
  where p.code = 'restaurant'
  returning id, lieu_stockage_id
)
insert into public.inventaire_lignes (inventaire_id, produit_id, quantite_comptee, compte_par)
select inv.id, s.id,
       case when row_number() over (order by s.nom) <= 6            -- 6 produits déjà comptés
            then greatest(round((s.stock_actuel + (random() - 0.6) * 2)::numeric, 1), 0) end,
       '00000000-0000-4000-a000-000000000005'
from inv join public.v_stock_produits s on s.lieu_stockage_id = inv.lieu_stockage_id;

-- -----------------------------------------------------------------------------
-- Recettes (désactivées : préparation du futur décrément par la caisse)
-- -----------------------------------------------------------------------------
with r as (
  insert into public.recettes (pole_id, nom, code_caisse, prix_vente_ttc)
  select p.id, v.nom, v.code, v.prix from public.poles p
  cross join (values ('Burger frites', 'BURG01', 14.50), ('Pizza margherita', 'PIZZ01', 12.00),
                     ('Penne crème jambon', 'PENN01', 11.00)) v (nom, code, prix)
  where p.code = 'restaurant'
  returning id, nom, pole_id
)
insert into public.recette_ingredients (recette_id, produit_id, quantite)
select r.id, pr.id, i.q from r
join (values ('Burger frites', 'Steak haché 15 %', 1), ('Burger frites', 'Frites surgelées 9 mm', 0.25),
             ('Burger frites', 'Salade batavia', 0.1), ('Burger frites', 'Tomates rondes', 0.05),
             ('Pizza margherita', 'Farine T55', 0.25), ('Pizza margherita', 'Mozzarella', 0.12),
             ('Pizza margherita', 'Tomates rondes', 0.15), ('Pizza margherita', 'Huile d''olive vierge extra', 0.01),
             ('Penne crème jambon', 'Pâtes penne', 0.12), ('Penne crème jambon', 'Crème fraîche 30 %', 0.08),
             ('Penne crème jambon', 'Jambon blanc', 0.06)) i (recette, produit, q) on i.recette = r.nom
join public.produits pr on pr.nom = i.produit and pr.pole_id = r.pole_id;

-- -----------------------------------------------------------------------------
-- Journal des appels IA : 30 derniers jours
-- -----------------------------------------------------------------------------
insert into public.appels_ia (id_externe, debut, duree_secondes, numero_masque, numero_hash, pole_id,
                              issue, resume, transcription)
select 'demo-' || g,
       least((current_date - (random() * 29)::int) + make_interval(hours => 9 + (random() * 10)::int,
                                                                 mins => (random() * 59)::int),
             now() - interval '10 minutes'),
       30 + (random() * 240)::int,
       '0' || (6 + (random())::int) || ' •• •• •• ' || lpad((random() * 99)::int::text, 2, '0'),
       md5('demo-numero-' || (random() * 40)::int),
       t.pole_id, t.issue, t.resume, t.transcription
from generate_series(1, 90) g
cross join lateral (
  select * from (values
    ((select id from public.poles where code = 'restaurant'), 'reservation'::public.issue_appel,
     'Réservation d''une table pour 4 personnes ce soir à 20 h.',
     'Client : Bonjour, je voudrais réserver pour ce soir.' || chr(10) ||
     'IA : Bien sûr, pour combien de personnes et à quelle heure ?' || chr(10) ||
     'Client : Quatre personnes, vers 20 h.' || chr(10) || 'IA : C''est noté, à ce soir !'),
    ((select id from public.poles where code = 'aquatique'), 'renseigne'::public.issue_appel,
     'Demande des horaires et tarifs des aires aquatiques.',
     'Client : Vous êtes ouverts jusqu''à quelle heure ?' || chr(10) ||
     'IA : Les aires aquatiques sont ouvertes de 10 h 30 à 18 h 30 en arrière-saison.'),
    ((select id from public.poles where code = 'mini_golf'), 'renseigne'::public.issue_appel,
     'Question sur les tarifs de groupe pour un anniversaire.',
     'Client : Avez-vous un tarif pour un groupe de 12 enfants ?' || chr(10) ||
     'IA : Oui, le tarif groupe s''applique dès 10 joueurs.'),
    ((select id from public.poles where code = 'restaurant'), 'transfere'::public.issue_appel,
     'Demande spécifique sur les allergènes : transféré au restaurant.',
     'Client : Mon fils est allergique aux arachides, pouvez-vous me garantir...' || chr(10) ||
     'IA : Je vous passe l''équipe du restaurant pour une réponse précise.'),
    (null::smallint, 'message_laisse'::public.issue_appel,
     'Objet perdu (lunettes de soleil) : rappel souhaité.',
     'Client : J''ai oublié mes lunettes hier.' || chr(10) ||
     'IA : Je laisse un message à l''accueil, on vous rappelle dès que possible.'),
    (null::smallint, 'transfere'::public.issue_appel,
     'Candidature pour un emploi saisonnier : transféré au gérant.',
     'Client : Je voudrais savoir si vous recrutez.' || chr(10) || 'IA : Je vous mets en relation.')
  ) v (pole_id, issue, resume, transcription)
  offset floor(random() * 6)::int + (g * 0) limit 1
) t;

drop table demo_produits;
