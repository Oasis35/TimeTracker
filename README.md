# TimeTracker

Full-stack time tracking app with:

- `back/`: .NET 10 Web API (SQLite + EF Core)
- `front/timetracker-front/`: Angular 21 frontend

## Documentation

- English:
  - Backend: [back/README.md](back/README.md)
  - Frontend: [front/timetracker-front/README.md](front/timetracker-front/README.md)
  - Docker (backend): [README.docker.md](README.docker.md)
- Francais:
  - Guide principal: [README.fr.md](README.fr.md)
  - Backend: [back/README.fr.md](back/README.fr.md)
  - Frontend: [front/timetracker-front/README.fr.md](front/timetracker-front/README.fr.md)
  - Docker (backend): [README.docker.fr.md](README.docker.fr.md)

## Quick Start

1. Start backend:
   - Local: `dotnet run --project back/Tracker.Api/Tracker.Api.csproj`
   - Docker: `docker compose -f back/docker-compose.yml up --build`
2. Start frontend:
   - `cd front/timetracker-front`
   - `npm install`
   - `npm start`

App URL: `http://localhost:4200`
API URL (default): `http://localhost:8080`

