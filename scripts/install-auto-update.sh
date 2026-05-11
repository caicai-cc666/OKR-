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
WORK_DIR="$(mktemp -d "$APP_ROOT/okr-auto-update-XXXXXX")"
ZIP_FILE="$WORK_DIR/source.zip"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

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

if [ ! -f "$CURRENT_DIR/.env.production" ]; then
  echo "Missing production env file: $CURRENT_DIR/.env.production" >&2
  exit 1
fi

echo "New source detected. Previous: ${previous:-none}; next: $etag"
curl -L --connect-timeout 20 --retry 5 \
  -H "Cache-Control: no-cache" \
  -o "$ZIP_FILE" \
  "${REPO_HEAD_URL}?ts=$(date +%s)"

mkdir -p "$WORK_DIR/source"
unzip -q "$ZIP_FILE" -d "$WORK_DIR/source"
SOURCE_DIR="$(find "$WORK_DIR/source" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$SOURCE_DIR" ]; then
  echo "Unable to locate extracted source directory" >&2
  exit 1
fi

if [ ! -f "$SOURCE_DIR/scripts/deploy-production.sh" ]; then
  echo "Missing deploy script in downloaded source: $SOURCE_DIR/scripts/deploy-production.sh" >&2
  exit 1
fi
chmod +x "$SOURCE_DIR/scripts/deploy-production.sh"

OKR_SOURCE_DIR="$SOURCE_DIR" \
OKR_APP_ROOT="$APP_ROOT" \
OKR_APP_NAME="$APP_NAME" \
bash "$SOURCE_DIR/scripts/deploy-production.sh"

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
