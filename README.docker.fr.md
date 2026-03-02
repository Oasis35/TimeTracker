# Guide Docker

Ce depot inclut actuellement un support Docker pour le backend uniquement.

Il n'existe pas encore de Dockerfile ni de stack Compose pour le frontend Angular.

## Fichiers Docker Presents Dans Le Depot

- [docker-compose.yml](c:/Git/TimeTracker/back/docker-compose.yml) : stack Compose pour l'API backend
- [Dockerfile](c:/Git/TimeTracker/back/Tracker.Api/Dockerfile) : build multi-stage de l'image .NET
- [.dockerignore](c:/Git/TimeTracker/back/Tracker.Api/.dockerignore) : exclusions du contexte de build pour l'image API

## Perimetre Actuel

Le setup Docker lance actuellement :

- l'API backend ASP.NET Core

Le setup Docker ne lance pas actuellement :

- le frontend Angular
- de reverse proxy
- de serveur de base de donnees separe

Le backend continue d'utiliser SQLite dans Docker, avec un fichier de base persiste dans un volume nomme.

## Demarrage Rapide

Depuis la racine du depot :

```bash
docker compose -f back/docker-compose.yml up --build
```

Pour lancer en mode detache :

```bash
docker compose -f back/docker-compose.yml up --build -d
```

Pour arreter la stack :

```bash
docker compose -f back/docker-compose.yml down
```

Pour arreter la stack et supprimer le volume nomme :

```bash
docker compose -f back/docker-compose.yml down -v
```

Attention :

- `down -v` supprime la base SQLite persistante stockee dans le volume Docker

## Configuration Compose

Le fichier Compose actuel definit un seul service :

- `trackerapi`

Comportement du service :

- build depuis `back/Tracker.Api`
- utilise le `Dockerfile` de ce dossier
- publie les ports `8080` et `8081`
- definit `ASPNETCORE_URLS=http://+:8080`
- surcharge la chaine de connexion avec `Data Source=/data/tracker.db`
- monte le volume nomme `tracker-data` sur `/data`

Volumes nommes :

- `tracker-data` : stocke le fichier SQLite

## Ports Exposes

Le fichier Compose mappe :

- `8080:8080`
- `8081:8081`

En pratique :

- l'API est censee etre joignable sur `http://localhost:8080`

Nuance importante :

- le conteneur expose `8081`, mais la variable d'environnement ne lie Kestrel qu'a `http://+:8080`
- sauf changement de configuration runtime, `8081` est expose au niveau reseau mais n'est pas utilise activement par l'application

## Persistance De La Base

Dans Docker, la chaine de connexion backend est surchargee en :

```text
Data Source=/data/tracker.db
```

Ce fichier vit dans le volume monte :

- chemin dans le conteneur : `/data/tracker.db`
- volume associe : `tracker-data`

Cela implique :

- recreer le conteneur ne supprime pas la base par defaut
- `docker compose down` conserve les donnees
- `docker compose down -v` supprime les donnees

## Details Du Build D'image

L'image backend utilise un Dockerfile multi-stage :

1. `base`
2. `build`
3. `publish`
4. `final`

### Etape `base`

- image : `mcr.microsoft.com/dotnet/aspnet:10.0`
- repertoire de travail : `/app`
- expose `8080` et `8081`

### Etape `build`

- image : `mcr.microsoft.com/dotnet/sdk:10.0`
- restaure les dependances depuis `Tracker.Api.csproj`
- copie l'ensemble du projet
- execute `dotnet build`

Argument de build :

- `BUILD_CONFIGURATION` (par defaut : `Release`)

### Etape `publish`

- execute `dotnet publish`
- ecrit dans `/app/publish`
- utilise `/p:UseAppHost=false`

### Etape `final`

- repart de l'image `base`
- copie le resultat publie depuis l'etape `publish`
- execute `dotnet Tracker.Api.dll`

## Contexte De Build Et `.dockerignore`

Le build Docker de l'API utilise `back/Tracker.Api` comme contexte.

Le `.dockerignore` exclut notamment :

- `.git`
- `.vs`
- `.vscode`
- `bin`
- `obj`
- `node_modules`
- les fichiers Compose locaux
- les Dockerfiles locaux

Detail notable actuellement :

- `README.md` est exclu du contexte de build

Ce n'est pas un probleme pour l'image actuelle, car le conteneur n'a pas besoin des fichiers de documentation a l'execution.

## Commandes Courantes

### Rebuild Et Demarrage

```bash
docker compose -f back/docker-compose.yml up --build
```

### Demarrer Sans Rebuild

```bash
docker compose -f back/docker-compose.yml up
```

### Lancer En Arriere-plan

```bash
docker compose -f back/docker-compose.yml up -d
```

### Voir Les Conteneurs En Cours

```bash
docker compose -f back/docker-compose.yml ps
```

### Consulter Les Logs

```bash
docker compose -f back/docker-compose.yml logs -f
```

### Arreter Les Conteneurs

```bash
docker compose -f back/docker-compose.yml down
```

### Supprimer Les Conteneurs Et Le Volume

```bash
docker compose -f back/docker-compose.yml down -v
```

## Comment Le Frontend S'integre

Le serveur de dev frontend n'est pas conteneurise dans ce depot.

Flux de dev local actuel :

1. Lancer le backend dans Docker sur `http://localhost:8080`
2. Lancer le frontend localement avec `npm start`
3. Laisser Angular proxifier les appels `/api` vers `http://localhost:8080`

Cela correspond a la configuration du frontend dans :

- [proxy.conf.json](c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json)

## Notes D'exploitation

- Le backend applique automatiquement les migrations EF Core au demarrage, y compris dans Docker.
- Hors environnement `Development`, le backend n'expose pas OpenAPI.
- Le backend ne force pas HTTPS dans Docker par defaut.
- Si le conteneur ne peut pas ecrire dans `/data`, le demarrage peut echouer car SQLite et les migrations ont besoin d'un acces en ecriture.

## Limitations Actuelles

- Pas d'image frontend
- Pas de fichier Compose racine unifiant front + back
- Pas de reverse proxy ni de terminaison TLS
- Pas de healthcheck dans le fichier Compose
- Le port `8081` est publie mais n'est pas clairement utilise par la configuration runtime actuelle

## Evolutions Possibles

- Ajouter un Dockerfile frontend pour un deploiement statique ou des workflows de dev conteneurises
- Ajouter un fichier Compose racine pour `front + back`
- Supprimer le port `8081` s'il n'est pas necessaire
- Ajouter un healthcheck pour le service backend
- Ajouter des surcharges Compose par environnement si des executions conteneurisees de staging/production sont prevues

