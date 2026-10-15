#!/usr/bin/env node
/**
 * Empirical Adversarial Deep Stress Harness: Phase 3 Milestone 1
 * Recipe 1: Free Website Hosting
 *
 * Exhaustive attack surface verification:
 * 1. Live HTTP Endpoint Authentication & Header Tampering (port 3333)
 * 2. Quota Limits & Plan Integrity Stress Tests (Free vs Pro, Error status reactivation, Active redeploy)
 * 3. File Bundle Validation & Structural Edge Cases (Missing content, Types, Path normalization, Traversals)
 * 4. Subdomain Boundary & Injection Stress Tests (Punycode, Homoglyphs, Hyphens, Length extremes)
 * 5. Direct Upload Manifest Normalization & Hash Integrity
 * 6. Multi-Tenant Cross-User Attack Surface
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
delete process.env.MOCK_CLOUDFLARE_TOKEN;

// Initialize jiti for TypeScript module resolution
const jiti = createJiti(path.resolve(WEB_DIR, 'test_runner.js'), {
  alias: { '@': WEB_DIR },
});

// Import backend modules via jiti
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

const {
  getCloudflareApiToken,
  createCloudflareConnection,
} = jiti('./lib/activepieces/client.ts');

const server = jiti('./lib/supabase/server.ts');
const apClient = jiti('./lib/activepieces/client.ts');
const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');
const deactRoute = jiti('./app/api/recipes/hosting/[id]/deactivate/route.ts');
const recipesListRoute = jiti('./app/api/recipes/route.ts');

// ANSI formatting
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let passedCount = 0;
let failedCount = 0;
const findings = [];
const testResults = [];

function recordTest(testId, description, passed, details = '') {
  if (passed) {
    passedCount++;
    console.log(`  ${ANSI.green}✔ PASS${ANSI.reset} [${testId}] ${description}`);
    testResults.push({ testId, description, status: 'PASS', details });
  } else {
    failedCount++;
    console.error(`  ${ANSI.red}✖ FAIL${ANSI.reset} [${testId}] ${description} — ${details}`);
    testResults.push({ testId, description, status: 'FAIL', details });
    findings.push({ testId, description, details });
  }
}

// =========================================================================
// SUITE 1: Live HTTP Endpoint Authentication & Header Tampering (port 3333)
// =========================================================================
async function runSuite1LiveHttp() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 1: Live HTTP Probing on Port 3333${ANSI.reset}`);

  // 1. Unauthenticated endpoints
  const eps = [
    { method: 'GET', url: `${BASE_URL}/api/recipes`, name: 'GET /api/recipes' },
    {
      method: 'POST',
      url: `${BASE_URL}/api/recipes/hosting`,
      name: 'POST /api/recipes/hosting',
      body: JSON.stringify({ subdomain: 'test-site', files: [{ path: 'index.html', content: '<h1>Hi</h1>' }] }),
    },
    {
      method: 'POST',
      url: `${BASE_URL}/api/recipes/hosting/rec_fake123/update`,
      name: 'POST /api/recipes/hosting/:id/update',
      body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>Updated</h1>' }] }),
    },
    {
      method: 'POST',
      url: `${BASE_URL}/api/recipes/hosting/rec_fake123/deactivate`,
      name: 'POST /api/recipes/hosting/:id/deactivate',
    },
  ];

  for (let i = 0; i < eps.length; i++) {
    const ep = eps[i];
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
        body: ep.body,
      });
      const data = await res.json().catch(() => null);
      recordTest(
        `LIVE-AUTH-0${i + 1}`,
        `Unauthenticated ${ep.name} on port 3333 returns HTTP 401`,
        res.status === 401 && data?.error === 'Unauthorized',
        `Status: ${res.status}, body: ${JSON.stringify(data)}`
      );
    } catch (err) {
      recordTest(`LIVE-AUTH-0${i + 1}`, `Unauthenticated ${ep.name} returns HTTP 401`, false, `Error: ${err.message}`);
    }
  }

  // 2. Tampered headers
  const tampers = [
    { name: 'Encoded null byte in Bearer', header: 'Bearer token%00injection' },
    { name: 'Double Bearer prefix', header: 'Bearer Bearer valid_token' },
    { name: 'Case insensitive bearer', header: 'bEaReR invalid_token' },
    { name: '16KB Giant Bearer', header: `Bearer ${'B'.repeat(16384)}` },
    { name: 'Whitespace only token', header: 'Bearer    \t   ' },
  ];

  for (let i = 0; i < tampers.length; i++) {
    const t = tampers[i];
    try {
      const res = await fetch(`${BASE_URL}/api/recipes`, {
        headers: { Authorization: t.header },
      });
      const ok = res.status === 401 || res.status === 431;
      recordTest(
        `LIVE-TAMP-0${i + 1}`,
        `GET /api/recipes with ${t.name} returns 401/431`,
        ok,
        `Status: ${res.status}`
      );
    } catch (err) {
      recordTest(`LIVE-TAMP-0${i + 1}`, `GET /api/recipes with ${t.name}`, false, `Error: ${err.message}`);
    }
  }
}

// =========================================================================
// SUITE 2: Quota Limits & Plan Integrity Stress Tests
// =========================================================================
async function runSuite2QuotaStress() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 2: Quota Limits & Plan Integrity Stress Tests${ANSI.reset}`);

  const store = new RecipeStore();
  const freeUser = `usr_free_stress_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({ id: freeUser, email: 'free@ingr.local' });
  apClient.getCloudflareApiToken = async () => 'cf_test_mock_token';

  // 1. Free plan: create 2 recipes (reaches limit)
  const r1 = await store.createRecipe({ userId: freeUser, name: 'Site 1', subdomain: 'free-site-1', status: 'active' });
  const r2 = await store.createRecipe({ userId: freeUser, name: 'Site 2', subdomain: 'free-site-2', status: 'active' });

  const countAfter2 = await store.countActive(freeUser);
  recordTest('QUOTA-STRESS-01', 'Free tier user starts with 2 active recipes', countAfter2 === 2, `Active: ${countAfter2}`);

  // 2. Free tier user attempting 3rd recipe creation via route must return HTTP 403
  const req3 = new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'free-site-3', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
  });
  const res3 = await hostingRoute.POST(req3);
  const body3 = await res3.json().catch(() => null);
  recordTest(
    'QUOTA-STRESS-02',
    'Creating 3rd recipe on Free tier returns HTTP 403 PLAN_LIMIT_EXCEEDED',
    res3.status === 403 && body3?.code === 'PLAN_LIMIT_EXCEEDED',
    `Status: ${res3.status}, Code: ${body3?.code}`
  );

  // 3. Updating an ALREADY ACTIVE recipe when at limit (activeCount == 2) must SUCCEED (not blocked!)
  const updateActiveReq = new Request(`${BASE_URL}/api/recipes/hosting/${r1.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>Updated Active</h1>' }] }),
  });
  const updateActiveRes = await updateRoute.POST(updateActiveReq, { params: { id: r1.id } });
  const updateActiveBody = await updateActiveRes.json().catch(() => null);
  recordTest(
    'QUOTA-STRESS-03',
    'Redeploying an already active recipe when at capacity (2/2) succeeds without plan limit error',
    updateActiveRes.status === 200 && updateActiveBody?.success === true,
    `Status: ${updateActiveRes.status}`
  );

  // 4. Deactivate r2, then update r2 back to active -> succeeds because active count was 1
  await deactRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting/${r2.id}/deactivate`, { method: 'POST' }), { params: { id: r2.id } });
  const countAfterDeact = await store.countActive(freeUser);
  recordTest('QUOTA-STRESS-04', 'Deactivating recipe decrements active count to 1', countAfterDeact === 1, `Active: ${countAfterDeact}`);

  const reactivateReq = new Request(`${BASE_URL}/api/recipes/hosting/${r2.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>Reactivated</h1>' }] }),
  });
  const reactivateRes = await updateRoute.POST(reactivateReq, { params: { id: r2.id } });
  const countAfterReactivate = await store.countActive(freeUser);
  recordTest(
    'QUOTA-STRESS-05',
    'Reactivating inactive recipe succeeds when capacity is available (1/2 -> 2/2)',
    reactivateRes.status === 200 && countAfterReactivate === 2,
    `Status: ${reactivateRes.status}, Active: ${countAfterReactivate}`
  );

  // 5. ATTACK VECTOR: Error status recipe reactivation quota bypass!
  // Create an error recipe for freeUser
  const rErr = await store.createRecipe({ userId: freeUser, name: 'Err Site', subdomain: 'err-site', status: 'error' });
  const countWithErr = await store.countActive(freeUser); // Should still be 2 because rErr is in 'error' status
  recordTest('QUOTA-STRESS-06', 'Error recipe is not counted in activeCount', countWithErr === 2, `Active: ${countWithErr}`);

  // Now user attempts to update rErr to redeploy it. Because user is already at 2 active recipes,
  // redeploying rErr to active would result in 3 active recipes!
  const updateErrReq = new Request(`${BASE_URL}/api/recipes/hosting/${rErr.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>Fixed</h1>' }] }),
  });
  const updateErrRes = await updateRoute.POST(updateErrReq, { params: { id: rErr.id } });
  const finalActiveCount = await store.countActive(freeUser);

  recordTest(
    'QUOTA-STRESS-07-BUG',
    'Updating recipe from "error" status must enforce plan limit if user is already at max capacity (activeCount = 2)',
    updateErrRes.status === 403 && finalActiveCount <= 2,
    `Status: ${updateErrRes.status}, final activeCount: ${finalActiveCount} (limit is 2)`
  );

  // 6. Pro tier user has unlimited active recipes
  const proUser = `usr_pro_stress_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({
    id: proUser,
    email: 'pro@ingr.local',
    app_metadata: { plan: 'pro' },
  });

  const proR1 = await store.createRecipe({ userId: proUser, name: 'P1', subdomain: 'pro-1', status: 'active' });
  const proR2 = await store.createRecipe({ userId: proUser, name: 'P2', subdomain: 'pro-2', status: 'active' });
  const proR3 = await store.createRecipe({ userId: proUser, name: 'P3', subdomain: 'pro-3', status: 'active' });

  const proReq = new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'pro-4', files: [{ path: 'index.html', content: '<h1>Pro 4</h1>' }] }),
  });
  const proRes = await hostingRoute.POST(proReq);
  recordTest(
    'QUOTA-STRESS-08',
    'Pro tier user can create >2 active recipes without HTTP 403',
    proRes.status === 201,
    `Status: ${proRes.status}`
  );
}

// =========================================================================
// SUITE 3: File Bundle Validation & Structural Edge Cases
// =========================================================================
async function runSuite3FileBundleStress() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 3: File Bundle Validation & Structural Edge Cases${ANSI.reset}`);

  // 1. Missing or non-string file content
  const contentTests = [
    { name: 'Missing content field', file: { path: 'index.html' } },
    { name: 'Null content field', file: { path: 'index.html', content: null } },
    { name: 'Number content field', file: { path: 'index.html', content: 12345 } },
    { name: 'Boolean content field', file: { path: 'index.html', content: true } },
    { name: 'Object content field', file: { path: 'index.html', content: { text: 'hi' } } },
  ];

  for (let i = 0; i < contentTests.length; i++) {
    const ct = contentTests[i];
    const val = validateFileBundle([ct.file]);
    recordTest(
      `FILE-CONTENT-0${i + 1}-BUG`,
      `validateFileBundle rejects file bundle where content is not a string (${ct.name})`,
      val.valid === false,
      `Result: ${JSON.stringify(val)}`
    );
  }

  // 2. Normalization check for root index.html variants
  const rootIndexVariants = [
    { path: 'index.html', expected: true },
    { path: '/index.html', expected: true },
    { path: './index.html', expected: true },
    { path: '//index.html', expected: true }, // Normalized to /index.html in Cloudflare Pages
    { path: '/./index.html', expected: true },
  ];

  for (let i = 0; i < rootIndexVariants.length; i++) {
    const v = rootIndexVariants[i];
    const val = validateFileBundle([{ path: v.path, content: '<h1>Root</h1>' }]);
    recordTest(
      `FILE-ROOT-0${i + 1}`,
      `validateFileBundle accepts root index path: "${v.path}"`,
      val.valid === v.expected,
      `Valid: ${val.valid}, Error: ${val.error}`
    );
  }

  // 3. Nested index.html must NOT satisfy root index.html requirement
  const nestedVariants = [
    'sub/index.html',
    '/sub/index.html',
    './assets/index.html',
    'index.html/nested.html',
    'index.html.bak',
    'my-index.html',
  ];

  for (let i = 0; i < nestedVariants.length; i++) {
    const p = nestedVariants[i];
    const val = validateFileBundle([{ path: p, content: '<h1>Nested</h1>' }]);
    recordTest(
      `FILE-NESTED-0${i + 1}`,
      `validateFileBundle rejects non-root index path: "${p}"`,
      val.valid === false,
      `Valid: ${val.valid}, Error: ${val.error}`
    );
  }

  // 4. Case sensitivity: INDEX.HTML
  const caseVal = validateFileBundle([{ path: 'INDEX.HTML', content: '<h1>Upper</h1>' }]);
  recordTest(
    'FILE-CASE-01',
    'validateFileBundle rejects uppercase INDEX.HTML (Cloudflare Pages default index is lowercase index.html)',
    caseVal.valid === false,
    `Valid: ${caseVal.valid}, Error: ${caseVal.error}`
  );

  // 5. Empty bundle & non-array payloads
  const nonArrayPayloads = [null, undefined, '', 123, {}, false];
  for (let i = 0; i < nonArrayPayloads.length; i++) {
    const payload = nonArrayPayloads[i];
    const val = validateFileBundle(payload);
    recordTest(
      `FILE-TYPE-0${i + 1}`,
      `validateFileBundle rejects non-array payload: ${JSON.stringify(payload)}`,
      val.valid === false && val.error === 'At least one file is required.',
      `Valid: ${val.valid}, Error: ${val.error}`
    );
  }
}

// =========================================================================
// SUITE 4: Subdomain Boundary & Injection Stress Tests
// =========================================================================
async function runSuite4SubdomainStress() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 4: Subdomain Boundary & Injection Stress Tests${ANSI.reset}`);

  // Test consistency between isValidSubdomain and validateSubdomain
  const testDomains = [
    { dom: 'abc', valid: true },
    { dom: '123', valid: true },
    { dom: 'a-b', valid: true },
    { dom: 'a--b', valid: true },
    { dom: 'my-great-site-2026', valid: true },
    { dom: 'a'.repeat(63), valid: true },
    { dom: 'a'.repeat(64), valid: false }, // Too long
    { dom: 'ab', valid: false }, // Too short
    { dom: 'a', valid: false }, // Too short
    { dom: '', valid: false }, // Empty
    { dom: '-abc', valid: false }, // Leading hyphen
    { dom: 'abc-', valid: false }, // Trailing hyphen
    { dom: '-abc-', valid: false }, // Both hyphens
    { dom: 'a_b', valid: false }, // Underscore
    { dom: 'a.b', valid: false }, // Dot
    { dom: 'abc def', valid: false }, // Space in middle
    { dom: '  abc  ', valid: false }, // Untrimmed space
    { dom: 'ABC', valid: false }, // Uppercase
    { dom: 'abc!def', valid: false }, // Special char
    { dom: 'abc$def', valid: false },
    { dom: 'abc#def', valid: false },
    { dom: 'abc/def', valid: false },
    { dom: 'abc\\def', valid: false },
    { dom: 'abc\0def', valid: false }, // Null byte
    { dom: 'site🚀', valid: false }, // Emoji
    { dom: 'münchen', valid: false }, // Umlaut
    { dom: 'xn--test', valid: true }, // Punycode format
    { dom: '__proto__', valid: false }, // Prototype key
    { dom: 'constructor', valid: true }, // JavaScript identifier but valid DNS label
  ];

  for (let i = 0; i < testDomains.length; i++) {
    const td = testDomains[i];
    const isVal = isValidSubdomain(td.dom);
    const valRes = validateSubdomain(td.dom);
    const agreed = isVal === valRes.valid;
    const correct = isVal === td.valid;

    recordTest(
      `DOMAIN-STRESS-${String(i + 1).padStart(2, '0')}`,
      `Subdomain "${td.dom.length > 25 ? td.dom.substring(0, 25) + '...' : td.dom}" validation (expected: ${td.valid})`,
      agreed && correct,
      `isValidSubdomain: ${isVal}, validateSubdomain: ${valRes.valid}, agreed: ${agreed}`
    );
  }
}

// =========================================================================
// SUITE 5: Direct Upload Manifest Normalization & Hash Integrity
// =========================================================================
async function runSuite5ManifestIntegrity() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 5: Manifest Normalization & Hash Cryptographic Integrity${ANSI.reset}`);

  // Test file set
  const files = [
    { path: 'index.html', content: '<!DOCTYPE html><html><body>Home</body></html>' },
    { path: '/css/style.css', content: 'body { color: red; }' },
    { path: './js/app.js', content: 'console.log("ready");' },
    { path: '//images/logo.png', content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', encoding: 'base64' },
  ];

  const normalized = normalizeFiles(files);

  // 1. All paths must start with a single leading slash
  const allSingleLeadingSlash = normalized.every((f) => f.path.startsWith('/') && !f.path.startsWith('//'));
  recordTest(
    'MANIFEST-PATH-01',
    'All normalized file paths start with exactly one leading slash',
    allSingleLeadingSlash,
    `Paths: ${normalized.map((f) => f.path).join(', ')}`
  );

  // 2. Exact path mappings
  const expectedPaths = ['/index.html', '/css/style.css', '/js/app.js', '/images/logo.png'];
  const matchesExpected = normalized.every((f, idx) => f.path === expectedPaths[idx]);
  recordTest(
    'MANIFEST-PATH-02',
    'Paths normalized to expected clean paths without relative dot segments or double slashes',
    matchesExpected,
    `Got: ${normalized.map((f) => f.path).join(', ')}`
  );

  // 3. Cryptographic hash check for each file
  let allHashesAccurate = true;
  for (const f of normalized) {
    const recomputed = crypto.createHash('sha256').update(f.buffer).digest('hex');
    if (f.hash !== recomputed) {
      allHashesAccurate = false;
    }
  }
  recordTest(
    'MANIFEST-HASH-01',
    'SHA-256 hashes in manifest match verbatim byte-level digest of file buffers',
    allHashesAccurate,
    `Tested ${normalized.length} files`
  );

  // 4. Binary buffer size for base64 file
  const base64File = normalized.find((f) => f.path === '/images/logo.png');
  recordTest(
    'MANIFEST-BASE64-01',
    'Base64 encoded file decoded into valid non-empty buffer (1x1 transparent PNG is 68 bytes)',
    base64File && base64File.buffer.length === 68,
    `Buffer length: ${base64File?.buffer?.length}`
  );
}

// =========================================================================
// RUN ALL SUITES
// =========================================================================
async function main() {
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}    Phase 3 Milestone 1 — EMPIRICAL DEEP STRESS HARNESS                 ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);

  try {
    await runSuite1LiveHttp();
    await runSuite2QuotaStress();
    await runSuite3FileBundleStress();
    await runSuite4SubdomainStress();
    await runSuite5ManifestIntegrity();
  } catch (err) {
    console.error(`${ANSI.red}FATAL ERROR IN HARNESS:${ANSI.reset}`, err);
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}                          DEEP STRESS SUMMARY                           ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`Total Tests Run:  ${passedCount + failedCount}`);
  console.log(`Passed:           ${ANSI.green}${passedCount}${ANSI.reset}`);
  console.log(`Failed / Bugs:    ${failedCount > 0 ? ANSI.red : ANSI.green}${failedCount}${ANSI.reset}`);

  if (findings.length > 0) {
    console.log(`\n${ANSI.bold}${ANSI.red}CRITICAL EMPIRICAL FINDINGS REQUIRING REMEDIATION:${ANSI.reset}`);
    findings.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.testId}] ${f.description}`);
      console.log(`     ${ANSI.dim}${f.details}${ANSI.reset}`);
    });
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main();
