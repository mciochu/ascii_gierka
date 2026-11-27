#!/usr/bin/env bash
set -uo pipefail

BASE="/home/ubuntu/services/ascii_gierka"
mkdir -p "$BASE/logs" "$BASE/staging" "$BASE/releases"
exec 9>"$BASE/logs/watch.lock"
if ! flock -n 9; then
  echo "[$(date -Is)] Another DOMINIUM watcher is already running."
  exit 0
fi

server_pid=""
start_server() {
  [[ -s "$BASE/current/dist/index.html" ]] || return 0
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    return 0
  fi
  echo "[$(date -Is)] Starting DOMINIUM static server on 0.0.0.0:4175"
  DIST_DIR="$BASE/current/dist" HOST="0.0.0.0" PORT="4175" \
    node "$BASE/bin/serve.mjs" >> "$BASE/logs/server.log" 2>&1 &
  server_pid="$!"
  sleep 2
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "[$(date -Is)] Static server failed to start." >&2
    server_pid=""
  fi
}

stop_server() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap stop_server EXIT INT TERM

echo "[$(date -Is)] DOMINIUM watcher started; checking GitHub main every 60 seconds."
while true; do
  bash "$BASE/bin/deploy-once.sh" >> "$BASE/logs/deploy.log" 2>&1 || true
  start_server
  sleep 60
  if [[ -n "$server_pid" ]] && ! kill -0 "$server_pid" 2>/dev/null; then
    echo "[$(date -Is)] Static server exited; it will be restarted." >> "$BASE/logs/server.log"
    server_pid=""
  fi
done
