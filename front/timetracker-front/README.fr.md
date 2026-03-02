# Frontend TimeTracker

Ce dossier contient le frontend Angular de TimeTracker.

Il fournit l'interface principale du timesheet (vues jour et mois), une grille de gestion des tickets, une interface bilingue (`fr` / `en`) et un client partage pour l'API backend.

## Contenu

- `src/` : code source de l'application
- `public/` : assets statiques et fichiers de traduction
- `proxy.conf.json` : proxy API local pour le developpement
- `angular.json` : configuration du workspace Angular CLI
- `package.json` : scripts et dependances

## Stack Technique

- Angular 21
- Angular Material
- RxJS
- `@ngx-translate/core`
- TypeScript 5.9
- Vitest (via le builder de tests Angular)

## Structure Du Projet

- `src/main.ts` : point d'entree de bootstrap Angular
- `src/app/app.ts` : composant racine
- `src/app/app.routes.ts` : configuration du routeur
- `src/app/app.config.ts` : providers (routeur, HTTP, chargeur de traductions)
- `src/app/core/api/` : client API backend, DTOs et mapping des erreurs API
- `src/app/core/i18n/` : types de langue et definition des cles de traduction
- `src/app/core/services/unit.service.ts` : etat global du mode d'affichage jour/heure
- `src/app/features/timesheet/` : pages timesheet jour et mois
- `src/app/features/tickets-grid/` : grille de gestion des tickets
- `src/app/features/tickets/shared/add-ticket-dialog/` : dialogue partage de creation de ticket
- `public/i18n/fr.json` : libelles francais
- `public/i18n/en.json` : libelles anglais

## Prerequis

- Node.js compatible avec Angular 21
- npm `11.x` (le lockfile et `packageManager` ciblent actuellement `npm@11.5.2`)
- Le backend API demarre localement pour la plupart des parcours applicatifs

## Installation

Depuis `front/timetracker-front` :

```bash
npm install
```

## Scripts

Scripts npm disponibles :

- `npm start` : demarre le serveur de dev Angular avec `proxy.conf.json`
- `npm run build` : build de production
- `npm run watch` : build de developpement en mode watch
- `npm test` : tests unitaires en mode watch
- `npm run test:ci` : tests unitaires en une seule execution

## Developpement Local

Demarrer le frontend :

```bash
npm start
```

Par defaut, Angular sert l'application sur :

- `http://localhost:4200`

L'application attend le backend sous `/api`, et le serveur de dev proxifie ce prefixe via [proxy.conf.json](c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json) :

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
}
```

Impact pratique :

- les requetes locales vers `/api/...` sont transferees vers `http://localhost:8080`
- cela s'aligne sur la configuration Docker du backend
- si le backend tourne ailleurs, il faut modifier `proxy.conf.json`

## Build

Generer un build de production :

```bash
npm run build
```

Parametres Angular notables :

- builder : `@angular/build:application`
- configuration par defaut : `production`
- seuil d'avertissement du bundle initial en production : `500kB`
- seuil d'erreur du bundle initial en production : `1MB`
- seuil d'avertissement par style de composant : `6kB`
- seuil d'erreur par style de composant : `10kB`

La configuration `development` desactive l'optimisation et garde les source maps.

## Tests

Lancer les tests unitaires :

```bash
npm test
```

Execution type CI :

```bash
npm run test:ci
```

Le projet utilise le builder de tests Angular et contient des specs pour :

- le composant racine
- le mapping des erreurs API
- le service de mode d'unite
- la page timesheet jour
- la page timesheet mois
- la grille des tickets

## Shell Applicatif

Le composant racine dans [app.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.ts) fournit :

- une toolbar principale
- un selecteur de langue (`FR` / `EN`)
- un selecteur d'unite (`day` / `hour`)
- un bouton de navigation vers la grille des tickets
- un `router-outlet` pour le contenu des pages

Etat UI global expose au niveau du shell :

- langue courante
- unite d'affichage courante (`day` ou `hour`)

Le choix de l'unite est partage via `UnitService`, donc un changement d'unite affecte toutes les vues qui formatent des durees.

## Routing

Les routes sont definies dans [app.routes.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.routes.ts) :

- `/day` : page timesheet jour
- `/month` : page timesheet mois
- `/tickets-grid` : grille de gestion des tickets
- `/` : redirige vers `/day`
- routes inconnues : redirigent vers `/day`

L'application utilise des routes paresseuses via `loadComponent()`.

## Internationalisation

La traduction est configuree dans [app.config.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.config.ts) :

- langue par defaut : `fr`
- langue de repli : `fr`
- fichiers charges depuis `./i18n/*.json`

Langues actuellement supportees dans l'UI :

- francais
- anglais

Les fichiers de traduction se trouvent dans :

- [fr.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/fr.json)
- [en.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/en.json)

La liste source des cles attendues est maintenue dans [translations.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/i18n/translations.ts).

Note developpeur :

- si vous ajoutez une nouvelle chaine traduisible, il faut mettre a jour les deux fichiers JSON et garder `translations.ts` aligne

## Integration API

Le client HTTP partage est implemente dans [tracker-api.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/tracker-api.ts).

### Appels Backend

Le frontend appelle actuellement :

- `GET /api/timesheet/metadata`
- `GET /api/timesheet?year=...&month=...`
- `GET /api/tickets/used?year=...&month=...`
- `GET /api/tickets`
- `GET /api/tickets/totals`
- `POST /api/tickets`
- `PUT /api/tickets/{ticketId}`
- `PATCH /api/tickets/{ticketId}/completion`
- `DELETE /api/tickets/{ticketId}`
- `POST /api/timeentries/upsert`

### Appel Externe

La page mensuelle appelle aussi un service public externe :

- `GET https://calendrier.api.gouv.fr/jours-feries/metropole.json`

Notes d'usage :

- cet appel sert a marquer les jours feries francais dans la vue mensuelle
- en cas d'echec, la page degrade proprement et traite cela comme une liste vide
- cette requete n'est pas proxifiee par Angular car l'URL est absolue

## Modeles Partages

Les DTOs frontend sont declares dans [models.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/models.ts).

Contrats principaux :

- `TicketDto`
- `TicketTotalDto`
- `CreateTicketDto`
- `TimesheetMetadataDto`
- `TimesheetMonthDto`
- `TimesheetRowDto`
- `UpsertTimeEntryDto`

Ils refletent de pres l'API backend et doivent rester alignes avec les DTOs du backend.

## Gestion Des Erreurs

Les codes d'erreur backend sont mappes vers des cles de traduction via :

- [api-error-messages.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/api-error-messages.ts)

Comportement :

- les erreurs metier et de validation sont converties en messages utilisateurs traduits
- chaque page intercepte les echecs reseau/API et affiche un message approprie
- les cas inconnus retombent sur des messages generiques comme `cannot_load_data`, `cannot_log_time`, `cannot_create_ticket`, `cannot_update_ticket` ou `cannot_delete_ticket`

## Etat Global Et Formatage

### Mode D'unite

[unit.service.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/services/unit.service.ts) stocke un signal global :

- `day`
- `hour`

Les pages lisent ce signal pour basculer le format des durees et les quick picks.

### Formatage Des Nombres

Plusieurs vues appliquent la meme convention UI :

- maximum 2 decimales
- separateur decimal avec virgule
- suppression des zeros inutiles en fin de valeur

Exemples :

- `12.00` devient `12`
- `12.50` devient `12,5`
- `12.34` devient `12,34`

Ce format est notamment utilise dans la page mensuelle et la grille des tickets.

## Vue D'ensemble Des Fonctionnalites

### Page Timesheet Jour

Implementation principale :

- [timesheet-day-page.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/timesheet/timesheet-day-page/timesheet-day-page.ts)

Objectif :

- saisir du temps pour un jour ouvre selectionne
- afficher le contexte du mois tout en se focalisant sur une date
- creer des tickets directement depuis ce parcours

Comportements principaux :

- se positionne par defaut sur le mois/annee courants
- suit le jour selectionne sous forme ISO (`YYYY-MM-DD`)
- choisit automatiquement un jour ouvre par defaut apres chargement
- saute les week-ends lors de la navigation jour precedent / jour suivant
- permet une selection de date en bloquant les week-ends
- charge metadata, donnees mensuelles, tickets utilises et totaux via `resource()`
- permet de creer un ticket via le dialogue partage
- ecrit le temps via `POST /api/timeentries/upsert`
- recharge les ressources necessaires apres succes

Comportement d'affichage :

- les valeurs rapides proviennent des metadata backend
- en mode `hour`, les libelles utilisent `allowedMinutesHourMode`
- en mode `day`, les libelles utilisent `allowedMinutesDayMode`
- les valeurs affichees utilisent la virgule et ajoutent `h` ou `j`

Nuance de filtrage :

- la page affiche les tickets utilises sur le mois selectionne
- les tickets completes restent visibles uniquement s'ils ont deja du temps sur le jour selectionne

Support des query params :

- `?date=YYYY-MM-DD` preselectionne une date precise

### Page Timesheet Mois

Implementation principale :

- [timesheet-month-page.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/timesheet/timesheet-month-page/timesheet-month-page.ts)

Objectif :

- afficher une matrice mensuelle tickets x jours
- montrer les totaux par ligne et pour le mois
- distinguer visuellement les week-ends et jours feries francais

Comportements principaux :

- se positionne par defaut sur le mois courant
- charge metadata, donnees du mois, tickets utilises et jours feries
- en cas d'echec de l'API des jours feries, retombe sur une liste vide
- fusionne `used tickets` avec les lignes mensuelles pour afficher aussi les tickets sans ligne existante
- calcule les totaux de ligne cote client
- permet la navigation mois precedent, mois suivant et retour au mois courant
- permet la selection d'un mois via le datepicker Material

Comportement d'affichage :

- utilise une logique de tableau sticky
- mesure la largeur de l'en-tete `type` avec `ResizeObserver` pour aligner correctement les offsets sticky
- formate les valeurs en mode jour ou heure via l'etat global d'unite
- les week-ends et jours feries sont visuellement differencies

Support des query params :

- `?year=YYYY&month=M` preselectionne un mois precis
- les params invalides ou hors plage sont ignores

### Grille Des Tickets

Implementation principale :

- [tickets-grid-page.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/tickets-grid/tickets-grid-page/tickets-grid-page.ts)

Objectif :

- lister tous les tickets gerables
- afficher le temps cumule par ticket
- creer, modifier, supprimer et marquer les tickets comme completes / ouverts

Comportements principaux :

- charge tous les tickets, les totaux et les metadata
- utilise `MatTableDataSource` avec tri et pagination Material
- personnalise le paginator via un `MatPaginatorIntl` traduit
- prend en charge l'edition inline de `type`, `externalKey` et `label`
- permet la creation de ticket via le dialogue partage
- permet le changement d'etat de completion et la suppression avec les regles backend
- recharge les donnees apres mutation reussie

Comportement de filtrage :

- le filtre texte cherche dans `externalKey`, `type`, `label` et `totalMinutes`
- le texte est normalise avant comparaison
- le filtrage est insensible a la casse
- le filtrage est insensible aux accents
- les espaces de debut et de fin sont ignores
- le filtre de completion supporte `open`, `completed` et `all`

Comportement de formatage :

- le temps affiche est rendu en mode `hour` ou `day`
- les valeurs utilisent la virgule decimale
- les zeros finaux inutiles sont retires

Exemples :

- `12.00` devient `12`
- `12.50` devient `12,5`
- `12.34` devient `12,34`

Contraintes backend visibles cote UI :

- un ticket complete peut refuser la mise a jour ou la suppression
- marquer un ticket comme complete peut echouer s'il n'a aucune saisie de temps
- supprimer un ticket peut echouer s'il a deja des saisies

### Dialogue Partage De Creation De Ticket

Fichiers principaux :

- [add-ticket-dialog.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/tickets/shared/add-ticket-dialog/add-ticket-dialog.ts)
- [add-ticket-dialog.html](c:/Git/TimeTracker/front/timetracker-front/src/app/features/tickets/shared/add-ticket-dialog/add-ticket-dialog.html)

Objectif :

- permettre la creation de ticket depuis plusieurs points d'entree

Appelants actuels :

- la page timesheet jour
- la grille des tickets

Ce dialogue centralise le flux de creation et permet aux pages parentes de ne recharger leurs donnees que lorsqu'un ticket a effectivement ete cree.

## Attentes Vis-a-vis Du Backend

Pour que le frontend fonctionne correctement, le backend doit :

- etre joignable sur `http://localhost:8080` en dev local standard, sauf modification du proxy
- autoriser CORS depuis `http://localhost:4200` si le proxy est contourne
- exposer toutes les routes `/api/...` utilisees par `TrackerApi`
- retourner les codes d'erreur attendus par `api-error-messages.ts`

Notes de dependance fonctionnelle :

- le frontend depend de `timesheet/metadata` pour les increments autorises et la semantique des unites
- les pages jour et mois utilisent `tickets/used` pour determiner quels tickets afficher sur un mois
- la grille des tickets utilise `tickets` et non `metadata`, donc elle suit le comportement backend qui exclut `CONGES`

## Assets Et Styles

Les assets statiques sont servis depuis `public/`.

Les styles globaux se trouvent dans :

- [styles.scss](c:/Git/TimeTracker/front/timetracker-front/src/styles.scss)

Les styles de fonctionnalite sont colocalises a cote de chaque composant dans les fichiers `*.scss`.

## Taches Developpeur Courantes

### Demarrer Le Serveur De Dev

```bash
npm start
```

### Lancer Un Build De Production

```bash
npm run build
```

### Lancer Les Tests Une Fois

```bash
npm run test:ci
```

### Changer La Cible Du Proxy Backend

Modifier :

- [proxy.conf.json](c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json)

### Ajouter Une Nouvelle Route

Mettre a jour :

- [app.routes.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.routes.ts)

### Ajouter Une Nouvelle Traduction

Mettre a jour :

- [fr.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/fr.json)
- [en.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/en.json)
- [translations.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/i18n/translations.ts)

## Notes D'implementation Et Points D'attention

- La navigation racine expose actuellement un bouton direct vers la grille des tickets ; les pages jour et mois restent accessibles par route mais ne sont pas exposees dans la toolbar de `app.html`.
- `UnitService` est purement en memoire. Recharger la page reinitialise l'unite a `day`.
- Le choix de langue n'est pas persiste non plus et repart sur `fr`.
- La page mensuelle depend d'une API externe de jours feries francais. Si ce service tombe, la page continue de fonctionner mais sans libelles de jours feries.
- Le frontend repose fortement sur les signaux Angular et `resource()`. Si les flux de donnees changent, il faut garder des rechargements explicites apres les mutations.
- La page jour et la grille des tickets dependent toutes deux des metadata backend pour les conversions jour/heure ; si `HoursPerDay` change cote backend, les valeurs en jours changent automatiquement.
- Le filtre texte de la grille normalise accents et casse avant comparaison ; c'est un comportement facile a casser lors d'un refactor.

