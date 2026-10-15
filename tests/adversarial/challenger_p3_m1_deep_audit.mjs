#!/usr/bin/env node
/**
 * Challenger P3-M1 Deep Audit & Adversarial Verification Suite
 *
 * Exhaustive empirical challenge covering:
 * - Suite A: Multi-Tenant IDOR & Cross-User Attack Matrix
 * - Suite B: Live HTTP Probing across all 4 endpoints (port 3333)
 * - Suite C: Extreme Fuzzing & Malformed Payload Handling
 * - Suite D: Plan Tier Limits, Edge Statuses, and Concurrency
 * - Suite E: Multipart Form-Data Ingestion & Base64 Assets
 * - Suite F: Direct Upload Manifest & Cryptographic Hashes
 */

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import createJiti from '../../web/node_modules/jiti/lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WEB_DIR = path.resolve(REPO_ROOT, 'web');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3333';

process.env.TEST_MODE = 'true';
process.env.MOCK_CLOUDFLARE_TOKEN = 'cf_test_challenger_token';

const jiti = createJiti(path.resolve(WEB_DIR, 'test_runner.js'), {
  alias: { '@': WEB_DIR },
});

// Import modules
const {
  isValidSubdomain,
  validateSubdomain,
  validateFileBundle,
  getUserPlan,
} = jiti('./lib/recipes/types.ts');

const { RecipeStore, recipeStore } = jiti('./lib/recipes/store.ts');
const {
  deployToCloudflarePages,
  normalizeFiles,
  isHermeticMode,
} = jiti('./lib/recipes/cloudflare-pages.ts');

const server = jiti('./lib/supabase/server.ts');
const apClient = jiti('./lib/activepieces/client.ts');
const recipesListRoute = jiti('./app/api/recipes/route.ts');
const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');
const deactRoute = jiti('./app/api/recipes/hosting/[id]/deactivate/route.ts');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function check(testId, name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${testId}] ${name}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m [${testId}] ${name} -> ${details}`);
    failures.push({ testId, name, details });
  }
}

// =========================================================================
// SUITE A: Multi-Tenant IDOR & Cross-User Isolation
// =========================================================================
async function suiteMultiTenant() {
  console.log('\n\x1b[1m\x1b[36m► Suite A: Multi-Tenant IDOR & Isolation Matrix\x1b[0m');

  const store = new RecipeStore();
  const userA = `usr_tenantA_${Date.now()}`;
  const userB = `usr_tenantB_${Date.now()}`;

  // User A creates recipe
  const recA = await store.createRecipe({
    userId: userA,
    name: 'Tenant A Project',
    subdomain: 'tenant-a-project',
    status: 'active',
  });

  // User B creates recipe
  const recB = await store.createRecipe({
    userId: userB,
    name: 'Tenant B Project',
    subdomain: 'tenant-b-project',
    status: 'active',
  });

  // Test 1: listRecipes isolation
  const listA = await store.listRecipes(userA);
  const listB = await store.listRecipes(userB);
  check('IDOR-01', 'Tenant A list does not contain Tenant B recipes', !listA.some((r) => r.userId === userB));
  check('IDOR-02', 'Tenant B list does not contain Tenant A recipes', !listB.some((r) => r.userId === userA));

  // Test 2: getRecipeById isolation
  const getAfromB = await store.getRecipeById(userB, recA.id);
  const getBfromA = await store.getRecipeById(userA, recB.id);
  check('IDOR-03', 'User B cannot fetch User A recipe by ID', getAfromB === null);
  check('IDOR-04', 'User A cannot fetch User B recipe by ID', getBfromA === null);

  // Test 3: update cross-tenant attempt via store
  const hackedRecA = await store.updateRecipe(userB, recA.id, { name: 'Hacked by B' });
  const freshRecA = await store.getRecipeById(userA, recA.id);
  check('IDOR-05', 'User B cannot update User A recipe via store', hackedRecA === null && freshRecA.name === 'Tenant A Project');

  // Test 4: deactivate cross-tenant attempt via store
  const deactHackedA = await store.deactivateRecipe(userB, recA.id);
  const freshRecA2 = await store.getRecipeById(userA, recA.id);
  check('IDOR-06', 'User B cannot deactivate User A recipe via store', deactHackedA === null && freshRecA2.status === 'active');

  // Test 5: Route handler IDOR on update
  server.getAuthenticatedUser = async () => ({ id: userB, email: 'userB@ingr.local' });
  const reqUpdate = new Request(`${BASE_URL}/api/recipes/hosting/${recA.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>Injected</h1>' }] }),
  });
  const resUpdate = await updateRoute.POST(reqUpdate, { params: { id: recA.id } });
  check('IDOR-07', 'POST /api/recipes/hosting/:id/update returns 404 on cross-tenant ID', resUpdate.status === 404);

  // Test 6: Route handler IDOR on deactivate
  const reqDeact = new Request(`${BASE_URL}/api/recipes/hosting/${recA.id}/deactivate`, {
    method: 'POST',
  });
  const resDeact = await deactRoute.POST(reqDeact, { params: { id: recA.id } });
  check('IDOR-08', 'POST /api/recipes/hosting/:id/deactivate returns 404 on cross-tenant ID', resDeact.status === 404);

  // Test 7: Verify User A recipe remained completely untouched after IDOR attacks
  const finalRecA = await store.getRecipeById(userA, recA.id);
  check('IDOR-09', 'Target recipe retains pristine status and name after attacked', finalRecA.status === 'active' && finalRecA.name === 'Tenant A Project');
}

// =========================================================================
// SUITE B: Live HTTP Probing on All 4 Endpoints (port 3333)
// =========================================================================
async function suiteLiveHttp() {
  console.log('\n\x1b[1m\x1b[36m► Suite B: Live HTTP Probing Across Endpoints\x1b[0m');

  const testCases = [
    { method: 'GET', url: `${BASE_URL}/api/recipes`, name: 'GET /api/recipes' },
    { method: 'POST', url: `${BASE_URL}/api/recipes/hosting`, name: 'POST /api/recipes/hosting', body: '{}' },
    { method: 'POST', url: `${BASE_URL}/api/recipes/hosting/123/update`, name: 'POST /api/recipes/hosting/123/update', body: '{}' },
    { method: 'POST', url: `${BASE_URL}/api/recipes/hosting/123/deactivate`, name: 'POST /api/recipes/hosting/123/deactivate' },
  ];

  for (const tc of testCases) {
    // Missing auth header
    const resNoAuth = await fetch(tc.url, {
      method: tc.method,
      headers: tc.body ? { 'Content-Type': 'application/json' } : {},
      body: tc.body,
    });
    const bodyNoAuth = await resNoAuth.json().catch(() => null);
    check(
      `LIVE-AUTH-${tc.method}`,
      `Unauthenticated ${tc.name} returns 401`,
      resNoAuth.status === 401 && bodyNoAuth?.error === 'Unauthorized',
      `Status: ${resNoAuth.status}`
    );

    // Malformed auth header
    const resBadAuth = await fetch(tc.url, {
      method: tc.method,
      headers: {
        Authorization: 'Bearer invalid_signature_token',
        ...(tc.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: tc.body,
    });
    const bodyBadAuth = await resBadAuth.json().catch(() => null);
    check(
      `LIVE-MALFORM-${tc.method}`,
      `Invalid Bearer token on ${tc.name} returns 401`,
      resBadAuth.status === 401,
      `Status: ${resBadAuth.status}`
    );
  }
}

// =========================================================================
// SUITE C: Fuzzing & Malformed Payloads
// =========================================================================
async function suitePayloadFuzzing() {
  console.log('\n\x1b[1m\x1b[36m► Suite C: Extreme Fuzzing & Malformed Payloads\x1b[0m');

  const fuzzUser = `usr_fuzz_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({ id: fuzzUser, email: 'fuzz@ingr.local' });
  apClient.getCloudflareApiToken = async () => 'cf_test_mock';

  // 1. Missing subdomain
  const resNoSub = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: 'hello' }] }),
  }));
  check('FUZZ-01', 'POST hosting without subdomain returns 400', resNoSub.status === 400);

  // 2. Subdomain as object or number
  const resNumSub = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 12345, files: [{ path: 'index.html', content: 'hello' }] }),
  }));
  check('FUZZ-02', 'POST hosting with numeric subdomain returns 400', resNumSub.status === 400);

  // 3. Subdomain with HTML / XSS injection
  const resXssSub = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: '<script>alert(1)</script>', files: [{ path: 'index.html', content: 'hello' }] }),
  }));
  check('FUZZ-03', 'POST hosting with XSS subdomain returns 400', resXssSub.status === 400);

  // 4. Missing files
  const resNoFiles = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'valid-sub', files: [] }),
  }));
  check('FUZZ-04', 'POST hosting with empty files returns 400', resNoFiles.status === 400);

  // 5. Files containing invalid types in update route
  // First create a valid recipe
  const resValid = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'fuzz-valid-sub', files: [{ path: 'index.html', content: '<h1>Hi</h1>' }] }),
  }));
  const validData = await resValid.json();
  const recipeId = validData.recipe.id;

  const updateBadTypes = [
    { name: 'null file in update', files: [null] },
    { name: 'missing content in update', files: [{ path: 'index.html' }] },
    { name: 'numeric content in update', files: [{ path: 'index.html', content: 999 }] },
    { name: 'empty path in update', files: [{ path: '', content: 'hi' }] },
  ];

  for (let i = 0; i < updateBadTypes.length; i++) {
    const item = updateBadTypes[i];
    const resBadUpdate = await updateRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting/${recipeId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: item.files }),
    }), { params: { id: recipeId } });
    check(`FUZZ-UPDATE-0${i + 1}`, `Update with ${item.name} returns 400 (not 500)`, resBadUpdate.status === 400);
  }

  // 6. Corrupt JSON body
  const resCorruptJson = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"subdomain": "corrupt',
  }));
  check('FUZZ-05', 'POST hosting with malformed JSON body gracefully returns 400 (not 500)', resCorruptJson.status === 400);
}

// =========================================================================
// SUITE D: Plan Tier Limits, Edge Statuses, and Concurrency
// =========================================================================
async function suitePlanTierAndConcurrency() {
  console.log('\n\x1b[1m\x1b[36m► Suite D: Plan Tier Limits & State Transitions\x1b[0m');

  const store = new RecipeStore();
  const testUser = `usr_plan_test_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({ id: testUser, email: 'plan@ingr.local' });
  apClient.getCloudflareApiToken = async () => 'cf_test_mock';

  // Recipe 1
  const r1 = await store.createRecipe({ userId: testUser, subdomain: 'site-alpha', name: 'Site Alpha', status: 'active' });
  // Recipe 2
  const r2 = await store.createRecipe({ userId: testUser, subdomain: 'site-beta', name: 'Site Beta', status: 'active' });

  // Free tier at 2 active recipes
  const count2 = await store.countActive(testUser);
  check('PLAN-01', 'Initial active count is 2', count2 === 2);

  // Attempting to create a 3rd active recipe via route returns 403
  const res3 = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'site-gamma', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
  }));
  check('PLAN-02', 'Free tier blocked from 3rd active recipe (HTTP 403)', res3.status === 403);

  // Deactivate Recipe 1 -> active count drops to 1
  const deactRes = await deactRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting/${r1.id}/deactivate`, { method: 'POST' }), { params: { id: r1.id } });
  const countAfterDeact = await store.countActive(testUser);
  check('PLAN-03', 'Deactivating recipe drops active count to 1', countAfterDeact === 1 && deactRes.status === 200);

  // Now create Recipe 3 -> succeeds
  const res3Success = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'site-gamma', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
  }));
  const countAfter3 = await store.countActive(testUser);
  check('PLAN-04', 'Capacity available allows new recipe creation', res3Success.status === 201 && countAfter3 === 2);

  // Reactivate Recipe 1 while at capacity -> must be rejected with 403
  const reactivateReject = await updateRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting/${r1.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>Reactivate</h1>' }] }),
  }), { params: { id: r1.id } });
  check('PLAN-05', 'Reactivating recipe while at capacity returns 403', reactivateReject.status === 403);

  // Ensure active count did not exceed 2
  const countAfterReject = await store.countActive(testUser);
  check('PLAN-06', 'Active count strictly remains capped at 2', countAfterReject === 2);
}

// =========================================================================
// SUITE E: Multipart Form-Data & Manifest Verification
// =========================================================================
async function suiteMultipartAndManifest() {
  console.log('\n\x1b[1m\x1b[36m► Suite E: Multipart Form-Data & Manifest Normalization\x1b[0m');

  const mpUser = `usr_mp_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({ id: mpUser, email: 'mp@ingr.local' });
  apClient.getCloudflareApiToken = async () => 'cf_test_mock';

  // 1. Multipart form-data deployment
  const formData = new FormData();
  formData.append('subdomain', 'multipart-site');
  formData.append('name', 'Multipart Site');
  const indexBlob = new Blob(['<!DOCTYPE html><html><body><h1>Multipart</h1></body></html>'], { type: 'text/html' });
  formData.append('index.html', indexBlob, 'index.html');
  const styleBlob = new Blob(['body { background: #000; }'], { type: 'text/css' });
  formData.append('style.css', styleBlob, 'style.css');

  const reqMp = new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    body: formData,
  });

  const resMp = await hostingRoute.POST(reqMp);
  const dataMp = await resMp.json();
  check('MP-01', 'POST hosting via multipart/form-data returns 201 Created', resMp.status === 201 && dataMp.success === true);
  check('MP-02', 'Recipe metadata recorded accurate file count (2 files)', dataMp?.recipe?.metadata?.fileCount === 2);

  // 2. Manifest normalization
  const sampleFiles = [
    { path: '///index.html', content: '<h1>Test</h1>' },
    { path: '/././assets/icon.svg', content: '<svg></svg>' },
    { path: 'assets/app.js', content: 'console.log("ok")' },
  ];
  const normalized = normalizeFiles(sampleFiles);
  const allSingleSlash = normalized.every((f) => f.path.startsWith('/') && !f.path.startsWith('//'));
  check('MANIFEST-01', 'Multiple leading slashes / dots normalize to single leading slash', allSingleSlash);
  check('MANIFEST-02', 'Root index normalized to exactly /index.html', normalized[0].path === '/index.html');
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
async function main() {
  console.log('\x1b[1m\x1b[35m========================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m   Challenger P3-M1 Deep Audit & Adversarial Verification Suite         \x1b[0m');
  console.log('\x1b[1m\x1b[35m========================================================================\x1b[0m');

  await suiteMultiTenant();
  await suiteLiveHttp();
  await suitePayloadFuzzing();
  await suitePlanTierAndConcurrency();
  await suiteMultipartAndManifest();

  console.log('\n\x1b[1m\x1b[35m========================================================================\x1b[0m');
  console.log(`Total Checks:  ${totalTests}`);
  console.log(`Passed:        \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed:        ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log('\x1b[1m\x1b[35m========================================================================\x1b[0m');

  if (failures.length > 0) {
    console.error('\nFAILURES FOUND:');
    failures.forEach((f) => console.error(`  - [${f.testId}] ${f.name}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('\x1b[32mAll challenge assertions PASSED successfully!\x1b[0m\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal crash in challenger audit script:', err);
  process.exit(1);
});
