# Backend TimeTracker

Ce dossier contient le backend .NET de TimeTracker.

L'API est construite avec ASP.NET Core, SQLite et EF Core. Elle gere les tickets, les upserts de saisie de temps, les donnees mensuelles du timesheet, les metadonnees UI, l'export / restauration de la base pour la zone maintenance du frontend, ainsi que les parametres applicatifs persistants.

## Contenu

- `Tracker.Api/` : projet principal de l'API
- `Tracker.Api.Tests/` : projet de tests xUnit
- `docker-compose.yml` : stack Docker Compose avec SQLite persiste

## Stack

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core 10
- SQLite
- xUnit

## Developpement local

Depuis la racine du depot :

```bash
dotnet run --project back/Tracker.Api/Tracker.Api.csproj
```

URLs de dev par defaut dans `launchSettings.json` :

- HTTP : `http://localhost:5021`
- HTTPS : `https://localhost:7227`

En `Development` :

- les migrations sont appliquees automatiquement
- la base est creee si besoin
- des donnees de dev sont inserees
- OpenAPI est expose

Hors `Development` :

- les migrations tournent quand meme au demarrage
- le seed de dev est saute
- OpenAPI n'est pas expose

## Base de donnees

L'API utilise SQLite avec cette configuration par defaut :

```json
{
  "ConnectionStrings": {
    "Main": "Data Source=tracker.db"
  }
}
```

Par defaut, `tracker.db` est cree dans le repertoire de travail du processus.

Entites principales :

- `Ticket`
  - `Id`
  - `Type`
  - `ExternalKey`
  - `Label`
  - `IsCompleted`
- `TimeEntry`
  - `Id`
  - `TicketId`
  - `Date`
  - `QuantityMinutes`
  - `Comment`
- `AppSetting`
  - `Key` (cle primaire, max 64 caracteres)
  - `Value` (max 512 caracteres)

Contraintes EF Core importantes :

- index unique sur `(Ticket.Type, Ticket.ExternalKey)`
- index unique sur `(TimeEntry.TicketId, TimeEntry.Date)`
- `DateOnly` stocke en `yyyy-MM-dd`
- `QuantityMinutes` stocke en `INTEGER`

## Configuration

### `TimeTracking`

`appsettings.json` definit :

```json
{
  "TimeTracking": {
    "MinutesPerDay": 480
  }
}
```

`MinutesPerDay` est la source de verite pour :

- la validation des saisies
- les metadonnees du timesheet
- les payloads mensuels
- le seed de developpement

Validation actuelle :

- `MinutesPerDay` doit etre strictement positif
- `MinutesPerDay` doit etre divisible par `4`

Si la config est invalide, `GET /api/timesheet/metadata` retourne `400` avec :

- `TT_CONFIG_MINUTES_PER_DAY_INVALID`

## Seed de developpement

En `Development`, le demarrage insere :

- plusieurs tickets `DEV`
- plusieurs tickets `ABSENT`
- un historique de saisies sur jours ouvres
- des tickets / periodes de conges predefinis

Details :

- comportement idempotent
- marqueur `__DEV_SEED_V2__`
- week-ends ignores
- aucune saisie future

`GET /api/tickets` exclut `ABSENT`, alors que `GET /api/timesheet/metadata` les inclut.

## Vue d'ensemble de l'API

Toutes les routes sont prefixees par `/api`.

### Tickets

- `GET /api/tickets`
  - retourne tous les tickets hors `ABSENT`
- `GET /api/tickets/used?year=...&month=...`
  - retourne les tickets utilises sur un mois
- `POST /api/tickets`
  - cree un ticket, ou retourne l'existant si `(type, externalKey)` existe deja
- `PUT /api/tickets/{ticketId}`
  - met a jour un ticket
- `PATCH /api/tickets/{ticketId}/completion`
  - marque un ticket termine / ouvert
- `DELETE /api/tickets/{ticketId}`
  - supprime un ticket si les regles metier le permettent
- `GET /api/tickets/totals`
  - retourne le total de minutes par ticket, avec filtre optionnel `year` + `month`
- `GET /api/tickets/{ticketId}/detail`
  - retourne le detail d'un ticket et ses saisies

Regles importantes :

- un ticket termine est en lecture seule pour update et delete
- un ticket ne peut pas etre termine sans au moins une saisie
- la suppression echoue si des saisies existent deja

### Saisies de temps

- `POST /api/timeentries/upsert`
  - cree, met a jour ou supprime une saisie `(ticket, date)`

Regles de validation actuelles :

- `ticketId` doit etre positif
- le ticket doit exister
- le ticket ne doit pas etre termine
- `quantityMinutes` doit etre entre `0` et `MinutesPerDay`
- `quantityMinutes` doit respecter un pas de 15 minutes
- le total du jour ne doit pas depasser `MinutesPerDay`

Codes d'erreur typiques :

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_COMPLETED_LOCKED`
- `TT_MINUTES_OUT_OF_RANGE`
- `TT_STEP_15`
- `TT_OVERFLOW_DAY`

### Timesheet

- `GET /api/timesheet?year=...&month=...`
  - retourne la grille mensuelle
- `GET /api/timesheet/metadata`
  - retourne `minutesPerDay`, les quick-picks autorises, l'unite / type par defaut, et la liste de tickets utilisee par le frontend

La metadata contient actuellement :

- `minutesPerDay`
- `allowedMinutesDayMode`
- `allowedMinutesHourMode`
- `defaultUnit`
- `defaultType`
- `tickets`

Le contrat API n'expose plus `hoursPerDay`.

### Parametres

- `GET /api/settings`
  - retourne tous les parametres sous forme de dictionnaire plat `{ cle: valeur }`
- `PUT /api/settings/{key}`
  - cree ou met a jour un parametre (upsert atomique)
  - body : `{ "value": "..." }`
  - longueur max de la cle : 64 caracteres
- `DELETE /api/settings/{key}`
  - supprime un parametre ; retourne `204` meme si la cle n'existe pas

Les parametres sont utilises par le frontend pour persister les preferences utilisateur (langue, unite de temps, URL de base pour les liens externes) cote serveur plutot que dans le localStorage.

### Sauvegarde

- `POST /api/backup/export`
  - exporte une copie complete de la base SQLite courante au format `.db`
- `POST /api/backup/restore`
  - restaure un fichier `.db` envoye en multipart

Comportement de la restauration :

- refuse les fichiers manquants ou invalides
- verifie que le fichier est une sauvegarde SQLite exploitable
- cree une sauvegarde de securite avant ecrasement
- range ces sauvegardes a cote de la base principale dans `backups/`

Codes d'erreur specifiques :

- `TT_BACKUP_FILE_MISSING`
- `TT_BACKUP_FILE_INVALID`

## Format des erreurs

Les erreurs de validation / metier retournent :

```json
{
  "code": "TT_TICKET_NOT_FOUND"
}
```

Les exceptions non gerees utilisent le meme format avec le code `TT_UNKNOWN_ERROR`.

## Tests

Depuis la racine du depot :

```bash
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj
```

Le projet de tests couvre notamment :

- le CRUD tickets et les regles associees
- les endpoints timesheet mensuel et metadata
- la validation des upserts de saisie
- le service d'export / restauration de sauvegarde
- la logique partagee `TimeEntryRules`
- le CRUD parametres (upsert, idempotence, suppression, validation)

## Docker

Lancer l'API dans Docker :

```bash
docker compose -f back/docker-compose.yml up --build
```

La stack :

- expose l'API sur `http://localhost:8080`
- persiste SQLite dans le volume nomme `tracker-data`
- stocke la base sous `/data/tracker.db`
- stocke donc les sauvegardes maintenance sous `/data/backups`

## Commandes courantes

Build :

```bash
dotnet build back/Tracker.Api/Tracker.Api.csproj
```

Ajouter une migration :

```bash
dotnet ef migrations add <MigrationName> --project back/Tracker.Api/Tracker.Api.csproj
```

Appliquer les migrations manuellement :

```bash
dotnet ef database update --project back/Tracker.Api/Tracker.Api.csproj
```
