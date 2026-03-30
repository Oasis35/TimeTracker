# TimeTracker Frontend

This folder contains the Angular frontend for TimeTracker.

It provides:

- a day timesheet page
- a month timesheet page
- a ticket management grid
- a ticket detail page
- a settings dialog with language, unit and maintenance actions

## Stack

- Angular 21
- Angular Material
- RxJS
- `@ngx-translate/core`
- TypeScript 5.9
- Vitest through the Angular unit-test builder

## Main Structure

- `src/app/app.ts`: root shell and settings dialog entrypoint
- `src/app/app.routes.ts`: app routes
- `src/app/core/api/`: shared backend client, DTOs and API error mapping
- `src/app/core/i18n/`: language types and translation keys
- `src/app/core/services/unit.service.ts`: persisted unit state
- `src/app/features/timesheet/`: day and month pages
- `src/app/features/tickets-grid/`: tickets grid
- `src/app/features/tickets/`: ticket detail page and shared ticket UI
- `src/app/features/settings/`: settings dialog
- `public/i18n/`: English and French translations

## Install

From `front/timetracker-front`:

```bash
npm install
```

## Scripts

- `npm start`
- `npm run build`
- `npm run watch`
- `npm test`
- `npm run test:ci`

## Local Development

Start the frontend:

```bash
npm start
```

Default URL:

- `http://localhost:4200`

The Angular dev server proxies `/api` through [proxy.conf.json](/c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json), which currently points to `http://localhost:8080`.

That matches the Docker backend setup. If you run the backend directly with `dotnet run`, adjust the proxy target.

## Application Shell

The root shell in [app.html](/c:/Git/TimeTracker/front/timetracker-front/src/app/app.html) currently provides:

- a top toolbar
- direct navigation to `/day`, `/month` and `/tickets-grid`
- a settings button
- a router outlet

The settings dialog currently includes:

- language switch (`fr` / `en`)
- display unit switch (`day` / `hour`)
- maintenance actions for backup export and backup restore

Persisted UI state:

- language is stored in `localStorage` under `tt.language`
- unit is stored in `localStorage` under `tt.unitMode`

## Routing

Routes defined in [app.routes.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/app.routes.ts):

- `/day`
- `/month`
- `/tickets-grid`
- `/ticket/:ticketId`
- `/404`
- `/` redirects to `/day`
- unknown routes redirect to `/404`

All feature pages are lazy-loaded with `loadComponent()`.

## API Integration

The shared API client lives in [tracker-api.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/tracker-api.ts).

Current backend calls:

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

External call:

- `GET https://calendrier.api.gouv.fr/jours-feries/metropole.json`

The month page uses this public French holiday API and falls back to an empty result on failure.

## Frontend Data Notes

- the frontend uses `minutesPerDay` from backend metadata
- there is no frontend dependency on `hoursPerDay`
- ticket lookup in the UI is now client-side, based on loaded ticket lists, not on a dedicated backend lookup endpoint

## Feature Summary

### Day Page

The day page:

- focuses on one workday
- loads metadata, month data, used tickets and ticket totals
- supports quick picks in day or hour mode
- creates tickets through the shared dialog — two actions: **Create** and **Create & log time** (opens the time entry dialog immediately after creation)
- copies the previous working day's tickets with 0 time via the copy button (skips weekends and French public holidays; shows a message if the previous working day has no entries)
- writes entries through `POST /api/timeentries/upsert`

### Month Page

The month page:

- shows a ticket x day matrix for one month
- highlights weekends and French public holidays
- supports month navigation and month picker
- computes row totals client-side
- creates tickets through the same shared dialog as the day page

### Tickets Grid

The tickets grid:

- lists manageable tickets
- shows total logged time per ticket
- supports create, inline edit, completion toggle and delete
- reflects backend business rules for completed tickets and tickets with time entries

### Ticket Detail Page

The ticket detail page:

- shows all entries for one ticket
- groups entries by month
- supports adding and editing entries for that ticket
- respects the completed-ticket lock

### Settings / Maintenance

The settings dialog maintenance section allows:

- exporting the SQLite database as a `.db` backup
- selecting a `.db` file for restore
- confirming a destructive restore
- receiving the generated safety backup filename after restore

## Internationalization

Translations are stored in:

- [public/i18n/fr.json](/c:/Git/TimeTracker/front/timetracker-front/public/i18n/fr.json)
- [public/i18n/en.json](/c:/Git/TimeTracker/front/timetracker-front/public/i18n/en.json)

Expected translation keys are tracked in [translations.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/core/i18n/translations.ts).

## Error Handling

Backend error codes are mapped in [api-error-messages.ts](/c:/Git/TimeTracker/front/timetracker-front/src/app/core/api/api-error-messages.ts).

The frontend currently handles translated messages for:

- ticket rules
- time entry validation
- configuration errors
- backup file validation and restore/export failures

## Testing

Run unit tests:

```bash
npm run test:ci
```

Recent targeted coverage includes:

- app shell
- settings dialog maintenance actions
- day and month pages
- tickets grid
- ticket detail page
- API error translation mapping

## Build

Create a production build:

```bash
npm run build
```

The current production initial bundle stays under the configured `1MB` error budget.
