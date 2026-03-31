#!/bin/sh
set -e

/nakama/nakama migrate up --database.address "${DATABASE_URL}"

exec /nakama/nakama \
  --name tictactoe \
  --database.address "${DATABASE_URL}" \
  --logger.level INFO \
  --session.token_expiry_sec 7200 \
  --socket.outgoing_queue_size 128 \
  --runtime.js_entrypoint index.js
