#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$PWD}"
ENV_FILE="$APP_DIR/.env.production"
BOOTSTRAP_LOG="$APP_DIR/bootstrap-output.txt"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

cd "$APP_DIR"

echo "==> Checking required files"
for file in Dockerfile docker-compose.yml Caddyfile scripts/generate-production-env.mjs scripts/bootstrap-production.mjs database/schema.sql; do
  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    exit 1
  fi
done

echo "==> Installing system packages"
if command -v dnf >/dev/null 2>&1; then
  $SUDO dnf install -y docker git curl
  $SUDO dnf install -y docker-compose-plugin || true
elif command -v yum >/dev/null 2>&1; then
  $SUDO yum install -y docker git curl
  $SUDO yum install -y docker-compose-plugin || true
elif command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO apt-get install -y docker.io git curl
  $SUDO apt-get install -y docker-compose-plugin || true
else
  echo "Unsupported Linux package manager. Please install Docker, Docker Compose, Git, and Curl manually."
  exit 1
fi

echo "==> Starting Docker"
$SUDO systemctl enable --now docker

if ! $SUDO docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is missing."
  echo "Install docker-compose-plugin from your server package manager, then rerun this script."
  exit 1
fi

echo "==> Checking ports 80 and 443"
if command -v ss >/dev/null 2>&1; then
  if ss -lntp 2>/dev/null | grep -E ':(80|443)\s' | grep -v docker >/dev/null 2>&1; then
    echo "Port 80 or 443 is already occupied. Current listeners:"
    ss -lntp 2>/dev/null | grep -E ':(80|443)\s' || true
    echo "Please stop the service occupying 80/443, or configure that service to reverse proxy to this app."
    exit 1
  fi
fi

echo "==> Ensuring swap exists on small-memory server"
if ! swapon --show | grep -q '^'; then
  $SUDO fallocate -l 2G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  fi
fi

echo "==> Generating production environment file"
if [ ! -f "$ENV_FILE" ]; then
  $SUDO docker run --rm -v "$APP_DIR:/app" -w /app node:20-alpine node scripts/generate-production-env.mjs
  $SUDO chown "$(id -u):$(id -g)" "$ENV_FILE" || true
  chmod 600 "$ENV_FILE"
else
  echo ".env.production already exists. Keeping existing secrets."
fi

echo "==> Starting PostgreSQL"
$SUDO docker compose --env-file "$ENV_FILE" up -d --build postgres

echo "==> Building application image"
$SUDO docker compose --env-file "$ENV_FILE" build app

echo "==> Bootstrapping database and initial accounts"
set +e
$SUDO docker compose --env-file "$ENV_FILE" run --rm app node scripts/bootstrap-production.mjs | tee "$BOOTSTRAP_LOG"
BOOTSTRAP_STATUS=${PIPESTATUS[0]}
set -e
chmod 600 "$BOOTSTRAP_LOG" || true
if [ "$BOOTSTRAP_STATUS" -ne 0 ]; then
  echo "Database bootstrap failed. See $BOOTSTRAP_LOG"
  exit "$BOOTSTRAP_STATUS"
fi

echo "==> Starting application and HTTPS reverse proxy"
$SUDO docker compose --env-file "$ENV_FILE" up -d --build

echo "==> Deployment status"
$SUDO docker compose --env-file "$ENV_FILE" ps

echo ""
echo "Deployment command finished."
echo "Open: https://ai6c9.cn"
echo "Initial passwords, if newly created, are saved in: $BOOTSTRAP_LOG"
echo "Keep .env.production and bootstrap-output.txt private."
