# Docker Guide

This repository currently ships Docker support for the backend API only.

There is no frontend container image or full front + back compose stack yet.

## Docker Files

- [back/docker-compose.yml](back/docker-compose.yml)
- [back/Tracker.Api/Dockerfile](back/Tracker.Api/Dockerfile)
- [back/Tracker.Api/.dockerignore](back/Tracker.Api/.dockerignore)

## Quick Start

From the repository root:

```bash
docker compose -f back/docker-compose.yml up --build
```

Detached mode:

```bash
docker compose -f back/docker-compose.yml up --build -d
```

Stop:

```bash
docker compose -f back/docker-compose.yml down
```

Stop and remove the persisted volume:

```bash
docker compose -f back/docker-compose.yml down -v
```

`down -v` deletes the persisted SQLite data.

## Current Scope

The Docker stack currently runs:

- the ASP.NET Core backend API

It does not currently run:

- the Angular frontend
- a reverse proxy
- a separate database server

## Runtime Configuration

The compose file defines one service:

- `trackerapi`

Current behavior:

- builds from `back/Tracker.Api`
- binds ports `8080:8080` and `8081:8081`
- sets `ASPNETCORE_URLS=http://+:8080`
- overrides the SQLite connection string to `Data Source=/data/tracker.db`
- mounts the named volume `tracker-data` to `/data`

Practical result:

- the API is reachable on `http://localhost:8080`
- the SQLite database lives at `/data/tracker.db`
- maintenance backups created by `/api/backup/restore` are stored under `/data/backups`

Note about port `8081`:

- it is published by Docker
- the current runtime binding only uses `http://+:8080`
- unless runtime config changes, `8081` is exposed but not actively used by the app

## Persistence

SQLite data is stored in the named volume:

- volume name: `tracker-data`
- database file: `/data/tracker.db`
- backup directory: `/data/backups`

This means:

- recreating the container does not remove data
- `docker compose down` keeps data
- `docker compose down -v` removes data

## Local Dev Flow With Frontend

Recommended local flow:

1. Run the backend with Docker on `http://localhost:8080`
2. Run the frontend locally with `npm start`
3. Let Angular proxy `/api` to `http://localhost:8080`

That matches the current frontend proxy configuration in [proxy.conf.json](/c:/Git/TimeTracker/front/timetracker-front/proxy.conf.json).

## Notes

- the backend auto-applies EF Core migrations on startup, including in Docker
- OpenAPI is not exposed outside `Development`
- the app does not force HTTPS in Docker by default
- startup fails if the container cannot write to `/data`

## Current Limitations

- no frontend Docker image
- no root compose file for front + back
- no reverse proxy / TLS termination
- no healthcheck in the compose file
- published but effectively unused port `8081`
