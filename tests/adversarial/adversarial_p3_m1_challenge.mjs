#!/usr/bin/env node
/**
 * Empirical Adversarial Challenge Harness: Phase 3 Milestone 1
 * Backend Deployment Pipeline & Recipe Storage
 *
 * Suites:
 * 1. Live HTTP Endpoint Authentication & Header Tampering (port 3333)
 * 2. Multi-Tenant Recipe Isolation & Scoping (User A vs User B)
 * 3. State Machine Transitions & File Bundle Edge Cases
 * 4. Subdomain Regex & Whitespace Validation Boundaries
 * 5. Cloudflare Pages Direct Upload Manifest Generation & Hash Computation
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

// Initialize jiti for TypeScript module resolution with @ alias
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
  deleteAppConnectionByExternalId,
  listAppConnections,
} = jiti('./lib/activepieces/client.ts');

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
async function runSuite1HttpAuth() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 1: Live HTTP Authentication & Tampering (port 3333)${ANSI.reset}`);

  // Endpoints under test
  const endpoints = [
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

  // 1. Unauthenticated requests must return HTTP 401
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
        body: ep.body,
      });
      const data = await res.json().catch(() => null);
      recordTest(
        `HTTP-AUTH-0${i + 1}`,
        `Unauthenticated ${ep.name} returns HTTP 401 Unauthorized`,
        res.status === 401 && data?.error === 'Unauthorized',
        `Status: ${res.status}, body: ${JSON.stringify(data)}`
      );
    } catch (err) {
      recordTest(`HTTP-AUTH-0${i + 1}`, `Unauthenticated ${ep.name} returns HTTP 401`, false, `Network error: ${err.message}`);
    }
  }

  // 2. Tampered / malformed Authorization headers
  const tamperingCases = [
    { name: 'Empty Bearer', header: 'Bearer' },
    { name: 'Whitespace Bearer', header: 'Bearer    ' },
    { name: 'Bogus Token String', header: 'Bearer random_garbage_token_999' },
    { name: 'Forged JWT Token', header: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.sig' },
    { name: 'Basic Auth Scheme', header: 'Basic dXNlcjpwYXNz' },
    { name: 'SQL Injection in Auth Header', header: "Bearer ' OR '1'='1' --" },
    { name: 'XSS in Auth Header', header: 'Bearer <script>alert(1)</script>' },
    { name: 'Oversized 8KB Auth Header', header: `Bearer ${'A'.repeat(8192)}` },
  ];

  for (let i = 0; i < tamperingCases.length; i++) {
    const tc = tamperingCases[i];
    try {
      const res = await fetch(`${BASE_URL}/api/recipes`, {
        headers: { Authorization: tc.header },
      });
      const passed = res.status === 401 || (tc.name.includes('Oversized') && (res.status === 431 || res.status === 401));
      recordTest(
        `HTTP-TAMP-0${i + 1}`,
        `GET /api/recipes with ${tc.name} returns HTTP 401 (or 431)`,
        passed,
        `Status: ${res.status}`
      );
    } catch (err) {
      recordTest(`HTTP-TAMP-0${i + 1}`, `GET /api/recipes with ${tc.name}`, false, `Error: ${err.message}`);
    }
  }
}

// =========================================================================
// SUITE 2: Multi-Tenant Recipe Isolation & Scoping (User A vs User B)
// =========================================================================
async function runSuite2MultiTenantIsolation() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 2: Multi-Tenant Recipe Isolation (User A vs User B)${ANSI.reset}`);

  // Create two distinct isolated tenant stores
  const store = new RecipeStore();
  const tenantA = `usr_tenant_alpha_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tenantB = `usr_tenant_beta_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. Tenant A creates 2 recipes
  const recipeA1 = await store.createRecipe({
    userId: tenantA,
    name: 'Alpha Site 1',
    subdomain: 'alpha-site-one',
    status: 'active',
  });
  const recipeA2 = await store.createRecipe({
    userId: tenantA,
    name: 'Alpha Site 2',
    subdomain: 'alpha-site-two',
    status: 'active',
  });

  // 2. Tenant B creates 1 recipe
  const recipeB1 = await store.createRecipe({
    userId: tenantB,
    name: 'Beta Site 1',
    subdomain: 'beta-site-one',
    status: 'active',
  });

  recordTest(
    'ISOL-01',
    'Tenant A and Tenant B recipes created with distinct owner IDs',
    recipeA1.userId === tenantA && recipeA2.userId === tenantA && recipeB1.userId === tenantB,
    `Tenant A: ${tenantA}, Tenant B: ${tenantB}`
  );

  // 3. Read isolation via listRecipes
  const listA = await store.listRecipes(tenantA);
  const listB = await store.listRecipes(tenantB);

  const listAHasOnlyA = listA.length === 2 && listA.every((r) => r.userId === tenantA);
  const listBHasOnlyB = listB.length === 1 && listB.every((r) => r.userId === tenantB);
  const crossLeakA = listA.some((r) => r.id === recipeB1.id);
  const crossLeakB = listB.some((r) => r.id === recipeA1.id || r.id === recipeA2.id);

  recordTest(
    'ISOL-02',
    'listRecipes enforces strict tenant partition (no cross-tenant leakage)',
    listAHasOnlyA && listBHasOnlyB && !crossLeakA && !crossLeakB,
    `A count: ${listA.length}, B count: ${listB.length}`
  );

  // 4. Read isolation via getRecipeById
  const aSeesB = await store.getRecipeById(tenantA, recipeB1.id);
  const bSeesA = await store.getRecipeById(tenantB, recipeA1.id);

  recordTest(
    'ISOL-03',
    'getRecipeById returns null when User A requests User B recipe ID',
    aSeesB === null,
    `Expected null, got: ${JSON.stringify(aSeesB)}`
  );

  recordTest(
    'ISOL-04',
    'getRecipeById returns null when User B requests User A recipe ID',
    bSeesA === null,
    `Expected null, got: ${JSON.stringify(bSeesA)}`
  );

  // 5. Update attack: User A attempts to overwrite User B's recipe
  const hostileUpdateResult = await store.updateRecipe(tenantA, recipeB1.id, {
    name: 'Hacked by Alpha',
    status: 'error',
  });

  const b1AfterAttack = await store.getRecipeById(tenantB, recipeB1.id);

  recordTest(
    'ISOL-05',
    'Cross-tenant updateRecipe returns null and leaves target recipe completely unmodified',
    hostileUpdateResult === null && b1AfterAttack?.name === 'Beta Site 1' && b1AfterAttack?.status === 'active',
    `Hostile update result: ${hostileUpdateResult}, Target name: ${b1AfterAttack?.name}`
  );

  // 6. Deactivate attack: User A attempts to deactivate User B's recipe
  const hostileDeactResult = await store.deactivateRecipe(tenantA, recipeB1.id);
  const b1AfterDeact = await store.getRecipeById(tenantB, recipeB1.id);

  recordTest(
    'ISOL-06',
    'Cross-tenant deactivateRecipe returns null and leaves target recipe active',
    hostileDeactResult === null && b1AfterDeact?.status === 'active',
    `Hostile deactivate result: ${hostileDeactResult}, Target status: ${b1AfterDeact?.status}`
  );

  // 7. Active count and Plan limit isolation
  const countA = await store.countActive(tenantA);
  const countB = await store.countActive(tenantB);

  const planA = getUserPlan({ app_metadata: { plan: 'free' } }, countA);
  const planB = getUserPlan({ app_metadata: { plan: 'free' } }, countB);

  recordTest(
    'ISOL-07',
    'Active recipe counts are strictly isolated per tenant',
    countA === 2 && countB === 1,
    `Tenant A: ${countA}, Tenant B: ${countB}`
  );

  recordTest(
    'ISOL-08',
    'Plan limit enforcement: User A with 2 active recipes is capped, User B with 1 is not blocked',
    planA.canActivateMore === false && planB.canActivateMore === true,
    `Plan A canActivateMore: ${planA.canActivateMore}, Plan B canActivateMore: ${planB.canActivateMore}`
  );

  // 8. Activepieces Vault Credential Scoping
  // Test that a user without vaulted Cloudflare connection cannot retrieve token
  const randomUser = `usr_random_${Date.now()}`;
  const unvaultedToken = await getCloudflareApiToken(randomUser);
  recordTest(
    'ISOL-09',
    'Activepieces vault getCloudflareApiToken returns null for unvaulted user',
    unvaultedToken === null,
    `Token returned: ${unvaultedToken}`
  );

  // Now create connection for tenantA in Activepieces vault and verify tenantB cannot access it
  try {
    const cfCreated = await createCloudflareConnection('cf_alpha_secret_token_123', tenantA);
    const retrievedAlpha = await getCloudflareApiToken(tenantA);
    const retrievedBeta = await getCloudflareApiToken(tenantB);

    recordTest(
      'ISOL-10',
      'Vault token retrieval returns secret for owner (tenantA) but null for non-owner (tenantB)',
      retrievedAlpha === 'cf_alpha_secret_token_123' && retrievedBeta === null,
      `Alpha token: ${retrievedAlpha ? 'retrieved' : 'null'}, Beta token: ${retrievedBeta ? 'retrieved' : 'null'}`
    );

    // Clean up
    await deleteAppConnectionByExternalId(`usr_${tenantA}_cloudflare`);
  } catch (err) {
    recordTest('ISOL-10', 'Vault token retrieval multi-tenant isolation', false, `Engine vault error: ${err.message}`);
  }
}

// =========================================================================
// SUITE 3: State Machine Transitions & File Bundle Edge Cases
// =========================================================================
async function runSuite3StateMachine() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 3: State Machine Transitions & File Bundle Edge Cases${ANSI.reset}`);

  const store = new RecipeStore();
  const testUser = `usr_state_${Date.now()}`;

  // 1. Initial State Creation
  const recipe = await store.createRecipe({
    userId: testUser,
    name: 'State Test Site',
    subdomain: 'state-test-site',
    status: 'active',
  });

  recordTest(
    'STATE-01',
    'Recipe initialized with active status',
    recipe.status === 'active' && recipe.subdomain === 'state-test-site',
    `Status: ${recipe.status}`
  );

  // 2. Active -> Inactive transition (Deactivation)
  const deactivated = await store.deactivateRecipe(testUser, recipe.id);
  const activeCountAfter = await store.countActive(testUser);

  recordTest(
    'STATE-02',
    'Deactivation transitions status active -> inactive and decrements countActive to 0',
    deactivated?.status === 'inactive' && activeCountAfter === 0,
    `Status: ${deactivated?.status}, countActive: ${activeCountAfter}`
  );

  // 3. Repeated Deactivation (Idempotency)
  const deactivatedAgain = await store.deactivateRecipe(testUser, recipe.id);
  recordTest(
    'STATE-03',
    'Repeated deactivation is idempotent and maintains inactive status',
    deactivatedAgain?.status === 'inactive',
    `Status: ${deactivatedAgain?.status}`
  );

  // 4. File bundle validation: valid bundle with root index.html
  const validBundle = [
    { path: 'index.html', content: '<h1>Home</h1>' },
    { path: 'styles.css', content: 'body { color: blue; }' },
  ];
  const validRes = validateFileBundle(validBundle);
  recordTest(
    'FILE-01',
    'validateFileBundle accepts bundle with root index.html',
    validRes.valid === true,
    `Error: ${validRes.error}`
  );

  // 5. File bundle validation: missing root index.html
  const missingIndexBundle = [
    { path: 'about.html', content: '<h1>About</h1>' },
    { path: 'styles.css', content: 'body { color: red; }' },
  ];
  const missingIndexRes = validateFileBundle(missingIndexBundle);
  recordTest(
    'FILE-02',
    'validateFileBundle rejects bundle missing root index.html with clear error',
    missingIndexRes.valid === false && missingIndexRes.error?.includes('index.html'),
    `Result: ${JSON.stringify(missingIndexRes)}`
  );

  // 6. File bundle validation: nested index.html (public/index.html) without root
  const nestedIndexBundle = [
    { path: 'public/index.html', content: '<h1>Nested</h1>' },
  ];
  const nestedIndexRes = validateFileBundle(nestedIndexBundle);
  recordTest(
    'FILE-03',
    'validateFileBundle rejects bundle where index.html is only nested in subfolder',
    nestedIndexRes.valid === false && nestedIndexRes.error?.includes('index.html at the root'),
    `Result: ${JSON.stringify(nestedIndexRes)}`
  );

  // 7. File bundle validation: empty bundle
  const emptyBundleRes = validateFileBundle([]);
  recordTest(
    'FILE-04',
    'validateFileBundle rejects empty file array with 400-level error',
    emptyBundleRes.valid === false && emptyBundleRes.error?.includes('required'),
    `Result: ${JSON.stringify(emptyBundleRes)}`
  );

  // 8. BUG HUNT: Malformed file entries in validateFileBundle
  // What happens if files contains { content: "hi" } without path property?
  let uncaughtCrashOnMissingPath = false;
  let crashErrorMessage = '';
  try {
    // Malformed object missing 'path' property
    validateFileBundle([{ content: 'No path here' }]);
  } catch (err) {
    uncaughtCrashOnMissingPath = true;
    crashErrorMessage = err.message;
  }

  recordTest(
    'FILE-05-BUG',
    'File bundle validation gracefully handles missing file path without crashing (TypeError: Cannot read properties of undefined)',
    !uncaughtCrashOnMissingPath,
    uncaughtCrashOnMissingPath ? `CRASH: ${crashErrorMessage}` : 'Handled safely'
  );

  // What happens if files contains null or undefined elements?
  let uncaughtCrashOnNull = false;
  let crashNullMsg = '';
  try {
    validateFileBundle([null]);
  } catch (err) {
    uncaughtCrashOnNull = true;
    crashNullMsg = err.message;
  }

  recordTest(
    'FILE-06-BUG',
    'File bundle validation gracefully handles null/undefined array elements without crashing',
    !uncaughtCrashOnNull,
    uncaughtCrashOnNull ? `CRASH: ${crashNullMsg}` : 'Handled safely'
  );

  // 9. QUOTA BYPASS BUG HUNT: Does updating an inactive recipe bypass the Free plan limit?
  // Setup: Free tier user creates 2 active recipes
  const quotaUser = `usr_quota_bypass_${Date.now()}`;
  const rec1 = await store.createRecipe({ userId: quotaUser, name: 'Site 1', subdomain: 'quota-site-1', status: 'active' });
  const rec2 = await store.createRecipe({ userId: quotaUser, name: 'Site 2', subdomain: 'quota-site-2', status: 'active' });

  // Now user deactivates rec1 (activeCount = 1)
  await store.deactivateRecipe(quotaUser, rec1.id);
  const countAfterDeact = await store.countActive(quotaUser);

  // User creates rec3 (activeCount = 2, max limit reached)
  const rec3 = await store.createRecipe({ userId: quotaUser, name: 'Site 3', subdomain: 'quota-site-3', status: 'active' });
  const countAtLimit = await store.countActive(quotaUser);

  // Now user updates rec1 (which was inactive).
  // Notice in web/app/api/recipes/hosting/[id]/update/route.ts lines 141-149:
  // updateRecipe sets status: deployResult.status (which is "active"!).
  // But update route does NOT check plan limits!
  const updatedRec1 = await store.updateRecipe(quotaUser, rec1.id, { status: 'active' });
  const countAfterBypass = await store.countActive(quotaUser);

  recordTest(
    'QUOTA-01-BUG',
    'Updating an inactive recipe respects Free tier max 2 limit (or flags unlimited reactivation bypass)',
    countAfterBypass <= 2,
    `Active count rose to ${countAfterBypass} (limit is 2) — updating inactive recipe bypasses plan limit!`
  );
}

// =========================================================================
// SUITE 4: Subdomain Regex & Validation Boundaries
// =========================================================================
async function runSuite4SubdomainValidation() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 4: Subdomain Regex & Validation Boundaries${ANSI.reset}`);

  // Test matrix for valid subdomains
  const validCases = [
    'abc',                                // exactly 3 chars (min)
    'a1b',                                // alphanumeric
    '123',                                // numeric
    'my-site',                            // single hyphen
    'my-cool-portfolio-2026',             // multiple hyphens and numbers
    'my--site',                           // consecutive hyphens (allowed in CF Pages & DNS)
    'a' + 'b'.repeat(61) + 'c',           // exactly 63 chars (max)
  ];

  for (const s of validCases) {
    const res = validateSubdomain(s);
    const regexRes = isValidSubdomain(s);
    recordTest(
      `DOMAIN-VAL-${s.substring(0, 10)}`,
      `Valid subdomain "${s.length > 20 ? s.substring(0, 15) + '...' : s}" (${s.length} chars) is accepted`,
      res.valid === true && regexRes === true,
      `validateSubdomain: ${res.valid}, isValidSubdomain: ${regexRes}`
    );
  }

  // Test matrix for invalid subdomains
  const invalidCases = [
    { input: '', reason: 'empty string' },
    { input: '  ', reason: 'whitespace only' },
    { input: 'a', reason: 'too short (1 char)' },
    { input: 'ab', reason: 'too short (2 chars)' },
    { input: 'a' + 'b'.repeat(62) + 'c', reason: 'too long (64 chars)' },
    { input: '-mysite', reason: 'leading hyphen' },
    { input: 'mysite-', reason: 'trailing hyphen' },
    { input: '-mysite-', reason: 'leading and trailing hyphen' },
    { input: 'MySite', reason: 'uppercase letters' },
    { input: 'my_site', reason: 'underscore not allowed' },
    { input: 'my.site', reason: 'dot not allowed' },
    { input: 'site!123', reason: 'special character !' },
    { input: 'site@pages', reason: 'special character @' },
    { input: '<script>', reason: 'XSS script tag' },
    { input: 'site🚀', reason: 'Unicode emoji' },
    { input: 'münchen', reason: 'Unicode umlaut' },
    { input: 'site\x00null', reason: 'Null byte injection' },
    { input: '../traversal', reason: 'Path traversal' },
  ];

  for (let i = 0; i < invalidCases.length; i++) {
    const c = invalidCases[i];
    const res = validateSubdomain(c.input);
    const regexRes = isValidSubdomain(c.input);
    recordTest(
      `DOMAIN-INVAL-0${i + 1}`,
      `Invalid subdomain rejected: ${c.reason} ("${c.input}")`,
      res.valid === false && regexRes === false,
      `validate: ${res.valid} (${res.error}), regex: ${regexRes}`
    );
  }

  // BUG HUNT: Subdomain Untrimmed Whitespace Discrepancy
  // If user passes "  my-site  ":
  // validateSubdomain trims and returns { valid: true }
  // but isValidSubdomain("  my-site  ") returns false!
  // And route.ts does NOT trim subdomain before storing or deploying!
  const whitespaceSubdomain = '  my-site  ';
  const valRes = validateSubdomain(whitespaceSubdomain);
  const regexWhitespace = isValidSubdomain(whitespaceSubdomain);

  recordTest(
    'DOMAIN-WHITESPACE-BUG',
    'validateSubdomain and isValidSubdomain agree on whitespace-padded subdomains ("  my-site  ")',
    valRes.valid === regexWhitespace,
    `Discrepancy: validateSubdomain returned valid=${valRes.valid}, but isValidSubdomain returned ${regexWhitespace}!`
  );
}

// =========================================================================
// SUITE 5: Cloudflare Pages Direct Upload Manifest Generation & Hash
// =========================================================================
async function runSuite5CloudflareManifest() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 5: Cloudflare Pages Manifest Generation & Hash Computation${ANSI.reset}`);

  // 1. Path normalization
  const testFiles = [
    { path: 'index.html', content: '<h1>Home</h1>' },
    { path: '/about.html', content: '<h1>About</h1>' },
    { path: './contact.html', content: '<h1>Contact</h1>' },
    { path: '/./faq.html', content: '<h1>FAQ</h1>' },
    { path: 'assets/css/style.css', content: 'body { margin: 0; }' },
  ];

  const normalized = normalizeFiles(testFiles);

  recordTest(
    'MANIFEST-01',
    'All file paths are normalized to root-leading single slash (/path)',
    normalized.every((f) => f.path.startsWith('/') && !f.path.startsWith('/./')),
    `Paths: ${normalized.map((f) => f.path).join(', ')}`
  );

  // 2. Hash calculation accuracy
  const sampleContent = '<h1>Home</h1>';
  const expectedHash = crypto.createHash('sha256').update(Buffer.from(sampleContent, 'utf8')).digest('hex');
  const indexFile = normalized.find((f) => f.path === '/index.html');

  recordTest(
    'MANIFEST-02',
    'SHA-256 hash matches exact cryptographic digest of file contents',
    indexFile?.hash === expectedHash,
    `Expected: ${expectedHash}, Got: ${indexFile?.hash}`
  );

  // 3. Binary Base64 file hash accuracy
  const rawBinaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
  const base64Data = rawBinaryData.toString('base64');
  const expectedBinaryHash = crypto.createHash('sha256').update(rawBinaryData).digest('hex');

  const binaryNormalized = normalizeFiles([
    { path: 'logo.png', content: base64Data, encoding: 'base64' },
  ]);

  recordTest(
    'MANIFEST-03',
    'Base64 binary file is decoded into buffer and hashed accurately',
    binaryNormalized[0]?.hash === expectedBinaryHash,
    `Expected: ${expectedBinaryHash}, Got: ${binaryNormalized[0]?.hash}`
  );

  // 4. Content-addressable manifest structure
  const manifest = {};
  for (const f of normalized) {
    manifest[f.path] = f.hash;
  }

  recordTest(
    'MANIFEST-04',
    'Manifest object maps every file path to its SHA-256 hash',
    Object.keys(manifest).length === 5 && manifest['/index.html'] === expectedHash,
    `Manifest keys: ${Object.keys(manifest).join(', ')}`
  );

  // 5. Duplicate content deduplication
  // Two distinct files with identical content
  const dupFiles = [
    { path: 'style1.css', content: 'body { color: black; }' },
    { path: 'style2.css', content: 'body { color: black; }' },
  ];
  const dupNormalized = normalizeFiles(dupFiles);
  const dupManifest = {};
  for (const f of dupNormalized) {
    dupManifest[f.path] = f.hash;
  }

  recordTest(
    'MANIFEST-05',
    'Files with identical content have identical hash in manifest',
    dupNormalized[0].hash === dupNormalized[1].hash && Object.keys(dupManifest).length === 2,
    `Hash 1: ${dupNormalized[0].hash}, Hash 2: ${dupNormalized[1].hash}`
  );

  // 6. Double slash edge case: "//index.html"
  const doubleSlashNorm = normalizeFiles([{ path: '//index.html', content: '<h1>Hi</h1>' }]);
  const doubleSlashPath = doubleSlashNorm[0].path;

  recordTest(
    'MANIFEST-06-EDGE',
    'Leading double slashes ("//index.html") normalized to single root slash',
    doubleSlashPath === '/index.html',
    `Result was: "${doubleSlashPath}"`
  );

  // 7. Hermetic simulator verification
  const originalTestMode = process.env.TEST_MODE;
  delete process.env.TEST_MODE;
  const isSim = isHermeticMode('cf_test_mock_token');
  const isLive = isHermeticMode('cf_real_prod_token_abc123');
  if (originalTestMode !== undefined) process.env.TEST_MODE = originalTestMode;

  recordTest(
    'MANIFEST-07',
    'Hermetic mode detection activates on mock token prefixes (cf_test_*, mock_*)',
    isSim === true && isLive === false,
    `isSim: ${isSim}, isLive: ${isLive}`
  );
}

// =========================================================================
// SUITE 6: Route Handler Empirical Exploitation & Boundary Probing
// =========================================================================
async function runSuite6RouteExploitation() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}► Suite 6: Route Handler Empirical Exploitation & Boundary Probing${ANSI.reset}`);

  process.env.MOCK_CLOUDFLARE_TOKEN = 'cf_test_mock_token';

  const server = jiti('./lib/supabase/server.ts');
  const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
  const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');
  const deactRoute = jiti('./app/api/recipes/hosting/[id]/deactivate/route.ts');
  const recipesListRoute = jiti('./app/api/recipes/route.ts');

  const victimUser = `usr_route_exploit_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({ id: victimUser, email: 'exploit@ingr.local' });

  // 1. Plan limit: Free tier creates 2 active recipes successfully
  const res1 = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'exploit-site-1', files: [{ path: 'index.html', content: '<h1>1</h1>' }] }),
  }));
  const body1 = await res1.json().catch(() => null);

  const res2 = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'exploit-site-2', files: [{ path: 'index.html', content: '<h1>2</h1>' }] }),
  }));
  const body2 = await res2.json().catch(() => null);

  recordTest(
    'ROUTE-PLAN-01',
    'Free tier user creates recipe 1 and 2 successfully (HTTP 201)',
    res1.status === 201 && res2.status === 201,
    `Res1: ${res1.status}, Res2: ${res2.status}`
  );

  // 2. Plan limit: Attempting 3rd active recipe returns HTTP 403 Forbidden
  const res3 = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'exploit-site-3', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
  }));
  const body3 = await res3.json().catch(() => null);

  recordTest(
    'ROUTE-PLAN-02',
    'Attempting 3rd active recipe on Free tier returns HTTP 403 Forbidden (PLAN_LIMIT_EXCEEDED)',
    res3.status === 403 && body3?.code === 'PLAN_LIMIT_EXCEEDED',
    `Status: ${res3.status}, Code: ${body3?.code}, Error: ${body3?.error}`
  );

  // 3. Deactivate recipe 1, then create recipe 3 -> should succeed
  const deactRes = await deactRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting/${body1.recipe.id}/deactivate`, {
    method: 'POST',
  }), { params: { id: body1.recipe.id } });

  const res3AfterDeact = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'exploit-site-3', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
  }));

  recordTest(
    'ROUTE-PLAN-03',
    'After deactivating 1 recipe, Free tier user can successfully create another (active count capped at 2)',
    res3AfterDeact.status === 201,
    `Status: ${res3AfterDeact.status}`
  );

  // 4. Quota bypass exploit: Update/redeploy deactivated recipe 1
  const updateDeactRes = await updateRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting/${body1.recipe.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: 'index.html', content: '<h1>1 Reactivated</h1>' }] }),
  }), { params: { id: body1.recipe.id } });

  const listRes = await recipesListRoute.GET(new Request(`${BASE_URL}/api/recipes`));
  const listBody = await listRes.json().catch(() => null);

  recordTest(
    'ROUTE-BYPASS-BUG',
    'Updating deactivated recipe enforces plan limit and rejects exceeding 2 active recipes',
    listBody?.activeCount <= 2,
    `Active count rose to ${listBody?.activeCount} (limit is 2) — update route bypasses plan limit!`
  );

  // 5. Bad Payloads in POST /api/recipes/hosting (using fresh test user with 0 recipes):
  const payloadUser = `usr_bad_payload_${Date.now()}`;
  server.getAuthenticatedUser = async () => ({ id: payloadUser, email: 'payload@ingr.local' });

  // 5a. Missing path in file object: files: [{ content: 'no path' }]
  const badPayloadPath = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'bad-path-test', files: [{ content: 'no path' }] }),
  }));
  const badPathBody = await badPayloadPath.json().catch(() => null);

  recordTest(
    'ROUTE-BADPAYLOAD-01-BUG',
    'POST /api/recipes/hosting with files missing "path" property returns HTTP 400 (not unhandled 500 crash)',
    badPayloadPath.status === 400,
    `Status was HTTP ${badPayloadPath.status}: ${JSON.stringify(badPathBody)}`
  );

  // 5b. Null entry in files array: files: [null]
  const badPayloadNull = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'bad-null-test', files: [null] }),
  }));
  const badNullBody = await badPayloadNull.json().catch(() => null);

  recordTest(
    'ROUTE-BADPAYLOAD-02-BUG',
    'POST /api/recipes/hosting with null file entry in array returns HTTP 400 (not unhandled 500 crash)',
    badPayloadNull.status === 400,
    `Status was HTTP ${badPayloadNull.status}: ${JSON.stringify(badNullBody)}`
  );

  // 5c. Non-string path in file object: files: [{ path: 12345, content: 'hi' }]
  const badPayloadType = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: 'bad-type-test', files: [{ path: 12345, content: 'hi' }] }),
  }));
  const badTypeBody = await badPayloadType.json().catch(() => null);

  recordTest(
    'ROUTE-BADPAYLOAD-03-BUG',
    'POST /api/recipes/hosting with non-string path property returns HTTP 400 (not unhandled 500 crash)',
    badPayloadType.status === 400,
    `Status was HTTP ${badPayloadType.status}: ${JSON.stringify(badTypeBody)}`
  );

  // 5d. Whitespace subdomain leakage into live URL: subdomain: "  clean-site  "
  const wsSubdomainRes = await hostingRoute.POST(new Request(`${BASE_URL}/api/recipes/hosting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain: '  clean-site  ', files: [{ path: 'index.html', content: '<h1>Clean</h1>' }] }),
  }));
  const wsSubdomainBody = await wsSubdomainRes.json().catch(() => null);

  const hasLeakedWhitespace = wsSubdomainBody?.recipe?.subdomain?.includes(' ') || wsSubdomainBody?.recipe?.liveUrl?.includes(' ');

  recordTest(
    'ROUTE-WHITESPACE-01-BUG',
    'POST /api/recipes/hosting rejects untrimmed whitespace subdomains or trims them so liveUrl contains zero spaces',
    !hasLeakedWhitespace,
    `Persisted subdomain: "${wsSubdomainBody?.recipe?.subdomain}", liveUrl: "${wsSubdomainBody?.recipe?.liveUrl}"`
  );
}

// =========================================================================
// RUN ALL SUITES AND PRINT SUMMARY
// =========================================================================
async function main() {
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}      INGR Platform — Empirical Adversarial Challenge Harness (P3-M1)   ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);

  try {
    await runSuite1HttpAuth();
    await runSuite2MultiTenantIsolation();
    await runSuite3StateMachine();
    await runSuite4SubdomainValidation();
    await runSuite5CloudflareManifest();
    await runSuite6RouteExploitation();
  } catch (err) {
    console.error(`${ANSI.red}FATAL ERROR IN HARNESS:${ANSI.reset}`, err);
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}                          CHALLENGE SUMMARY                             ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`Total Tests Run:  ${passedCount + failedCount}`);
  console.log(`Passed:           ${ANSI.green}${passedCount}${ANSI.reset}`);
  console.log(`Failed / Bugs:    ${failedCount > 0 ? ANSI.red : ANSI.green}${failedCount}${ANSI.reset}`);

  if (findings.length > 0) {
    console.log(`\n${ANSI.bold}${ANSI.yellow}CONFIRMED EMPIRICAL FINDINGS & VULNERABILITIES:${ANSI.reset}`);
    findings.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.testId}] ${f.description}`);
      console.log(`     ${ANSI.dim}${f.details}${ANSI.reset}`);
    });
  }

  process.exit(0);
}

main();
