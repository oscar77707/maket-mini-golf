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

| E-mail                                                                                               | Rôle                |
| ---------------------------------------------------------------------------------------------------- | ------------------- |
| gerant@palmeraie.test                                                                                | Gérant              |
| resp.restaurant@palmeraie.test, resp.minigolf@palmeraie.test, resp.aquatique@palmeraie.test          | Responsable de pôle |
| salarie.restaurant@palmeraie.test, salarie.minigolf@palmeraie.test, salarie.aquatique@palmeraie.test | Salarié             |

## Contrôles

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`supabase/tests/rls_smoke.sql` rejoue les droits de chaque rôle directement en SQL (à lancer sur une base préparée avec `supabase db reset`).

## Régénérer les types de la base

Après chaque nouvelle migration : `supabase gen types typescript --local > src/types/database.ts`.

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

## Ce que fait l'étape 2 (Stocks)

- **Catalogue** : recherche, filtres (niveau d'alerte, catégorie, lieu, fournisseur, archivés), tri, pagination serveur, sélection multiple (export, commande, archivage avec « Annuler »). Cartes à gros boutons sur téléphone.
- **Mouvements** : entrée, sortie, perte, correction, depuis le tableau ou la fiche produit ; annulation d'une saisie récente par le bouton « Annuler » du message de confirmation ; historique filtrable, export CSV.
- **Fiche produit** : stock, seuil, valeur, prix d'achat, lots à DLC, courbe d'évolution du prix, historique.
- **Alertes** : rouge (sous le seuil), orange (proche), DLC à surveiller ; « Commander tous les produits en alerte » prépare des brouillons de commande.
- **Inventaires** : comptage à l'aveugle sur téléphone (enregistrement à chaque saisie), soumission, validation par le responsable ou le gérant, écarts transformés en corrections.
- **Import / export CSV** : format Excel français (`;`, virgule décimale), modèle à télécharger, contrôle ligne par ligne avant import.

## Comment tester l'étape 2

1. `supabase db reset` (applique la migration `soumettre_inventaire` et recharge les données de démo), puis `npm run dev`.
2. **Responsable** (`resp.restaurant@palmeraie.test`) sur ordinateur, page Stocks :
   - créer un produit avec « Nouveau produit » (bouton « Enregistrer et ajouter un autre » pour en saisir plusieurs) ; un nom déjà pris est refusé ;
   - « Entrée » sur ce produit : livraison de 10 unités, le stock du tableau passe à 10 en une saisie ;
   - « Sortie » supérieure au stock : refusée avec un message clair ; sortie valide puis « Annuler » dans le message : le stock revient ;
   - filtre « Sous le seuil » puis « Commander tous les produits en alerte » ; sélectionner deux lignes puis « Exporter » (CSV ouvrable dans Excel) et « Archiver » (annulable).
3. **Salarié** (`salarie.restaurant@palmeraie.test`) sur téléphone (ou fenêtre étroite) :
   - cartes avec « + Entrée » et « + Sortie » ; pas de « Nouveau produit », pas de « Correction », pas d'onglet « Import / export » ;
   - Inventaires : ouvrir l'inventaire en cours, saisir les quantités (aucun stock théorique affiché), « Soumettre à validation ».
4. **Gérant** (`gerant@palmeraie.test`) : filtre de pôle en haut ; Inventaires : ouvrir l'inventaire soumis, voir les écarts, « Valider et corriger le stock » ; Import / export : télécharger le modèle, ajouter une ligne fausse (prix « abc ») : elle est signalée sans bloquer les autres.
5. Vérifier qu'un salarié du restaurant ne voit aucun produit des autres pôles (l'adresse d'une fiche d'un autre pôle renvoie « introuvable »).
