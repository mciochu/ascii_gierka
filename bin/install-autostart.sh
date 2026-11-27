#!/usr/bin/env bash
set -euo pipefail

BASE="/home/ubuntu/services/ascii_gierka"
mkdir -p "$BASE/logs"
LINE='@reboot /usr/bin/nohup /bin/bash /home/ubuntu/services/ascii_gierka/bin/watch.sh >> /home/ubuntu/services/ascii_gierka/logs/cron.log 2>&1 &'
CURRENT="$(crontab -l 2>/dev/null || true)"

if grep -Fq '/home/ubuntu/services/ascii_gierka/bin/watch.sh' <<<"$CURRENT"; then
  echo "DOMINIUM autostart entry already exists; crontab left unchanged."
  exit 0
fi

{ printf '%s\n' "$CURRENT"; printf '%s\n' "$LINE"; } | sed '/^[[:space:]]*$/d' | crontab -
echo "Installed DOMINIUM @reboot entry; existing cron entries were preserved."
