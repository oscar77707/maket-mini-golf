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
src/types/database.ts  types de la base (à régénérer avec `supabase gen types` dès qu'une base locale tourne)
```

## Conventions
- Lecture dans les Server Components, écriture par Server Actions validées par Zod côté serveur. Toujours avec le client de session (`lib/supabase/server`), donc sous RLS. `lib/supabase/admin.ts` (service_role) uniquement pour webhooks, invitations, blocage de comptes.
- Les droits sont appliqués par la base (RLS). Le menu et `requireRole` ne font que guider l'interface.
- Le stock n'est jamais stocké : c'est la somme de `mouvements_stock` (vue `v_stock_produits`). Les mouvements sont immuables ; on corrige par contre-passation.
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

## État d'avancement
- Étape 1 (setup, auth, rôles) : faite, voir README. Étapes 2 à 7 : à faire.
