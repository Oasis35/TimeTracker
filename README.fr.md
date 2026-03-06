# TimeTracker

Application de suivi du temps avec:

- `back/`: API .NET 10 (SQLite + EF Core)
- `front/timetracker-front/`: frontend Angular 21

## Documentation

- Francais:
  - Backend: [back/README.fr.md](back/README.fr.md)
  - Frontend: [front/timetracker-front/README.fr.md](front/timetracker-front/README.fr.md)
  - Docker (backend): [README.docker.fr.md](README.docker.fr.md)
- English:
  - Main guide: [README.md](README.md)
  - Backend: [back/README.md](back/README.md)
  - Frontend: [front/timetracker-front/README.md](front/timetracker-front/README.md)
  - Docker (backend): [README.docker.md](README.docker.md)

## Demarrage Rapide

1. Demarrer le backend:
   - Local: `dotnet run --project back/Tracker.Api/Tracker.Api.csproj`
   - Docker: `docker compose -f back/docker-compose.yml up --build`
2. Demarrer le frontend:
   - `cd front/timetracker-front`
   - `npm install`
   - `npm start`

URL app: `http://localhost:4200`
URL API (par defaut): `http://localhost:8080`

