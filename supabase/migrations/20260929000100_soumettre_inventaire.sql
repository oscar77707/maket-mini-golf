-- Étape 2 : soumission d'un inventaire par un membre du pôle
-- =============================================================================
create function public.soumettre_inventaire(p_inventaire_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare inv public.inventaires;
begin
  select * into inv from public.inventaires where id = p_inventaire_id for update;
  if not found then raise exception 'Inventaire introuvable.' using errcode = 'P0002'; end if;
  if not app.acces_pole(inv.pole_id) then
    raise exception 'Vous n''avez pas accès à cet inventaire.' using errcode = '42501';
  end if;
  if inv.statut <> 'en_cours' then
    raise exception 'Cet inventaire n''est plus en cours de comptage.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.inventaire_lignes
                 where inventaire_id = inv.id and quantite_comptee is not null) then
    raise exception 'Comptez au moins un produit avant de soumettre l''inventaire.' using errcode = 'P0001';
  end if;
  update public.inventaires set statut = 'soumis', soumis_le = now() where id = inv.id;
end $$;

revoke all on function public.soumettre_inventaire(uuid) from public, anon;
grant execute on function public.soumettre_inventaire(uuid) to authenticated, service_role;
