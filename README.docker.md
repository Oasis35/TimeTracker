# Docker Guide

This repository currently includes Docker support for the backend API only.

There is no Dockerfile or compose stack for the Angular frontend at this time.

## Docker Assets In The Repository

- [docker-compose.yml](c:/Git/TimeTracker/back/docker-compose.yml): compose stack for the backend API
- [Dockerfile](c:/Git/TimeTracker/back/Tracker.Api/Dockerfile): multi-stage image build for the .NET API
- [.dockerignore](c:/Git/TimeTracker/back/Tracker.Api/.dockerignore): build-context exclusions for the API image

## Current Scope

The Docker setup currently runs:

- the ASP.NET Core backend API

The Docker setup does not currently run:

- the Angular frontend
- a reverse proxy
- a separate database server

The backend keeps using SQLite in Docker, with the database file persisted in a named volume.

## Quick Start

From the repository root:

```bash
docker compose -f back/docker-compose.yml up --build
```

To run in detached mode:

```bash
docker compose -f back/docker-compose.yml up --build -d
```

To stop the stack:

```bash
docker compose -f back/docker-compose.yml down
```

To stop the stack and remove the named volume:

```bash
docker compose -f back/docker-compose.yml down -v
```

Warning:

- `down -v` deletes the persisted SQLite database stored in the Docker volume

## Compose Configuration

The current compose file defines one service:

- `trackerapi`

Service behavior:

- builds from `back/Tracker.Api`
- uses `Dockerfile` in that folder
- publishes ports `8080` and `8081`
- sets `ASPNETCORE_URLS=http://+:8080`
- overrides the connection string to `Data Source=/data/tracker.db`
- mounts the named volume `tracker-data` to `/data`

Named volumes:

- `tracker-data`: stores the SQLite database file

## Exposed Ports

The compose file maps:

- `8080:8080`
- `8081:8081`

Practical result:

- the API is expected to be reachable at `http://localhost:8080`

Important nuance:

- the container exposes `8081`, but the compose environment only binds Kestrel to `http://+:8080`
- unless the runtime configuration is changed, `8081` is exposed at the container/network level but not actively used by the app

## Database Persistence

In Docker, the backend connection string is overridden to:

```text
Data Source=/data/tracker.db
```

That file lives inside the mounted volume:

- container path: `/data/tracker.db`
- backing volume: `tracker-data`

This means:

- container recreation does not delete the DB by default
- `docker compose down` keeps the data
- `docker compose down -v` removes the data

## Image Build Details

The backend image uses a multi-stage Dockerfile:

1. `base`
2. `build`
3. `publish`
4. `final`

### `base` Stage

- image: `mcr.microsoft.com/dotnet/aspnet:10.0`
- working directory: `/app`
- exposes `8080` and `8081`

### `build` Stage

- image: `mcr.microsoft.com/dotnet/sdk:10.0`
- restores dependencies from `Tracker.Api.csproj`
- copies the full project
- runs `dotnet build`

Build argument:

- `BUILD_CONFIGURATION` (default: `Release`)

### `publish` Stage

- runs `dotnet publish`
- outputs to `/app/publish`
- uses `/p:UseAppHost=false`

### `final` Stage

- starts from the `base` image
- copies published output from the `publish` stage
- runs `dotnet Tracker.Api.dll`

## Build Context And `.dockerignore`

The API image build uses `back/Tracker.Api` as the Docker build context.

The `.dockerignore` excludes common local/dev files such as:

- `.git`
- `.vs`
- `.vscode`
- `bin`
- `obj`
- `node_modules`
- local compose files
- local Dockerfiles

One current detail worth noting:

- `README.md` is excluded from the image build context

That is fine for the current image because the container does not need documentation files at runtime.

## Common Commands

### Rebuild And Start

```bash
docker compose -f back/docker-compose.yml up --build
```

### Start Without Rebuild

```bash
docker compose -f back/docker-compose.yml up
```

### Run In Background

```bash
docker compose -f back/docker-compose.yml up -d
```

### Show Running Containers

```bash
docker compose -f back/docker-compose.yml ps
```

### View Logs

```bash
docker compose -f back/docker-compose.yml logs -f
```

### Stop Containers

```bash
docker compose -f back/docker-compose.yml down
```

### Remove Containers And Volume

```bash
docker compose -f back/docker-compose.yml down -v
```

## How The Frontend Fits In

The frontend dev server is not containerized in this repository.

Current local-dev flow:

1. Run the backend with Docker on `http://localhost:8080`
2. Run the frontend locally with `npm start`
3. Let Angular proxy `/api` calls to `http://localhost:8080`

This matches the frontend proxy config in:

- [proxy.conf.json](c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json)

## Operational Notes

- The backend auto-applies EF Core migrations on startup, including in Docker.
- In non-`Development` environments, the backend does not enable OpenAPI.
- The backend does not force HTTPS in Docker by default.
- If the container cannot write to `/data`, startup may fail because the SQLite file and migrations require write access.

## Current Limitations

- No frontend container image
- No all-in-one root compose file for front + back
- No reverse proxy or TLS termination container
- No healthcheck in the compose file
- Port `8081` is published but not clearly used by the current runtime configuration

## Suggested Future Improvements

- Add a frontend Dockerfile for static deployment or dev container workflows
- Add a root-level compose file for `front + back`
- Remove unused port `8081` if it is not needed
- Add a healthcheck for the backend service
- Add environment-specific compose overrides if staging/production container runs are planned

