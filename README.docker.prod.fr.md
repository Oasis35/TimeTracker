# Stack Docker prod mon-image

Cette stack fournit la solution complete en mode production dans une seule image Docker :

- frontend Angular compile puis embarque dans le backend ASP.NET Core
- API backend ASP.NET Core
- base SQLite persistante dans un volume Docker

Le backend est force en `Production`, donc le seed de developpement n'est pas applique.

## Fichiers

- `docker-compose.prod.yml`
- `Dockerfile.prod`
- `scripts/docker/export-image.sh`
- `scripts/docker/import-and-redeploy.sh`
- `scripts/docker/export-image.ps1`
- `scripts/docker/import-and-redeploy.ps1`

## Build local de la stack prod

Depuis la racine du depot :

```powershell
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Application disponible sur :

- `http://localhost:8088`

La base SQLite est stockee dans le volume Docker `tracker-data`.

## Export d'images pour un autre poste

PowerShell :

```powershell
.\scripts\docker\export-image.ps1
```

Bash :

```bash
bash scripts/docker/export-image.sh
```

Cela genere par defaut :

- `timetracker-app-prod.tar`

## Import sur l'autre poste

Copier au minimum :

- `docker-compose.prod.yml`
- `timetracker-app-prod.tar`

Si vous prenez le depot complet, c'est suffisant aussi.

PowerShell :

```powershell
.\scripts\docker\import-and-redeploy.ps1
```

Bash :

```bash
bash scripts/docker/import-and-redeploy.sh
```

Ou manuellement :

```powershell
docker image load -i .\timetracker-app-prod.tar
docker compose -f docker-compose.prod.yml up -d --no-build
```

## Notes

- L'archive d'image est portable entre postes Docker de meme architecture cible.
- Le premier build a besoin d'acces aux images de base Docker et aux packages npm si non caches.
- `docker compose down` conserve la base.
- `docker compose down -v` supprime la base SQLite persistante.
