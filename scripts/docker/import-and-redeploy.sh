#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ARCHIVE_PATH="${1:-$ROOT_DIR/timetracker-app-prod.tar}"

docker image load -i "$ARCHIVE_PATH"
docker compose -f "$COMPOSE_FILE" up -d --no-build

printf 'Stack started. Open http://localhost:8088\n'
