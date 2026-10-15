/**
 * Tier 1: Feature F4 - Engine Standalone Verification Script
 * Authoritative source: ORIGINAL_REQUEST.md (R1 Acceptance), PROJECT.md (Feature F4)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { ENGINE_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F4 Standalone Verification Script', 'Tier 1', 'F4');

export async function runF4Tests() {
  const verifyScriptPath = path.join(ENGINE_ROOT, 'verify.sh');

  await registry.runTest('F4-01: verify.sh exists and is executable', async () => {
    assert(fs.existsSync(verifyScriptPath), `verify.sh must exist at ${verifyScriptPath}`);
    const stat = fs.statSync(verifyScriptPath);
    const isExecutable = (stat.mode & 0o111) !== 0;
    assert(isExecutable, 'verify.sh must have executable permissions (+x)');
  });

  await registry.runTest('F4-02: verify.sh executes successfully and returns exit code 0', async () => {
    const output = execSync(`bash "${verifyScriptPath}"`, { encoding: 'utf-8' });
    assertIncludes(output, 'ALL CHECKS PASSED', 'Script output must indicate all checks passed');
  });

  await registry.runTest('F4-03: verify.sh validates all 5 core engine phases', async () => {
    const output = execSync(`bash "${verifyScriptPath}"`, { encoding: 'utf-8' });
    assertIncludes(output, '[1/5]', 'Must include flags check [1/5]');
    assertIncludes(output, '[2/5]', 'Must include health check [2/5]');
    assertIncludes(output, '[3/5]', 'Must include authentication check [3/5]');
    assertIncludes(output, '[4/5]', 'Must include app connections check [4/5]');
    assertIncludes(output, '[5/5]', 'Must include pieces check [5/5]');
  });

  await registry.runTest('F4-04: verify.sh respects ACTIVEPIECES_API_URL environment variable', async () => {
    const output = execSync(`ACTIVEPIECES_API_URL="http://localhost:8080" bash "${verifyScriptPath}"`, { encoding: 'utf-8' });
    assertIncludes(output, 'Target URL: http://localhost:8080', 'Script must print targeted URL');
  });

  await registry.runTest('F4-05: verify.sh handles unreachable engine with non-zero exit code', async () => {
    let failedAsExpected = false;
    try {
      execSync(`ACTIVEPIECES_API_URL="http://127.0.0.1:59999" bash "${verifyScriptPath}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (err) {
      failedAsExpected = true;
      assert(err.status !== 0, 'Exit code must be non-zero on unreachable server');
    }
    assert(failedAsExpected, 'Execution against bogus port must fail');
  });
}

if (process.argv[1]?.endsWith('test_f4_verify.mjs')) {
  runF4Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
