#!/usr/bin/env bash
# Render build step for the backend. Works even when the build image has no `npm` on PATH
# (seen on Render: "npm: command not found"). Tries npm, then corepack, then downloads npm itself.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "node: $(command -v node || echo missing) $(node -v 2>/dev/null || true)"

if command -v npm >/dev/null 2>&1; then
  echo "Installing with npm $(npm -v)"
  exec npm ci --omit=dev
fi

if command -v corepack >/dev/null 2>&1; then
  echo "npm not on PATH; installing with corepack"
  exec corepack npm@10 ci --omit=dev
fi

NPM_VERSION=10.9.2
echo "npm and corepack not on PATH; downloading npm ${NPM_VERSION}"
TMP="$(mktemp -d)"
URL="https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" | tar -xz -C "$TMP"
else
  wget -qO- "$URL" | tar -xz -C "$TMP"
fi
exec node "$TMP/package/bin/npm-cli.js" ci --omit=dev
