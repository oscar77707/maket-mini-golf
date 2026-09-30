-- Étape 5 : tableau de bord
--   * « aujourd'hui » = jour de Paris (le serveur tourne en UTC : entre minuit et 2 h, les
--     retards et les livraisons du jour étaient décalés d'un jour)
--   * indicateurs du tableau de bord en un seul appel
--   * graphiques : bornes de jours à l'heure de Paris
--   * inventaires ajoutés au temps réel

create function app.aujourdhui() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Paris')::date
$$;
revoke all on function app.aujourdhui() from public, anon;
grant execute on function app.aujourdhui() to authenticated, service_role;

create or replace view public.v_alertes_dlc with (security_invoker = true) as
select l.id, l.produit_id, p.nom as produit_nom, l.pole_id, l.dlc, l.numero_lot, l.quantite_initiale,
       (l.dlc - app.aujourdhui()) as jours_restants
from public.lots_dlc l
join public.produits p on p.id = l.produit_id
cross join public.parametres prm
where l.solde_le is null
  and l.dlc <= app.aujourdhui() + prm.seuil_dlc_jours;

create or replace view public.v_commandes with (security_invoker = true) as
select c.*,
       'CMD-' || lpad(c.numero::text, 6, '0')                     as reference,
       f.nom                                                      as fournisseur_nom,
       coalesce(t.nb_lignes, 0)                                   as nb_lignes,
       coalesce(t.montant_ht, 0)                                  as montant_ht,
       (c.statut in ('envoyee', 'confirmee') and c.date_livraison_prevue < app.aujourdhui()) as est_en_retard
from public.commandes c
join public.fournisseurs f on f.id = c.fournisseur_id
left join lateral (
  select count(*) as nb_lignes, sum(l.montant_ht) as montant_ht
  from public.commande_lignes l where l.commande_id = c.id
) t on true;

create or replace function app.marquer_commandes_en_retard() returns void
language sql security definer set search_path = '' as $$
  update public.commandes set statut = 'en_retard'
  where statut in ('envoyee', 'confirmee') and date_livraison_prevue < app.aujourdhui();
$$;

-- Valeur du stock jour par jour (mouvements valorisés au prix de chaque mouvement)
create or replace function public.evolution_valeur_stock(p_jours integer default 30, p_pole_id smallint default null)
returns table (jour date, valeur_ht numeric)
language sql stable set search_path = '' as $$
  with debut as (select app.aujourdhui() - (least(greatest(p_jours, 1), 366) - 1) as d),
  base as (
    select coalesce(sum(m.quantite * coalesce(m.prix_unitaire_ht, 0)), 0) as valeur
    from public.mouvements_stock m, debut
    where (m.date_mouvement at time zone 'Europe/Paris')::date < debut.d
      and (p_pole_id is null or m.pole_id = p_pole_id)
  ),
  variations as (
    select (m.date_mouvement at time zone 'Europe/Paris')::date as jour,
           sum(m.quantite * coalesce(m.prix_unitaire_ht, 0)) as delta
    from public.mouvements_stock m, debut
    where (m.date_mouvement at time zone 'Europe/Paris')::date >= debut.d
      and (p_pole_id is null or m.pole_id = p_pole_id)
    group by 1
  )
  select j.d::date,
         round(base.valeur + coalesce(sum(v.delta) over (order by j.d), 0), 2)
  from debut, base,
       generate_series(debut.d, app.aujourdhui(), interval '1 day') j(d)
  left join variations v on v.jour = j.d::date
  order by 1
$$;

-- Produits les plus consommés (sorties et pertes) entre deux jours de Paris, classés par valeur
create or replace function public.top_produits_consommes(p_debut date, p_fin date,
                                                         p_pole_id smallint default null, p_limite integer default 10)
returns table (produit_id uuid, nom text, unite public.unite_mesure, quantite numeric, valeur_ht numeric)
language sql stable set search_path = '' as $$
  select p.id, p.nom, p.unite, sum(-m.quantite), round(sum(-m.quantite * coalesce(m.prix_unitaire_ht, 0)), 2)
  from public.mouvements_stock m join public.produits p on p.id = m.produit_id
  where m.type in ('sortie', 'perte')
    and m.date_mouvement >= (p_debut::timestamp at time zone 'Europe/Paris')
    and m.date_mouvement <  ((p_fin + 1)::timestamp at time zone 'Europe/Paris')
    and (p_pole_id is null or m.pole_id = p_pole_id)
  group by p.id, p.nom, p.unite
  order by 5 desc, 2
  limit least(greatest(p_limite, 1), 50)
$$;

-- Tous les chiffres des cartes du tableau de bord (la RLS s'applique : chacun compte ce qu'il voit)
create function public.indicateurs_tableau_de_bord(p_pole_id smallint default null)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'rouges', (select count(*) from public.v_stock_produits
               where actif and niveau_alerte = 'rouge' and (p_pole_id is null or pole_id = p_pole_id)),
    'oranges', (select count(*) from public.v_stock_produits
                where actif and niveau_alerte = 'orange' and (p_pole_id is null or pole_id = p_pole_id)),
    'dlc', (select count(*) from public.v_alertes_dlc where p_pole_id is null or pole_id = p_pole_id),
    'valeur_stock_ht', (select coalesce(round(sum(valeur_stock_ht), 2), 0) from public.v_stock_produits
                        where actif and (p_pole_id is null or pole_id = p_pole_id)),
    'a_valider', (select count(*) from public.commandes
                  where statut = 'a_valider' and (p_pole_id is null or pole_id = p_pole_id)),
    'brouillons', (select count(*) from public.commandes
                   where statut = 'brouillon' and (p_pole_id is null or pole_id = p_pole_id)),
    'attendues_aujourdhui', (select count(*) from public.commandes
                             where statut in ('envoyee', 'confirmee', 'en_retard')
                               and date_livraison_prevue = app.aujourdhui()
                               and (p_pole_id is null or pole_id = p_pole_id)),
    'en_retard', (select count(*) from public.v_commandes
                  where (statut = 'en_retard' or est_en_retard) and (p_pole_id is null or pole_id = p_pole_id)),
    'inventaires_soumis', (select count(*) from public.inventaires
                           where statut = 'soumis' and (p_pole_id is null or pole_id = p_pole_id)),
    'appels_aujourdhui', (select count(*) from public.appels_ia
                          where debut >= (app.aujourdhui()::timestamp at time zone 'Europe/Paris')
                            and (p_pole_id is null or pole_id = p_pole_id))
  )
$$;
revoke all on function public.indicateurs_tableau_de_bord(smallint) from public, anon;
grant execute on function public.indicateurs_tableau_de_bord(smallint) to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventaires') then
    alter publication supabase_realtime add table public.inventaires;
  end if;
end $$;
