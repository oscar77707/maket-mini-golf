-- Étape 4 : journal des appels IA
--   * statistiques filtrables par pôle, bornes calculées à l'heure de Paris
--   * index pour retrouver les autres appels d'un même numéro (empreinte HMAC)
--   * activation de pg_cron quand la base le permet (purge nocturne, 90 jours par défaut)

drop function public.stats_appels(date, date);

create function public.stats_appels(p_debut date, p_fin date, p_pole_id smallint default null)
returns jsonb language sql stable set search_path = '' as $$
  with a as (select * from public.appels_ia
             where debut >= (p_debut::timestamp at time zone 'Europe/Paris')
               and debut <  ((p_fin + 1)::timestamp at time zone 'Europe/Paris')
               and (p_pole_id is null or pole_id = p_pole_id))
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
    'par_pole', (select coalesce(jsonb_agg(x order by x.nb desc), '[]') from
                 (select coalesce(p.code::text, 'general') as pole, count(*) as nb
                  from a left join public.poles p on p.id = a.pole_id group by 1) x),
    'par_issue', (select coalesce(jsonb_agg(x order by x.nb desc), '[]') from
                  (select issue, count(*) as nb from a group by 1) x)
  )
$$;
revoke all on function public.stats_appels(date, date, smallint) from public, anon;
grant execute on function public.stats_appels(date, date, smallint) to authenticated, service_role;

create index appels_ia_hash_idx on public.appels_ia (numero_hash, debut desc)
  where numero_hash is not null;

-- pg_cron : sur Supabase il s'active aussi depuis Database > Extensions. Sans lui, la purge
-- reste possible à la main (Paramètres > Données et RGPD).
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible (%) : la purge nocturne devra être activée à la main.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('palmeraie-purge-rgpd', '15 3 * * *', 'select app.purger_donnees()');
    perform cron.schedule('palmeraie-commandes-retard', '0 6 * * *', 'select app.marquer_commandes_en_retard()');
  end if;
end $$;
