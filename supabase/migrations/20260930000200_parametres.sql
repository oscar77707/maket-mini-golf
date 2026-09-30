-- Étape 6 : paramètres
--   * profil créé à l'invitation avec le rôle et le pôle choisis par le gérant (app_metadata)
--   * invitations en attente
--   * purge des données à la demande du gérant
--   * logo du complexe (Supabase Storage)

-- Création du profil à la création du compte Auth. Rôle et pôle sont lus dans raw_app_meta_data,
-- que seul le serveur (clé service_role) peut écrire : l'invitation crée d'abord le compte avec ces
-- valeurs (createUser), puis envoie l'e-mail (inviteUserByEmail). Sans elles : rôle « salarie » sans
-- pôle, que la contrainte des profils refuse (aucun compte sans droits précis).
create or replace function app.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.role_utilisateur :=
    coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'salarie')::public.role_utilisateur;
  v_pole smallint :=
    (select id from public.poles where code::text = new.raw_app_meta_data ->> 'pole');
begin
  insert into public.profiles (id, email, prenom, nom, role, pole_id)
  values (new.id, new.email,
          left(coalesce(new.raw_user_meta_data ->> 'prenom', ''), 80),
          left(coalesce(new.raw_user_meta_data ->> 'nom', ''), 80),
          v_role,
          case when v_role = 'gerant' then null else v_pole end);
  return new;
end $$;

-- Invitations en attente : compte invité par le gérant qui ne s'est pas encore connecté
create function public.invitations_en_attente() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where app.est_gerant() and u.invited_at is not null and u.last_sign_in_at is null
$$;
revoke all on function public.invitations_en_attente() from public, anon;
grant execute on function public.invitations_en_attente() to authenticated, service_role;

-- Nom du complexe : ni vide ni démesuré
alter table public.parametres
  add constraint parametres_nom_complexe check (length(btrim(nom_complexe)) between 2 and 80);

-- Purge : supprime ce qui a dépassé sa durée de conservation et renvoie les quantités supprimées
drop function app.purger_donnees();
create function app.purger_donnees() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_appels integer; v_audit integer; v_webhooks integer; prm public.parametres;
begin
  select * into prm from public.parametres;
  delete from public.appels_ia where debut < now() - make_interval(days => prm.retention_appels_jours);
  get diagnostics v_appels = row_count;
  delete from public.audit_log where cree_le < now() - make_interval(days => prm.retention_audit_jours);
  get diagnostics v_audit = row_count;
  delete from public.webhooks_recus where recu_le < now() - interval '30 days';
  get diagnostics v_webhooks = row_count;
  perform app.journaliser('rgpd.purge', null, null,
                          jsonb_build_object('appels', v_appels, 'audit', v_audit, 'webhooks', v_webhooks));
  return jsonb_build_object('appels', v_appels, 'audit', v_audit, 'webhooks', v_webhooks);
end $$;
revoke all on function app.purger_donnees() from public, anon, authenticated;

create function public.purger_donnees_maintenant() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.est_gerant() then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  return app.purger_donnees();
end $$;
revoke all on function public.purger_donnees_maintenant() from public, anon;
grant execute on function public.purger_donnees_maintenant() to authenticated, service_role;

-- Logo du complexe : bucket public (lecture par tous), écriture réservée au gérant
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('logos', 'logos', true, 512000, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = 512000,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

    drop policy if exists logos_ecriture_gerant on storage.objects;
    create policy logos_ecriture_gerant on storage.objects for all to authenticated
      using (bucket_id = 'logos' and (select app.est_gerant()))
      with check (bucket_id = 'logos' and (select app.est_gerant()));
  end if;
end $$;

-- Saisons : nom lisible, pas de chevauchement entre deux saisons
alter table public.saisons
  add constraint saisons_nom check (length(btrim(nom)) between 2 and 60);

create function app.controler_saison() returns trigger
language plpgsql set search_path = '' as $$
declare v_autre text;
begin
  select s.nom into v_autre from public.saisons s
  where s.id <> new.id
    and daterange(s.date_debut, s.date_fin, '[]') && daterange(new.date_debut, new.date_fin, '[]')
  limit 1;
  if v_autre is not null then
    raise exception 'Ces dates chevauchent la saison « % ».', v_autre using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_saisons_chevauchement before insert or update of date_debut, date_fin
  on public.saisons for each row execute function app.controler_saison();

-- Journal d'audit : tout ce que le gérant règle dans les paramètres
do $$
declare t text;
begin
  foreach t in array array['poles', 'saisons', 'fermetures_exceptionnelles', 'categories_produit', 'lieux_stockage'] loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function app.audit_trigger()', t);
  end loop;
end $$;

-- Événements qui ne passent pas par une table auditée (invitation, test de webhook, logo...)
create function public.journaliser_evenement(p_action text, p_table text, p_cible text,
                                             p_details jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.est_gerant() then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  if p_action !~ '^(utilisateur|integration|logo|horaires)\.[a-z_]+$' then
    raise exception 'Événement inconnu.' using errcode = 'P0001';
  end if;
  perform app.journaliser(p_action, nullif(p_table, ''), nullif(p_cible, ''), p_details);
end $$;
revoke all on function public.journaliser_evenement(text, text, text, jsonb) from public, anon;
grant execute on function public.journaliser_evenement(text, text, text, jsonb) to authenticated;

-- Journal d'audit : l'identifiant de la ligne modifiée est celui de la ligne complète. Avant, une
-- modification n'enregistrait que les colonnes changées (donc jamais l'id) : `cible_id` restait vide.
create or replace function app.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ligne jsonb := to_jsonb(coalesce(new, old));
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
          coalesce(v_ligne ->> 'id', v_ligne ->> 'cle'),
          v_avant, v_apres);
  return coalesce(new, old);
end $$;

-- RGPD : l'anonymisation efface aussi l'identité restée dans les anciennes entrées du journal,
-- que la ligne soit retrouvée par son identifiant ou (entrées anciennes sans identifiant) par l'e-mail.
create or replace function public.anonymiser_utilisateur(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if not app.est_gerant() then raise exception 'Accès refusé.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas anonymiser votre propre compte.' using errcode = 'P0001';
  end if;
  select email into v_email from public.profiles where id = p_user_id;
  if not found then raise exception 'Compte introuvable.' using errcode = 'P0002'; end if;
  update public.profiles
  set prenom = 'Ancien', nom = 'collaborateur', telephone = null, preferences = '{}',
      email = 'anonyme+' || id || '@palmeraie.invalid', actif = false, anonymise_le = now()
  where id = p_user_id;
  update public.audit_log set user_email = null where user_id = p_user_id or user_email = v_email;
  update public.audit_log set avant = avant - 'email' - 'prenom' - 'nom' - 'telephone',
                              apres = apres - 'email' - 'prenom' - 'nom' - 'telephone'
  where table_cible = 'profiles'
    and (cible_id = p_user_id::text or avant ->> 'email' = v_email or apres ->> 'email' = v_email);
  perform app.journaliser('rgpd.anonymisation', 'profiles', p_user_id::text);
end $$;
