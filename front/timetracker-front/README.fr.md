# Frontend TimeTracker

Ce dossier contient le frontend Angular de TimeTracker.

Il fournit :

- une page timesheet jour
- une page timesheet mois
- une grille de gestion des tickets
- une page detail ticket
- un dialogue de parametres avec langue, unite et maintenance

## Stack

- Angular 21
- Angular Material
- RxJS
- `@ngx-translate/core`
- TypeScript 5.9
- Vitest via le builder de tests Angular

## Structure principale

- `src/app/app.ts` : shell racine et ouverture du dialogue de parametres
- `src/app/app.routes.ts` : routes de l'application
- `src/app/core/api/` : client backend partage, DTOs et mapping des erreurs
- `src/app/core/i18n/` : types de langue et cles de traduction
- `src/app/core/services/app-settings.service.ts` : charge et persiste tous les parametres utilisateur via l'API backend
- `src/app/core/services/unit.service.ts` : facade fine sur `AppSettingsService` pour l'unite de temps
- `src/app/core/services/external-link.service.ts` : facade fine sur `AppSettingsService` pour l'URL de base des liens externes
- `src/app/features/timesheet/` : pages jour et mois
- `src/app/features/tickets-grid/` : grille tickets
- `src/app/features/tickets/` : page detail ticket et UI partagee
- `src/app/features/settings/` : dialogue de parametres
- `public/i18n/` : traductions FR et EN

## Installation

Depuis `front/timetracker-front` :

```bash
npm install
```

## Scripts

- `npm start`
- `npm run build`
- `npm run watch`
- `npm test`
- `npm run test:ci`

## Developpement local

Demarrer le frontend :

```bash
npm start
```

URL par defaut :

- `http://localhost:4200`

Le serveur Angular proxifie `/api` via [proxy.conf.json](/c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json), actuellement cible sur `http://localhost:8080`.

Cela correspond au backend lance en Docker. Si tu lances le backend avec `dotnet run`, pense a ajuster ce proxy.

## Shell applicatif

Le shell racine dans [app.html](/c:/Git/TimeTracker/front/timetracker-front/src/app/app.html) fournit actuellement :

- une top bar
- une navigation directe vers `/day`, `/month` et `/tickets-grid`
- un bouton de parametres
- un router outlet

Le dialogue de parametres contient actuellement :

- le changement de langue (`fr` / `en`)
- le changement d'unite (`day` / `hour`)
- une zone maintenance pour l'export et la restauration de sauvegarde

Etat UI persiste :

Les preferences utilisateur (langue, unite de temps, URL de base pour les liens externes) sont chargees depuis le backend au demarrage via `GET /api/settings` et sauvegardees a chaque changement via `PUT /api/settings/{key}`. `AppSettingsService` est la source de verite unique, initialisee via `APP_INITIALIZER` avant le rendu de l'application. Le localStorage n'est plus utilise pour les parametres.

## Routing

Routes definies dans [app.routes.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/app.routes.ts) :

- `/day`
- `/month`
- `/tickets-grid`
- `/ticket/:ticketId`
- `/404`
- `/` redirige vers `/day`
- les routes inconnues redirigent vers `/404`

Toutes les pages sont chargees paresseusement via `loadComponent()`.

## Integration API

Le client partage est dans [tracker-api.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/tracker-api.ts).

Appels backend actuels :

- `GET /api/timesheet/metadata`
- `GET /api/timesheet?year=...&month=...`
- `GET /api/tickets/used?year=...&month=...`
- `GET /api/tickets`
- `GET /api/tickets/totals`
- `GET /api/tickets/{ticketId}/detail`
- `POST /api/tickets`
- `PUT /api/tickets/{ticketId}`
- `PATCH /api/tickets/{ticketId}/completion`
- `DELETE /api/tickets/{ticketId}`
- `POST /api/timeentries/upsert`
- `POST /api/backup/export`
- `POST /api/backup/restore`
- `GET /api/settings`
- `PUT /api/settings/{key}`
- `DELETE /api/settings/{key}`

Appel externe :

- `GET https://calendrier.api.gouv.fr/jours-feries/metropole.json`

La page mois utilise cette API publique de jours feries et retombe sur une liste vide en cas d'echec.

## Notes de donnees frontend

- le frontend utilise `minutesPerDay` venant de la metadata backend
- il n'y a plus de dependance frontend a `hoursPerDay`
- la recherche de ticket dans l'UI est maintenant cote client, a partir des listes deja chargees, et non via un endpoint de lookup dedie

## Resume des fonctionnalites

### Page jour

La page jour :

- se focalise sur un jour ouvre
- charge metadata, donnees du mois, tickets utilises et totaux
- propose des quick picks en mode jour ou heure
- permet de creer un ticket via le dialogue partage — deux actions : **Creer** et **Creer et saisir** (ouvre directement le dialogue de saisie apres creation)
- permet de copier les tickets du jour ouvre precedent avec les temps a 0 via le bouton de copie (ignore les week-ends et jours feries francais ; affiche un message si le jour precedent n'a aucune saisie)
- enregistre via `POST /api/timeentries/upsert`

### Page mois

La page mois :

- affiche une matrice tickets x jours
- distingue week-ends et jours feries francais
- permet la navigation entre mois et la selection par datepicker
- calcule les totaux de ligne cote client
- permet de creer un ticket via le meme dialogue partage que la page jour

### Grille tickets

La grille tickets :

- liste les tickets gerables
- affiche le temps total par ticket
- permet creation, edition inline, completion et suppression
- refleche les regles backend sur les tickets termines et ceux ayant deja des saisies

### Page detail ticket

La page detail ticket :

- affiche toutes les saisies d'un ticket
- groupe les saisies par mois
- permet d'ajouter et modifier des saisies pour ce ticket
- respecte le verrou des tickets termines

### Parametres / maintenance

La zone maintenance du dialogue de parametres permet :

- d'exporter la base SQLite au format `.db`
- de selectionner un fichier `.db` pour restauration
- de confirmer la restauration avant ecrasement
- de recuperer le nom de la sauvegarde de securite creee automatiquement

## Internationalisation

Les traductions sont stockees dans :

- [public/i18n/fr.json](/c:/Git/TimeTracker/front/timetracker-front/public/i18n/fr.json)
- [public/i18n/en.json](/c:/Git/TimeTracker/front/timetracker-front/public/i18n/en.json)

Les cles attendues sont listees dans [translations.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/core/i18n/translations.ts).

## Gestion des erreurs

Les codes backend sont mappes dans [api-error-messages.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/api-error-messages.ts).

Le frontend gere actuellement des messages traduits pour :

- les regles ticket
- la validation des saisies
- les erreurs de configuration
- les erreurs d'export / restauration de sauvegarde

## Tests

Lancer les tests unitaires :

```bash
npm run test:ci
```

Couverture ciblee recente :

- shell applicatif
- `AppSettingsService` (load, set, remove, fallbacks, resilience aux erreurs)
- maintenance du dialogue de parametres
- pages jour et mois
- grille tickets
- page detail ticket
- mapping des erreurs API

## Build

Generer un build de production :

```bash
npm run build
```

Le bundle initial de production reste actuellement sous le seuil d'erreur configure a `1MB`.
