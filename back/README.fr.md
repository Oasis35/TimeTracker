# Backend TimeTracker

Ce dossier contient le backend .NET de TimeTracker.

Il expose une API Web ASP.NET Core basée sur SQLite et Entity Framework Core, ainsi qu'un projet de tests xUnit qui couvre les endpoints HTTP et les regles principales de saisie du temps.

## Contenu

- `Tracker.Api/` : projet principal de l'API Web
- `Tracker.Api.Tests/` : tests d'integration et de regles
- `docker-compose.yml` : orchestration locale de l'API en conteneur avec une base SQLite persistante

## Stack Technique

- .NET 10 (`net10.0`)
- ASP.NET Core Web API
- Entity Framework Core 10
- SQLite
- xUnit
- Docker (optionnel)

## Structure Du Projet

- `Tracker.Api/Program.cs` : enregistrement des services, middleware, comportement au demarrage, auto-migration, seed de dev
- `Tracker.Api/Controllers/` : endpoints de l'API
- `Tracker.Api/Data/TrackerDbContext.cs` : modele EF Core et index
- `Tracker.Api/Data/DbSeeder.cs` : donnees de seed en developpement uniquement
- `Tracker.Api/Models/` : entites de persistence (`Ticket`, `TimeEntry`)
- `Tracker.Api/Dtos/` : contrats de requete et de reponse
- `Tracker.Api/Services/TimeEntryRules.cs` : regles de validation des upserts de saisie du temps
- `Tracker.Api/Migrations/` : migrations EF Core
- `Tracker.Api.Tests/Testing/` : couverture de tests API et regles

## Prerequis

- SDK .NET 10.x
- Optionnel : Docker Desktop (pour les executions conteneurisees)

## Developpement Local

Lancer l'API depuis la racine du depot :

```bash
dotnet run --project back/Tracker.Api/Tracker.Api.csproj
```

URLs de developpement par defaut dans `launchSettings.json` :

- HTTP : `http://localhost:5021`
- HTTPS : `https://localhost:7227`

Comportement important en environnement `Development` :

- les migrations EF Core sont appliquees automatiquement au demarrage
- s'il n'existe aucune migration, la base est creee directement
- des donnees de seed de developpement sont inserees automatiquement
- OpenAPI est expose
- la redirection HTTPS est activee

Comportement important hors `Development` :

- les migrations sont quand meme appliquees automatiquement au demarrage
- aucune donnee de seed de developpement n'est inseree
- OpenAPI n'est pas expose
- la redirection HTTPS n'est pas forcee par l'application

## Base De Donnees

L'API utilise SQLite avec cette chaine de connexion par defaut :

```json
"ConnectionStrings": {
  "Main": "Data Source=tracker.db"
}
```

Cela cree `tracker.db` dans le repertoire de travail courant du processus, sauf surcharge explicite.

### Notes Sur Le Schema

- `Ticket`
  - `Id`
  - `Type`
  - `ExternalKey` (nullable)
  - `Label` (nullable)
  - `IsCompleted`
- `TimeEntry`
  - `Id`
  - `TicketId` (nullable dans le modele, mais les flux API utilisent un ticket)
  - `Date`
  - `QuantityMinutes`
  - `Comment`

### Contraintes EF Core

- index unique sur `(Ticket.Type, Ticket.ExternalKey)`
- index unique sur `(TimeEntry.TicketId, TimeEntry.Date)`
- `DateOnly` est stocke sous forme de texte `yyyy-MM-dd`
- `QuantityMinutes` est stocke en `INTEGER`

## Configuration

### `TimeTracking`

`appsettings.json` contient actuellement :

```json
"TimeTracking": {
  "HoursPerDay": 8
}
```

L'API en deduit :

- `MinutesPerDay = HoursPerDay * 60`

Cette configuration impacte directement :

- la validation des quantites de temps
- les metadonnees du timesheet
- les payloads agreges jour/semaine/mois
- la generation du seed de developpement

### Contraintes De Configuration

- `HoursPerDay` doit etre strictement superieur a `0`
- `MinutesPerDay` doit etre divisible par `4`

Si ces regles sont violees, `GET /api/timesheet/metadata` retourne un `400` avec :

- `TT_CONFIG_HOURS_PER_DAY_INVALID`
- ou `TT_CONFIG_MINUTES_PER_DAY_INVALID`

## CORS

L'API expose actuellement une seule policy CORS nommee `AngularDev` qui autorise :

- l'origine `http://localhost:4200`
- tous les headers
- toutes les methodes

Si le frontend tourne sur un autre port ou domaine, cette policy doit etre adaptee.

## OpenAPI

En `Development`, l'application appelle `AddOpenApi()` et `MapOpenApi()`.

Le document OpenAPI est donc disponible uniquement en developpement. La route par defaut attendue est :

- `GET /openapi/v1.json`

## Seed De Developpement

Au demarrage en `Development`, l'application insere :

- un ensemble de tickets `DEV`
- un ensemble de tickets `CONGES`
- une annee d'historique de saisies sur les jours ouvrés
- des periodes de conges predefinies (`CP-HIVER`, `CP-PRINTEMPS`, `CP-ETE`, `CP-TOUSSAINT`, `CP-NOEL`, `RTT-PONTS`)

Details du seed :

- il est concu pour etre idempotent
- il utilise le commentaire marqueur `__DEV_SEED_V2__`
- il ignore les week-ends
- il ne cree pas de saisies datees dans le futur
- les periodes de conges remplacent les saisies `DEV` seedees sur les memes dates

Point important cote API :

- `GET /api/tickets` exclut explicitement les tickets dont `Type == "CONGES"`

Les tickets de conges seedes existent donc en base et sont inclus dans les metadonnees, mais ils sont filtres hors de l'endpoint principal de liste des tickets.

## Vue D'ensemble De L'API

Tous les endpoints sont prefixes par `/api`.

### Tickets

#### `GET /api/tickets`

Retourne tous les tickets sauf `CONGES`, tries par `Type` puis `ExternalKey`.

Exemple de reponse :

```json
{
  "id": 1,
  "type": "DEV",
  "externalKey": "65010",
  "label": "Refonte auth API",
  "isCompleted": false
}
```

#### `GET /api/tickets/used?year=2026&month=2`

Retourne les tickets distincts utilises par des saisies de temps sur le mois demande.

Validation :

- `month` doit etre compris entre `1` et `12`

Code `400` possible :

- `TT_MONTH_INVALID`

#### `POST /api/tickets`

Cree un ticket.

Corps de requete :

```json
{
  "type": "DEV",
  "externalKey": "65042",
  "label": "Nouvelle fonctionnalite"
}
```

Regles :

- `type` est obligatoire
- si `externalKey` est fourni, `label` devient obligatoire
- si un ticket existe deja avec le meme `(type, externalKey)`, le ticket existant est retourne au lieu de creer un doublon

Codes `400` possibles :

- `TT_TICKET_TYPE_REQUIRED`
- `TT_TICKET_LABEL_REQUIRED`

Reponses :

- `201 Created` pour un nouveau ticket
- `200 OK` si le ticket existe deja et est retourne tel quel

#### `PUT /api/tickets/{ticketId}`

Met a jour un ticket avec le meme format de payload que la creation.

Regles :

- `ticketId` doit etre positif
- le ticket doit exister
- les tickets completes sont verrouilles et ne peuvent pas etre modifies
- `type` est obligatoire
- si `externalKey` est fourni, `label` est obligatoire
- `(type, externalKey)` doit rester unique par rapport aux autres tickets

Codes `400` possibles :

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_COMPLETED_LOCKED`
- `TT_TICKET_TYPE_REQUIRED`
- `TT_TICKET_LABEL_REQUIRED`
- `TT_TICKET_ALREADY_EXISTS`

#### `PATCH /api/tickets/{ticketId}/completion`

Met a jour l'etat de completion.

Corps de requete :

```json
{
  "isCompleted": true
}
```

Regles :

- `ticketId` doit etre positif
- le ticket doit exister
- un ticket ne peut etre marque comme complete que s'il possede deja au moins une saisie de temps

Codes `400` possibles :

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_NO_TIME_ENTRIES`

#### `DELETE /api/tickets/{ticketId}`

Supprime un ticket.

Regles :

- `ticketId` doit etre positif
- le ticket doit exister
- les tickets completes sont verrouilles et ne peuvent pas etre supprimes
- les tickets ayant des saisies ne peuvent pas etre supprimes

Codes `400` possibles :

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_COMPLETED_LOCKED`
- `TT_TICKET_HAS_TIME_ENTRIES`

Reponse :

- `204 No Content` en cas de succes

#### `GET /api/tickets/totals`

Retourne le total de minutes saisies par ticket, soit sur tout l'historique, soit pour un mois donne.

Modes supportes :

- sans query params : total sur toutes les donnees
- `?year=2026&month=2` : total sur un mois

Validation :

- `year` et `month` doivent etre fournis ensemble
- `month` doit etre compris entre `1` et `12`

Codes `400` possibles :

- `TT_FILTER_YEAR_MONTH_REQUIRED`
- `TT_MONTH_INVALID`

Exemple de reponse :

```json
{
  "ticketId": 1,
  "type": "DEV",
  "externalKey": "65010",
  "label": "Refonte auth API",
  "total": 480
}
```

### Saisies De Temps

#### `GET /api/timeentries/day?date=2026-03-02`

Retourne le temps saisi sur une journee, groupe par ticket.

Exemple de reponse :

```json
{
  "date": "2026-03-02",
  "entries": [
    {
      "ticketId": 1,
      "type": "DEV",
      "externalKey": "65010",
      "label": "Refonte auth API",
      "quantityMinutes": 240
    }
  ],
  "totalMinutes": 240,
  "minutesPerDay": 480
}
```

#### `GET /api/timeentries/week?start=2026-03-02`

Retourne une vue hebdomadaire basee sur un lundi.

Comportement :

- la date `start` fournie est recalee au lundi de sa semaine
- la reponse couvre toujours 7 jours consecutifs
- les lignes sont groupees par ticket
- `totalsByDay` contient les totaux par jour

#### `POST /api/timeentries/upsert`

Cree, met a jour ou supprime une saisie de temps pour un couple ticket/jour.

Corps de requete :

```json
{
  "ticketId": 1,
  "date": "2026-03-02",
  "quantityMinutes": 120,
  "comment": "Session de pairing"
}
```

Comportement :

- si aucune ligne n'existe pour `(ticketId, date)` et `quantityMinutes > 0`, une ligne est creee
- si une ligne existe et `quantityMinutes > 0`, elle est mise a jour
- si `quantityMinutes == 0`, la ligne existante est supprimee
- si `quantityMinutes == 0` et qu'aucune ligne n'existe, l'endpoint retourne quand meme un succes
- `comment` est tronque aux espaces et stocke a `null` s'il est vide

Regles de validation :

- `ticketId` doit etre positif
- le ticket doit exister
- `quantityMinutes` doit etre compris entre `0` et `MinutesPerDay`
- `quantityMinutes` doit etre un multiple de `15`
- le total resultant de la journee ne doit pas depasser `MinutesPerDay`

Codes `400` possibles :

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_MINUTES_OUT_OF_RANGE`
- `TT_STEP_15`
- `TT_OVERFLOW_DAY`

Reponses :

- `201 Created` lorsqu'une nouvelle ligne est inseree
- `204 No Content` lorsqu'une ligne existante est mise a jour
- `204 No Content` lorsqu'une ligne est supprimee
- `204 No Content` lorsque `quantityMinutes == 0` et qu'aucune ligne n'existait

### Timesheet

#### `GET /api/timesheet?year=2026&month=3`

Retourne la grille mensuelle utilisee par l'UI du timesheet.

Comportement :

- `month` doit etre compris entre `1` et `12`
- `days` contient toutes les dates du mois
- les lignes sont groupees par ticket
- chaque ligne contient une map `values` complete pour tous les jours du mois, avec `0` pour les jours sans saisie
- `ticketKey` vaut :
  - `Type` si `ExternalKey` est vide
  - `Type-ExternalKey` sinon

Codes `400` possibles :

- `TT_MONTH_INVALID`

#### `GET /api/timesheet/metadata`

Retourne la configuration UI et les listes de tickets utilisees par le frontend.

La reponse contient :

- `hoursPerDay`
- `minutesPerDay`
- `allowedMinutesDayMode`
- `allowedMinutesHourMode`
- `defaultUnit` (actuellement `"day"`)
- `defaultType` (actuellement `"DEV"`)
- `tickets`

Valeurs calculees actuellement :

- `allowedMinutesDayMode` : `0`, `1/4 jour`, `1/2 jour`, `3/4 jour`, `1 jour`
- `allowedMinutesHourMode` : de `0` a `MinutesPerDay` par pas de `30` minutes

Contrairement a `GET /api/tickets`, cet endpoint inclut tous les tickets de la base, y compris `CONGES`.

## Format Des Erreurs

Les erreurs de validation ou de regles metier retournent :

```json
{
  "code": "TT_TICKET_NOT_FOUND"
}
```

Les exceptions non gerees retournent :

- HTTP `500`
- le meme format avec le code `TT_UNKNOWN_ERROR`

## Tests

Lancer les tests backend depuis la racine du depot :

```bash
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj
```

Le projet de tests cible `net10.0` et reference directement le projet API.

Les fichiers de tests actuels couvrent notamment :

- le CRUD des tickets et les regles metier associees
- les endpoints de timesheet mensuel et de metadata
- les vues jour et semaine
- le comportement d'upsert
- des cas orphelins et de validation
- les regles `TimeEntryRules`

## Docker

Demarrer l'API avec Docker Compose :

```bash
docker compose -f back/docker-compose.yml up --build
```

Configuration actuelle du conteneur :

- build a partir de `back/Tracker.Api/Dockerfile`
- expose `8080` (HTTP) et `8081`
- definit `ASPNETCORE_URLS=http://+:8080`
- surcharge la base avec `ConnectionStrings__Main=Data Source=/data/tracker.db`
- persiste les donnees SQLite dans le volume nomme `tracker-data`

En pratique :

- l'API est joignable sur `http://localhost:8080`
- le fichier SQLite est stocke dans le volume Docker, pas dans la couche du conteneur

## Taches Developpeur Courantes

### Build

```bash
dotnet build back/Tracker.Api/Tracker.Api.csproj
```

### Lancer Les Tests

```bash
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj
```

### Ajouter Une Migration

A lancer depuis le dossier du projet API ou avec le chemin explicite :

```bash
dotnet ef migrations add <MigrationName> --project back/Tracker.Api/Tracker.Api.csproj
```

### Appliquer Les Migrations Manuellement

Ce n'est en general pas necessaire en local car le demarrage les applique automatiquement, mais la commande est :

```bash
dotnet ef database update --project back/Tracker.Api/Tracker.Api.csproj
```

## Notes D'Implementation Et Points D'attention

- La completion d'un ticket est un verrou metier pour l'edition et la suppression, pas juste un indicateur UI.
- Un ticket ne peut pas etre marque comme complete tant qu'il n'a aucune saisie de temps.
- `POST /api/tickets` est volontairement idempotent uniquement lorsqu'un `(type, externalKey)` existe deja et que `externalKey` est renseigne.
- `GET /api/tickets` et `GET /api/timesheet/metadata` ne retournent pas exactement le meme ensemble de tickets car le premier exclut `CONGES` et le second non.
- Les ecritures de saisies de temps sont contraintes par `HoursPerDay` ; changer cette valeur modifie immediatement le comportement de validation de l'API.
- L'API applique les migrations au demarrage. C'est pratique en local, mais le demarrage peut echouer si une migration est invalide ou si la base n'est pas inscriptible.

