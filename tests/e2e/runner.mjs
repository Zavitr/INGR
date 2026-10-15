#!/usr/bin/env node
/**
 * Master E2E Test Suite Runner
 * Executes multi-tier opaque-box test suites and generates structured reports.
 */

import { registry } from './helpers/test_context.mjs';
import { runF1Tests } from './tier1_features/test_f1_docker.mjs';
import { runF2Tests } from './tier1_features/test_f2_engine_api.mjs';
import { runF3Tests } from './tier1_features/test_f3_vault.mjs';
import { runF4Tests } from './tier1_features/test_f4_verify.mjs';
import { runF5Tests } from './tier1_features/test_f5_hygiene.mjs';
import { runF6Tests } from './tier1_features/test_f6_build.mjs';
import { runF7Tests } from './tier1_features/test_f7_routes.mjs';
import { runF8Tests } from './tier1_features/test_f8_auth.mjs';
import { runF9Tests } from './tier1_features/test_f9_oauth.mjs';
import { runF10Tests } from './tier1_features/test_f10_landing.mjs';
import { runF11Tests } from './tier1_features/test_f11_dashboard.mjs';
import { runF12Tests } from './tier1_features/test_f12_recipes.mjs';
import { runF13Tests } from './tier1_features/test_f13_crisp.mjs';
import { runF14Tests } from './tier1_features/test_f14_styling.mjs';
import { runF15Tests } from './tier1_features/test_f15_infra.mjs';
import { runF16Tests } from './tier1_features/test_f16_service_connections.mjs';
import { runF17Tests } from './tier1_features/test_f17_recipe_hosting.mjs';
import { runF18Tests } from './tier1_features/test_f18_recipe_uptime.mjs';
import { runF19Tests } from './tier1_features/test_f19_billing.mjs';
import { runTier2Tests } from './tier2_boundaries/test_boundaries.mjs';
import { runTier3Tests } from './tier3_combinations/test_combinations.mjs';
import { runTier4Tests } from './tier4_scenarios/test_scenarios.mjs';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const allowPending = args.includes('--allow-pending');
  const engineOnly = args.includes('--engine');
  const webOnly = args.includes('--web');

  let selectedTier = null;
  const tierArgIdx = args.findIndex(a => a === '--tier');
  if (tierArgIdx !== -1 && args[tierArgIdx + 1]) {
    selectedTier = args[tierArgIdx + 1];
  }

  if (!isJson) {
    console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
    console.log(`${ANSI.bold}${ANSI.cyan}      INGR Platform — Comprehensive Multi-Tier E2E Test Suite          ${ANSI.reset}`);
    console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
    console.log(`${ANSI.dim}Mode: ${engineOnly ? 'Engine Only' : webOnly ? 'Web Only' : selectedTier ? `Tier ${selectedTier}` : 'All Tiers'}${ANSI.reset}\n`);
  }

  // Register and execute suites based on flags
  const suitesToRun = [];

  if (!selectedTier || selectedTier === '1') {
    if (!webOnly) {
      suitesToRun.push({ name: 'F1 Docker', fn: runF1Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F2 Engine API', fn: runF2Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F3 Vault', fn: runF3Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F4 Verify Script', fn: runF4Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F5 Hygiene', fn: runF5Tests, tier: 'Tier 1' });
    }
    if (!engineOnly) {
      suitesToRun.push({ name: 'F6 Build & Typecheck', fn: runF6Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F7 Route Integrity', fn: runF7Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F8 Supabase Auth', fn: runF8Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F9 Google OAuth', fn: runF9Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F10 Landing Page', fn: runF10Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F11 Dashboard Shell', fn: runF11Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F12 Recipe Creation', fn: runF12Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F13 Crisp Chat', fn: runF13Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F14 Responsive Styling', fn: runF14Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F15 Test Infrastructure', fn: runF15Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F16 Service Connections', fn: runF16Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F17 Recipe Hosting', fn: runF17Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F18 Recipe Uptime', fn: runF18Tests, tier: 'Tier 1' });
      suitesToRun.push({ name: 'F19 Billing & Security', fn: runF19Tests, tier: 'Tier 1' });
    }
  }

  if (!selectedTier || selectedTier === '2') {
    if (!engineOnly && !webOnly) {
      suitesToRun.push({ name: 'Tier 2 Boundaries', fn: runTier2Tests, tier: 'Tier 2' });
    }
  }

  if (!selectedTier || selectedTier === '3') {
    if (!engineOnly && !webOnly) {
      suitesToRun.push({ name: 'Tier 3 Combinations', fn: runTier3Tests, tier: 'Tier 3' });
    }
  }

  if (!selectedTier || selectedTier === '4') {
    if (!engineOnly && !webOnly) {
      suitesToRun.push({ name: 'Tier 4 Scenarios', fn: runTier4Tests, tier: 'Tier 4' });
    }
  }

  // Execute suites
  for (const suite of suitesToRun) {
    registry.setSuite(suite.name, suite.tier, suite.name);
    if (!isJson) {
      console.log(`${ANSI.bold}► Running [${suite.tier}] ${suite.name}...${ANSI.reset}`);
    }
    const prevCount = registry.results.length;
    await suite.fn();
    const newResults = registry.results.slice(prevCount);

    if (!isJson) {
      for (const res of newResults) {
        if (res.status === 'PASS') {
          console.log(`  ${ANSI.green}✔ PASS${ANSI.reset} ${res.name} ${ANSI.gray}(${res.durationMs}ms)${ANSI.reset}`);
        } else {
          console.log(`  ${ANSI.red}✘ FAIL${ANSI.reset} ${res.name} ${ANSI.gray}(${res.durationMs}ms)${ANSI.reset}`);
          console.log(`     ${ANSI.yellow}Error: ${res.error}${ANSI.reset}`);
        }
      }
      console.log('');
    }
  }

  const summary = registry.getSummary();

  if (isJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    // Print Summary Table
    console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
    console.log(`${ANSI.bold}                          TEST RESULTS SUMMARY                          ${ANSI.reset}`);
    console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);

    // Tier counts
    const tierMap = {};
    for (const r of summary.results) {
      const t = r.tier || 'Other';
      if (!tierMap[t]) tierMap[t] = { total: 0, passed: 0, failed: 0 };
      tierMap[t].total++;
      if (r.status === 'PASS') tierMap[t].passed++;
      else tierMap[t].failed++;
    }

    console.log(`${'Tier / Category'.padEnd(25)} | ${'Total'.padEnd(8)} | ${'Passed'.padEnd(8)} | ${'Failed'.padEnd(8)} | Status`);
    console.log('------------------------------------------------------------------------');
    for (const [tier, counts] of Object.entries(tierMap)) {
      const statusStr = counts.failed === 0 ? `${ANSI.green}ALL PASS${ANSI.reset}` : `${ANSI.red}${counts.failed} FAILED${ANSI.reset}`;
      console.log(`${tier.padEnd(25)} | ${String(counts.total).padEnd(8)} | ${String(counts.passed).padEnd(8)} | ${String(counts.failed).padEnd(8)} | ${statusStr}`);
    }
    console.log('------------------------------------------------------------------------');
    const overallStatus = summary.failed === 0 ? `${ANSI.green}${ANSI.bold}PASSED${ANSI.reset}` : `${ANSI.red}${ANSI.bold}FAILED${ANSI.reset}`;
    console.log(`${ANSI.bold}${'OVERALL TOTAL'.padEnd(25)} | ${String(summary.total).padEnd(8)} | ${String(summary.passed).padEnd(8)} | ${String(summary.failed).padEnd(8)} | ${overallStatus}${ANSI.reset}`);
    console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}\n`);
  }

  if (summary.failed > 0 && !allowPending) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
