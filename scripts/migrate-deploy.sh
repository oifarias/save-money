#!/usr/bin/env bash
# Retries `prisma migrate deploy` on advisory lock timeouts (P1002),
# which happen when two Vercel builds for the same branch run concurrently
# against the shared Neon database and race for the migration lock.
set -uo pipefail

attempts=5
delay=5

for i in $(seq 1 "$attempts"); do
  if npx prisma migrate deploy; then
    exit 0
  fi
  echo "prisma migrate deploy failed (attempt $i/$attempts), retrying in ${delay}s..."
  sleep "$delay"
done

exit 1
