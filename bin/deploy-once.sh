#!/usr/bin/env bash
set -Eeuo pipefail

BASE="/home/ubuntu/services/ascii_gierka"
REPO_URL="https://github.com/mciochu/ascii_gierka.git"
mkdir -p "$BASE"/{staging,releases,logs}

export GIT_TERMINAL_PROMPT=0
remote_sha="$(git ls-remote "$REPO_URL" refs/heads/main | awk 'NR == 1 {print $1}')"
if [[ ! "$remote_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "[$(date -Is)] Could not read main from GitHub." >&2
  exit 2
fi

current_sha=""
if [[ -r "$BASE/current/COMMIT" ]]; then
  current_sha="$(cat "$BASE/current/COMMIT")"
fi
if [[ "$current_sha" == "$remote_sha" && -s "$BASE/current/dist/index.html" ]]; then
  echo "[$(date -Is)] main unchanged at ${remote_sha:0:12}"
  exit 0
fi

work="$(mktemp -d "$BASE/staging/source-XXXXXX")"
release_tmp=""
cleanup() {
  [[ -z "$work" || ! -d "$work" ]] || rm -rf -- "$work"
  [[ -z "$release_tmp" || ! -d "$release_tmp" ]] || rm -rf -- "$release_tmp"
}
trap cleanup EXIT

echo "[$(date -Is)] Preparing main commit $remote_sha"
git clone --depth 1 --branch main --single-branch "$REPO_URL" "$work/src"
commit_sha="$(git -C "$work/src" rev-parse HEAD)"
release="$BASE/releases/$commit_sha"

if [[ -s "$release/dist/index.html" && "$(cat "$release/COMMIT" 2>/dev/null || true)" == "$commit_sha" ]]; then
  echo "[$(date -Is)] Verified release already built for $commit_sha"
else
  [[ ! -e "$release" && ! -L "$release" ]] || rm -rf -- "$release"
  cd "$work/src"
  echo "[$(date -Is)] Installing locked dependencies"
  npm ci --include=dev
  echo "[$(date -Is)] Running TypeScript checks and production build"
  npm run verify
  test -s "$work/src/dist/index.html"

  release_tmp="$(mktemp -d "$BASE/staging/release-XXXXXX")"
  cp -a "$work/src/dist" "$release_tmp/dist"
  printf '%s\n' "$commit_sha" > "$release_tmp/COMMIT"
  mv "$release_tmp" "$release"
  release_tmp=""
fi

ln -s "releases/$commit_sha" "$BASE/current.next.$$"
mv -Tf "$BASE/current.next.$$" "$BASE/current"
echo "[$(date -Is)] DEPLOYED $commit_sha"

current_target="$(readlink -f "$BASE/current")"
mapfile -t old_releases < <(find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk 'NR > 3 {$1=""; sub(/^ /, ""); print}')
for old in "${old_releases[@]}"; do
  [[ "$old" == "$BASE/releases/"* && "$old" != "$current_target" ]] && rm -rf -- "$old"
done
