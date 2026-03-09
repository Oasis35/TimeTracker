# TimeTracker Backend

This folder contains the .NET backend for TimeTracker.

It exposes an ASP.NET Core Web API backed by SQLite and Entity Framework Core, plus an xUnit test project that exercises the HTTP endpoints and core time-entry rules.

## Contents

- `Tracker.Api/`: main Web API project
- `Tracker.Api.Tests/`: integration and rule tests
- `docker-compose.yml`: local container orchestration for the API with a persisted SQLite database

## Tech Stack

- .NET 10 (`net10.0`)
- ASP.NET Core Web API
- Entity Framework Core 10
- SQLite
- xUnit
- Docker (optional)

## Project Layout

- `Tracker.Api/Program.cs`: service registration, middleware, startup behavior, auto-migration, development seed
- `Tracker.Api/Controllers/`: API endpoints
- `Tracker.Api/Data/TrackerDbContext.cs`: EF Core model and indexes
- `Tracker.Api/Data/DbSeeder.cs`: development-only seed data
- `Tracker.Api/Models/`: persistence entities (`Ticket`, `TimeEntry`)
- `Tracker.Api/Dtos/`: request and response contracts
- `Tracker.Api/Services/TimeEntryRules.cs`: validation rules for time entry upserts
- `Tracker.Api/Migrations/`: EF Core migrations
- `Tracker.Api.Tests/Testing/`: API and rule test coverage

## Prerequisites

- .NET SDK 10.x
- Optional: Docker Desktop (for containerized runs)

## Local Development

Run the API from the repository root:

```bash
dotnet run --project back/Tracker.Api/Tracker.Api.csproj
```

Default development URLs from `launchSettings.json`:

- HTTP: `http://localhost:5021`
- HTTPS: `https://localhost:7227`

Important runtime behavior in `Development`:

- EF Core migrations are applied automatically on startup.
- If no migrations exist, the database is created directly.
- Development seed data is inserted automatically.
- OpenAPI is exposed.
- HTTPS redirection is enabled.

Important runtime behavior outside `Development`:

- Migrations still run automatically on startup.
- No development seed data is inserted.
- OpenAPI is not mapped.
- HTTPS redirection is not forced by the app itself.

## Database

The API uses SQLite with this default connection string:

```json
"ConnectionStrings": {
  "Main": "Data Source=tracker.db"
}
```

That creates `tracker.db` in the current working directory of the running process unless overridden.

### Schema Notes

- `Ticket`
  - `Id`
  - `Type`
  - `ExternalKey` (nullable)
  - `Label` (nullable)
  - `IsCompleted`
- `TimeEntry`
  - `Id`
  - `TicketId` (nullable in the model, but API flows use a ticket)
  - `Date`
  - `QuantityMinutes`
  - `Comment`

### EF Core Constraints

- Unique index on `(Ticket.Type, Ticket.ExternalKey)`
- Unique index on `(TimeEntry.TicketId, TimeEntry.Date)`
- `DateOnly` is stored as `yyyy-MM-dd` text
- `QuantityMinutes` is stored as `INTEGER`

## Configuration

### `TimeTracking`

`appsettings.json` currently defines:

```json
"TimeTracking": {
  "HoursPerDay": 8
}
```

The API derives:

- `MinutesPerDay = HoursPerDay * 60`

This configuration directly affects:

- validation of time entry quantities
- timesheet metadata
- day/week/month aggregation payloads
- development seed generation

### Valid Configuration Requirements

- `HoursPerDay` must be greater than `0`
- `MinutesPerDay` must be divisible by `4`

If those rules are broken, `GET /api/timesheet/metadata` returns a `400` with:

- `TT_CONFIG_HOURS_PER_DAY_INVALID`
- or `TT_CONFIG_MINUTES_PER_DAY_INVALID`

## CORS

The API currently enables a single CORS policy named `AngularDev` that allows:

- origin `http://localhost:4200`
- any header
- any method

If the frontend runs on another port or domain, this policy must be updated.

## OpenAPI

In `Development`, the app calls `AddOpenApi()` and `MapOpenApi()`.

That means the OpenAPI document is available during development only. The default route is expected to be:

- `GET /openapi/v1.json`

## Development Seed Data

On startup in `Development`, the app seeds:

- a set of `DEV` tickets
- a set of `ABSENT` tickets
- one year of historical time entries for business days
- predefined leave periods (`CP-HIVER`, `CP-PRINTEMPS`, `CP-ETE`, `CP-TOUSSAINT`, `CP-NOEL`, `RTT-PONTS`)

Seed behavior details:

- it is intended to be idempotent
- it uses the marker comment `__DEV_SEED_V2__`
- it skips weekends
- it does not create future-dated entries
- leave periods replace seeded `DEV` entries on the same dates

One important API nuance:

- `GET /api/tickets` explicitly excludes tickets where `Type == "ABSENT"`

So seeded leave tickets exist in the database and are included in metadata, but they are filtered out from the main tickets list endpoint.

## API Overview

All endpoints are rooted under `/api`.

### Tickets

#### `GET /api/tickets`

Returns all tickets except `ABSENT`, ordered by `Type` then `ExternalKey`.

Response item shape:

```json
{
  "id": 1,
  "type": "DEV",
  "externalKey": "65010",
  "label": "Refonte auth API",
  "isCompleted": false
}
```

#### `GET /api/tickets/lookup?q=6501&take=10`

Returns open tickets that match a partial external key.

Behavior:

- excludes completed tickets
- excludes tickets where `Type == "ABSENT"`
- only searches tickets where `ExternalKey` is not null
- ranks exact matches first, then prefix matches, then other partial matches

Query parameters:

- `q`: search string on `ExternalKey`
- `take`: requested number of rows (default `10`, clamped to `1..25`)

If `q` is missing or blank, the endpoint returns an empty array.

#### `GET /api/tickets/used?year=2026&month=2`

Returns distinct tickets used by time entries in the requested month.

Validation:

- `month` must be between `1` and `12`

Possible `400` code:

- `TT_MONTH_INVALID`

#### `POST /api/tickets`

Creates a ticket.

Request body:

```json
{
  "type": "DEV",
  "externalKey": "65042",
  "label": "New feature"
}
```

Rules:

- `type` is required
- if `externalKey` is provided, `label` is required
- if another ticket already exists with the same `(type, externalKey)`, the existing ticket is returned instead of creating a duplicate

Possible `400` codes:

- `TT_TICKET_TYPE_REQUIRED`
- `TT_TICKET_LABEL_REQUIRED`

Responses:

- `201 Created` for a new ticket
- `200 OK` if the ticket already exists and is returned as-is

#### `PUT /api/tickets/{ticketId}`

Updates a ticket using the same payload shape as creation.

Rules:

- `ticketId` must be positive
- ticket must exist
- completed tickets are locked and cannot be edited
- `type` is required
- if `externalKey` is provided, `label` is required
- `(type, externalKey)` must remain unique across other tickets

Possible `400` codes:

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_COMPLETED_LOCKED`
- `TT_TICKET_TYPE_REQUIRED`
- `TT_TICKET_LABEL_REQUIRED`
- `TT_TICKET_ALREADY_EXISTS`

#### `PATCH /api/tickets/{ticketId}/completion`

Sets completion status.

Request body:

```json
{
  "isCompleted": true
}
```

Rules:

- `ticketId` must be positive
- ticket must exist
- a ticket can only be marked completed if it already has at least one time entry

Possible `400` codes:

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_NO_TIME_ENTRIES`

#### `DELETE /api/tickets/{ticketId}`

Deletes a ticket.

Rules:

- `ticketId` must be positive
- ticket must exist
- completed tickets are locked and cannot be deleted
- tickets with time entries cannot be deleted

Possible `400` codes:

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_TICKET_COMPLETED_LOCKED`
- `TT_TICKET_HAS_TIME_ENTRIES`

Response:

- `204 No Content` on success

#### `GET /api/tickets/totals`

Returns total logged minutes per ticket across all time, or for a specific month.

Supported query modes:

- no query params: totals across all data
- `?year=2026&month=2`: totals for one month

Validation:

- `year` and `month` must be provided together
- `month` must be between `1` and `12`

Possible `400` codes:

- `TT_FILTER_YEAR_MONTH_REQUIRED`
- `TT_MONTH_INVALID`

Response item shape:

```json
{
  "ticketId": 1,
  "type": "DEV",
  "externalKey": "65010",
  "label": "Refonte auth API",
  "total": 480
}
```

### Time Entries

#### `GET /api/timeentries/day?date=2026-03-02`

Returns the logged time for one day, grouped by ticket.

Response shape:

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

Returns one Monday-based week view.

Behavior:

- the provided `start` date is normalized back to the Monday of that week
- the response always covers 7 consecutive days
- rows are grouped by ticket
- `totalsByDay` contains per-day totals

#### `POST /api/timeentries/upsert`

Creates, updates, or deletes a single ticket/day time entry.

Request body:

```json
{
  "ticketId": 1,
  "date": "2026-03-02",
  "quantityMinutes": 120,
  "comment": "Pairing session"
}
```

Behavior:

- if no row exists for `(ticketId, date)` and `quantityMinutes > 0`, a row is created
- if a row exists and `quantityMinutes > 0`, that row is updated
- if `quantityMinutes == 0`, the existing row is deleted
- if `quantityMinutes == 0` and no row exists, the endpoint still returns success
- `comment` is trimmed and stored as `null` when blank

Validation rules:

- `ticketId` must be positive
- ticket must exist
- `quantityMinutes` must be between `0` and `MinutesPerDay`
- `quantityMinutes` must be a multiple of `15`
- the resulting total for the day cannot exceed `MinutesPerDay`

Possible `400` codes:

- `TT_TICKET_ID_INVALID`
- `TT_TICKET_NOT_FOUND`
- `TT_MINUTES_OUT_OF_RANGE`
- `TT_STEP_15`
- `TT_OVERFLOW_DAY`

Responses:

- `201 Created` when a new row is inserted
- `204 No Content` when an existing row is updated
- `204 No Content` when a row is deleted
- `204 No Content` when `quantityMinutes == 0` and nothing exists yet

### Timesheet

#### `GET /api/timesheet?year=2026&month=3`

Returns the month grid used by the timesheet UI.

Behavior:

- `month` must be between `1` and `12`
- `days` includes every date in the month
- rows are grouped by ticket
- each row contains a complete `values` map for every day of the month, with missing days filled with `0`
- `ticketKey` is:
  - `Type` when `ExternalKey` is blank
  - `Type-ExternalKey` otherwise

Possible `400` codes:

- `TT_MONTH_INVALID`

#### `GET /api/timesheet/metadata`

Returns UI configuration and ticket lists used by the frontend.

Response includes:

- `hoursPerDay`
- `minutesPerDay`
- `allowedMinutesDayMode`
- `allowedMinutesHourMode`
- `defaultUnit` (currently `"day"`)
- `defaultType` (currently `"DEV"`)
- `tickets`

The current computed defaults are:

- `allowedMinutesDayMode`: `0`, `1/4 day`, `1/2 day`, `3/4 day`, `1 day`
- `allowedMinutesHourMode`: `0` to `MinutesPerDay` in `30` minute steps

Unlike `GET /api/tickets`, this endpoint includes all tickets from the database, including `ABSENT`.

## Error Format

Validation and business rule failures return:

```json
{
  "code": "TT_TICKET_NOT_FOUND"
}
```

Unhandled exceptions return:

- HTTP `500`
- the same shape with code `TT_UNKNOWN_ERROR`

## Testing

Run the backend tests from the repository root:

```bash
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj
```

The test project targets `net10.0` and references the API project directly.

Current test coverage files indicate checks for:

- ticket CRUD and ticket business rules
- timesheet month and metadata endpoints
- day and week time-entry views
- upsert behavior
- orphan and validation scenarios
- core `TimeEntryRules`

## Docker

Start the API with Docker Compose:

```bash
docker compose -f back/docker-compose.yml up --build
```

Current container setup:

- builds from `back/Tracker.Api/Dockerfile`
- exposes `8080` (HTTP) and `8081`
- sets `ASPNETCORE_URLS=http://+:8080`
- overrides the database path with `ConnectionStrings__Main=Data Source=/data/tracker.db`
- persists SQLite data in the named volume `tracker-data`

Practical result:

- the API is reachable on `http://localhost:8080`
- the SQLite file is stored in the Docker volume, not in the container layer

## Common Developer Tasks

### Build

```bash
dotnet build back/Tracker.Api/Tracker.Api.csproj
```

### Run Tests

```bash
dotnet test back/Tracker.Api.Tests/Tracker.Api.Tests.csproj
```

### Add a Migration

Run this from the API project directory or provide the project path explicitly:

```bash
dotnet ef migrations add <MigrationName> --project back/Tracker.Api/Tracker.Api.csproj
```

### Apply Migrations Manually

This is usually not required locally because startup applies them automatically, but the command is:

```bash
dotnet ef database update --project back/Tracker.Api/Tracker.Api.csproj
```

## Implementation Notes and Gotchas

- Ticket completion is a business lock for editing and deletion, not just a UI flag.
- A ticket cannot be marked completed until it has at least one time entry.
- `POST /api/tickets` is intentionally idempotent only when `(type, externalKey)` already exists and `externalKey` is present.
- `GET /api/tickets` and `GET /api/timesheet/metadata` do not return the same ticket set because the first excludes `ABSENT` and the second does not.
- Time-entry writes are constrained by `HoursPerDay`; changing that value changes API validation behavior immediately.
- The API auto-migrates on startup. That is convenient locally, but it also means startup can fail if a migration is broken or the database is not writable.
