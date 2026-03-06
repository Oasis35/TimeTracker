# TimeTracker Frontend

This folder contains the Angular frontend for TimeTracker.

It provides the main timesheet UI (day and month views), a ticket management grid, bilingual labels (`fr` / `en`), and a shared client for the backend API.

## Contents

- `src/`: application source
- `public/`: static assets and translation files
- `proxy.conf.json`: local API proxy for development
- `angular.json`: Angular CLI workspace configuration
- `package.json`: scripts and dependencies

## Tech Stack

- Angular 21
- Angular Material
- RxJS
- `@ngx-translate/core`
- TypeScript 5.9
- Vitest (via Angular unit-test builder)

## Project Layout

- `src/main.ts`: Angular bootstrap entrypoint
- `src/app/app.ts`: root shell component
- `src/app/app.routes.ts`: router configuration
- `src/app/app.config.ts`: providers (router, HTTP, translation loader)
- `src/app/core/api/`: backend API client, DTOs and API error mapping
- `src/app/core/i18n/`: language types and translation key definitions
- `src/app/core/services/unit.service.ts`: global day/hour display mode state
- `src/app/features/timesheet/`: day and month timesheet pages
- `src/app/features/tickets-grid/`: ticket management grid
- `src/app/features/settings/`: settings dialog (language and unit mode)
- `src/app/features/tickets/shared/add-ticket-dialog/`: shared ticket creation dialog
- `public/i18n/fr.json`: French UI strings
- `public/i18n/en.json`: English UI strings

## Prerequisites

- Node.js compatible with Angular 21
- npm `11.x` (the lockfile and `packageManager` currently target `npm@11.5.2`)
- The backend API running locally for most app flows

## Install

From `front/timetracker-front`:

```bash
npm install
```

## Scripts

Available npm scripts:

- `npm start`: starts Angular dev server with `proxy.conf.json`
- `npm run build`: production build
- `npm run watch`: development build in watch mode
- `npm test`: unit tests in watch mode
- `npm run test:ci`: unit tests once, without watch

## Local Development

Start the frontend:

```bash
npm start
```

By default, Angular serves the app on:

- `http://localhost:4200`

The application expects the backend API under `/api`, and the dev server proxies that path using [proxy.conf.json](c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json):

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
}
```

Practical impact:

- local frontend requests to `/api/...` are forwarded to `http://localhost:8080`
- this aligns with the backend Docker setup
- if the backend runs elsewhere, update `proxy.conf.json`

## Build

Create a production build:

```bash
npm run build
```

Relevant Angular build settings:

- builder: `@angular/build:application`
- default build configuration: `production`
- production `initial` bundle warning threshold: `500kB`
- production `initial` bundle error threshold: `1MB`
- production per-component-style warning threshold: `6kB`
- production per-component-style error threshold: `10kB`

Development build configuration disables optimization and keeps source maps enabled.

## Testing

Run unit tests:

```bash
npm test
```

CI-style single run:

```bash
npm run test:ci
```

The project uses the Angular unit-test builder and includes spec files for:

- root app component
- API error message mapping
- unit-mode service
- day timesheet page
- month timesheet page
- tickets grid page

## Application Shell

The root app component in [app.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.ts) provides:

- a top toolbar
- direct navigation links to `/day`, `/month` and `/tickets-grid`
- a settings button that opens the settings dialog
- a router outlet for page content

Global UI state exposed at the shell level:

- current language
- current display unit (`day` or `hour`)

The unit selection is shared across pages through `UnitService`, so switching units affects all views that format durations.
Language and unit are changed from the settings dialog, opened from the toolbar button.

## Routing

Routes are defined in [app.routes.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.routes.ts):

- `/day`: day timesheet page
- `/month`: month timesheet page
- `/tickets-grid`: tickets management grid
- `/`: redirects to `/day`
- unknown routes: redirect to `/day`

The app uses lazy `loadComponent()` routes for each page.

## Internationalization

Translation is configured in [app.config.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.config.ts):

- default language: `fr`
- fallback language: `fr`
- translation files loaded from `./i18n/*.json`

Supported languages in the UI:

- French
- English

Translation files live in:

- [fr.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/fr.json)
- [en.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/en.json)

The source of expected translation keys is tracked in [translations.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/i18n/translations.ts).

Developer note:

- if you add a new translatable UI string, update both translation JSON files and keep the key list in `translations.ts` in sync

## API Integration

The shared HTTP client is implemented in [tracker-api.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/tracker-api.ts).

### Backend Calls

The frontend currently calls:

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

The shared API client also exposes:

- `GET /api/tickets/lookup?q=...&take=...` for external-key lookup (available in `TrackerApi`, ready for UI autocomplete flows)

### External Calls

The month page also calls a public external service:

- `GET https://calendrier.api.gouv.fr/jours-feries/metropole.json`

Usage notes:

- this is used to mark French public holidays in the month view
- failures are swallowed on the month page and treated as an empty holiday list
- this request is not proxied through the Angular dev proxy because it is a direct absolute URL

## Shared Models

Frontend DTOs are declared in [models.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/models.ts).

Key contracts include:

- `TicketDto`
- `TicketTotalDto`
- `CreateTicketDto`
- `TimesheetMetadataDto`
- `TimesheetMonthDto`
- `TimesheetRowDto`
- `UpsertTimeEntryDto`

These mirror the backend API closely and should be kept aligned with the backend DTOs.

## Error Handling

Backend error codes are mapped to translation keys through:

- [api-error-messages.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/api-error-messages.ts)

Behavior:

- business-rule and validation errors from the backend are turned into translated user-facing messages
- each page catches request failures and displays an appropriate translated error
- unknown failures fall back to generic messages such as `cannot_load_data`, `cannot_log_time`, `cannot_create_ticket`, `cannot_update_ticket`, or `cannot_delete_ticket`

## Global State and Formatting

### Unit Mode

[unit.service.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/services/unit.service.ts) stores a single global signal:

- `day`
- `hour`

Pages read this signal to switch duration formatting and quick-pick options.

### Number Formatting

Several views format numbers with the same UI convention:

- 2 decimals max
- comma decimal separator
- trailing zeros trimmed when possible

Examples:

- `12.00` becomes `12`
- `12.50` becomes `12,5`
- `12.34` becomes `12,34`

This is used notably in the month page and tickets grid for user-facing time values.

## Feature Overview

### Day Timesheet Page

Main implementation:

- [timesheet-day-page.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/timesheet/timesheet-day-page/timesheet-day-page.ts)

Purpose:

- log time for a selected workday
- show month-level context while focusing on one selected date
- create tickets directly from the day workflow

Key behavior:

- defaults to the current month/year
- tracks a selected day as ISO date (`YYYY-MM-DD`)
- auto-selects a default workday when data loads
- skips weekends when navigating previous/next workday
- supports date picking with weekends blocked
- loads metadata, month data, used tickets and ticket totals in parallel via Angular `resource()`
- lets the user create tickets through the shared add-ticket dialog
- writes time using `POST /api/timeentries/upsert`
- reloads relevant resources after successful writes

Display behavior:

- quick-pick values come from backend metadata
- in `hour` mode, labels use `allowedMinutesHourMode`
- in `day` mode, labels use `allowedMinutesDayMode`
- formatted labels use comma decimals and append `h` or `j`

Ticket filtering nuance:

- the page shows tickets used in the selected month
- completed tickets remain visible only if they already have time logged on the selected day

Route query support:

- `?date=YYYY-MM-DD` preselects a specific day

## Month Timesheet Page

Main implementation:

- [timesheet-month-page.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/timesheet/timesheet-month-page/timesheet-month-page.ts)

Purpose:

- show a month-wide matrix of tickets vs. days
- display totals by row and month
- visually identify weekends and French public holidays

Key behavior:

- defaults to the current month
- loads metadata, month data, used tickets and public holidays
- catches public holiday API failures and falls back to no holiday labels
- merges `used tickets` with monthly rows so tickets with no row data still render
- computes totals per row on the client
- supports previous month, next month and return-to-current-month navigation
- supports month selection through Material datepicker

Display behavior:

- uses sticky table layout logic
- measures the type header width with `ResizeObserver` to keep sticky offsets aligned
- formats values in day or hour mode using the shared unit state
- weekends and holidays are visually distinguished

Route query support:

- `?year=YYYY&month=M` preselects a specific month
- invalid or out-of-range query params are ignored

## Tickets Grid Page

Main implementation:

- [tickets-grid-page.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/tickets-grid/tickets-grid-page/tickets-grid-page.ts)

Purpose:

- list all manageable tickets
- show cumulative logged time per ticket
- create, edit, delete and mark tickets completed/open

Key behavior:

- loads all tickets, ticket totals and metadata
- uses `MatTableDataSource` with Material sort and paginator
- customizes paginator labels through a translated `MatPaginatorIntl`
- supports inline edit for `type`, `externalKey` and `label`
- supports ticket creation through the shared add-ticket dialog
- supports completion toggling and deletion with backend-driven business rules
- reloads data after successful mutations

Filtering behavior:

- free-text filter matches against `externalKey`, `type`, `label` and `totalMinutes`
- text is normalized before matching
- filtering is case-insensitive
- filtering is accent-insensitive
- leading and trailing spaces are ignored
- completion status filter supports `open`, `completed` and `all`

Formatting behavior:

- logged time is shown in `hour` or `day` mode
- values use comma decimals
- trailing zeros are removed

Examples:

- `12.00` becomes `12`
- `12.50` becomes `12,5`
- `12.34` becomes `12,34`

Important backend-aligned constraints surfaced in the UI:

- completed tickets may fail to update or delete
- marking a ticket completed may fail if the ticket has no time entries
- deleting a ticket may fail if the ticket already has time entries

## Shared Ticket Creation Dialog

Main files:

- [add-ticket-dialog.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/features/tickets/shared/add-ticket-dialog/add-ticket-dialog.ts)
- [add-ticket-dialog.html](c:/Git/TimeTracker/front/timetracker-front/src/app/features/tickets/shared/add-ticket-dialog/add-ticket-dialog.html)

Purpose:

- allow ticket creation from multiple entry points

Current callers:

- day timesheet page
- tickets grid page

The dialog centralizes creation flow and lets parent pages refresh their data only when a ticket was actually created.

## Backend Expectations

For the frontend to work correctly, the backend should:

- be reachable at `http://localhost:8080` during normal local dev, or the proxy target must be changed
- allow CORS from `http://localhost:4200` if the proxy is bypassed
- expose all `/api/...` routes used by `TrackerApi`
- return backend error codes expected by `api-error-messages.ts`

Functional dependency notes:

- the frontend relies on `timesheet/metadata` for allowed increments and default timing semantics
- the day and month pages rely on `tickets/used` to determine which tickets should appear for a month
- the tickets grid uses `tickets` rather than metadata, so it follows backend behavior that excludes `CONGES`

## Assets and Styling

Static assets are served from `public/`.

Global styles live in:

- [styles.scss](c:/Git/TimeTracker/front/timetracker-front/src/styles.scss)

Feature-level styling is colocated next to each component in `*.scss` files.

## Common Developer Tasks

### Start Dev Server

```bash
npm start
```

### Run Production Build

```bash
npm run build
```

### Run Tests Once

```bash
npm run test:ci
```

### Change Backend Proxy Target

Edit:

- [proxy.conf.json](c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json)

### Add a New Route

Update:

- [app.routes.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/app.routes.ts)

### Add a New Translation

Update all of:

- [fr.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/fr.json)
- [en.json](c:/Git/TimeTracker/front/timetracker-front/public/i18n/en.json)
- [translations.ts](c:/Git/TimeTracker/front/timetracker-front/src/app/core/i18n/translations.ts)

## Implementation Notes and Gotchas

- The root nav surfaces `/day`, `/month`, and `/tickets-grid` directly in `app.html`; language and unit toggles are handled in the settings dialog.
- `UnitService` is in-memory only. Reloading the page resets the unit to `day`.
- Language selection is also not persisted beyond the current session and defaults to `fr`.
- The month page depends on an external French public holiday API. If that service is unavailable, the page still works but without holiday labels.
- The frontend uses Angular signals and `resource()` heavily. When changing data flows, keep the reload semantics explicit after mutations.
- The day page and tickets grid both depend on backend metadata for day/hour conversions; if backend `HoursPerDay` changes, displayed day values change automatically.
- The tickets grid text filter normalizes accents and casing before matching, which is easy to accidentally break if filtering logic is refactored.
