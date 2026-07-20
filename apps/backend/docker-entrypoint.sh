#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying Prisma migrations"
  node ./apps/backend/node_modules/prisma/build/index.js migrate deploy \
    --schema ./apps/backend/prisma/schema.prisma
fi

exec "$@"
