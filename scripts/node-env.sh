#!/bin/sh
# Use this project's Node runtime without changing the user's shell.
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
NODE_VERSION=$(cat "$PROJECT_ROOT/.node-version")
NODE_BIN="$PROJECT_ROOT/.runtime/node-v$NODE_VERSION-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/')/bin"
if [ ! -x "$NODE_BIN/node" ]; then
  echo "Project Node runtime missing: $NODE_BIN" >&2
  exit 1
fi
export PATH="$NODE_BIN:$PATH"
export npm_config_cache="$PROJECT_ROOT/.runtime/npm-cache"
cd "$PROJECT_ROOT"
exec "$@"
