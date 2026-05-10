#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${OKR_APP_ROOT:-$HOME/apps}"
APP_NAME="${OKR_APP_NAME:-okr-harness}"
COMPOSE_PROJECT="${OKR_COMPOSE_PROJECT:-okr-harness}"
DOCKER_MIRROR="${OKR_DOCKER_MIRROR:-m.daocloud.io/docker.io}"
NPM_REGISTRY="${OKR_NPM_REGISTRY:-https://registry.npmmirror.com}"
REPO_ZIP_URL="${OKR_REPO_ZIP_URL:-https://codeload.github.com/caicai-cc666/OKR-/zip/refs/heads/master?ts=$(date +%s)}"
SUDO="${OKR_SUDO:-sudo}"

CURRENT_DIR="$APP_ROOT/$APP_NAME"
WORK_DIR="$(mktemp -d "$APP_ROOT/okr-deploy-XXXXXX")"
NEXT_DIR="$WORK_DIR/next"
ZIP_FILE="$WORK_DIR/source.zip"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

log() {
  printf '\n==> %s\n' "$*"
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

log "Preparing source"
if [ -n "${OKR_SOURCE_DIR:-}" ]; then
  cp -a "$OKR_SOURCE_DIR" "$NEXT_DIR"
else
  curl -L --connect-timeout 20 --retry 5 \
    -H "Cache-Control: no-cache" \
    -o "$ZIP_FILE" \
    "$REPO_ZIP_URL"
  mkdir -p "$WORK_DIR/source"
  unzip -q "$ZIP_FILE" -d "$WORK_DIR/source"
  SOURCE_DIR="$(find "$WORK_DIR/source" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "$SOURCE_DIR" ]; then
    echo "Unable to locate extracted source directory" >&2
    exit 1
  fi
  mv "$SOURCE_DIR" "$NEXT_DIR"
fi

require_file "$CURRENT_DIR/.env.production"
cp "$CURRENT_DIR/.env.production" "$NEXT_DIR/.env.production"
cp "$CURRENT_DIR/bootstrap-output.txt" "$NEXT_DIR/bootstrap-output.txt" 2>/dev/null || true

cd "$NEXT_DIR"

log "Patching China-friendly mirrors"
sed -i "s#^FROM .*node:20-alpine#FROM ${DOCKER_MIRROR}/library/node:20-alpine#g" Dockerfile
sed -i "s#image: .*postgres:16-alpine#image: ${DOCKER_MIRROR}/library/postgres:16-alpine#g" docker-compose.yml
sed -i "s#image: .*caddy:2-alpine#image: ${DOCKER_MIRROR}/library/caddy:2-alpine#g" docker-compose.yml
grep -q "$NPM_REGISTRY" Dockerfile || sed -i "/RUN npm ci/i RUN npm config set registry ${NPM_REGISTRY}" Dockerfile

log "Building new app image before touching the running service"
$SUDO docker compose -p "$COMPOSE_PROJECT" --env-file .env.production build --no-cache app

log "Stopping current service"
if [ -d "$CURRENT_DIR" ]; then
  $SUDO docker compose -p "$COMPOSE_PROJECT" -f "$CURRENT_DIR/docker-compose.yml" --env-file "$CURRENT_DIR/.env.production" down
fi

BACKUP_DIR="$APP_ROOT/${APP_NAME}-backup-$(date +%Y%m%d%H%M%S)"
log "Swapping release directories"
if [ -d "$CURRENT_DIR" ]; then
  mv "$CURRENT_DIR" "$BACKUP_DIR"
fi
mv "$NEXT_DIR" "$CURRENT_DIR"

cd "$CURRENT_DIR"

log "Starting updated service"
$SUDO docker compose -p "$COMPOSE_PROJECT" --env-file .env.production up -d

log "Service status"
$SUDO docker compose -p "$COMPOSE_PROJECT" --env-file .env.production ps

log "Deployment complete"
