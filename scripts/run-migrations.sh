#!/usr/bin/env bash
# Apply every hand-rolled SQL file in src/db/migrations/ that hasn't
# yet been applied. Tracking lives in a `_applied_migrations` table
# inside the same DB, populated lazily.
#
# Why this exists: the deploy workflow used to skip migrations entirely
# (rebuild + docker compose up only). When schema-changing code shipped
# without the matching migration applied, the root-page healthcheck
# stayed green because the public homepage never touched the affected
# columns — so the failure only surfaced for signed-in users. This
# script closes that gap.
#
# Conventions for new migration files:
#   - Numbered prefix (0019_, 0020_, …) for sortable application order
#   - Use IF NOT EXISTS / IF EXISTS guards so a re-run is a no-op
#   - The whole file gets wrapped in a single transaction, so a partial
#     failure rolls everything back

set -euo pipefail

MIGRATIONS_DIR="${1:-src/db/migrations}"
DB_SVC="${DB_SVC:-db}"
DB_USER="${DB_USER:-sellingmyitems}"
DB_NAME="${DB_NAME:-sellingmyitems}"

psql_in() {
  docker compose exec -T "$DB_SVC" psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ Migrations dir '$MIGRATIONS_DIR' not found." >&2
  exit 1
fi

# Tracking table — first thing we ensure exists.
psql_in -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS _applied_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT NOW());" >/dev/null

APPLIED_COUNT=$(psql_in -tAc "SELECT COUNT(*) FROM _applied_migrations;" | tr -d '[:space:]')

# Bootstrap: first time the runner ever sees this DB, the schema is
# already up-to-date (every prior migration was applied by hand). We
# mark every existing *.sql file as applied without re-running, to
# avoid colliding with non-idempotent older migrations.
if [ "$APPLIED_COUNT" = "0" ]; then
  COUNT=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l | tr -d '[:space:]')
  echo "==> Bootstrapping migration tracking ($COUNT existing files marked applied, no SQL re-run)"
  for f in "$MIGRATIONS_DIR"/*.sql; do
    name=$(basename "$f")
    psql_in -v ON_ERROR_STOP=1 -c "INSERT INTO _applied_migrations(filename) VALUES ('$name') ON CONFLICT DO NOTHING;" >/dev/null
  done
  echo "==> Bootstrap complete."
  exit 0
fi

# Steady-state: apply any *.sql file not yet in the tracking table.
NEW_COUNT=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  name=$(basename "$f")
  exists=$(psql_in -tAc "SELECT 1 FROM _applied_migrations WHERE filename = '$name';" | tr -d '[:space:]')
  if [ -n "$exists" ]; then
    continue
  fi

  echo "==> Applying $name..."
  # -1 wraps the file in a single transaction; ON_ERROR_STOP=1 aborts
  # on the first SQL error so we don't end up with half-applied state.
  psql_in -1 -v ON_ERROR_STOP=1 -f - < "$f"
  psql_in -v ON_ERROR_STOP=1 -c "INSERT INTO _applied_migrations(filename) VALUES ('$name');" >/dev/null
  echo "==> $name applied."
  NEW_COUNT=$((NEW_COUNT + 1))
done

if [ "$NEW_COUNT" = "0" ]; then
  echo "==> No new migrations to apply."
else
  echo "==> $NEW_COUNT migration(s) applied."
fi
