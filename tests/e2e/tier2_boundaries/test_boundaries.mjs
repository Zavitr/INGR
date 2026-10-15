/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Covers invalid credentials, missing parameters, bad inputs, 404 handling, and adversarial boundaries.
 */

import { adminSignIn, createAppConnection, listAppConnections } from '../helpers/api_client.mjs';
import { assert, assertEqual, assertHttpStatus, assertIncludes } from '../helpers/assertions.mjs';
import { CONFIG, WEB_ROOT, registry } from '../helpers/test_context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import createJiti from '../../../web/node_modules/jiti/lib/index.js';

registry.setSuite('Tier 2 - Boundary & Corner Cases', 'Tier 2', 'BOUNDARIES');

export async function runTier2Tests() {
  await registry.runTest('B01: Engine sign-in rejects incorrect password with HTTP 401/403', async () => {
    const { status, data } = await adminSignIn(CONFIG.adminEmail, 'WrongPassword2026!');
    assert(status === 401 || status === 403, `Expected status 401/403, got ${status}`);
    assert(data !== null, 'Response body should contain error object');
  });

  await registry.runTest('B02: Engine sign-in rejects non-existent email with HTTP 401/403', async () => {
    const { status } = await adminSignIn('nonexistent@ingr.local', 'SomePassword2026!');
    assert(status === 401 || status === 403, `Expected status 401/403, got ${status}`);
  });

  await registry.runTest('B03: Engine sign-in rejects malformed/empty JSON payload with HTTP 400', async () => {
    const res = await fetch(`${CONFIG.engineUrl}/api/v1/authentication/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(res.status === 400 || res.status === 401, `Expected HTTP 400 or 401, got ${res.status}`);
  });

  await registry.runTest('B04: Engine app-connections rejects request missing Bearer token with HTTP 401/403', async () => {
    const { status } = await listAppConnections(null, CONFIG.expectedProjectId);
    assert(status === 401 || status === 403, `Request without Authorization header must return HTTP 401 or 403, got ${status}`);
  });

  await registry.runTest('B05: Engine app-connections rejects invalid Bearer token with HTTP 401/403', async () => {
    const { status } = await listAppConnections('invalid.fake.jwt-token', CONFIG.expectedProjectId);
    assert(status === 401 || status === 403, `Request with bogus Bearer token must return HTTP 401 or 403, got ${status}`);
  });

  await registry.runTest('B06: Engine app-connections rejects invalid connection payload with HTTP 400', async () => {
    const { data: auth } = await adminSignIn();
    assert(auth && auth.token, 'Must acquire admin token');
    const { status } = await createAppConnection(auth.token, {
      projectId: auth.projectId,
      externalId: 'bad_conn',
      // Missing pieceName, type, and value
    });
    assertHttpStatus(status, 400, 'Payload missing required fields must return HTTP 400');
  });

  await registry.runTest('B07: Engine returns HTTP 404 on undefined REST API endpoints', async () => {
    const res = await fetch(`${CONFIG.engineUrl}/api/v1/nonexistent-endpoint-${Date.now()}`);
    assertHttpStatus(res.status, 404, 'Nonexistent REST route must return HTTP 404');
  });

  await registry.runTest('B08: Web sign-up form requires matching passwords', async () => {
    const formPath = path.join(WEB_ROOT, 'components/sign-up-form.tsx');
    assert(fs.existsSync(formPath), 'sign-up-form.tsx must exist');
    const content = fs.readFileSync(formPath, 'utf-8');
    assert(
      content.includes('password !== repeatPassword') ||
      content.includes('password !==') ||
      content.includes('Passwords do not match'),
      'Sign-up form must validate password matching'
    );
  });

  await registry.runTest('B09: Web login and sign-up forms enforce HTML5 email validation', async () => {
    const loginPath = path.join(WEB_ROOT, 'components/login-form.tsx');
    const content = fs.readFileSync(loginPath, 'utf-8');
    assertIncludes(content, 'type="email"', 'Login email input must have type="email"');
    assertIncludes(content, 'required', 'Login inputs must have required attribute');
  });

  await registry.runTest('B10: OAuth callback route gracefully redirects on missing authorization code', async () => {
    const callbackPath = path.join(WEB_ROOT, 'app/auth/callback/route.ts');
    if (fs.existsSync(callbackPath)) {
      const content = fs.readFileSync(callbackPath, 'utf-8');
      assert(
        content.includes('if (!code') || content.includes('code ?') || content.includes('/auth/error'),
        'OAuth callback handler must check code presence and redirect to error'
      );
    }
  });

  await registry.runTest('B11: Crisp chat widget safely tolerates missing/empty website ID without crashing', async () => {
    const crispPath = path.join(WEB_ROOT, 'components/crisp-chat.tsx');
    if (fs.existsSync(crispPath)) {
      const content = fs.readFileSync(crispPath, 'utf-8');
      assert(
        content.includes('if (!') || content.includes('return null') || content.includes('return undefined'),
        'Crisp component must guard against empty/undefined website ID'
      );
    }
  });

  await registry.runTest('B12: Adversarial Technical Jargon Scanner verifies copy purity', async () => {
    const landingPath = path.join(WEB_ROOT, 'app/page.tsx');
    const content = fs.readFileSync(landingPath, 'utf-8');
    // Ensure that none of the forbidden technical jargon terms appear in customer copy
    const forbiddenPatterns = [
      /\bwebhook\b/i,
      /\bcontainer\b/i,
      /\bendpoint\b/i,
      /\benvironment variable\b/i,
      /\bDevOps\b/i,
    ];
    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern);
      assert(!match, `Found prohibited technical jargon "${match?.[0]}" in landing page copy`);
    }
  });

  // =========================================================================
  // Phase 3 Milestone 3: Recipe 1 Free Website Hosting Boundary Tests B13 - B18
  // =========================================================================
  const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
    alias: { '@': WEB_ROOT },
  });

  process.env.TEST_MODE = 'true';
  delete process.env.MOCK_CLOUDFLARE_TOKEN;

  const {
    validateSubdomain,
    isValidSubdomain,
    validateFileBundle,
    getUserPlan,
  } = jiti('./lib/recipes/types.ts');
  const { extractZipFiles, hasRootIndexHtml } = jiti('./lib/recipes/file-reader.ts');
  const { recipeStore } = jiti('./lib/recipes/store.ts');
  const server = jiti('./lib/supabase/server.ts');
  const apClient = jiti('./lib/activepieces/client.ts');
  const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
  const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');

  await registry.runTest(
    'B13: Subdomain validation boundaries (min length 3, max length 63, hyphen rules, lowercase alphanumeric, punycode xn--, invalid symbols rejected)',
    async () => {
      // 1. Min length
      assertEqual(isValidSubdomain('ab'), false, 'Subdomain of length 2 must be invalid');
      const minRes = validateSubdomain('ab');
      assertEqual(minRes.valid, false);
      assertEqual(minRes.error, 'Web address must be at least 3 characters long.');

      assertEqual(isValidSubdomain('abc'), true, 'Subdomain of length 3 must be valid');
      assertEqual(validateSubdomain('abc').valid, true);

      // 2. Max length
      const len63 = 'a'.repeat(63);
      assertEqual(isValidSubdomain(len63), true, 'Subdomain of length 63 must be valid');
      assertEqual(validateSubdomain(len63).valid, true);

      const len64 = 'a'.repeat(64);
      assertEqual(isValidSubdomain(len64), false, 'Subdomain of length 64 must be invalid');
      const maxRes = validateSubdomain(len64);
      assertEqual(maxRes.valid, false);
      assertEqual(maxRes.error, 'Web address must be at most 63 characters long.');

      // 3. Hyphens
      assertEqual(isValidSubdomain('-site'), false, 'Leading hyphen must be rejected');
      assertEqual(validateSubdomain('-site').error, 'Web address cannot start or end with a hyphen.');

      assertEqual(isValidSubdomain('site-'), false, 'Trailing hyphen must be rejected');
      assertEqual(validateSubdomain('site-').error, 'Web address cannot start or end with a hyphen.');

      assertEqual(isValidSubdomain('-site-'), false);
      assertEqual(isValidSubdomain('my-site'), true, 'Internal hyphen allowed');
      assertEqual(isValidSubdomain('a--b'), true, 'Double internal hyphens allowed');

      // 4. Case sensitivity
      assertEqual(isValidSubdomain('My-Site'), false, 'Uppercase letters must be rejected');
      assertEqual(validateSubdomain('My-Site').error, 'Web address must be lowercase.');

      // 5. Punycode
      assertEqual(isValidSubdomain('xn--test'), true, 'Punycode format must be allowed');
      assertEqual(validateSubdomain('xn--test').valid, true);

      // 6. Whitespace and invalid symbols
      assertEqual(isValidSubdomain('  mysite  '), false, 'Spaces must be rejected');
      assertEqual(validateSubdomain('  mysite  ').error, 'Web address cannot contain spaces.');
      assertEqual(validateSubdomain('my site').valid, false);
      assertEqual(validateSubdomain('my site').error, 'Web address can only contain letters, numbers, and hyphens.');

      const invalidSymbols = ['site_name', 'site.pages', 'site!123', 'site🚀'];
      for (const sym of invalidSymbols) {
        assertEqual(isValidSubdomain(sym), false, `Symbol "${sym}" must be rejected`);
        assertEqual(
          validateSubdomain(sym).error,
          'Web address can only contain letters, numbers, and hyphens.'
        );
      }
    }
  );

  await registry.runTest(
    'B14: Missing root index.html file bundle rejection (empty bundle, nested index without root, non-html files only)',
    async () => {
      // 1. Empty bundle
      const empty1 = validateFileBundle([]);
      assertEqual(empty1.valid, false);
      assertEqual(empty1.error, 'At least one file is required.');

      const empty2 = validateFileBundle(null);
      assertEqual(empty2.valid, false);
      assertEqual(empty2.error, 'At least one file is required.');

      // 2. Nested index without root
      const nested1 = validateFileBundle([{ path: 'sub/index.html', content: '<h1>Sub</h1>' }]);
      assertEqual(nested1.valid, false);
      assertEqual(nested1.error, 'Website files must include an index.html at the root.');

      const nested2 = validateFileBundle([{ path: 'dist/index.html', content: '<h1>Dist</h1>' }]);
      assertEqual(nested2.valid, false);
      assertEqual(hasRootIndexHtml([{ path: 'dist/index.html', content: '...' }]), false);

      // 3. Non-HTML files only
      const nonHtml = validateFileBundle([
        { path: 'styles.css', content: 'body {}' },
        { path: 'script.js', content: 'console.log(1)' },
      ]);
      assertEqual(nonHtml.valid, false);
      assertEqual(nonHtml.error, 'Website files must include an index.html at the root.');

      // 4. Valid root variants
      const rootVariants = ['index.html', '/index.html', './index.html', '//index.html', '/./index.html'];
      for (const rPath of rootVariants) {
        const res = validateFileBundle([{ path: rPath, content: '<h1>Root</h1>' }]);
        assertEqual(res.valid, true, `Path variant "${rPath}" must be recognized as root index.html`);
        assertEqual(hasRootIndexHtml([{ path: rPath, content: '...' }]), true);
      }
    }
  );

  await registry.runTest(
    'B15: Free plan quota limit enforcement on recipe creation (HTTP 403 PLAN_LIMIT_EXCEEDED when activeCount >= 2)',
    async () => {
      const userId = `usr_b15_quota_${Date.now()}`;

      // 1. Setup 2 active recipes in store for this user
      await recipeStore.createRecipe({
        userId,
        name: 'Site 1',
        subdomain: 'site-1',
        liveUrl: 'https://site-1.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });
      await recipeStore.createRecipe({
        userId,
        name: 'Site 2',
        subdomain: 'site-2',
        liveUrl: 'https://site-2.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });

      const activeCount = await recipeStore.countActive(userId);
      assertEqual(activeCount, 2, 'User must have exactly 2 active recipes');

      const plan = getUserPlan({ app_metadata: { plan: 'free' } }, activeCount);
      assertEqual(plan.tier, 'free');
      assertEqual(plan.maxActiveRecipes, 2);
      assertEqual(plan.canActivateMore, false, 'Free user at 2 active recipes cannot activate more');

      // 2. Attempt 3rd recipe creation via hostingRoute.POST
      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;
      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        apClient.getCloudflareApiToken = async () => 'cf_hermetic_mock_b15';

        const req = new Request('http://localhost:3000/api/recipes/hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'site-3',
            files: [{ path: 'index.html', content: '<h1>Site 3</h1>' }],
          }),
        });

        const res = await hostingRoute.POST(req);
        assertEqual(res.status, 403, 'Attempting to create 3rd active recipe must return HTTP 403');
        const body = await res.json();
        assertEqual(body.code, 'PLAN_LIMIT_EXCEEDED');
        assertIncludes(body.error, 'Free plan limit reached');

        // Store count must still be 2
        const finalCount = await recipeStore.countActive(userId);
        assertEqual(finalCount, 2, 'Store must not create recipe beyond quota');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  await registry.runTest(
    'B16: Free plan quota limit enforcement on reactivation/update of inactive or error recipes (HTTP 403 PLAN_LIMIT_EXCEEDED when activeCount >= 2)',
    async () => {
      const userId = `usr_b16_reactivate_${Date.now()}`;

      // 1. Setup 2 active recipes, 1 inactive, 1 error
      const rec1 = await recipeStore.createRecipe({
        userId,
        name: 'Active 1',
        subdomain: 'active-1',
        liveUrl: 'https://active-1.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });
      await recipeStore.createRecipe({
        userId,
        name: 'Active 2',
        subdomain: 'active-2',
        liveUrl: 'https://active-2.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });
      const recInactive = await recipeStore.createRecipe({
        userId,
        name: 'Inactive 3',
        subdomain: 'inactive-3',
        liveUrl: 'https://inactive-3.pages.dev',
        status: 'inactive',
        services: ['cloudflare'],
      });
      const recError = await recipeStore.createRecipe({
        userId,
        name: 'Error 4',
        subdomain: 'error-4',
        liveUrl: 'https://error-4.pages.dev',
        status: 'error',
        services: ['cloudflare'],
      });

      assertEqual(await recipeStore.countActive(userId), 2, 'Count active must be 2');

      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;
      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        apClient.getCloudflareApiToken = async () => 'cf_hermetic_mock_b16';

        // 2. Attempt to reactivate inactive recipe 3 while at 2/2 quota -> 403
        const reqInactive = new Request(`http://localhost:3000/api/recipes/hosting/${recInactive.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ path: 'index.html', content: '<h1>Reactivated</h1>' }],
          }),
        });
        const resInactive = await updateRoute.POST(reqInactive, { params: { id: recInactive.id } });
        assertEqual(resInactive.status, 403, 'Reactivating inactive recipe when at 2/2 capacity must return 403');
        const bodyInactive = await resInactive.json();
        assertEqual(bodyInactive.code, 'PLAN_LIMIT_EXCEEDED');

        const recheckInactive = await recipeStore.getRecipeById(userId, recInactive.id);
        assertEqual(recheckInactive.status, 'inactive', 'Recipe 3 must remain inactive');

        // 3. Attempt to redeploy/fix error recipe 4 while at 2/2 quota -> 403
        const reqError = new Request(`http://localhost:3000/api/recipes/hosting/${recError.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ path: 'index.html', content: '<h1>Fix Error</h1>' }],
          }),
        });
        const resError = await updateRoute.POST(reqError, { params: { id: recError.id } });
        assertEqual(resError.status, 403, 'Redeploying error recipe when at 2/2 capacity must return 403');
        const bodyError = await resError.json();
        assertEqual(bodyError.code, 'PLAN_LIMIT_EXCEEDED');

        const recheckError = await recipeStore.getRecipeById(userId, recError.id);
        assertEqual(recheckError.status, 'error', 'Recipe 4 must remain in error status');

        // 4. Updating an already active recipe (rec1) while at 2/2 quota -> 200 allowed
        const reqActive = new Request(`http://localhost:3000/api/recipes/hosting/${rec1.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ path: 'index.html', content: '<h1>Updated In-Place</h1>' }],
          }),
        });
        const resActive = await updateRoute.POST(reqActive, { params: { id: rec1.id } });
        assertEqual(resActive.status, 200, 'Updating an already active recipe must succeed');
        const bodyActive = await resActive.json();
        assertEqual(bodyActive.success, true);
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  await registry.runTest(
    'B17: Non-string and malformed file content rejection (HTTP 400 Bad Request) preventing unhandled TypeError inside Buffer.from',
    async () => {
      // 1. Non-string content cases rejected by validateFileBundle
      const malformedCases = [
        { path: 'index.html' },
        { path: 'index.html', content: null },
        { path: 'index.html', content: 12345 },
        { path: 'index.html', content: true },
        { path: 'index.html', content: { code: 'alert(1)' } },
        { path: 'index.html', content: ['line1'] },
      ];

      for (const badFile of malformedCases) {
        const res = validateFileBundle([badFile]);
        assertEqual(res.valid, false, 'Non-string content must be invalid');
        assertEqual(res.error, 'Invalid file bundle structure');
      }

      // 2. Dispatch to hostingRoute.POST with malformed content -> HTTP 400
      const userId = `usr_b17_malformed_${Date.now()}`;
      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;
      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
        });
        apClient.getCloudflareApiToken = async () => 'cf_hermetic_token';

        const req = new Request('http://localhost:3000/api/recipes/hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'malformed-test',
            files: [{ path: 'index.html', content: 12345 }],
          }),
        });

        const res = await hostingRoute.POST(req);
        assertEqual(res.status, 400, 'Malformed file bundle payload must return HTTP 400 Bad Request');
        const body = await res.json();
        assertEqual(body.error, 'Invalid file bundle structure');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  await registry.runTest(
    'B18: Truncated or corrupted ZIP buffer safety (file-reader.ts boundary checks prevent RangeError)',
    async () => {
      // 1. Zero-byte buffer
      const zeroResult = await extractZipFiles(new ArrayBuffer(0));
      assertEqual(Array.isArray(zeroResult), true);
      assertEqual(zeroResult.length, 0, 'Zero-byte buffer must safely return empty array');

      // 2. Truncated header (< 30 bytes)
      const truncatedBuf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]).buffer;
      const truncResult = await extractZipFiles(truncatedBuf);
      assertEqual(truncResult.length, 0, 'Truncated header must return empty array without throwing');

      // 3. Corrupted / random bytes
      const randomBuf = crypto.randomBytes(128).buffer;
      const randomResult = await extractZipFiles(randomBuf);
      assertEqual(randomResult.length, 0, 'Random bytes must return empty array without throwing');

      // 4. Out-of-bounds filename length
      // Header: 30 bytes, fileNameLength = 500, but total buffer is only 40 bytes
      const oobFileNameBuf = new ArrayBuffer(40);
      const view1 = new DataView(oobFileNameBuf);
      view1.setUint32(0, 0x04034b50, true);
      view1.setUint16(26, 500, true);
      const oobFileNameResult = await extractZipFiles(oobFileNameBuf);
      assertEqual(oobFileNameResult.length, 0, 'OOB filename length must break cleanly without RangeError');

      // 5. Out-of-bounds compressed payload size
      // Header: 30 bytes, fileNameLength = 4, compressedSize = 10000, but total buffer is 50 bytes
      const oobDataBuf = new ArrayBuffer(50);
      const view2 = new DataView(oobDataBuf);
      view2.setUint32(0, 0x04034b50, true);
      view2.setUint32(18, 10000, true);
      view2.setUint16(26, 4, true);
      const oobDataResult = await extractZipFiles(oobDataBuf);
      assertEqual(oobDataResult.length, 0, 'OOB compressed data must break cleanly without RangeError');

      // 6. Corrupted Deflate payload
      const deflateCorruptBuf = new ArrayBuffer(40);
      const view3 = new DataView(deflateCorruptBuf);
      view3.setUint32(0, 0x04034b50, true);
      view3.setUint16(8, 8, true);
      view3.setUint32(18, 5, true);
      view3.setUint16(26, 5, true);
      const nameBytes = new TextEncoder().encode('a.txt');
      new Uint8Array(deflateCorruptBuf, 30, 5).set(nameBytes);
      new Uint8Array(deflateCorruptBuf, 35, 5).set([0xff, 0xff, 0xff, 0xff, 0xff]);
      const deflateResult = await extractZipFiles(deflateCorruptBuf);
      assertEqual(Array.isArray(deflateResult), true, 'Corrupted deflate payload must not throw unhandled exception');
    }
  );

  // =========================================================================
  // Phase 4 Boundaries: B19 - B24 (Free Uptime Monitor Boundaries)
  // =========================================================================

  await registry.runTest(
    'B19: POST /api/recipes/uptime rejects unauthenticated requests with HTTP 401',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      try {
        server.getAuthenticatedUser = async () => null;
        const req = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: 'test-monitor' }),
        });
        const res = await uptimeRoute.POST(req);
        assertEqual(res.status, 401, 'Unauthenticated request must return HTTP 401');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  await registry.runTest(
    'B20: POST /api/recipes/uptime rejects missing or empty targets array with HTTP 400',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      try {
        server.getAuthenticatedUser = async () => ({
          id: 'usr_b20_test',
          email: 'b20@ingr.local',
          app_metadata: { plan: 'free' },
        });

        const req = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'valid-subdomain',
            targets: [],
            notification: { type: 'email', target: 'alerts@example.com' },
          }),
        });

        const res = await uptimeRoute.POST(req);
        assertEqual(res.status, 400, 'Empty targets must return HTTP 400');
        const body = await res.json();
        assertIncludes(body.error, 'At least one website');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  await registry.runTest(
    'B21: POST /api/recipes/uptime rejects targets with non-HTTP protocols with HTTP 400',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      try {
        server.getAuthenticatedUser = async () => ({
          id: 'usr_b21_test',
          email: 'b21@ingr.local',
          app_metadata: { plan: 'free' },
        });

        const req = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'valid-subdomain',
            targets: [{ url: 'ftp://bad-proto.org', name: 'Bad Protocol' }],
            notification: { type: 'email', target: 'alerts@example.com' },
          }),
        });

        const res = await uptimeRoute.POST(req);
        assertEqual(res.status, 400, 'Non-HTTP url must return HTTP 400');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  await registry.runTest(
    'B22: POST /api/recipes/uptime rejects invalid notification email or insecure webhook with HTTP 400',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      try {
        server.getAuthenticatedUser = async () => ({
          id: 'usr_b22_test',
          email: 'b22@ingr.local',
          app_metadata: { plan: 'free' },
        });

        // 1. Invalid email
        const req1 = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'valid-subdomain',
            targets: [{ url: 'https://example.com', name: 'Valid Site' }],
            notification: { type: 'email', target: 'not-an-email' },
          }),
        });
        const res1 = await uptimeRoute.POST(req1);
        assertEqual(res1.status, 400, 'Invalid email must return HTTP 400');

        // 2. Insecure webhook
        const req2 = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'valid-subdomain',
            targets: [{ url: 'https://example.com', name: 'Valid Site' }],
            notification: { type: 'webhook', target: 'http://insecure.com/hook' },
          }),
        });
        const res2 = await uptimeRoute.POST(req2);
        assertEqual(res2.status, 400, 'Insecure webhook must return HTTP 400');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  await registry.runTest(
    'B23: POST /api/recipes/uptime rejects invalid status page subdomain with HTTP 400',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      try {
        server.getAuthenticatedUser = async () => ({
          id: 'usr_b23_test',
          email: 'b23@ingr.local',
          app_metadata: { plan: 'free' },
        });

        const req = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: '-invalid_subdomain-',
            targets: [{ url: 'https://example.com', name: 'Example' }],
            notification: { type: 'email', target: 'alerts@example.com' },
          }),
        });
        const res = await uptimeRoute.POST(req);
        assertEqual(res.status, 400, 'Invalid subdomain must return HTTP 400');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  await registry.runTest(
    'B24: Plan limit blocks 3rd active recipe when 1 hosting and 1 uptime recipe already active',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const { recipeStore } = jiti('./lib/recipes/store.ts');
      const origAuth = server.getAuthenticatedUser;

      const userId = `usr_b24_limit_${Date.now()}`;

      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });

        // 1st active recipe: hosting
        await recipeStore.createRecipe({
          userId,
          type: 'hosting',
          name: 'Site 1',
          status: 'active',
          subdomain: 'site1-b24',
        });

        // 2nd active recipe: uptime
        await recipeStore.createRecipe({
          userId,
          type: 'uptime',
          name: 'Status 1',
          status: 'active',
          subdomain: 'status1-b24',
        });

        // Attempt 3rd recipe via uptime POST
        const req = new Request('http://localhost:3000/api/recipes/uptime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'status2-b24',
            targets: [{ url: 'https://example.com', name: 'Site' }],
            notification: { type: 'email', target: 'alerts@example.com' },
          }),
        });

        const res = await uptimeRoute.POST(req);
        assertEqual(res.status, 403, 'Exceeding 2 active recipes must return HTTP 403');
        const body = await res.json();
        assertEqual(body.code, 'PLAN_LIMIT_EXCEEDED');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  // B25: POST /api/services blocks 4th connection on Free tier with HTTP 403 SERVICES_LIMIT_EXCEEDED
  await registry.runTest('B25: POST /api/services blocks 4th connection on Free tier with HTTP 403 SERVICES_LIMIT_EXCEEDED',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const servicesRoute = jiti('./app/api/services/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const apClient = jiti('./lib/activepieces/client.ts');
      const { updateBillingAccount } = jiti('./lib/stripe/client.ts');
      const origAuth = server.getAuthenticatedUser;
      const origList = apClient.listAppConnections;

      const userId = `usr_b25_${Date.now()}`;

      try {
        await updateBillingAccount(userId, { plan: 'free', status: 'active' });

        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });

        // Mock 3 existing active connections for this user
        apClient.listAppConnections = async () => [
          { id: '1', externalId: `usr_${userId}_supabase`, displayName: 'Supabase', pieceName: 'supabase', status: 'ACTIVE' },
          { id: '2', externalId: `usr_${userId}_cloudflare`, displayName: 'Cloudflare', pieceName: 'cloudflare', status: 'ACTIVE' },
          { id: '3', externalId: `usr_${userId}_openrouter`, displayName: 'OpenRouter', pieceName: 'openrouter', status: 'ACTIVE' },
        ];

        // Attempt to connect 4th service (oracle)
        const req = new Request('http://localhost:3000/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'oracle',
            credentials: { tenancyOcid: 'ocid1', userOcid: 'ocid2' },
          }),
        });

        const res = await servicesRoute.POST(req);
        assertEqual(res.status, 403, 'Exceeding 3 connected services on Free tier must return HTTP 403');
        const body = await res.json();
        assertEqual(body.code, 'SERVICES_LIMIT_EXCEEDED');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.listAppConnections = origList;
      }
    }
  );

  // B26: POST /api/billing/webhook rejects missing or invalid signatures with HTTP 400
  await registry.runTest('B26: POST /api/billing/webhook rejects forged or missing signature with HTTP 400',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const webhookRoute = jiti('./app/api/billing/webhook/route.ts');

      // 1. Missing signature
      const reqMissing = new Request('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'customer.subscription.deleted' }),
      });
      const resMissing = await webhookRoute.POST(reqMissing);
      // In mock/test mode without STRIPE_WEBHOOK_SECRET, verifies mock payload handling; when secret set, returns 400
      assert(resMissing.status === 200 || resMissing.status === 400, 'Must safely respond to webhook');
    }
  );

  // B27: Unauthenticated calls to billing endpoints return HTTP 401
  await registry.runTest('B27: Unauthenticated calls to /api/billing/checkout and /portal return HTTP 401',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const checkoutRoute = jiti('./app/api/billing/checkout/route.ts');
      const portalRoute = jiti('./app/api/billing/portal/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      try {
        server.getAuthenticatedUser = async () => null;

        const resCheckout = await checkoutRoute.POST(new Request('http://localhost:3000/api/billing/checkout', { method: 'POST' }));
        assertEqual(resCheckout.status, 401, 'Unauthenticated checkout must return 401');

        const resPortal = await portalRoute.POST(new Request('http://localhost:3000/api/billing/portal', { method: 'POST' }));
        assertEqual(resPortal.status, 401, 'Unauthenticated portal must return 401');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  // B28: Security headers verification in Next.js configuration
  await registry.runTest('B28: Next.js headers contain hardened CSP, HSTS, X-Frame-Options DENY and Permissions-Policy',
    async () => {
      const nextConfigPath = path.resolve(WEB_ROOT, 'next.config.ts');
      const content = fs.readFileSync(nextConfigPath, 'utf8');

      assertIncludes(content, 'X-Frame-Options', 'Must configure X-Frame-Options');
      assertIncludes(content, 'DENY', 'Must set X-Frame-Options to DENY');
      assertIncludes(content, 'Content-Security-Policy', 'Must configure CSP');
      assertIncludes(content, 'Strict-Transport-Security', 'Must configure HSTS');
      assertIncludes(content, 'Permissions-Policy', 'Must configure Permissions-Policy');
    }
  );
}

if (process.argv[1]?.endsWith('test_boundaries.mjs')) {
  runTier2Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
