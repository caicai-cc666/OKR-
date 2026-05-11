#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${OKR_APP_ROOT:-/home/admin/apps}"
APP_NAME="${OKR_APP_NAME:-okr-harness}"
SERVICE_NAME="${OKR_SERVICE_NAME:-okr-harness-auto-update}"
REPO_HEAD_URL="${OKR_REPO_HEAD_URL:-https://codeload.github.com/caicai-cc666/OKR-/zip/refs/heads/master}"
INTERVAL="${OKR_UPDATE_INTERVAL:-5min}"

AUTO_UPDATE_SCRIPT="$APP_ROOT/okr-auto-update.sh"
STATE_FILE="$APP_ROOT/.${APP_NAME}-source-etag"
LOCK_FILE="$APP_ROOT/.${APP_NAME}-auto-update.lock"
CURRENT_DIR="$APP_ROOT/$APP_NAME"

if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

mkdir -p "$APP_ROOT"

cat > "$AUTO_UPDATE_SCRIPT" <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${OKR_APP_ROOT:-/home/admin/apps}"
APP_NAME="${OKR_APP_NAME:-okr-harness}"
REPO_HEAD_URL="${OKR_REPO_HEAD_URL:-https://codeload.github.com/caicai-cc666/OKR-/zip/refs/heads/master}"
STATE_FILE="${OKR_STATE_FILE:-$APP_ROOT/.${APP_NAME}-source-etag}"
LOCK_FILE="${OKR_LOCK_FILE:-$APP_ROOT/.${APP_NAME}-auto-update.lock}"
CURRENT_DIR="$APP_ROOT/$APP_NAME"

mkdir -p "$APP_ROOT"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another OKR auto update is already running."
  exit 0
fi

etag="$(
  curl -fsSIL --connect-timeout 20 --retry 3 \
    -H "Cache-Control: no-cache" \
    "$REPO_HEAD_URL" |
    tr -d '\r' |
    awk 'tolower($1) == "etag:" { print $2 }' |
    tail -n 1
)"

if [ -z "$etag" ]; then
  echo "Unable to read source ETag from $REPO_HEAD_URL" >&2
  exit 1
fi

previous=""
if [ -f "$STATE_FILE" ]; then
  previous="$(cat "$STATE_FILE")"
fi

if [ "$etag" = "$previous" ]; then
  echo "No update needed. Source ETag: $etag"
  exit 0
fi

if [ ! -x "$CURRENT_DIR/scripts/deploy-production.sh" ]; then
  if [ ! -f "$CURRENT_DIR/scripts/deploy-production.sh" ]; then
    echo "Missing deploy script: $CURRENT_DIR/scripts/deploy-production.sh" >&2
    exit 1
  fi
  chmod +x "$CURRENT_DIR/scripts/deploy-production.sh"
fi

echo "New source detected. Previous: ${previous:-none}; next: $etag"
OKR_REPO_ZIP_URL="${REPO_HEAD_URL}?ts=$(date +%s)" \
OKR_APP_ROOT="$APP_ROOT" \
OKR_APP_NAME="$APP_NAME" \
bash "$CURRENT_DIR/scripts/deploy-production.sh"

printf '%s' "$etag" > "$STATE_FILE"
echo "Auto update complete. Source ETag: $etag"
SCRIPT

chmod +x "$AUTO_UPDATE_SCRIPT"

cat > "/tmp/${SERVICE_NAME}.service" <<SERVICE
[Unit]
Description=OKR Harness auto update
Wants=network-online.target docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
User=root
Environment=HOME=/home/admin
Environment=OKR_APP_ROOT=$APP_ROOT
Environment=OKR_APP_NAME=$APP_NAME
Environment=OKR_REPO_HEAD_URL=$REPO_HEAD_URL
Environment=OKR_STATE_FILE=$STATE_FILE
Environment=OKR_LOCK_FILE=$LOCK_FILE
Environment=OKR_SUDO=
ExecStart=$AUTO_UPDATE_SCRIPT
SERVICE

cat > "/tmp/${SERVICE_NAME}.timer" <<TIMER
[Unit]
Description=Run OKR Harness auto update periodically

[Timer]
OnBootSec=2min
OnUnitActiveSec=$INTERVAL
AccuracySec=30s
Persistent=true

[Install]
WantedBy=timers.target
TIMER

$SUDO mv "/tmp/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
$SUDO mv "/tmp/${SERVICE_NAME}.timer" "/etc/systemd/system/${SERVICE_NAME}.timer"
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now "${SERVICE_NAME}.timer"

echo "Installed ${SERVICE_NAME}.timer. Running one update now..."
$SUDO systemctl start "${SERVICE_NAME}.service"
$SUDO systemctl status "${SERVICE_NAME}.timer" --no-pager
