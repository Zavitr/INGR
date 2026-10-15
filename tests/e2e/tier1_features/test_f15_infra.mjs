/**
 * Tier 1: Feature F15 - E2E Test Suite & Test Infrastructure
 * Authoritative source: PROJECT.md (Feature F15, Milestones M3 & M4), Project Pattern
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual } from '../helpers/assertions.mjs';
import { PROJECT_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F15 Test Suite Infrastructure', 'Tier 1', 'F15');

export async function runF15Tests() {
  const runnerShPath = path.join(PROJECT_ROOT, 'tests/e2e/run_all.sh');
  const runnerJsPath = path.join(PROJECT_ROOT, 'tests/e2e/runner.mjs');
  const testInfraPath = path.join(PROJECT_ROOT, 'TEST_INFRA.md');
  const testReadyPath = path.join(PROJECT_ROOT, 'TEST_READY.md');

  await registry.runTest('F15-01: Master runner script tests/e2e/run_all.sh exists and is executable', async () => {
    assert(fs.existsSync(runnerShPath), 'tests/e2e/run_all.sh must exist');
    const stat = fs.statSync(runnerShPath);
    const isExecutable = (stat.mode & 0o111) !== 0;
    assert(isExecutable, 'tests/e2e/run_all.sh must be executable (+x)');
  });

  await registry.runTest('F15-02: Node test runner harness tests/e2e/runner.mjs exists', async () => {
    assert(fs.existsSync(runnerJsPath), 'tests/e2e/runner.mjs must exist');
  });

  await registry.runTest('F15-03: Test runner provides structured output formatting', async () => {
    const content = fs.readFileSync(runnerJsPath, 'utf-8');
    assert(
      content.includes('PASS') && content.includes('FAIL') && content.includes('summary'),
      'Runner must implement structured pass/fail tracking and summary output'
    );
  });

  await registry.runTest('F15-04: TEST_INFRA.md exists in project root with architectural documentation', async () => {
    assert(fs.existsSync(testInfraPath), 'TEST_INFRA.md must exist in project root');
  });

  await registry.runTest('F15-05: TEST_READY.md exists in project root documenting test results and execution', async () => {
    assert(fs.existsSync(testReadyPath), 'TEST_READY.md must exist in project root');
  });
}

if (process.argv[1]?.endsWith('test_f15_infra.mjs')) {
  runF15Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
