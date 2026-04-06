#!/usr/bin/env bash
# ── VPS first-time setup script ──────────────────────────────────────────────
# Run this ONCE on your VPS to bootstrap the project.
# Prerequisite: SSH deploy key ~/.ssh/id_ed25519_github already configured.
#
# Usage: ssh user@your-vps 'bash -s' < scripts/vps-setup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/sellingmyitems}"
DEPLOY_KEY="$HOME/.ssh/id_ed25519_github"

# ── Check deploy key ─────────────────────────────────────────────────────────
if [ ! -f "$DEPLOY_KEY" ]; then
  echo "⚠  Deploy key not found at $DEPLOY_KEY"
  exit 1
fi
export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=no"

# ── Disk space check ─────────────────────────────────────────────────────────
echo "==> Checking disk space..."
df -h /
AVAIL=$(df / | tail -1 | awk '{print $4}')
if [ "$AVAIL" -lt 2097152 ]; then
  echo "⚠  Less than 2GB free disk space. Proceed with caution."
fi

# ── Docker ───────────────────────────────────────────────────────────────────
echo "==> Installing Docker (if missing)..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "    Docker installed. You may need to log out/in for group changes."
fi

# Clean up any leftover Docker resources
echo "==> Pruning Docker to free space..."
docker system prune -af --volumes 2>/dev/null || true

# ── Shared proxy network (for Caddy ↔ App connectivity) ─────────────────────
echo "==> Creating shared-proxy network (if missing)..."
docker network create shared-proxy 2>/dev/null || echo "    shared-proxy network already exists."

REPO_URL="${REPO_URL:-git@github.com:r45635/SellingMyItems.git}"

echo "==> Cloning repo to $APP_DIR..."
if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "    Directory exists, pulling latest..."
  cd "$APP_DIR" && git pull origin main
fi

cd "$APP_DIR"

echo "==> Creating .env from template..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    ⚠  EDIT .env NOW to set POSTGRES_PASSWORD before starting!"
  echo "    nano $APP_DIR/.env"
else
  echo "    .env already exists, skipping."
fi

echo ""
echo "==> Setup complete!"
echo "    1. Edit .env:  nano $APP_DIR/.env"
echo "    2. Start:      cd $APP_DIR && docker compose up -d"
echo "    3. Run migrations: docker compose exec app npx drizzle-kit push"
echo ""
