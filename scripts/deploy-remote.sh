#!/usr/bin/env bash
# Runs ON the VPS, fed over SSH by .github/workflows/deploy.yml:
#   ssh vps 'bash -s' -- <image-tag> [app-dir] < scripts/deploy-remote.sh
# The image is built in GitHub Actions and already `docker load`ed here.
# This script never builds: a small VPS must not run a Next.js build.
set -euo pipefail

IMAGE=sellingmyitems-app
TAG=${1:?usage: deploy-remote.sh <image-tag> [app-dir]}
APP_DIR=${2:-}
[ -n "$APP_DIR" ] || APP_DIR="$HOME/sellingmyitems"
APP_DIR=${APP_DIR/#\~/$HOME}
APP_DIR=${APP_DIR//\$HOME/$HOME}

die() { echo "❌ $*" >&2; exit 1; }

# Global deploy lock on the VPS to avoid overlapping runs.
exec 9>/tmp/sellingmyitems-deploy.lock
flock -w 1200 9 || die "Could not acquire deploy lock within 20 minutes."

docker image inspect "$IMAGE:$TAG" >/dev/null 2>&1 || die "Image $IMAGE:$TAG is not loaded on this host."

echo "==> Disk space BEFORE deploy:"
df -h / | tail -1
AVAIL=$(df / | tail -1 | awk '{print $4}')
[ "$AVAIL" -ge 1048576 ] || die "Less than 1GB free disk space (${AVAIL} KB)."

# Ensure shared-proxy network exists (idempotent, needed for Caddy ↔ App connectivity)
docker network create shared-proxy 2>/dev/null || true

# The checkout supplies docker-compose.yml and the migration scripts; it must match the image.
[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a checkout. First install: see README › Self-hosting."
cd "$APP_DIR"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519_github -o StrictHostKeyChecking=accept-new"
git fetch -q origin main
git merge -q --ff-only "$TAG" || die "Cannot fast-forward the checkout to $TAG."
[ "$(git rev-parse HEAD)" = "$TAG" ] || die "Checkout is at $(git rev-parse --short HEAD), not $TAG (a newer deploy already ran?)."

# Keep the running image as :previous for a manual rollback, then point :latest at the new one.
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi
docker tag "$IMAGE:$TAG" "$IMAGE:latest"

docker compose config -q
SMI_IMAGE_TAG="$TAG" docker compose up -d --no-build --force-recreate --remove-orphans

running=$(docker inspect -f '{{.Config.Image}}' sellingmyitems-app)
[ "$running" = "$IMAGE:$TAG" ] || die "sellingmyitems-app runs $running, expected $IMAGE:$TAG."

# Apply any new SQL migrations BEFORE declaring the deploy healthy.
# Idempotent — see scripts/run-migrations.sh.
echo "==> Running DB migrations..."
chmod +x scripts/run-migrations.sh
./scripts/run-migrations.sh

# /api/health does a SELECT on profiles, so a missing column or enum drift fails here.
# Use 127.0.0.1 not localhost — Alpine's busybox wget may prefer ::1 while Next.js binds 0.0.0.0.
echo "==> Verifying app + DB schema (up to 60s)..."
HEALTH_OK=0
for i in $(seq 1 12); do
  if docker exec sellingmyitems-app wget -qO- http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
    echo "✅ App + DB healthy (attempt ${i})"
    HEALTH_OK=1
    break
  fi
  echo "  Attempt ${i}/12 failed, retrying in 5s..."
  sleep 5
done
if [ "$HEALTH_OK" -ne 1 ]; then
  docker compose logs --tail=50 app || true
  die "App or DB schema unhealthy after 60s at /api/health. Rollback: SMI_IMAGE_TAG=previous docker compose up -d --no-build app"
fi

# Keep only :latest (= this deploy) and :previous; drop older per-commit tags and dangling layers.
echo "==> Pruning old $IMAGE tags..."
for ref in $(docker images "$IMAGE" --format '{{.Repository}}:{{.Tag}}'); do
  case "$ref" in "$IMAGE:latest"|"$IMAGE:previous"|"$IMAGE:$TAG"|*"<none>") continue ;; esac
  docker rmi "$ref" >/dev/null || echo "⚠ could not remove $ref"
done
docker image prune -f >/dev/null
docker builder prune -f >/dev/null 2>&1 || true   # leftovers from the era of building on the VPS

echo "==> Disk space AFTER deploy:"
df -h / | tail -1
