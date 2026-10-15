#!/usr/bin/env bash
# INGR Engine Connectivity Verification Script
# Verifies Phase 0 (Engine Foundation & Headless Activepieces)
set -eo pipefail

ENGINE_URL="${ACTIVEPIECES_API_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ACTIVEPIECES_ADMIN_EMAIL:-admin@ingr.local}"
ADMIN_PASSWORD="${ACTIVEPIECES_ADMIN_PASSWORD:-IngrAdminPassword2026!}"

echo "=========================================================="
echo "  INGR Engine Connectivity & Health Verification"
echo "  Target URL: $ENGINE_URL"
echo "=========================================================="

# Helper function to check dependency
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required but not installed." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required but not installed." >&2; exit 1; }

# [1/5] Verify Flags endpoint
echo -n "[1/5] Checking GET /api/v1/flags... "
FLAGS_RAW=$(curl -s -w "\n%{http_code}" "${ENGINE_URL}/api/v1/flags" || true)
FLAGS_CODE=$(echo "$FLAGS_RAW" | tail -n1)
FLAGS_BODY=$(echo "$FLAGS_RAW" | sed '$d')

if [ "$FLAGS_CODE" != "200" ]; then
  echo "FAILED: HTTP status $FLAGS_CODE (expected 200)"
  exit 1
fi

USER_CREATED=$(echo "$FLAGS_BODY" | jq -r .USER_CREATED 2>/dev/null || echo "unknown")
EDITION=$(echo "$FLAGS_BODY" | jq -r .EDITION 2>/dev/null || echo "unknown")
VERSION=$(echo "$FLAGS_BODY" | jq -r .CURRENT_VERSION 2>/dev/null || echo "unknown")

if [ "$USER_CREATED" != "true" ]; then
  echo "FAILED: USER_CREATED is '$USER_CREATED' (expected true)"
  exit 1
fi
if [ -z "$EDITION" ] || [ "$EDITION" = "null" ]; then
  echo "FAILED: EDITION is missing or null"
  exit 1
fi
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  echo "FAILED: CURRENT_VERSION is missing or null"
  exit 1
fi
echo "PASSED (HTTP 200, Version: $VERSION, Edition: $EDITION, User Created: $USER_CREATED)"

# [2/5] Verify Health endpoint
echo -n "[2/5] Checking GET /api/v1/health... "
HEALTH_RAW=$(curl -s -w "\n%{http_code}" "${ENGINE_URL}/api/v1/health" || true)
HEALTH_CODE=$(echo "$HEALTH_RAW" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RAW" | sed '$d')

if [ "$HEALTH_CODE" != "200" ]; then
  echo "FAILED: HTTP status $HEALTH_CODE (expected 200)"
  exit 1
fi

STATUS=$(echo "$HEALTH_BODY" | jq -r .status 2>/dev/null || echo "unknown")
if [ "$STATUS" != "Healthy" ]; then
  echo "FAILED: Unexpected health status '$STATUS' (expected 'Healthy')"
  exit 1
fi
echo "PASSED (HTTP 200, Status: Healthy)"

# [3/5] Verify Admin Authentication
echo -n "[3/5] Checking POST /api/v1/authentication/sign-in... "
AUTH_RAW=$(curl -s -w "\n%{http_code}" -X POST "${ENGINE_URL}/api/v1/authentication/sign-in" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" || true)
AUTH_CODE=$(echo "$AUTH_RAW" | tail -n1)
AUTH_BODY=$(echo "$AUTH_RAW" | sed '$d')

if [ "$AUTH_CODE" != "200" ]; then
  echo "FAILED: HTTP status $AUTH_CODE (expected 200)"
  exit 1
fi

TOKEN=$(echo "$AUTH_BODY" | jq -r .token 2>/dev/null || true)
PROJECT_ID=$(echo "$AUTH_BODY" | jq -r .projectId 2>/dev/null || true)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "FAILED: Token missing in sign-in response"
  exit 1
fi
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
  echo "FAILED: ProjectId missing in sign-in response"
  exit 1
fi
echo "PASSED (HTTP 200, JWT token acquired, Project ID: $PROJECT_ID)"

# [4/5] Verify App Connections (Credentials Vault)
echo -n "[4/5] Checking GET /api/v1/app-connections?projectId=... "
CONNS_RAW=$(curl -s -w "\n%{http_code}" "${ENGINE_URL}/api/v1/app-connections?projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" || true)
CONNS_CODE=$(echo "$CONNS_RAW" | tail -n1)
CONNS_BODY=$(echo "$CONNS_RAW" | sed '$d')

if [ "$CONNS_CODE" != "200" ]; then
  echo "FAILED: HTTP status $CONNS_CODE (expected 200)"
  exit 1
fi

CONNS_COUNT=$(echo "$CONNS_BODY" | jq -r ".data | length" 2>/dev/null || echo "0")
echo "PASSED (HTTP 200, Credentials vault valid, $CONNS_COUNT connections registered)"

# [5/5] Verify Pieces Catalog
echo -n "[5/5] Checking GET /api/v1/pieces... "
PIECES_RAW=$(curl -s -w "\n%{http_code}" "${ENGINE_URL}/api/v1/pieces" \
  -H "Authorization: Bearer ${TOKEN}" || true)
PIECES_CODE=$(echo "$PIECES_RAW" | tail -n1)
PIECES_BODY=$(echo "$PIECES_RAW" | sed '$d')

if [ "$PIECES_CODE" != "200" ]; then
  echo "FAILED: HTTP status $PIECES_CODE (expected 200)"
  exit 1
fi

PIECES_COUNT=$(echo "$PIECES_BODY" | jq -r "length" 2>/dev/null || echo "0")
if [ "$PIECES_COUNT" -eq 0 ]; then
  echo "FAILED: Pieces catalog returned 0 pieces"
  exit 1
fi
echo "PASSED (HTTP 200, Pieces catalog valid, $PIECES_COUNT pieces available)"

echo "=========================================================="
echo "  ALL CHECKS PASSED (5/5): INGR Engine is operational & headless!"
echo "=========================================================="
exit 0
