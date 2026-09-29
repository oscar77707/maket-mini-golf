\pset footer off
\set ON_ERROR_STOP 0
create or replace function pg_temp.en(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;
-- lectures par rôle
select 'gerant' qui, pg_temp.en('00000000-0000-4000-a000-000000000001'); set role authenticated;
select (select count(*) from produits) produits, (select count(distinct pole_id) from mouvements_stock) poles_mvt, (select count(*) from appels_ia) appels, (select count(*) from audit_log)>0 audit, (select count(*) from profiles) profils;
reset role; select 'resp resto' qui, pg_temp.en('00000000-0000-4000-a000-000000000002'); set role authenticated;
select (select count(*) from produits) produits, (select count(distinct pole_id) from mouvements_stock) poles_mvt, (select count(*) from appels_ia) appels, (select count(*) from audit_log) audit, (select count(*) from profiles) profils, (select count(*) from v_commandes) cmd, (select count(distinct pole_id) from v_stock_produits) poles_vue, (select count(*) from fournisseurs) fourn;
reset role; select 'salarie golf' qui, pg_temp.en('00000000-0000-4000-a000-000000000006'); set role authenticated;
select (select count(*) from produits) produits, (select count(distinct pole_id) from mouvements_stock) poles_mvt, (select count(*) from appels_ia) appels, (select count(*) from profiles) profils, (select count(*) from commande_lignes) lignes, (select count(*) from livraison_lignes) ll;
-- écritures
select 'salarie: sortie OK'; select enregistrer_mouvement((select id from produits where nom='Balles de golf couleur'), 'sortie', 5, 'Balles perdues dans le lac') > 0 as ok;
select 'salarie: correction refusée'; select enregistrer_mouvement((select id from produits where nom='Balles de golf couleur'), 'correction', 5, 'test');
select 'salarie: mouvement autre pôle refusé'; insert into mouvements_stock (produit_id, type, quantite) values ((select id from produits p where p.nom='Farine T55'), 'sortie', -1);
select 'salarie: produit du restaurant invisible'; select count(*) from produits where nom='Farine T55';
select 'salarie: modification mouvement refusée'; update mouvements_stock set quantite = -1 where id = (select max(id) from mouvements_stock);
select 'salarie: annuler son propre mouvement'; select annuler_mouvement((select max(id) from mouvements_stock where type='sortie')) > 0 ok;
select 'salarie: se promouvoir refusé'; update profiles set role='gerant' where id = auth.uid();
select 'salarie: créer produit refusé'; insert into produits (pole_id, nom, unite) values (2, 'Test', 'piece');
reset role; select 'resp resto' qui, pg_temp.en('00000000-0000-4000-a000-000000000002'); set role authenticated;
select 'resp: créer produit autre pôle refusé'; insert into produits (pole_id, nom, unite) values (2, 'Test', 'piece');
select 'resp: créer produit + livraison'; 
with p as (insert into produits (pole_id, nom, unite, seuil_minimum, suivi_dlc, fournisseur_principal_id) values (1, 'Burrata', 'piece', 5, true, (select id from fournisseurs where nom='Grossiste Provence Alimentaire')) returning id) select count(*) from p;
select 'resp: envoyer commande refusé'; update commandes set statut='envoyee' where statut='a_valider' and pole_id=1;
select 'resp: réception boucherie';
insert into livraisons (commande_id, numero_bon_livraison) select id, 'BL-TEST' from commandes where statut='envoyee' and pole_id=1;
insert into livraison_lignes (livraison_id, commande_ligne_id, produit_id, quantite_commandee, quantite_recue, prix_unitaire_ht, dlc)
select l.id, cl.id, cl.produit_id, cl.quantite, cl.quantite, cl.prix_unitaire_ht, current_date+6 from livraisons l join commande_lignes cl on cl.commande_id=l.commande_id where l.numero_bon_livraison='BL-TEST';
select stock_actuel avant from v_stock_produits where nom='Steak haché 15 %';
select valider_livraison((select id from livraisons where numero_bon_livraison='BL-TEST'));
select stock_actuel apres from v_stock_produits where nom='Steak haché 15 %';
select statut from commandes c join livraisons l on l.commande_id=c.id where l.numero_bon_livraison='BL-TEST';
select 'resp: valider inventaire'; select valider_inventaire((select id from inventaires where statut='en_cours')) as corrections;
select 'resp: brouillons réappro'; select count(*) from creer_brouillons_reappro(1::smallint);
select v.reference, v.fournisseur_nom, v.statut, v.nb_lignes, v.montant_ht from v_commandes v where statut='brouillon';
reset role; select 'gerant' qui, pg_temp.en('00000000-0000-4000-a000-000000000001'); set role authenticated;
select 'gerant: valider et envoyer'; update commandes set statut='envoyee' where statut='a_valider' and pole_id=1 returning statut, valide_par is not null, envoyee_le is not null;
select 'gerant: transition interdite'; update commandes set statut='brouillon' where statut='cloturee' and ctid = (select min(ctid) from commandes where statut='cloturee');
select 'gerant: rétrograder dernier gérant refusé'; update profiles set role='responsable', pole_id=1 where id=auth.uid();
select 'gerant: export RGPD'; select jsonb_array_length(exporter_donnees_utilisateur('00000000-0000-4000-a000-000000000005')->'mouvements_saisis') nb;
select 'gerant: anonymiser'; select anonymiser_utilisateur('00000000-0000-4000-a000-000000000007'); select prenom, nom, email, actif from profiles where id='00000000-0000-4000-a000-000000000007';
reset role; set role anon; select 'anon'; select count(*) from produits;
reset role; select app.purger_donnees(); select app.marquer_commandes_en_retard();
select action, count(*) from audit_log group by 1 order by 2 desc limit 12;
