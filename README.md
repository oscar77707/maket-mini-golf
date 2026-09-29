# La Palmeraie : gestion interne

Application de gestion des stocks, fournisseurs, commandes et appels IA du complexe La Palmeraie (Restaurant, Mini-golf, Aires aquatiques). Interface en français. Plan complet : [docs/plan.md](docs/plan.md).

## Prérequis
- Node.js 20.19+ (testé avec 22) et npm
- Docker et la [CLI Supabase](https://supabase.com/docs/guides/local-development) pour la base locale, ou un projet Supabase Cloud

## Installation (base locale)
```bash
npm install
supabase start            # démarre Postgres, Auth, API ; affiche les clés locales
cp .env.example .env.local
# renseigner NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY
# avec les valeurs affichées par `supabase start` (`supabase status` pour les revoir)
supabase db reset         # applique supabase/migrations puis supabase/seed.sql (données de démo)
npm run dev               # http://localhost:3000
```
Les e-mails de réinitialisation du mot de passe arrivent dans Inbucket : http://127.0.0.1:54324.

## Installation (Supabase Cloud)
1. Créer un projet (région UE), puis exécuter `supabase/migrations/*.sql` dans l'éditeur SQL (ou `supabase link` puis `supabase db push`).
2. Activer l'extension `pg_cron` (Database > Extensions) **avant** la migration si vous voulez la purge automatique des appels ; sinon planifier `select app.purger_donnees()` chaque nuit.
3. Auth > URL : ajouter l'adresse du site et `/auth/callback` aux URL de redirection autorisées ; désactiver les inscriptions libres.
4. Créer le premier gérant (Auth > Users) avec, dans « app metadata » : `{"role": "gerant"}`. Les autres comptes s'inviteront depuis Paramètres (étape 6).
5. Ne pas charger `seed.sql` en production (comptes de démo).

## Comptes de démonstration
Mot de passe commun : `Palmeraie2026!`

| E-mail | Rôle |
|---|---|
| gerant@palmeraie.test | Gérant |
| resp.restaurant@palmeraie.test, resp.minigolf@palmeraie.test, resp.aquatique@palmeraie.test | Responsable de pôle |
| salarie.restaurant@palmeraie.test, salarie.minigolf@palmeraie.test, salarie.aquatique@palmeraie.test | Salarié |

## Contrôles
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
`supabase/tests/rls_smoke.sql` rejoue les droits de chaque rôle directement en SQL (à lancer sur une base préparée avec `supabase db reset`).

## Ce que fait l'étape 1
- Connexion e-mail + mot de passe, mot de passe oublié, réinitialisation par e-mail. Pas d'inscription libre. Les comptes désactivés sont refusés.
- Session gérée côté serveur (`src/proxy.ts`) ; redirection vers la page demandée après connexion.
- Menu selon le rôle : gérant (tout), responsable (stocks, commandes, fournisseurs), salarié (stocks). Filtre de pôle pour le gérant. Mode clair par défaut, sombre en option, barre de navigation en bas sur téléphone.
- Les modules suivants affichent un écran « arrive bientôt » jusqu'à leur étape.

## Comment tester l'étape 1
1. `supabase db reset` puis `npm run dev`.
2. Se connecter avec `gerant@palmeraie.test` : arrivée sur le tableau de bord, 6 entrées de menu, filtre de pôle en haut.
3. Se connecter avec `resp.restaurant@palmeraie.test` : arrivée sur Stocks, ni « Appels IA » ni « Paramètres ». Ouvrir `/appels` renvoie vers « Accès refusé ».
4. Se connecter avec un salarié sur téléphone : seule l'entrée « Stocks » existe dans la barre du bas.
5. « Mot de passe oublié » : le lien arrive dans Inbucket et mène à « Nouveau mot de passe ».
