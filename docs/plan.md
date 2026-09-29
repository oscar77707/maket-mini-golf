# La Palmeraie : proposition avant développement

> Document à valider avant toute ligne de code. Accompagné de `schema.sql` (schéma complet) et `seed.sql` (données de démo), tous deux testés sur PostgreSQL 16 : chargement sans erreur, droits vérifiés rôle par rôle (voir §3.4).

---

## 1. Hypothèses retenues en attendant vos réponses

Là où le cahier des charges laisse un choix ouvert, j'ai pris une valeur par défaut pour que le plan soit complet. Chacune est reprise dans les questions de la fin (§9) et se change facilement.

| Sujet | Hypothèse par défaut |
|---|---|
| Déploiement | Vercel (app) + Supabase Cloud, région UE (Francfort ou Paris) |
| Couleurs | Principale `#0F766E` (vert palmier), secondaire `#F59E0B` (sable/soleil) |
| Couleurs des pôles | Restaurant `#EA580C` (orange), Mini-golf `#16A34A` (vert), Aires aquatiques `#0284C7` (bleu) |
| Logo | Logotype texte « La Palmeraie » + icône palmier, remplaçable dans Paramètres |
| Stocks | Module conçu pour le restaurant mais ouvert aux 3 pôles (mêmes écrans, filtrés par pôle) |
| Validation des commandes | Le responsable prépare et soumet « à valider » ; seul le gérant « Valide et envoie » |
| Réception de livraison | Responsable du pôle ou gérant |
| Fournisseurs | Partagés entre pôles ; création/modification gérant + responsables, suppression gérant |
| Un responsable | Rattaché à un seul pôle |
| Secrets des webhooks | Variables d'environnement ; Paramètres affiche l'URL, l'état (« configuré ») et un bouton « Tester » |
| Conservation des appels IA | 90 jours, puis suppression automatique chaque nuit |
| Inscription | Pas d'inscription libre : le gérant invite par e-mail depuis Paramètres |

---

## 2. Arborescence du projet

```
palmeraie/
├─ CLAUDE.md                     # stack, conventions, structure, commandes, décisions (tenu à jour)
├─ README.md                     # installation pas à pas
├─ .env.example
├─ middleware.ts                 # session Supabase + redirection /connexion
├─ next.config.ts · tailwind.config.ts · components.json (shadcn) · tsconfig.json (strict)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                # schema.sql découpé en migrations horodatées
│  ├─ seed.sql                   # données de démo
│  └─ tests/                     # tests pgTAP des politiques RLS (supabase test db)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/
│  │  │  ├─ connexion/page.tsx
│  │  │  ├─ mot-de-passe-oublie/page.tsx
│  │  │  └─ reinitialiser/page.tsx
│  │  ├─ (app)/                   # zone connectée : shell (sidebar, barre du haut, bouton + Ajouter)
│  │  │  ├─ layout.tsx
│  │  │  ├─ tableau-de-bord/page.tsx
│  │  │  ├─ stocks/
│  │  │  │  ├─ page.tsx                     # catalogue + alertes
│  │  │  │  ├─ [produitId]/page.tsx         # fiche + historique
│  │  │  │  ├─ mouvements/page.tsx
│  │  │  │  ├─ alertes/page.tsx
│  │  │  │  ├─ inventaires/page.tsx
│  │  │  │  ├─ inventaires/[id]/page.tsx    # comptage mobile + écarts + validation
│  │  │  │  └─ import/page.tsx              # import CSV
│  │  │  ├─ fournisseurs/
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ [fournisseurId]/page.tsx     # fiche + historique + stats + prix
│  │  │  ├─ commandes/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ [commandeId]/page.tsx
│  │  │  │  └─ [commandeId]/reception/page.tsx
│  │  │  ├─ appels/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ statistiques/page.tsx
│  │  │  │  └─ [appelId]/page.tsx
│  │  │  ├─ parametres/
│  │  │  │  ├─ page.tsx                     # infos du complexe, couleurs, logo
│  │  │  │  ├─ utilisateurs/page.tsx
│  │  │  │  ├─ horaires/page.tsx
│  │  │  │  ├─ stocks/page.tsx              # seuil DLC, marge d'alerte, catégories, lieux
│  │  │  │  ├─ integrations/page.tsx        # webhooks n8n
│  │  │  │  └─ donnees/page.tsx             # RGPD : conservation, export, anonymisation, audit
│  │  │  └─ mon-compte/page.tsx
│  │  ├─ api/webhooks/n8n/
│  │  │  ├─ orders/route.ts
│  │  │  └─ calls/route.ts
│  │  ├─ layout.tsx · globals.css · not-found.tsx · error.tsx
│  ├─ components/
│  │  ├─ ui/                      # shadcn (générés)
│  │  ├─ layout/                  # AppSidebar, Topbar, MobileNav, QuickAddButton, PoleFilter
│  │  ├─ data-table/              # DataTable TanStack générique (pagination serveur, tri, sélection, actions groupées)
│  │  ├─ forms/                   # champs RHF réutilisables (FormQuantity, FormSelectFournisseur...)
│  │  ├─ feedback/                # EmptyState, ErrorState, skeletons, UndoToast
│  │  ├─ charts/                  # wrappers Recharts
│  │  └─ command-palette/         # Cmd+K, aide des raccourcis
│  ├─ features/                   # un dossier par module
│  │  ├─ stocks/        { actions.ts, queries.ts, schemas.ts, components/ }
│  │  ├─ commandes/     { ... }
│  │  ├─ fournisseurs/  { ... }
│  │  ├─ appels/        { ... }
│  │  ├─ tableau-de-bord/ { ... }
│  │  ├─ parametres/    { ... }
│  │  └─ quick-add/     # registre des ajouts rapides (drawers) partagé par le bouton, Cmd+K et « N »
│  ├─ lib/
│  │  ├─ supabase/      { server.ts, client.ts, admin.ts (service_role, serveur seul), middleware.ts }
│  │  ├─ auth/          { get-session.ts, require-role.ts }
│  │  ├─ n8n/           { signature.ts, send-order.ts }
│  │  ├─ csv/           { parse.ts, export.ts }
│  │  ├─ format.ts      # nombres, € , dates en fr-FR
│  │  ├─ errors.ts      # erreurs Postgres → messages français
│  │  └─ env.ts         # validation Zod des variables d'environnement
│  ├─ hooks/            { use-hotkeys.ts, use-form-draft.ts, use-media-query.ts }
│  └─ types/database.ts # généré par `supabase gen types`
└─ tests/
   ├─ unit/             # Vitest : schémas Zod, signature, calculs, parsing CSV
   └─ e2e/              # Playwright : critères de réussite (desktop + mobile)
```

**Choix techniques**
- Lecture de données dans les Server Components ; écritures par Server Actions validées par Zod côté serveur, qui appellent Supabase avec la session de l'utilisateur, donc sous RLS. Les opérations multi-étapes (réception, inventaire, annulation) passent par des fonctions SQL transactionnelles.
- La clé `service_role` ne sert qu'aux routes webhooks, à l'invitation d'utilisateurs et au blocage de comptes, dans `lib/supabase/admin.ts` (import `server-only`).
- Tableaux : pagination, tri et filtres côté serveur, état dans l'URL (partage de liens filtrés, retour arrière fiable).
- Realtime : alertes de stock, statuts de commande et nouveaux appels se mettent à jour sans recharger.
- Mode sombre via `next-themes` ; couleurs du complexe et des pôles injectées en variables CSS depuis `parametres` et `poles`.

---

## 3. Modèle de données

Fichiers : **`schema.sql`** (types, tables, index, contraintes, triggers, vues, fonctions, RLS) et **`seed.sql`** (démo).

### 3.1 Tables

| Domaine | Tables |
|---|---|
| Référentiel | `poles`, `profiles`, `parametres` (ligne unique), `saisons`, `horaires_poles`, `fermetures_exceptionnelles` |
| Stock | `categories_produit`, `lieux_stockage`, `produits`, `mouvements_stock`, `lots_dlc`, `inventaires`, `inventaire_lignes` |
| Achats | `fournisseurs`, `fournisseur_produits`, `commandes`, `commande_lignes`, `livraisons`, `livraison_lignes` |
| Appels | `appels_ia` |
| Futur | `recettes`, `recette_ingredients` (inactives par défaut, `parametres.decrement_auto_recettes = false`) |
| Technique | `audit_log`, `webhooks_n8n` (URLs sortantes), `webhooks_recus` (anti-rejeu, diagnostic) |

Vues (avec `security_invoker`, donc soumises à la RLS de l'utilisateur) : `v_stock_produits`, `v_alertes_dlc`, `v_commandes`, `v_stats_fournisseurs`, `v_historique_prix`.

### 3.2 Règles clés
- **Stock = somme des mouvements.** Aucune colonne de stock. Chaque mouvement porte une quantité signée (entrée +, sortie/perte −, correction ±). Les mouvements sont immuables : un trigger refuse UPDATE et DELETE, y compris pour le gérant. On corrige par contre-passation (`annuler_mouvement`, utilisée par le toast « Annuler »).
- **Alertes** : rouge si stock ≤ seuil, orange si stock ≤ seuil + 25 % (marge paramétrable), DLC à J-3 (paramétrable). Les DLC sont suivies par lot (`lots_dlc`), créé à chaque entrée d'un produit suivi ; un lot est soldé automatiquement quand le stock du produit retombe à zéro, ou manuellement (« lot consommé / jeté »).
- **Inventaire** : le stock théorique est figé au moment de chaque comptage, ce qui rend l'écart juste même si des sorties ont lieu pendant l'inventaire. La validation par le responsable crée une correction par écart.
- **Réception** : `valider_livraison` exige un motif pour chaque écart et une DLC pour les produits suivis, crée les entrées de stock et les lots, met à jour le prix d'achat, passe la commande en « livrée » et calcule la conformité.
- **Statuts de commande** contrôlés en base : brouillon → à valider → envoyée → confirmée → livrée → clôturée, plus annulée (motif obligatoire) et en retard (tâche planifiée chaque matin). Une transition non prévue est refusée avec un message en français.
- **Cohérence des pôles** : un produit ne peut entrer que dans une commande, livraison, inventaire ou recette de son pôle ; catégorie et lieu appartiennent au pôle du produit (clés étrangères composites).
- **Fonctions pour l'interface** : `enregistrer_mouvement`, `annuler_mouvement`, `valider_livraison`, `valider_inventaire`, `creer_brouillons_reappro` (« Commander » et « Commander tous les produits en alerte », quantités arrondies au conditionnement fournisseur, brouillon existant complété), `dupliquer_commande`, `evolution_valeur_stock`, `top_produits_consommes`, `stats_appels`.
- **RGPD** : `exporter_donnees_utilisateur` (JSON), `anonymiser_utilisateur` (l'historique métier est gardé sans identité, le compte Auth est bloqué), numéros d'appel stockés masqués plus une empreinte HMAC (jamais en clair), purge nocturne des appels (90 j) et de l'audit (730 j) via `pg_cron`.

### 3.3 Matrice des droits (appliquée par la RLS)

| Donnée | Gérant | Responsable (son pôle) | Salarié (son pôle) |
|---|---|---|---|
| Produits, catégories, lieux | Tout | Lecture + écriture | Lecture |
| Mouvements | Tout | Tous types | Entrée, sortie, perte (pas de correction) ; annule les siens dans les 10 min |
| Inventaires | Tout | Ouvre, valide | Saisit les comptages |
| Commandes | Tout, seul à « Valider et envoyer » | Crée, modifie, soumet | Lecture |
| Livraisons | Tout | Pointe et valide | Lecture |
| Fournisseurs (partagés) | Tout | Lecture + création/modif | Lecture |
| Appels IA | Lecture | Aucun accès | Aucun accès |
| Paramètres, horaires | Écriture | Lecture | Lecture |
| Utilisateurs | Tout | Voit son équipe | Voit son profil |
| Audit, webhooks | Lecture | Aucun accès | Aucun accès |

Un utilisateur désactivé perd tout accès immédiatement. Rôle, pôle et statut d'un compte ne sont modifiables que par le gérant (trigger), et le dernier gérant actif ne peut pas être rétrogradé.

### 3.4 Ce qui a déjà été vérifié sur Postgres 16

Schéma et démo chargés sans erreur, puis testés avec chaque rôle :
- Le responsable restaurant voit 27 produits et 1 pôle, aucun appel, aucun audit. Le salarié mini-golf voit 7 produits de son pôle ; le produit « Farine T55 » du restaurant lui est invisible.
- Un salarié peut saisir une sortie et l'annuler. Il ne peut pas faire de correction, ne peut pas modifier un mouvement, ne peut pas créer de produit et ne peut pas se promouvoir gérant.
- Le responsable ne peut pas envoyer une commande. Le gérant la valide et l'envoie ; une transition interdite (clôturée → brouillon) est refusée.
- La réception de la commande boucherie fait passer le stock de steaks de 130 à 280 et la commande en « livrée ».
- La validation de l'inventaire crée 6 corrections. « Commander tous les produits en alerte » crée ou complète 3 brouillons.
- L'export RGPD, l'anonymisation, la purge et le passage « en retard » fonctionnent ; le rôle anonyme n'a accès à rien.

Ces tests deviendront des tests pgTAP automatisés à l'étape 1.

### 3.5 Données de démo
- 7 comptes (gérant, 3 responsables, 3 salariés dont 2 saisonniers). Mot de passe commun : `Palmeraie2026!`. Adresses en `@palmeraie.test`.
- 9 fournisseurs fictifs, 43 produits (27 restaurant, 7 mini-golf, 9 aquatique).
- 45 jours d'historique : environ 80 commandes livrées ou clôturées avec réceptions (dont quelques non conformes), environ 1 850 mouvements. Aujourd'hui : 4 produits en rouge, 5 en orange, 4 lots à DLC proche.
- Commandes en cours dans tous les statuts (2 à valider, 2 livraisons attendues aujourd'hui, 1 en retard...), un inventaire en cours, 3 recettes inactives, 90 appels IA sur 30 jours.
- Toutes les dates sont relatives au jour du chargement, donc la démo reste à jour.

---

## 4. Liste des pages

| Page | Accès | Contenu | Mobile |
|---|---|---|---|
| Connexion, mot de passe oublié, réinitialisation | Public | E-mail + mot de passe, lien de réinitialisation par e-mail | Oui |
| Tableau de bord | Gérant (responsable : version de son pôle) | Cartes cliquables : produits sous le seuil, commandes à valider (bouton « Valider et envoyer » sur chaque ligne), livraisons attendues aujourd'hui, derniers appels. Graphiques : valeur du stock sur 30 j, top 10 consommés. Liste « À faire aujourd'hui ». Filtre par pôle | Oui (cartes empilées) |
| Stocks : catalogue | Tous | Tableau recherche/filtres (pôle, catégorie, lieu, fournisseur, alerte), pastille d'alerte, boutons « + Entrée » / « + Sortie » par ligne, « Commander » sur les produits en alerte, actions groupées (exporter, commander, archiver) | Liste en cartes, gros boutons |
| Stocks : fiche produit | Tous | Infos, stock, lots DLC, historique des mouvements, prix d'achat dans le temps | Oui |
| Stocks : mouvements | Tous | Journal filtrable (type, période, auteur), export CSV | Oui |
| Stocks : alertes | Tous | Rouge / orange / DLC, « Commander tous les produits en alerte » | Prioritaire |
| Inventaires : liste | Tous | En cours / historiques ; « Nouvel inventaire » (responsable) | Oui |
| Inventaire : comptage | Tous (validation responsable) | Mode comptage : un produit à la fois ou liste par lieu, pavé numérique, écarts en couleur, « Soumettre », « Valider » | Conçu d'abord pour mobile |
| Import CSV | Responsable, gérant | Modèle téléchargeable, aperçu avec erreurs ligne par ligne, stock initial importé comme entrée | Non (bureau) |
| Fournisseurs : liste | Tous | Recherche, mode de commande, jours, délai | Oui |
| Fournisseur : fiche | Tous | Contact, jours, minimum, produits associés, délai réel moyen, taux de conformité, évolution des prix, « Dupliquer la dernière commande » | Oui |
| Commandes : liste | Tous | Onglets par statut, filtres pôle/fournisseur/date, badges retard | Oui |
| Commande : détail | Tous (écriture selon le rôle) | Lignes modifiables en brouillon, total, minimum fournisseur, « Soumettre », « Valider et envoyer », « Recevoir la livraison », « Dupliquer », historique des statuts | Oui |
| Réception de livraison | Responsable, gérant | Pointage ligne par ligne (reçu vs commandé), motif d'écart, DLC/lot, photo du BL, validation | Conçu d'abord pour mobile |
| Journal des appels | Gérant | Liste date/heure/numéro masqué/durée/pôle/résumé/issue, filtres | Oui |
| Appel : détail | Gérant | Résumé, transcription | Oui |
| Appels : statistiques | Gérant | Appels par jour, par pôle, par heure, taux de transfert | Oui |
| Paramètres (6 sous-pages) | Gérant | Complexe (nom, logo, couleurs) ; utilisateurs et rôles (invitation, désactivation) ; horaires par pôle et saison, fermetures ; stocks (seuil DLC, marge, catégories, lieux) ; intégrations n8n ; données et RGPD (conservation, export, anonymisation, journal d'audit) | Bureau d'abord |
| Mon compte | Tous | Nom, téléphone, thème, mot de passe, export de mes données | Oui |

Chaque page a son skeleton de chargement, un état vide qui propose l'action utile (« Aucun produit : importer un fichier CSV / ajouter un produit ») et un écran d'erreur en français.

---

## 5. Intégration n8n

**Sortant : « Valider et envoyer »**
1. La Server Action vérifie le rôle, puis appelle l'URL `N8N_WEBHOOK_ORDER_SEND` (ou celle définie dans Paramètres) avec `{ commandeId, evenement: "order.send" }`.
2. La requête est signée : en-têtes `X-Palmeraie-Timestamp` et `X-Palmeraie-Signature` = HMAC-SHA256(`timestamp.corps`, `N8N_OUTBOUND_SECRET`). n8n vérifie la signature puis relit la commande par l'API.
3. Réponse 2xx : la commande passe en « envoyée ». Sinon elle reste « à valider », l'erreur est enregistrée et un message clair s'affiche (« L'envoi a échoué, réessayez »).

**Entrant : `POST /api/webhooks/n8n/orders` et `/calls`**
- Double contrôle : `Authorization: Bearer N8N_INBOUND_TOKEN` et signature HMAC avec `N8N_INBOUND_SECRET`, horodatage à moins de 5 minutes (anti-rejeu), comparaison en temps constant.
- Clé d'idempotence (`X-Idempotency-Key` ou identifiant d'appel) enregistrée dans `webhooks_recus` : un renvoi ne crée pas de doublon.
- Corps validé par Zod. `orders` accepte `draft.create` (création d'un brouillon avec ses lignes) et `status.update` (confirmée, livrée, en retard...). `calls` accepte un appel ; le numéro complet est masqué et haché côté serveur, jamais stocké en clair.
- Réponses : 200 / 400 (validation, détails en JSON) / 401 (signature) / 409 (transition impossible).
- La documentation des charges utiles, avec exemples `curl`, sera dans le README.

---

## 6. Plan de développement en 7 étapes

À la fin de chaque étape, l'app compile, fonctionne avec les données de démo, et je vous envoie un résumé de ce qui a été fait et comment le tester.

**Étape 1 : setup, authentification, rôles**
- Next.js (App Router, TypeScript strict, ESLint, Prettier), Tailwind, shadcn/ui, lucide-react ; Supabase CLI en local (Docker) ; migrations et seed ; types générés.
- Connexion, mot de passe oublié, réinitialisation ; middleware ; shell de l'app (sidebar desktop, barre d'onglets mobile, filtre de pôle, thème clair/sombre, couleurs des pôles).
- Composants transverses : DataTable, EmptyState, ErrorState, skeletons, toasts, `lib/errors.ts`.
- Tests pgTAP des politiques RLS, Vitest, Playwright configurés ; CI GitHub Actions (lint, types, tests).
- CLAUDE.md, README.md, .env.example.
- Test : se connecter avec chaque compte de démo et vérifier le menu propre à chaque rôle.

**Étape 2 : stocks**
- Catalogue, fiche produit, mouvements, alertes, lots DLC, inventaire mobile, import/export CSV ; boutons « + Entrée », « + Sortie », « Commander » ; annulation par toast.
- Test : en salarié sur téléphone, saisir une sortie puis l'annuler ; en responsable, compter puis valider un inventaire.

**Étape 3 : fournisseurs et commandes**
- Fiches fournisseurs et statistiques, commandes (création, soumission, duplication, « Commander tous les produits en alerte »), « Valider et envoyer » vers n8n, réception ligne par ligne, route `/api/webhooks/n8n/orders`.
- Test : critère n°1 (un responsable crée un produit et enregistre une livraison en moins d'une minute), et l'envoi vers un n8n de test ou un faux serveur local.

**Étape 4 : journal des appels IA**
- Liste, détail, statistiques, route `/api/webhooks/n8n/calls`, purge automatique.
- Test : envoyer un appel avec le `curl` fourni ; vérifier qu'un responsable n'y a pas accès.

**Étape 5 : tableau de bord**
- Cartes cliquables vers les listes filtrées, graphiques, « À faire aujourd'hui », filtre par pôle, mises à jour en temps réel.
- Test : critère n°2 (le gérant valide une commande en un clic depuis le tableau de bord).

**Étape 6 : paramètres**
- Complexe, utilisateurs (invitation, rôle, pôle, désactivation), horaires et fermetures, stocks, intégrations (test des webhooks), données et RGPD.
- Test : inviter un salarié, changer son pôle, exporter puis anonymiser ses données.

**Étape 7 : raccourcis et ajouts rapides**
- Bouton « + Ajouter » (flottant sur mobile, en haut à droite sur desktop) filtré par rôle ; drawers sans quitter la page ; palette Cmd/Ctrl+K (recherche produits, fournisseurs, commandes, pages et actions) ; raccourcis N, /, G puis S ou C, Échap, ? ; « Enregistrer et ajouter un autre » ; brouillons de formulaire sauvegardés automatiquement.
- Test : critère n°3 (ajouter un produit ou une commande en moins de 3 clics depuis n'importe quelle page), plus un passage complet au clavier.

Les tests Playwright des 4 critères de réussite sont ajoutés au fil des étapes et relancés à chaque étape suivante.

---

## 7. Conventions (reprises dans CLAUDE.md)
- Code en anglais pour les identifiants techniques génériques ; vocabulaire métier en français, identique à la base (`commande`, `fournisseur`, `mouvement`). Tous les textes visibles en français.
- Un module = `features/<module>/` avec `queries.ts` (lecture), `actions.ts` (Server Actions), `schemas.ts` (Zod partagé client/serveur), `components/`.
- Aucune requête sans RLS côté client ; la clé `service_role` ne sort jamais de `lib/supabase/admin.ts`.
- Nombres, montants et dates formatés en `fr-FR`, fuseau Europe/Paris.
- Accessibilité : labels sur tous les champs, focus visible, contraste AA vérifié pour les couleurs des pôles, cibles tactiles d'au moins 44 px.
- Pas de code mort, pas de `any`, erreurs Postgres traduites en messages français.

## 8. Variables d'environnement (`.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # serveur uniquement
NEXT_PUBLIC_APP_URL=http://localhost:3000
N8N_WEBHOOK_ORDER_SEND=             # URL du webhook n8n d'envoi de commande
N8N_OUTBOUND_SECRET=                # signature des appels app → n8n
N8N_INBOUND_TOKEN=                  # jeton Bearer exigé des appels n8n → app
N8N_INBOUND_SECRET=                 # signature HMAC des appels n8n → app
PHONE_HASH_SECRET=                  # empreinte des numéros d'appel
```

## 9. Questions ouvertes

1. Déploiement : **Vercel** ou VPS ? (recommandé : Vercel)
2. Couleurs `#0F766E` / `#F59E0B` : **oui** ou vos codes ? (recommandé : oui en attendant la charte)
3. Logo : texte provisoire en attendant le fichier ? (recommandé : **oui**)
4. Un responsable peut-il aussi « Valider et envoyer » les commandes de son pôle ? (recommandé : **non**, gérant seul)
5. Stocks pour les 3 pôles dès la V1, ou restaurant seul ? (recommandé : **3 pôles**)
6. Un salarié peut-il pointer une livraison ? (recommandé : **non**)
7. Les responsables peuvent-ils créer et modifier les fournisseurs ? (recommandé : **oui**)
8. Secrets des webhooks : variables d'environnement ou modifiables dans Paramètres ? (recommandé : **variables d'environnement**)
9. Conservation des appels IA : **90 jours** ? (recommandé : 90)
10. Code : je crée un nouveau dépôt GitHub privé, ou vous en avez un ? (recommandé : **nouveau**)
