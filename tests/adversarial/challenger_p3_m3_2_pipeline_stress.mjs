#!/usr/bin/env node
/**
 * Empirical Stress & Adversarial Suite: Phase 3 Milestone 3 (Challenger 2)
 * Focus: Tier 3 (C07, C08), Tier 4 (S05), and Master Runner Pipeline Resilience.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WEB_DIR = path.resolve(REPO_ROOT, 'web');

process.env.TEST_MODE = 'true';

const createJiti = (await import(path.join(WEB_DIR, 'node_modules/jiti/lib/index.js'))).default;
const jiti = createJiti(path.join(WEB_DIR, 'test_runner.js'), {
  alias: { '@': WEB_DIR },
});

const { RecipeStore } = jiti('./lib/recipes/store.ts');
const { deployToCloudflarePages, isHermeticMode, normalizeFiles } = jiti('./lib/recipes/cloudflare-pages.ts');
const { getUserPlan } = jiti('./lib/recipes/types.ts');
const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');
const deactRoute = jiti('./app/api/recipes/hosting/[id]/deactivate/route.ts');
const recipesRoute = jiti('./app/api/recipes/route.ts');
const server = jiti('./lib/supabase/server.ts');
const apClient = jiti('./lib/activepieces/client.ts');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function runStressTest(name, fn) {
  testsRun++;
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    testsPassed++;
    console.log(`  ${ANSI.green}✔ PASS${ANSI.reset} ${name} ${ANSI.gray}(${duration}ms)${ANSI.reset}`);
  } catch (err) {
    const duration = Date.now() - start;
    testsFailed++;
    console.error(`  ${ANSI.red}✘ FAIL${ANSI.reset} ${name} ${ANSI.gray}(${duration}ms)${ANSI.reset}`);
    console.error(`     ${ANSI.yellow}Error: ${err.message}${ANSI.reset}`);
  }
}

console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
console.log(`${ANSI.bold}${ANSI.cyan}  Phase 3 Milestone 3 — CHALLENGER 2 EMPIRICAL STRESS & PIPELINE SUITE  ${ANSI.reset}`);
console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}\n`);

// =============================================================================
// SECTION 1: Master Runner Pipeline & CLI Interface Verification
// =============================================================================
console.log(`${ANSI.bold}► SECTION 1: Master Runner Pipeline CLI & Output Contracts${ANSI.reset}`);

await runStressTest('CLI-01: runner.mjs with --tier 3 executes exactly 8 tests and passes', async () => {
  const result = spawnSync('node', ['tests/e2e/runner.mjs', '--tier', '3', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${process.env.PATH}:/home/zavitr/.nvm/versions/node/v22.22.3/bin` },
  });
  assertEqual(result.status, 0, `runner.mjs --tier 3 should exit with 0. Stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assertEqual(parsed.total, 8, 'Tier 3 total should be 8');
  assertEqual(parsed.passed, 8, 'Tier 3 passed should be 8');
  assertEqual(parsed.failed, 0, 'Tier 3 failed should be 0');
});

await runStressTest('CLI-02: runner.mjs with --tier 4 executes exactly 5 tests and passes', async () => {
  const result = spawnSync('node', ['tests/e2e/runner.mjs', '--tier', '4', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${process.env.PATH}:/home/zavitr/.nvm/versions/node/v22.22.3/bin` },
  });
  assertEqual(result.status, 0, `runner.mjs --tier 4 should exit with 0. Stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assertEqual(parsed.total, 5, 'Tier 4 total should be 5');
  assertEqual(parsed.passed, 5, 'Tier 4 passed should be 5');
  assertEqual(parsed.failed, 0, 'Tier 4 failed should be 0');
});

await runStressTest('CLI-03: runner.mjs handles non-existent tier flag gracefully without unhandled crash', async () => {
  const result = spawnSync('node', ['tests/e2e/runner.mjs', '--tier', '99', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${process.env.PATH}:/home/zavitr/.nvm/versions/node/v22.22.3/bin` },
  });
  assertEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assertEqual(parsed.total, 0);
  assertEqual(parsed.failed, 0);
});

await runStressTest('CLI-04: runner.mjs structured JSON schema compliance', async () => {
  const result = spawnSync('node', ['tests/e2e/runner.mjs', '--tier', '3', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${process.env.PATH}:/home/zavitr/.nvm/versions/node/v22.22.3/bin` },
  });
  const parsed = JSON.parse(result.stdout);
  assert(typeof parsed.total === 'number', 'summary.total must be number');
  assert(typeof parsed.passed === 'number', 'summary.passed must be number');
  assert(typeof parsed.failed === 'number', 'summary.failed must be number');
  assert(Array.isArray(parsed.results), 'summary.results must be an array');
  for (const item of parsed.results) {
    assert(typeof item.name === 'string', 'result.name must be string');
    assert(typeof item.status === 'string', 'result.status must be string');
    assert(typeof item.durationMs === 'number', 'result.durationMs must be number');
    assert(item.status === 'PASS' || item.status === 'FAIL', 'status must be PASS or FAIL');
  }
});

// =============================================================================
// SECTION 2: Tier 3 (C07) Recipe Lifecycle & Plan Limit Stress
// =============================================================================
console.log(`\n${ANSI.bold}► SECTION 2: Tier 3 (C07) Recipe State Transitions & Quota Hardening${ANSI.reset}`);

await runStressTest('C07-STRESS-01: Pro plan user bypasses 2-recipe quota up to 10 active recipes', async () => {
  const proUser = `usr_pro_stress_${Date.now()}`;
  const store = new RecipeStore();
  
  for (let i = 1; i <= 10; i++) {
    await store.createRecipe({
      userId: proUser,
      name: `Pro Site ${i}`,
      subdomain: `pro-site-${i}`,
      status: 'active',
      services: ['cloudflare'],
    });
  }
  
  const count = await store.countActive(proUser);
  assertEqual(count, 10, 'Pro user should have 10 active recipes in store');
  
  const userObj = { id: proUser, email: `${proUser}@test.local`, app_metadata: { plan: 'pro' } };
  const plan = getUserPlan(userObj, count);
  assertEqual(plan.tier, 'pro');
  assertEqual(plan.canActivateMore, true, 'Pro plan must allow activating more beyond 2');
});

await runStressTest('C07-STRESS-02: Sequential creation strictly enforces Free plan limit of 2 (3rd rejected with 403)', async () => {
  const freeUser = `usr_seq_quota_${Date.now()}`;
  const origAuth = server.getAuthenticatedUser;
  const origToken = apClient.getCloudflareApiToken;
  
  try {
    server.getAuthenticatedUser = async () => ({
      id: freeUser,
      email: `${freeUser}@test.local`,
      app_metadata: { plan: 'free' },
    });
    apClient.getCloudflareApiToken = async () => 'cf_stress_mock_token';
    
    // 1st recipe
    const req1 = new Request('http://localhost:3000/api/recipes/hosting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: 'site-seq-1',
        files: [{ path: 'index.html', content: '<h1>Site 1</h1>' }],
      }),
    });
    const res1 = await hostingRoute.POST(req1);
    assertEqual(res1.status, 201, '1st creation must succeed with 201');
    
    // 2nd recipe
    const req2 = new Request('http://localhost:3000/api/recipes/hosting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: 'site-seq-2',
        files: [{ path: 'index.html', content: '<h1>Site 2</h1>' }],
      }),
    });
    const res2 = await hostingRoute.POST(req2);
    assertEqual(res2.status, 201, '2nd creation must succeed with 201');
    
    // 3rd recipe (must be blocked by quota)
    const req3 = new Request('http://localhost:3000/api/recipes/hosting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: 'site-seq-3',
        files: [{ path: 'index.html', content: '<h1>Site 3</h1>' }],
      }),
    });
    const res3 = await hostingRoute.POST(req3);
    assertEqual(res3.status, 403, '3rd creation must be rejected with 403 PLAN_LIMIT_EXCEEDED');
    const body3 = await res3.json();
    assertEqual(body3.code, 'PLAN_LIMIT_EXCEEDED');
    
    const store = new RecipeStore();
    assertEqual(await store.countActive(freeUser), 2, 'Active count must remain exactly 2');
  } finally {
    server.getAuthenticatedUser = origAuth;
    apClient.getCloudflareApiToken = origToken;
  }
});

await runStressTest('C07-STRESS-03: Updating active recipe does NOT trigger false-positive quota block', async () => {
  const freeUser = `usr_update_active_${Date.now()}`;
  const origAuth = server.getAuthenticatedUser;
  const origToken = apClient.getCloudflareApiToken;
  
  try {
    server.getAuthenticatedUser = async () => ({
      id: freeUser,
      email: `${freeUser}@test.local`,
      app_metadata: { plan: 'free' },
    });
    apClient.getCloudflareApiToken = async () => 'cf_stress_mock_token';
    
    const store = new RecipeStore();
    const rec1 = await store.createRecipe({
      userId: freeUser,
      name: 'Site 1',
      subdomain: 'site-1',
      status: 'active',
      services: ['cloudflare'],
    });
    const rec2 = await store.createRecipe({
      userId: freeUser,
      name: 'Site 2',
      subdomain: 'site-2',
      status: 'active',
      services: ['cloudflare'],
    });
    
    assertEqual(await store.countActive(freeUser), 2);
    
    // Update Site 1 while Site 1 is ALREADY active
    const updateReq = new Request(`http://localhost:3000/api/recipes/hosting/${rec1.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{ path: 'index.html', content: '<h1>Updated Site 1</h1>' }],
      }),
    });
    const updateRes = await updateRoute.POST(updateReq, { params: { id: rec1.id } });
    assertEqual(updateRes.status, 200, 'Updating an ALREADY active recipe must succeed with 200, not blocked by 403 quota');
    const body = await updateRes.json();
    assertEqual(body.recipe.status, 'active');
  } finally {
    server.getAuthenticatedUser = origAuth;
    apClient.getCloudflareApiToken = origToken;
  }
});

await runStressTest('C07-STRESS-04: Idempotent deactivation on already inactive recipe maintains 0 active count', async () => {
  const user = `usr_idempotent_${Date.now()}`;
  const store = new RecipeStore();
  const rec = await store.createRecipe({
    userId: user,
    name: 'Single Site',
    subdomain: 'single-site',
    status: 'active',
    services: ['cloudflare'],
  });
  
  // 1st deactivate
  const deact1 = await store.deactivateRecipe(user, rec.id);
  assertEqual(deact1.status, 'inactive');
  assertEqual(await store.countActive(user), 0);
  
  // 2nd deactivate (idempotent)
  const deact2 = await store.deactivateRecipe(user, rec.id);
  assertEqual(deact2.status, 'inactive');
  assertEqual(await store.countActive(user), 0, 'Count must remain 0 after second deactivation');
});

await runStressTest('C07-STRESS-05: Rapid oscillation cycle (activate <-> deactivate x4) preserves counter consistency', async () => {
  const user = `usr_oscillate_${Date.now()}`;
  const store = new RecipeStore();
  const rec = await store.createRecipe({
    userId: user,
    name: 'Oscillating Site',
    subdomain: 'osc-site',
    status: 'active',
    services: ['cloudflare'],
  });
  
  for (let cycle = 1; cycle <= 4; cycle++) {
    const deactivated = await store.deactivateRecipe(user, rec.id);
    assertEqual(deactivated.status, 'inactive');
    assertEqual(await store.countActive(user), 0, `Cycle ${cycle} deactivation must result in 0 active`);
    
    const reactivated = await store.updateRecipe(user, rec.id, { status: 'active' });
    assertEqual(reactivated.status, 'active');
    assertEqual(await store.countActive(user), 1, `Cycle ${cycle} reactivation must result in 1 active`);
  }
});

await runStressTest('C07-STRESS-06: Error state recipes do not consume active quota; reactivation checks quota', async () => {
  const user = `usr_error_state_${Date.now()}`;
  const store = new RecipeStore();
  
  const rec1 = await store.createRecipe({
    userId: user,
    name: 'Site 1',
    subdomain: 'site-1',
    status: 'active',
  });
  const rec2 = await store.createRecipe({
    userId: user,
    name: 'Site 2',
    subdomain: 'site-2',
    status: 'active',
  });
  const errRec = await store.createRecipe({
    userId: user,
    name: 'Error Site',
    subdomain: 'site-err',
    status: 'error',
  });
  
  // Error recipe should NOT count as active
  assertEqual(await store.countActive(user), 2, 'Error recipe must not count towards active quota');
  
  // Attempting to update error recipe to active when quota is full (2/2) should be blocked in store
  const attemptReactivate = await store.updateRecipe(user, errRec.id, { status: 'active' }, 2);
  assertEqual(attemptReactivate.status, 'error', 'Reactivation beyond quota of 2 must remain in existing status');
  assertEqual(await store.countActive(user), 2);
  
  // Deactivate rec1 (frees 1 slot)
  await store.deactivateRecipe(user, rec1.id);
  assertEqual(await store.countActive(user), 1);
  
  // Now reactivate errRec to active
  const successReactivate = await store.updateRecipe(user, errRec.id, { status: 'active' }, 2);
  assertEqual(successReactivate.status, 'active', 'Reactivation with available quota must succeed');
  assertEqual(await store.countActive(user), 2);
});

// =============================================================================
// SECTION 3: Tier 3 (C08) Multi-Tenant Recipe Isolation Under Hostile Attacks
// =============================================================================
console.log(`\n${ANSI.bold}► SECTION 3: Tier 3 (C08) Multi-Tenant Security & Attack Resistance${ANSI.reset}`);

await runStressTest('C08-STRESS-01: Path traversal attack in recipe ID returns 404 and does not leak data', async () => {
  const attackerUser = `usr_attacker_${Date.now()}`;
  const origAuth = server.getAuthenticatedUser;
  
  try {
    server.getAuthenticatedUser = async () => ({
      id: attackerUser,
      email: `${attackerUser}@evil.local`,
    });
    
    const maliciousIds = [
      '../../etc/passwd',
      '..%2F..%2Fetc%2Fpasswd',
      `rec_valid' OR '1'='1`,
      'rec_\x00_nullbyte',
      '../recipes/victim_id',
    ];
    
    for (const badId of maliciousIds) {
      const req = new Request(`http://localhost:3000/api/recipes/hosting/${badId}/deactivate`, {
        method: 'POST',
      });
      const res = await deactRoute.POST(req, { params: { id: badId } });
      assertEqual(res.status, 404, `Malicious recipe ID "${badId}" must return 404 Not Found`);
    }
  } finally {
    server.getAuthenticatedUser = origAuth;
  }
});

await runStressTest('C08-STRESS-02: Direct Store Scoping prevents cross-tenant update or deletion', async () => {
  const store = new RecipeStore();
  const aliceId = `usr_alice_${Date.now()}`;
  const bobId = `usr_bob_${Date.now()}`;
  
  const bobRecipe = await store.createRecipe({
    userId: bobId,
    name: "Bob's Confidential Recipe",
    subdomain: 'bob-private',
    status: 'active',
    metadata: { secretToken: 'bob_super_secret_value' },
  });
  
  // Alice tries to update Bob's recipe directly in store
  const aliceAttempt = await store.updateRecipe(aliceId, bobRecipe.id, {
    name: "Alice Hacked Bob",
  });
  assertEqual(aliceAttempt, null, 'Store update across tenants must return null');
  
  // Verify Bob recipe remains unmutated
  const bobCheck = await store.getRecipeById(bobId, bobRecipe.id);
  assertEqual(bobCheck.name, "Bob's Confidential Recipe");
  assertEqual(bobCheck.metadata.secretToken, 'bob_super_secret_value');
  
  // Alice tries to deactivate Bob's recipe directly in store
  const aliceDeactAttempt = await store.deactivateRecipe(aliceId, bobRecipe.id);
  assertEqual(aliceDeactAttempt, null, 'Store deactivate across tenants must return null');
  
  // Verify Bob recipe still active
  const bobCheck2 = await store.getRecipeById(bobId, bobRecipe.id);
  assertEqual(bobCheck2.status, 'active');
});

await runStressTest('C08-STRESS-03: Multi-tenant list isolation with multiple items per tenant', async () => {
  const store = new RecipeStore();
  const aliceId = `usr_alice_multi_${Date.now()}`;
  const bobId = `usr_bob_multi_${Date.now()}`;
  
  // Alice creates 3 recipes
  for (let i = 1; i <= 3; i++) {
    await store.createRecipe({
      userId: aliceId,
      name: `Alice Site ${i}`,
      subdomain: `alice-site-${i}`,
      status: 'active',
    });
  }
  
  // Bob creates 2 recipes
  for (let i = 1; i <= 2; i++) {
    await store.createRecipe({
      userId: bobId,
      name: `Bob Site ${i}`,
      subdomain: `bob-site-${i}`,
      status: 'active',
    });
  }
  
  const origAuth = server.getAuthenticatedUser;
  try {
    // Check Alice API listing
    server.getAuthenticatedUser = async () => ({ id: aliceId, email: `${aliceId}@test.local` });
    const aliceRes = await recipesRoute.GET(new Request('http://localhost:3000/api/recipes'));
    assertEqual(aliceRes.status, 200);
    const aliceData = await aliceRes.json();
    assertEqual(aliceData.recipes.length, 3, 'Alice must see exactly 3 recipes');
    assert(aliceData.recipes.every(r => r.userId === aliceId), 'All recipes must belong to Alice');
    
    // Check Bob API listing
    server.getAuthenticatedUser = async () => ({ id: bobId, email: `${bobId}@test.local` });
    const bobRes = await recipesRoute.GET(new Request('http://localhost:3000/api/recipes'));
    assertEqual(bobRes.status, 200);
    const bobData = await bobRes.json();
    assertEqual(bobData.recipes.length, 2, 'Bob must see exactly 2 recipes');
    assert(bobData.recipes.every(r => r.userId === bobId), 'All recipes must belong to Bob');
  } finally {
    server.getAuthenticatedUser = origAuth;
  }
});

await runStressTest('C08-STRESS-04: Subdomain collision resistance between tenants', async () => {
  const store = new RecipeStore();
  const user1 = `usr_collision_1_${Date.now()}`;
  const user2 = `usr_collision_2_${Date.now()}`;
  
  const rec1 = await store.createRecipe({
    userId: user1,
    name: 'Shared Name',
    subdomain: 'cool-app',
    status: 'active',
  });
  
  const rec2 = await store.createRecipe({
    userId: user2,
    name: 'Shared Name',
    subdomain: 'cool-app',
    status: 'active',
  });
  
  // Both recipes should exist independently in respective user lists with distinct IDs
  assert(rec1.id !== rec2.id, 'Recipe IDs must be unique');
  const user1List = await store.listRecipes(user1);
  const user2List = await store.listRecipes(user2);
  assertEqual(user1List.length, 1);
  assertEqual(user2List.length, 1);
  assertEqual(user1List[0].id, rec1.id);
  assertEqual(user2List[0].id, rec2.id);
});

// =============================================================================
// SECTION 4: Tier 4 (S05) Deployment Orchestration & File Edge Cases
// =============================================================================
console.log(`\n${ANSI.bold}► SECTION 4: Tier 4 (S05) Deployment Orchestration & File Edge Cases${ANSI.reset}`);

await runStressTest('S05-STRESS-01: Direct Upload SHA-256 Manifest generation via normalizeFiles is deterministic', async () => {
  const file1 = { path: 'index.html', content: '<h1>Deterministic Test</h1>' };
  const file2 = { path: 'assets/app.js', content: 'console.log("hello world");' };
  
  const normalized = normalizeFiles([file1, file2]);
  assertEqual(normalized.length, 2);
  
  const expectedHash1 = crypto.createHash('sha256').update(file1.content).digest('hex');
  const expectedHash2 = crypto.createHash('sha256').update(file2.content).digest('hex');
  
  assertEqual(normalized[0].hash, expectedHash1, 'Normalized file 1 hash must match sha256 hex');
  assertEqual(normalized[1].hash, expectedHash2, 'Normalized file 2 hash must match sha256 hex');
  assertEqual(normalized[0].path, '/index.html', 'Leading slash must be normalized');
  assertEqual(normalized[1].path, '/assets/app.js', 'Subpath must be normalized');
});

await runStressTest('S05-STRESS-02: deployToCloudflarePages handles multi-directory structures', async () => {
  const result = await deployToCloudflarePages({
    apiToken: 'cf_test_mock_token_s05_nested',
    projectName: 'nested-site-test',
    files: [
      { path: 'index.html', content: '<html><body>Home</body></html>' },
      { path: 'css/main.css', content: 'body { color: black; }' },
      { path: 'js/components/button.js', content: 'export default () => {};' },
      { path: 'images/logo.svg', content: '<svg></svg>' },
    ],
  });
  
  assertEqual(result.status, 'active');
  assertEqual(result.url, 'https://nested-site-test.pages.dev');
  assert(result.deploymentId.startsWith('dep_sim_'));
});

await runStressTest('S05-STRESS-03: deployToCloudflarePages rejects missing root index.html', async () => {
  let errorCaught = false;
  try {
    await deployToCloudflarePages({
      apiToken: 'cf_test_mock_token_s05_nested',
      projectName: 'invalid-site',
      files: [
        { path: 'about.html', content: '<html>About</html>' },
        { path: 'styles.css', content: 'body {}' },
      ],
    });
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('index.html'), `Error must mention index.html, got: ${err.message}`);
  }
  assert(errorCaught, 'Must throw error when root index.html is missing');
});

await runStressTest('S05-STRESS-04: isHermeticMode token classification accuracy under non-test environment', async () => {
  // Temporarily unset TEST_MODE to verify pure token-based logic
  const savedTestMode = process.env.TEST_MODE;
  const savedCfMock = process.env.CLOUDFLARE_MOCK;
  delete process.env.TEST_MODE;
  delete process.env.CLOUDFLARE_MOCK;
  
  try {
    // Hermetic tokens:
    assert(isHermeticMode('cf_test_token'), 'cf_test_ must be hermetic');
    assert(isHermeticMode('mock_cf_pages_token'), 'mock_ must be hermetic');
    assert(isHermeticMode('test_abc_123'), 'test_ must be hermetic');
    assert(isHermeticMode('mock'), 'mock must be hermetic');
    
    // Live tokens:
    assert(!isHermeticMode('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'), 'Standard token should not be hermetic');
    assert(!isHermeticMode('live_prod_cloudflare_token_secret'), 'Live production token should not be hermetic');
  } finally {
    process.env.TEST_MODE = savedTestMode;
    if (savedCfMock !== undefined) process.env.CLOUDFLARE_MOCK = savedCfMock;
  }
});

// =============================================================================
// SECTION 5: Activepieces Rate-Limiting Empirical Analysis
// =============================================================================
console.log(`\n${ANSI.bold}► SECTION 5: Activepieces Auth Rate-Limit Empirical Characterization${ANSI.reset}`);

await runStressTest('RATE-01: Probing Activepieces rate-limit headers on /api/v1/authentication/sign-in', async () => {
  const probeRes = await fetch('http://localhost:8080/api/v1/authentication/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ingr.local', password: 'IngrAdminPassword2026!' }),
  });
  
  const limitHeader = probeRes.headers.get('x-ratelimit-limit');
  const remainingHeader = probeRes.headers.get('x-ratelimit-remaining');
  
  console.log(`     ${ANSI.gray}Status: ${probeRes.status}, Limit: ${limitHeader}, Remaining: ${remainingHeader}${ANSI.reset}`);
  
  // Either 200 or 429
  assert(probeRes.status === 200 || probeRes.status === 429, `Status should be 200 or 429, got ${probeRes.status}`);
  if (probeRes.status === 200) {
    assert(limitHeader !== null, 'Rate limit header should be present');
    assertEqual(parseInt(limitHeader, 10), 50, 'Fastify default rate limit is 50 req/min');
  }
});

console.log(`\n${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
console.log(`${ANSI.bold}               CHALLENGER 2 STRESS HARNESS SUMMARY                      ${ANSI.reset}`);
console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
console.log(`Total Stress Tests : ${testsRun}`);
console.log(`Passed             : ${ANSI.green}${testsPassed}${ANSI.reset}`);
console.log(`Failed             : ${testsFailed === 0 ? ANSI.green + '0' : ANSI.red + String(testsFailed)}${ANSI.reset}`);
console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}\n`);

process.exit(testsFailed > 0 ? 1 : 0);
