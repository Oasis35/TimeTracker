# TimeTracker

Personal full-stack time tracking app with:

- `back/`: .NET 10 Web API backed by SQLite + EF Core
- `front/timetracker-front/`: Angular 21 frontend

## Documentation

- Backend: [back/README.md](back/README.md)
- Frontend: [front/timetracker-front/README.md](front/timetracker-front/README.md)
- Docker (backend only): [README.docker.md](README.docker.md)
- Docker (production single image): [README.docker.prod.fr.md](README.docker.prod.fr.md)
- Francais:
  - Main guide: [README.fr.md](README.fr.md)
  - Backend: [back/README.fr.md](back/README.fr.md)
  - Frontend: [front/timetracker-front/README.fr.md](front/timetracker-front/README.fr.md)
  - Docker: [README.docker.fr.md](README.docker.fr.md)

## Quick Start

### Recommended local setup

This is the simplest path because the Angular proxy already targets `http://localhost:8080`.

1. Start the backend in Docker:
   - `docker compose -f back/docker-compose.yml up --build`
2. Start the frontend:
   - `cd front/timetracker-front`
   - `npm install`
   - `npm start`

URLs:

- App: `http://localhost:4200`
- API: `http://localhost:8080`

### Run the backend directly with `dotnet run`

You can also run the API without Docker:

- `dotnet run --project back/Tracker.Api/Tracker.Api.csproj`

Default development URLs then come from `launchSettings.json`:

- HTTP: `http://localhost:5021`
- HTTPS: `https://localhost:7227`

If you use this mode with the Angular dev server, update [proxy.conf.json](front/timetracker-front/proxy.conf.json) or start the frontend against the matching API URL.
