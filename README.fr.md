# TimeTracker

Application perso de suivi du temps avec :

- `back/` : API .NET 10 basee sur SQLite + EF Core
- `front/timetracker-front/` : frontend Angular 21

## Documentation

- Backend : [back/README.fr.md](back/README.fr.md)
- Frontend : [front/timetracker-front/README.fr.md](front/timetracker-front/README.fr.md)
- Docker (backend uniquement) : [README.docker.fr.md](README.docker.fr.md)
- English :
  - Main guide: [README.md](README.md)
  - Backend: [back/README.md](back/README.md)
  - Frontend: [front/timetracker-front/README.md](front/timetracker-front/README.md)
  - Docker: [README.docker.md](README.docker.md)

## Demarrage rapide

### Setup local recommande

C'est le chemin le plus simple car le proxy Angular cible deja `http://localhost:8080`.

1. Demarrer le backend dans Docker :
   - `docker compose -f back/docker-compose.yml up --build`
2. Demarrer le frontend :
   - `cd front/timetracker-front`
   - `npm install`
   - `npm start`

URLs :

- App : `http://localhost:4200`
- API : `http://localhost:8080`

### Lancer le backend directement avec `dotnet run`

Tu peux aussi lancer l'API sans Docker :

- `dotnet run --project back/Tracker.Api/Tracker.Api.csproj`

Les URLs de dev par defaut viennent alors de `launchSettings.json` :

- HTTP : `http://localhost:5021`
- HTTPS : `https://localhost:7227`

Si tu utilises ce mode avec le frontend Angular, pense a ajuster [proxy.conf.json](/c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json) ou a faire pointer le frontend vers la bonne URL d'API.
