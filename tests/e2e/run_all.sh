#!/usr/bin/env bash
# Master E2E Test Suite Execution Script
# Usage:
#   ./run_all.sh                # Run all tiers (Tiers 1-4)
#   ./run_all.sh --tier 1       # Run only Tier 1 (Feature Coverage)
#   ./run_all.sh --engine       # Run Phase 0 Engine Foundation tests
#   ./run_all.sh --web          # Run Phase 1 & 2 Web Frontend tests (F6-F16)
#   ./run_all.sh --json         # Structured JSON output
#   ./run_all.sh --allow-pending # Run all and return exit 0 (for inspection)

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${PATH}:/home/zavitr/.nvm/versions/node/v22.22.3/bin"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node runtime not found in PATH." >&2
  exit 1
fi

node "${SCRIPT_DIR}/runner.mjs" "$@"
