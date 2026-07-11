#!/usr/bin/env bash
set -euo pipefail

common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
lock_dir="$common_dir/agent-locks"
mkdir -p "$lock_dir"
exec 9>"$lock_dir/agent-browser.lock"

if ! flock --nonblock 9; then
  echo "agent-browser is already owned by another worker; retry after that proof finishes" >&2
  exit 75
fi

exec "$@"
