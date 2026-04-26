# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack personal time tracking application. Angular 21 frontend + .NET 10 Web API backend + SQLite database.

## Commands

### Backend (.NET)

```bash
# Run directly
dotnet run --project back/Tracker.Api/Tracker.Api.csproj
# → HTTP: http://localhost:5021 / HTTPS: https://localhost:7227

# Run via Docker (recommended for frontend dev)
docker compose -f back/docker-compose.yml up --build
# → http://localhost:8080

# Build & test
dotnet build back/Tracker.Api/Tracker.Api.csproj
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj

# EF Core migrations
dotnet ef migrations add <Name> --project back/Tracker.Api/Tracker.Api.csproj
dotnet ef database update --project back/Tracker.Api/Tracker.Api.csproj
```

### Frontend (Angular)

```bash
cd front/timetracker-front
npm install
npm start        # Dev server → http://localhost:4200
npm run build    # Production build
npm test         # Unit tests (Vitest)
```

The Angular dev proxy ([proxy.conf.json](front/timetracker-front/proxy.conf.json)) forwards `/api/*` to `http://localhost:8080`, so the backend must be running.

### Déploiement production

```bash
# Build et démarrage prod (port 8088)
docker compose -f docker-compose.prod.yml up --build

# Export image pour déploiement offline
./scripts/docker/export-image.sh [output-path]    # Linux/Mac
./scripts/docker/export-image.ps1 [output-path]   # Windows

# Import et redéploiement depuis archive
./scripts/docker/import-and-redeploy.sh [archive] # Linux/Mac
./scripts/docker/import-and-redeploy.ps1 [archive] # Windows
```

En prod, le frontend Angular est servi par nginx (via `front/docker/nginx.conf`) qui proxifie `/api/` vers le backend. Taille max upload : 250 MB (pour la restauration de backup). Le volume Docker nommé `tracker-data` persiste `/data` (base SQLite + backups).

## Architecture

### Backend (`back/Tracker.Api/`)

REST API with these controllers:

| Controller | Responsibility |
|---|---|
| `TicketsController` | CRUD for tickets, mark complete, monthly usage & totals |
| `TimeEntriesController` | Upsert/delete time entries |
| `TimesheetController` | Month grid + metadata |
| `SettingsController` | Key-value user settings |
| `BackupController` | SQLite export/restore (rate-limited: 5 req/min) |
| `PublicHolidaysController` | Proxy + 24h in-memory cache for French public holidays |

Key files:
- [Program.cs](back/Tracker.Api/Program.cs) — startup: auto-migrations, seed data, CORS, rate limiter, `/api/health` endpoint, global exception handler, SPA fallback
- [Data/TrackerDbContext.cs](back/Tracker.Api/Data/TrackerDbContext.cs) — EF Core context
- [Services/TimeEntryRules.cs](back/Tracker.Api/Services/TimeEntryRules.cs) — business rule enforcement
- [Infrastructure/](back/Tracker.Api/Infrastructure/) — standardized `TT_*` error codes and ProblemDetails responses

### DTOs — synchronisation manuelle

Les DTOs frontend ([core/api/models.ts](front/timetracker-front/src/app/core/api/models.ts)) et backend (`back/Tracker.Api/Dtos/`) sont maintenus manuellement. L'API expose OpenAPI sur `/openapi/v1.json` en développement mais aucune génération de client n'est configurée — toute modification de contrat d'API doit être répercutée manuellement des deux côtés.

### Frontend (`front/timetracker-front/src/app/`)

Standalone Angular components, lazy-loaded by route:

```
core/
  api/            # TrackerApi client + DTOs (single API service)
  services/       # AppSettingsService, UnitService, ExternalLinkService
  i18n/           # Translation wrappers
  utils/          # Helpers
features/
  timesheet/      # Day and month views
  tickets-grid/   # Ticket list
  tickets/        # Ticket detail
  settings/       # Settings dialog + DB maintenance
```

State is backend-driven: `AppSettingsService` loads all user preferences via `provideAppInitializer()` at startup. No Redux/NgRx — component-level state with Angular Signals.

**Patterns Angular à respecter :**

- **Signals** : état local avec `signal()`, dérivés avec `computed()`, effets avec `effect()`. Utiliser `untracked()` dans un `effect` pour lire un signal sans créer de dépendance.
- **`resource()`** : chargement asynchrone de données depuis l'API. Pattern standard :
  ```ts
  readonly detailRes = resource<TicketDetailDto | null, number | null>({
    params: () => this.ticketId(),      // signal réactif en paramètre
    loader: ({ params }) => firstValueFrom(this.api.getTicketDetail(params)),
  });
  // Recharger manuellement : this.detailRes.reload()
  // Accès : this.detailRes.value(), this.detailRes.isLoading(), this.detailRes.error()
  ```
- **Injection** : préférer `inject()` (style moderne) ou constructeur avec `private readonly`. Les deux coexistent dans le projet.
- **Pas de subscriptions RxJS dans les composants** : convertir avec `firstValueFrom()` pour les appels one-shot, ou `resource()` pour les données réactives.
- **Standalone components** : tous les composants déclarent `standalone: true` et listent leurs dépendances dans `imports: [...]`.
- **Lazy loading** : toutes les pages sont chargées via `loadComponent()` dans [app.routes.ts](front/timetracker-front/src/app/app.routes.ts).

### Database

SQLite with EF Core. Three entities:

- **Ticket** — Type (enum) + ExternalKey + Label + IsCompleted. Unique on `(Type, ExternalKey)`.
- **TimeEntry** — TicketId + Date (DateOnly) + QuantityMinutes. Unique on `(TicketId, Date)`.
- **AppSetting** — Key-value store for user preferences.

### Conventions de nommage backend

- **Controllers** : `{Feature}Controller.cs` — héritent de `ControllerBase`, route `[Route("api/{feature}")]`
- **Services** : `{Name}Service.cs` — enregistrés avec `AddSingleton` ou `AddScoped` dans `Program.cs`
- **DTOs** : suffixe `Dto`, organisés dans `Dtos/{Feature}/` (ex : `TicketDtos.cs`, `TicketDetailDto.cs`)
- **Codes d'erreur** : constantes `TT_SCREAMING_SNAKE_CASE` dans [Infrastructure/ApiErrorCode.cs](back/Tracker.Api/Infrastructure/ApiErrorCode.cs)

### Business Rules (enforced server-side)

- Time entries must be in 15-minute increments, max `MinutesPerDay` (default 480) per day.
- Daily total across all tickets cannot exceed `MinutesPerDay`.
- Completed tickets are read-only (no time entry changes, no delete).
- Cannot mark a ticket complete with zero time entries.
- Cannot delete a ticket that has time entries.
- Cannot create or update a ticket with type `ABSENT` (reserved for seed data).

### Configuration

`back/Tracker.Api/appsettings.json`:
- `ConnectionStrings.Main` — SQLite path (default: `tracker.db` in working directory; Docker mounts to `/data/tracker.db`)
- `TimeTracking.MinutesPerDay` — must be > 0 and divisible by 4

### Ajouter un code d'erreur

1. Ajouter la constante dans [Infrastructure/ApiErrorCode.cs](back/Tracker.Api/Infrastructure/ApiErrorCode.cs) — format `TT_SCREAMING_SNAKE_CASE`
2. Retourner l'erreur dans le controller : `return ApiProblems.BadRequest(this, ApiErrorCodes.MaNouvellErreur);`
3. Mapper le code vers une clé de traduction dans [core/api/api-error-messages.ts](front/timetracker-front/src/app/core/api/api-error-messages.ts)
4. Ajouter le message traduit dans `public/i18n/fr.json` et `public/i18n/en.json`

### Patterns de test

**Frontend (Vitest + TestBed) :**
- Fournir un mock de `TrackerApi` via `{ provide: TrackerApi, useValue: apiMock }` — les méthodes retournent des `Observable` avec `of(...)`
- Appeler `fixture.detectChanges()` puis `await fixture.whenStable()` puis `fixture.detectChanges()` à nouveau pour laisser les `resource()` se résoudre
- Asserter sur `fixture.nativeElement` (DOM) ou les instances de signal/computed

**Backend (xUnit) :**
- Créer une base SQLite en mémoire isolée par test : `var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();`
- Fermer la connexion dans le `Dispose` / `finally` pour libérer la mémoire
- Tests d'API end-to-end via `TrackerApiFactory` (WebApplicationFactory) avec `"Testing"` comme environment (désactive auto-migration et seed)
- Les classes de test qui utilisent `IClassFixture<TrackerApiFactory>` doivent aussi implémenter `IAsyncLifetime` et appeler `_factory.ResetDbAsync()` dans `InitializeAsync()` pour isoler chaque test

### i18n

Translation files live in `front/timetracker-front/public/i18n/` (`en.json`, `fr.json`). Error code messages are mapped in [core/api/api-error-messages.ts](front/timetracker-front/src/app/core/api/api-error-messages.ts) — update both when adding new `TT_*` error codes.

### External Integration

French public holidays are fetched from the gouvernement API and cached 24h server-side. The frontend calls `/api/public-holidays` (proxied by the backend) — never the external URL directly.
