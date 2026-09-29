# CLAUDE.md : La Palmeraie, application de gestion interne

Application web pour un complexe de loisirs à trois pôles (Restaurant, Mini-golf, Aires aquatiques). Utilisateurs : gérant, responsables de pôle, salariés (dont saisonniers). **Interface uniquement en français.** Ordinateur pour le gérant, téléphone pour la saisie de stock. Les automatisations (commandes fournisseurs, standard IA) sont dans n8n et communiquent avec l'app par webhooks.

## Méthode

Le propriétaire valide un plan écrit avant tout code (fait, voir `docs/plan.md`). Construction par étapes, dans cet ordre, avec un résumé et un mode d'emploi de test à la fin de chaque étape : 1 setup + auth + rôles, 2 stocks, 3 fournisseurs et commandes, 4 journal des appels, 5 tableau de bord, 6 paramètres, 7 raccourcis et ajouts rapides. En cas d'ambiguïté, poser la question au lieu de deviner.

## Stack

Next.js 16 (App Router) + TypeScript strict · Tailwind CSS 4 + composants style shadcn/ui + lucide-react · Supabase (Postgres, Auth, RLS, Realtime) · Recharts · TanStack Table · React Hook Form + Zod · Vitest.

## Commandes

```
npm run dev          # serveur de développement
npm run build        # compilation de production
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # tests unitaires (Vitest)
supabase start       # base locale (Docker), applique migrations + seed
supabase db reset    # repart de zéro : migrations puis supabase/seed.sql
```

## Structure

```
supabase/migrations/   schéma complet (tables, RLS, triggers, fonctions)
supabase/seed.sql      données de démo (comptes @palmeraie.test, mot de passe Palmeraie2026!)
supabase/tests/        script de contrôle des droits par rôle (rls_smoke.sql)
src/proxy.ts           session Supabase + redirection vers /connexion (Next 16 : « proxy » remplace « middleware »)
src/app/(auth)/        connexion, mot de passe oublié, réinitialisation
src/app/(app)/         zone connectée : layout avec menu, une page par module
src/app/auth/          callback e-mail Supabase, sortie des comptes désactivés
src/components/        ui/ (boutons, champs...), layout/, feedback/ (états vides, erreurs, skeletons)
src/features/<module>/ actions.ts (Server Actions), schemas.ts (Zod), composants du module
src/lib/supabase/      client (navigateur), server (session), admin (service_role, serveur seul), proxy
src/lib/auth/          session (profil courant, requireRole), routes, navigation par rôle
src/lib/errors.ts      erreurs Supabase/Postgres -> messages français
src/lib/server-result.ts  résultat commun des Server Actions (ok / fail / invalid)
src/lib/csv.ts         lecture/écriture CSV au format Excel français (`;`, virgule décimale, BOM)
src/lib/table-params.ts   paramètres d'URL des listes (page, taille, recherche) validés
src/lib/supabase/paginate.ts  fetchAll et inChunks (PostgREST plafonne à 1000 lignes)
src/hooks/use-url-state.ts    état des tableaux (filtres, tri, page) stocké dans l'URL
src/features/stocks/   queries.ts (lectures), actions.ts, schemas.ts, import-parse.ts / import-plan.ts, components/
src/features/fournisseurs/  labels, schemas, queries, actions, components (fiche, produits associés, prix)
src/features/commandes/  labels, schemas (dont OrderSendPayload), queries, actions, n8n.ts (envoi signé), webhook-orders.ts (événements entrants), components
src/app/api/webhooks/n8n/orders/  route entrante n8n (jeton + signature + idempotence), chemin public (`isWebhookPath`)
src/lib/webhooks/signature.ts  signature HMAC, vérification en temps constant, fenêtre de 5 minutes
src/lib/action-context.ts  context(...rôles) des Server Actions (session, profil, contrôle du rôle) ; src/lib/zod-helpers.ts  décimaux français, textes optionnels
scripts/               faux-n8n.mjs (faux serveur n8n), appel-n8n.mjs (appel entrant signé)
docs/n8n.md            contrat des échanges avec n8n
src/types/database.ts  types de la base, à régénérer après chaque migration : `supabase gen types typescript --local > src/types/database.ts`
src/types/models.ts    alias métier (Role, PoleCode, ProduitStock...)
```

## Conventions

- Lecture dans les Server Components, écriture par Server Actions validées par Zod côté serveur. Toujours avec le client de session (`lib/supabase/server`), donc sous RLS. `lib/supabase/admin.ts` (service_role) uniquement pour webhooks, invitations, blocage de comptes.
- Les droits sont appliqués par la base (RLS). Le menu et `requireRole` ne font que guider l'interface.
- Le stock n'est jamais stocké : c'est la somme de `mouvements_stock` (vue `v_stock_produits`). Les mouvements sont immuables ; on corrige par contre-passation.
- Les Server Actions renvoient `ServerResult<T>` (jamais d'exception vers l'écran) : message français + erreurs par champ. Le client affiche via `notify()` (toast, avec bouton « Annuler » quand l'action est réversible).
- Listes : filtres, tri et page dans l'URL (`useUrlState`), pagination côté serveur. PostgREST renvoie au plus 1000 lignes : utiliser `fetchAll` pour tout ce qui peut dépasser, `inChunks` pour les filtres `in()` longs.
- Ne jamais `await` un builder Supabase dans une fonction qui le renvoie (il s'exécuterait trop tôt) : construire de façon synchrone et passer le client en paramètre.
- Zod 4 : valider l'e-mail après `trim` avec `.trim().toLowerCase().pipe(z.email())` ; les décimaux français passent par `parseDecimal` (virgule acceptée). Formulaires : `useForm<z.input, unknown, z.output>` et `useWatch` (pas `watch`).
- TanStack Table est figé en v8 (`@tanstack/react-table@8`) : la v9 a une autre API.
- Exports CSV : format Excel français, protection contre l'injection de formules (cellule commençant par `= + - @`).
- Textes visibles en français, nombres/dates en `fr-FR` (`lib/format.ts`), fuseau Europe/Paris.
- Formulaires : React Hook Form + le même schéma Zod que la Server Action ; labels sur tous les champs ; cibles tactiles d'au moins 44 px.
- Aucun secret en dur : variables d'environnement (`.env.example`). Les variables `NEXT_PUBLIC_*` sont figées au moment du build.
- Pas de code mort, pas de `any`. Les pages de modules non construits utilisent `ModulePlaceholder` (à retirer à l'étape concernée).

## Décisions prises (à confirmer par le propriétaire, valeurs par défaut du plan)

- Hébergement : Vercel + Supabase Cloud (UE). Couleurs `#0F766E` / `#F59E0B`. Logo : logotype texte provisoire.
- Pôles : Restaurant `#EA580C`, Mini-golf `#16A34A`, Aires aquatiques `#0284C7`.
- Seul le gérant « valide et envoie » une commande. Stock ouvert aux 3 pôles. Le salarié ne pointe pas les livraisons. Les responsables gèrent les fournisseurs.
- Secrets des webhooks en variables d'environnement. Conservation des appels : 90 jours.
- Pas d'inscription libre : le gérant invite les utilisateurs.
- Next.js 16 : `proxy.ts` remplace `middleware.ts` ; `cookies()` et `searchParams` sont asynchrones.

## Module Stocks (étape 2)

- Catalogue (tableau sur ordinateur, cartes sur téléphone), fiche produit, alertes (rouge sous le seuil, orange proche du seuil, DLC), mouvements, inventaires, import/export CSV.
- Mouvements : entrée, sortie, perte (motif obligatoire), correction (on saisit le stock réel constaté, motif obligatoire). Une sortie ou une perte supérieure au stock est refusée. Produit à DLC : la DLC est obligatoire à l'entrée et crée un lot. Le bouton « Annuler » d'un toast passe par la fonction SQL `annuler_mouvement` (contre-passation).
- Droits : gérant tout ; responsable crée/modifie les produits, corrige, valide les inventaires, importe, commande ; salarié saisit entrées, sorties, pertes et comptages de son pôle, sans correction ni import. Le salarié compte « à l'aveugle » (stock théorique masqué).
- Inventaire : un seul inventaire ouvert (en cours ou soumis) par lieu. Le salarié soumet, le responsable ou le gérant valide : les écarts deviennent des corrections reliées aux lignes. Fonction `soumettre_inventaire` (migration `20260929000100`).
- Import CSV : chaque ligne est vérifiée séparément (une ligne fausse est signalée avec son numéro et ignorée). Le stock de départ devient une entrée « Stock initial » (origine `import_csv`).
- « Commander tous les produits en alerte » crée des brouillons de commande (RPC `creer_brouillons_reappro`) ; leur validation et leur envoi sont décrits plus bas (étape 3).

## Module Fournisseurs et commandes (étape 3)

- Statuts : brouillon → à valider → envoyée → confirmée / en retard → livrée → clôturée ; annulée possible avant la livraison (motif obligatoire). Les transitions sont contrôlées par le trigger SQL `controler_statut_commande` ; l'application ne fait que les demander.
- Droits : le gérant est seul à « Valider et envoyer » (refusé aussi par la base pour tout autre rôle, hors appel système). Le responsable crée, modifie, soumet, reçoit les livraisons de son pôle et gère les fournisseurs. Le salarié n'a pas de page Commandes ni Fournisseurs (la matrice du plan lui donne la lecture des commandes de son pôle en base, l'interface ne l'affiche pas).
- Envoi : `envoyerCommande` (gérant) passe la commande à « à valider », appelle n8n (`n8n.ts`, signé, https exigé en production), puis « envoyée » seulement si n8n répond 2xx. En cas d'échec la commande reste « à valider » et `derniere_erreur_envoi` est renseignée. L'adresse vient de `webhooks_n8n` (si active), sinon de `N8N_WEBHOOK_ORDER_SEND`.
- Entrant : n8n peut créer un brouillon (`draft.create`) ou poser `confirmee`, `en_retard`, `annulee`. **Jamais `livree`** : la réception se pointe dans l'application (elle crée les mouvements de stock via `valider_livraison`). Idempotence dans `webhooks_recus` (clé `X-Idempotency-Key`).
- Lignes : quantité et prix enregistrés en quittant le champ (`saveLigne`, upsert sur commande + produit) ; éditables seulement en brouillon ou à valider (RLS). Toujours partir de l'état complet d'une ligne quand on modifie un seul champ.
- Réappro : « Commander tous les produits en alerte » ne concerne que les produits sous le seuil (rouge) ayant un fournisseur principal, et ignore ceux déjà dans un brouillon ou une commande en cours (`retirerDejaCommandes`).
- Reporté : photo du bon de livraison, lignes hors commande à la réception, paramétrage de l'adresse du webhook dans l'interface (étape 6). Le minimum de commande avertit sans bloquer.

## État d'avancement

- Étape 1 (setup, auth, rôles) : faite. Étape 2 (stocks) : faite. Étape 3 (fournisseurs, commandes, n8n) : faite, voir README. Étapes 4 à 7 : à faire (4 : journal des appels, route `POST /api/webhooks/n8n/calls`, conservation 90 jours ; le chemin `/api/webhooks/` est déjà public).
- Essais réalisés sans Docker : Postgres 16 réel + un bouchon PostgREST/GoTrue local (avec clé service_role), navigateur piloté par Playwright, faux n8n en https. Le vrai Supabase (envoi d'e-mails, création des comptes de démo par `supabase db reset`) et un vrai n8n restent à vérifier au premier démarrage.
