#!/bin/sh
set -eu

STATE_DIR=${DATA_DIR:-/data}
MARKER="$STATE_DIR/.schema-ready"
USERS_MARKER="$STATE_DIR/.schema-users-ready"

mkdir -p "$STATE_DIR"

if [ ! -f "$MARKER" ]; then
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$STATE_DIR" --file drizzle/0000_simple_satana.sql
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$STATE_DIR" --file drizzle/0001_demonic_pestilence.sql
  touch "$MARKER"
fi

if [ ! -f "$USERS_MARKER" ]; then
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$STATE_DIR" --file drizzle/0002_user_accounts.sql
  touch "$USERS_MARKER"
fi

exec node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json \
  --local \
  --persist-to "$STATE_DIR" \
  --ip 0.0.0.0 \
  --port 3000 \
  --inspector-port 0
