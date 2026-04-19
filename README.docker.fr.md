# Guide Docker

Ce guide couvre la stack Docker backend uniquement (mode dev).

Pour la stack production complete (frontend + backend dans une seule image), voir :

- [README.docker.prod.fr.md](README.docker.prod.fr.md)

Ce guide prod documente aussi :

- l'export de l'image en `.tar`
- l'import sur un autre poste
- le redemarrage via `docker compose`

## Fichiers Docker

- [back/docker-compose.yml](back/docker-compose.yml)
- [back/Tracker.Api/Dockerfile](back/Tracker.Api/Dockerfile)
- [back/Tracker.Api/.dockerignore](back/Tracker.Api/.dockerignore)

## Demarrage rapide

Depuis la racine du depot :

```bash
docker compose -f back/docker-compose.yml up --build
```

Mode detache :

```bash
docker compose -f back/docker-compose.yml up --build -d
```

Arret :

```bash
docker compose -f back/docker-compose.yml down
```

Arret avec suppression du volume persiste :

```bash
docker compose -f back/docker-compose.yml down -v
```

`down -v` supprime les donnees SQLite persistantes.

## Perimetre actuel

La stack Docker lance actuellement :

- l'API backend ASP.NET Core

Elle ne lance pas :

- le frontend Angular
- un reverse proxy
- un serveur de base separe

## Configuration runtime

Le fichier compose definit un seul service :

- `trackerapi`

Comportement actuel :

- build depuis `back/Tracker.Api`
- bind des ports `8080:8080` et `8081:8081`
- `ASPNETCORE_URLS=http://+:8080`
- surcharge SQLite vers `Data Source=/data/tracker.db`
- montage du volume nomme `tracker-data` sur `/data`

En pratique :

- l'API est joignable sur `http://localhost:8080`
- la base SQLite vit sous `/data/tracker.db`
- les sauvegardes maintenance creees par `/api/backup/restore` sont stockees sous `/data/backups`

Note sur le port `8081` :

- il est publie par Docker
- le binding runtime actuel n'utilise que `http://+:8080`
- sauf changement de config, `8081` est expose mais pas reellement utilise par l'application

## Persistance

Les donnees SQLite sont stockees dans le volume nomme :

- volume : `tracker-data`
- fichier base : `/data/tracker.db`
- dossier de sauvegarde : `/data/backups`

Cela signifie :

- recreer le conteneur ne supprime pas les donnees
- `docker compose down` conserve les donnees
- `docker compose down -v` les supprime

## Flux de dev local avec le frontend

Flux recommande :

1. Lancer le backend dans Docker sur `http://localhost:8080`
2. Lancer le frontend localement avec `npm start`
3. Laisser Angular proxifier `/api` vers `http://localhost:8080`

Cela correspond a la configuration actuelle du proxy frontend dans [proxy.conf.json](front/timetracker-front/proxy.conf.json).

## Notes

- le backend applique automatiquement les migrations EF Core au demarrage, y compris dans Docker
- OpenAPI n'est pas expose hors `Development`
- l'application ne force pas HTTPS dans Docker par defaut
- le demarrage echoue si le conteneur ne peut pas ecrire dans `/data`

## Limitations actuelles

- pas de healthcheck dans le compose
- port `8081` publie mais effectivement inutilise
