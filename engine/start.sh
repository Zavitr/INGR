#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

DOCKER_CMD="docker"
if ! docker ps > /dev/null 2>&1; then
  if sg docker -c "docker ps" > /dev/null 2>&1; then
    DOCKER_CMD="sg docker -c"
  fi
fi

echo "=== Starting INGR Engine (Activepieces + Postgres + Redis) ==="
if [ "$DOCKER_CMD" = "docker" ]; then
  docker compose up -d
else
  sg docker -c "docker compose up -d"
fi

echo ""
echo "Waiting for Activepieces to become healthy at http://localhost:8080..."
for i in {1..45}; do
  if curl -s http://localhost:8080/api/v1/flags > /dev/null 2>&1; then
    echo "✓ Activepieces is UP and running on http://localhost:8080!"
    exit 0
  fi
  sleep 2
done

echo "Activepieces is still starting up. Check status with: sg docker -c 'docker compose logs -f'"
