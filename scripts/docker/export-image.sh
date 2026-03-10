#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ARCHIVE_PATH="${1:-$ROOT_DIR/timetracker-app-prod.tar}"

APP_IMAGE="${APP_IMAGE:-timetracker-app:prod}"

docker compose -f "$COMPOSE_FILE" build
docker image save -o "$ARCHIVE_PATH" "$APP_IMAGE"

printf 'Archive created: %s\n' "$ARCHIVE_PATH"
printf 'Import it on the target machine with docker image load -i %s\n' "$ARCHIVE_PATH"
