# TimeTracker Backend

This folder contains the .NET backend for TimeTracker.

The API is built with ASP.NET Core, SQLite and EF Core. It manages tickets, time entry upserts, monthly timesheet data, UI metadata, database backup / restore for the maintenance section in the frontend settings dialog, and persistent application settings.

## Contents

- `Tracker.Api/`: main Web API project
- `Tracker.Api.Tests/`: xUnit test project
- `docker-compose.yml`: Docker compose stack for the API with persisted SQLite storage

## Stack

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core 10
- SQLite
- xUnit

## Local Development

Run from the repository root:

```bash
dotnet run --project back/Tracker.Api/Tracker.Api.csproj
```

Default development URLs from `launchSettings.json`:

- HTTP: `http://localhost:5021`
- HTTPS: `https://localhost:7227`

In `Development`:

- migrations are applied automatically on startup
- the database is created directly if needed
- development seed data is inserted
- OpenAPI is exposed

Outside `Development`:

- migrations still run automatically
- development seed data is skipped
- OpenAPI is not mapped

## Database

The API uses SQLite with this default connection string:

```json
{
  "ConnectionStrings": {
    "Main": "Data Source=tracker.db"
  }
}
```

By default, this creates `tracker.db` in the current working directory of the process.

Main entities:

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
  - `Key` (primary key, max 64 chars)
  - `Value` (max 512 chars)

Important EF Core constraints:

- unique index on `(Ticket.Type, Ticket.ExternalKey)`
- unique index on `(TimeEntry.TicketId, TimeEntry.Date)`
- `DateOnly` stored as `yyyy-MM-dd`
- `QuantityMinutes` stored as `INTEGER`

## Configuration

### `TimeTracking`

`appsettings.json` defines:

```json
{
  "TimeTracking": {
    "MinutesPerDay": 480
  }
}
```

`MinutesPerDay` is the source of truth for:

- time entry validation
- timesheet metadata
- month payloads
- development seed generation

Current validation:

- `MinutesPerDay` must be greater than `0`
- `MinutesPerDay` must be divisible by `4`

If the configuration is invalid, `GET /api/timesheet/metadata` returns `400` with:

- `TT_CONFIG_MINUTES_PER_DAY_INVALID`

## Seed Data

In `Development`, startup seeds:

- several `DEV` tickets
- several `ABSENT` tickets
- historical business-day time entries
- predefined leave tickets / periods

Seed specifics:

- idempotent behavior
- marker comment `__DEV_SEED_V2__`
- weekends skipped
- no future-dated entries

`GET /api/tickets` excludes `ABSENT`, but `GET /api/timesheet/metadata` includes those tickets.

## API Overview

All routes are rooted under `/api`.

### Tickets

- `GET /api/tickets`
  - returns all non-`ABSENT` tickets
- `GET /api/tickets/used?year=...&month=...`
  - returns distinct tickets used in a month
- `POST /api/tickets`
  - creates a ticket, or returns the existing one when `(type, externalKey)` already exists
- `PUT /api/tickets/{ticketId}`
  - updates a ticket
- `PATCH /api/tickets/{ticketId}/completion`
  - marks a ticket completed / open
- `DELETE /api/tickets/{ticketId}`
  - deletes a ticket if business rules allow it
- `GET /api/tickets/totals`
  - returns total logged minutes per ticket, optionally filtered by `year` + `month`
- `GET /api/tickets/{ticketId}/detail`
  - returns ticket details plus all time entries for that ticket

Important ticket rules:

- completed tickets are read-only for update and delete
- a ticket cannot be completed until it has at least one time entry
- deleting a ticket fails if time entries already exist

### Time Entries

- `POST /api/timeentries/upsert`
  - creates, updates or deletes a single `(ticket, date)` time entry

Current validation rules:

- `ticketId` must be positive
- ticket must exist
- ticket must not be completed
- `quantityMinutes` must be between `0` and `MinutesPerDay`
- `quantityMinutes` must use a 15-minute step
- the resulting total for the day must not exceed `MinutesPerDay`

Possible error codes include:

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_COMPLETED_LOCKED`
- `TT_MINUTES_OUT_OF_RANGE`
- `TT_STEP_15`
- `TT_OVERFLOW_DAY`

### Timesheet

- `GET /api/timesheet?year=...&month=...`
  - returns the monthly grid used by the frontend
- `GET /api/timesheet/metadata`
  - returns `minutesPerDay`, allowed quick-pick values, default unit / type, and the ticket list used by the frontend

Metadata currently contains:

- `minutesPerDay`
- `allowedMinutesDayMode`
- `allowedMinutesHourMode`
- `defaultUnit`
- `defaultType`
- `tickets`

There is no longer any `hoursPerDay` field in the API contract.

### Settings

- `GET /api/settings`
  - returns all settings as a flat `{ key: value }` dictionary
- `PUT /api/settings/{key}`
  - creates or updates a setting (upsert, atomic)
  - body: `{ "value": "..." }`
  - key max length: 64 chars
- `DELETE /api/settings/{key}`
  - removes a setting; returns `204` even if the key does not exist

Settings are used by the frontend to persist user preferences (language, unit mode, external link base URL) server-side instead of in localStorage.

### Backup

- `POST /api/backup/export`
  - exports a full copy of the current SQLite database as a `.db` file
- `POST /api/backup/restore`
  - restores a `.db` file uploaded as multipart form-data

Restore behavior:

- rejects missing or invalid files
- validates that the uploaded file is a usable SQLite backup
- creates a safety backup before overwrite
- stores safety backups next to the main SQLite file in a `backups/` directory

Backup-specific error codes:

- `TT_BACKUP_FILE_MISSING`
- `TT_BACKUP_FILE_INVALID`

## Error Format

Validation and business rule failures return:

```json
{
  "code": "TT_TICKET_NOT_FOUND"
}
```

Unhandled exceptions use the same shape with code `TT_UNKNOWN_ERROR`.

## Testing

Run backend tests from the repository root:

```bash
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj
```

The test project includes coverage for:

- ticket CRUD and business rules
- timesheet month and metadata endpoints
- time entry upsert validation
- backup export / restore service behavior
- shared rule logic in `TimeEntryRules`
- settings CRUD (upsert, idempotency, delete, validation)

## Docker

Run the API in Docker:

```bash
docker compose -f back/docker-compose.yml up --build
```

The compose stack:

- exposes the API on `http://localhost:8080`
- persists SQLite data in the `tracker-data` named volume
- stores the database at `/data/tracker.db`
- therefore stores maintenance backups under `/data/backups`

## Common Commands

Build:

```bash
dotnet build back/Tracker.Api/Tracker.Api.csproj
```

Add a migration:

```bash
dotnet ef migrations add <MigrationName> --project back/Tracker.Api/Tracker.Api.csproj
```

Apply migrations manually:

```bash
dotnet ef database update --project back/Tracker.Api/Tracker.Api.csproj
```
