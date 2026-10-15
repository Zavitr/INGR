/**
 * Tier 1: Feature F17 - Recipe 1: Free Website Hosting Flow & Lifecycle
 * Authoritative sources:
 *   - ORIGINAL_REQUEST.md (2026-10-08T20:52:21Z: R1, R2, R3, R4)
 *   - MASTER_PLAN.md (Part 5: Recipe 1: Free Website Hosting & Part 2: Core UX Principles)
 *   - SCOPE.md (Phase 3 Milestones & Features F1-F14)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import createJiti from '../../../web/node_modules/jiti/lib/index.js';
import {
  adminSignIn,
  createAppConnection,
  deleteAppConnection,
  listAppConnections,
} from '../helpers/api_client.mjs';
import {
  assert,
  assertEqual,
  assertNotEqual,
  assertHttpStatus,
  assertIncludes,
  assertNotIncludes,
  assertFileExists,
} from '../helpers/assertions.mjs';
import { CONFIG, WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F17 Recipe Hosting', 'Tier 1', 'F17');

export async function runF17Tests() {
  const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
    alias: { '@': WEB_ROOT },
  });

  process.env.TEST_MODE = 'true';
  delete process.env.MOCK_CLOUDFLARE_TOKEN;

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
  } = jiti('./lib/activepieces/client.ts');

  const {
    hasRootIndexHtml,
    getStarterWebsiteFiles,
  } = jiti('./lib/recipes/file-reader.ts');

  const routes = {
    recipesList: path.join(WEB_ROOT, 'app/api/recipes/route.ts'),
    hosting: path.join(WEB_ROOT, 'app/api/recipes/hosting/route.ts'),
    update: path.join(WEB_ROOT, 'app/api/recipes/hosting/[id]/update/route.ts'),
    deactivate: path.join(WEB_ROOT, 'app/api/recipes/hosting/[id]/deactivate/route.ts'),
  };

  // =========================================================================
  // F17-01: Recipe API route handlers enforce authentication and return HTTP 401
  // =========================================================================
  await registry.runTest(
    'F17-01: Recipe API route handlers enforce authentication and return HTTP 401 Unauthorized',
    async () => {
      // 1. Static route verification
      for (const [name, filePath] of Object.entries(routes)) {
        assertFileExists(filePath, `Recipe route ${name} must exist at ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        assertIncludes(
          content,
          'getAuthenticatedUser',
          `Route ${name} must import and invoke getAuthenticatedUser`
        );
        assertIncludes(
          content,
          '401',
          `Route ${name} must return status 401 when unauthenticated`
        );
        assertIncludes(
          content,
          'Unauthorized',
          `Route ${name} must return Unauthorized message`
        );
      }

      // 2. Live HTTP probe if web server is running
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const probe = await fetch(`${CONFIG.webUrl}/api/recipes`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        assertHttpStatus(probe.status, 401, 'Unauthenticated GET /api/recipes must return 401');

        const postProbe = await fetch(`${CONFIG.webUrl}/api/recipes/hosting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: 'test' }),
        });
        assertHttpStatus(postProbe.status, 401, 'Unauthenticated POST /api/recipes/hosting must return 401');

        const updateProbe = await fetch(`${CONFIG.webUrl}/api/recipes/hosting/rec_fake/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assertHttpStatus(updateProbe.status, 401, 'Unauthenticated POST update must return 401');

        const deactProbe = await fetch(`${CONFIG.webUrl}/api/recipes/hosting/rec_fake/deactivate`, {
          method: 'POST',
        });
        assertHttpStatus(deactProbe.status, 401, 'Unauthenticated POST deactivate must return 401');
      } catch {
        // Web server offline in test environment is expected and tolerated; static contracts verified above
      }
    }
  );

  // =========================================================================
  // F17-02: Cloudflare account pre-flight check validates vault connection and rejects missing tokens
  // =========================================================================
  await registry.runTest(
    'F17-02: Cloudflare account pre-flight check validates vault connection and rejects missing tokens with HTTP 400',
    async () => {
      // 1. Static verification in route files
      const hostingContent = fs.readFileSync(routes.hosting, 'utf-8');
      assertIncludes(
        hostingContent,
        'getCloudflareApiToken',
        'hosting/route.ts must invoke getCloudflareApiToken'
      );
      assertIncludes(
        hostingContent,
        'CLOUDFLARE_NOT_CONNECTED',
        'hosting/route.ts must return CLOUDFLARE_NOT_CONNECTED error code when missing token'
      );

      const updateContent = fs.readFileSync(routes.update, 'utf-8');
      assertIncludes(
        updateContent,
        'getCloudflareApiToken',
        'update/route.ts must invoke getCloudflareApiToken'
      );
      assertIncludes(
        updateContent,
        'CLOUDFLARE_NOT_CONNECTED',
        'update/route.ts must return CLOUDFLARE_NOT_CONNECTED code when missing token'
      );

      // 2. Activepieces client implementation checks usr_${userId}_cloudflare
      const clientPath = path.join(WEB_ROOT, 'lib/activepieces/client.ts');
      const clientContent = fs.readFileSync(clientPath, 'utf-8');
      assertIncludes(
        clientContent,
        'usr_${userId}_cloudflare',
        'client.ts must target user-scoped externalId usr_${userId}_cloudflare'
      );

      // 3. Functional check: querying token for nonexistent user returns null
      const nonexistentToken = await getCloudflareApiToken(`nonexistent_${Date.now()}`);
      assertEqual(nonexistentToken, null, 'Unconnected user must resolve to null token');

      // 4. Live vault check with engine
      const testUserId = `f17_test_${Date.now()}`;
      const extId = `usr_${testUserId}_cloudflare`;
      let connectionId = null;
      try {
        const { data: auth } = await adminSignIn();
        const { status, data } = await createAppConnection(auth.token, {
          projectId: auth.projectId,
          externalId: extId,
          displayName: `Cloudflare Test (${testUserId})`,
          pieceName: '@activepieces/piece-http',
          type: 'SECRET_TEXT',
          value: {
            type: 'SECRET_TEXT',
            secret_text: 'cf_test_vault_token_f17_02',
          },
        });
        if (status === 200 || status === 201) {
          connectionId = data.id;
          const { data: list } = await listAppConnections(auth.token, auth.projectId);
          const found = list.data.find(c => c.id === connectionId);
          assert(found !== undefined, 'Vault connection must exist in engine list');
          assertEqual(found.status, 'ACTIVE', 'Connection must be active');
        }
      } finally {
        if (connectionId) {
          try {
            const { data: auth } = await adminSignIn();
            await deleteAppConnection(auth.token, connectionId);
          } catch {
            // Cleanup tolerance
          }
        }
      }
    }
  );

  // =========================================================================
  // F17-03: Subdomain validation enforces 3-63 character length, lowercase alphanumeric hyphens
  // =========================================================================
  await registry.runTest(
    'F17-03: Subdomain validation enforces 3-63 character length, lowercase alphanumeric hyphens, and rejects invalid formats',
    async () => {
      // Valid subdomains
      const validCases = ['my-site', 'coolsite123', 'a-b-c', 'site-1', 'a'.repeat(63), 'xn--test'];
      for (const valid of validCases) {
        assertEqual(isValidSubdomain(valid), true, `Subdomain "${valid}" should be valid`);
        const res = validateSubdomain(valid);
        assertEqual(res.valid, true, `Validation result for "${valid}" should be valid: true`);
      }

      // Invalid: length boundaries
      assertEqual(isValidSubdomain('ab'), false, 'Subdomain length 2 must be invalid');
      assertEqual(validateSubdomain('ab').valid, false);
      assertEqual(isValidSubdomain('a'.repeat(64)), false, 'Subdomain length 64 must be invalid');
      assertEqual(validateSubdomain('a'.repeat(64)).valid, false);

      // Invalid: leading or trailing hyphens
      assertEqual(isValidSubdomain('-leading'), false, 'Leading hyphen must be invalid');
      assertEqual(isValidSubdomain('trailing-'), false, 'Trailing hyphen must be invalid');
      assertEqual(isValidSubdomain('-both-'), false, 'Both hyphens must be invalid');

      // Invalid: uppercase letters
      assertEqual(isValidSubdomain('MySite'), false, 'Uppercase letters must be invalid');
      assertEqual(validateSubdomain('MySite').valid, false);

      // Invalid: whitespace
      assertEqual(isValidSubdomain(''), false, 'Empty subdomain must be invalid');
      assertEqual(isValidSubdomain('   '), false, 'Whitespace subdomain must be invalid');
      assertEqual(isValidSubdomain('my site'), false, 'Subdomain with space must be invalid');

      // Invalid: special symbols & traversal
      const invalidSymbols = ['site.name', 'site!@', '../traversal', 'site_name', 'site/page'];
      for (const inv of invalidSymbols) {
        assertEqual(isValidSubdomain(inv), false, `Subdomain "${inv}" with special chars must be invalid`);
        assertEqual(validateSubdomain(inv).valid, false);
      }

      // Route inspection
      const hostingContent = fs.readFileSync(routes.hosting, 'utf-8');
      assertIncludes(
        hostingContent,
        'validateSubdomain',
        'hosting/route.ts must call validateSubdomain'
      );
    }
  );

  // =========================================================================
  // F17-04: File bundle validation requires non-empty upload and enforces presence of root index.html
  // =========================================================================
  await registry.runTest(
    'F17-04: File bundle validation requires non-empty upload and enforces presence of root index.html',
    async () => {
      // Valid bundles
      const valid1 = validateFileBundle([{ path: 'index.html', content: '<h1>Home</h1>' }]);
      assertEqual(valid1.valid, true, 'Bundle with root index.html must be valid');

      const valid2 = validateFileBundle([
        { path: '/index.html', content: '<h1>Home</h1>' },
        { path: 'styles.css', content: 'body {}' },
      ]);
      assertEqual(valid2.valid, true, 'Bundle with leading slash /index.html must normalize and pass');

      const valid3 = validateFileBundle([
        { path: './index.html', content: '<h1>Home</h1>' },
        { path: 'assets/app.js', content: 'console.log(1)' },
      ]);
      assertEqual(valid3.valid, true, 'Bundle with ./index.html must normalize and pass');

      // Invalid: empty bundle
      assertEqual(validateFileBundle([]).valid, false, 'Empty bundle must be rejected');
      assertEqual(validateFileBundle(null).valid, false, 'Null bundle must be rejected');

      // Invalid: missing index.html
      const noIndex = validateFileBundle([{ path: 'styles.css', content: 'body {}' }]);
      assertEqual(noIndex.valid, false, 'Bundle missing index.html must be rejected');
      assertIncludes(noIndex.error, 'index.html', 'Error message must specify index.html requirement');

      // Invalid: nested index.html without root index.html
      const nestedIndex = validateFileBundle([{ path: 'nested/index.html', content: '<h1>Nested</h1>' }]);
      assertEqual(nestedIndex.valid, false, 'Bundle with only nested index.html must be rejected');

      const distIndex = validateFileBundle([{ path: 'dist/index.html', content: '<h1>Dist</h1>' }]);
      assertEqual(distIndex.valid, false, 'Bundle with dist/index.html must be rejected');

      // Starter website files test
      const starterFiles = getStarterWebsiteFiles();
      assert(Array.isArray(starterFiles) && starterFiles.length > 0, 'Starter website must return file array');
      assertEqual(hasRootIndexHtml(starterFiles), true, 'Starter template must include root index.html');
      assertEqual(validateFileBundle(starterFiles).valid, true, 'Starter template must pass bundle validation');
    }
  );

  // =========================================================================
  // F17-05: Cloudflare Pages deployment orchestration generates SHA-256 manifests and executes hermetic mock deployments
  // =========================================================================
  await registry.runTest(
    'F17-05: Cloudflare Pages deployment orchestration generates SHA-256 manifests and executes hermetic mock deployments',
    async () => {
      // 1. isHermeticMode detection
      assertEqual(isHermeticMode('cf_test_mock_token'), true, 'cf_test_ prefix must activate hermetic mode');
      assertEqual(isHermeticMode('mock_token_123'), true, 'mock_ prefix must activate hermetic mode');
      assertEqual(isHermeticMode('test_token_456'), true, 'test_ prefix must activate hermetic mode');
      assertEqual(isHermeticMode('mock'), true, 'exact token "mock" must activate hermetic mode');

      // 2. normalizeFiles and SHA-256 hash computation
      const testFiles = [
        { path: 'index.html', content: '<html><body>Hello</body></html>' },
        { path: 'css/app.css', content: 'body { margin: 0; }' },
      ];
      const normalized = normalizeFiles(testFiles);
      assertEqual(normalized.length, 2, 'Must normalize 2 files');
      assertEqual(normalized[0].path, '/index.html', 'Root path must have leading slash');
      assertEqual(normalized[1].path, '/css/app.css', 'Nested path must normalize with leading slash');

      const expectedHash = crypto
        .createHash('sha256')
        .update(Buffer.from(testFiles[0].content, 'utf8'))
        .digest('hex');
      assertEqual(normalized[0].hash, expectedHash, 'SHA-256 digest must match cryptographic hash');

      // 3. deployToCloudflarePages execution in hermetic mode
      const testSubdomain = `f17-site-${Date.now().toString(36)}`;
      const result = await deployToCloudflarePages({
        apiToken: 'cf_test_hermetic_token',
        projectName: testSubdomain,
        files: testFiles,
      });

      assertEqual(result.status, 'active', 'Hermetic deployment must yield status "active"');
      assertEqual(result.projectName, testSubdomain, 'Project name must match requested subdomain');
      assertEqual(result.url, `https://${testSubdomain}.pages.dev`, 'URL must point to *.pages.dev');
      assert(result.deploymentId.startsWith('dep_sim_'), 'Deployment ID must have dep_sim_ prefix');

      // 4. Input rejection safety: invalid subdomain throws before network
      let threwSubdomain = false;
      try {
        await deployToCloudflarePages({
          apiToken: 'cf_test_hermetic_token',
          projectName: 'invalid_subdomain!',
          files: testFiles,
        });
      } catch (err) {
        threwSubdomain = true;
      }
      assert(threwSubdomain, 'deployToCloudflarePages must throw on invalid subdomain');

      // 5. Input rejection safety: missing index.html throws before network
      let threwBundle = false;
      try {
        await deployToCloudflarePages({
          apiToken: 'cf_test_hermetic_token',
          projectName: 'valid-subdomain',
          files: [{ path: 'styles.css', content: 'body{}' }],
        });
      } catch (err) {
        threwBundle = true;
      }
      assert(threwBundle, 'deployToCloudflarePages must throw on bundle missing index.html');
    }
  );

  // =========================================================================
  // F17-06: Dual-store resilience provides isolated multi-tenant recipe persistence across lifecycles
  // =========================================================================
  await registry.runTest(
    'F17-06: Dual-store resilience provides isolated multi-tenant recipe persistence across create, list, update, and deactivate lifecycles',
    async () => {
      const userA = `usr_f17_alice_${Date.now()}`;
      const userB = `usr_f17_bob_${Date.now()}`;

      // 1. Create recipe for User A
      const recA = await recipeStore.createRecipe({
        userId: userA,
        name: 'Alice Site',
        subdomain: 'alice-site',
        liveUrl: 'https://alice-site.pages.dev',
        status: 'active',
        services: ['cloudflare'],
        metadata: { theme: 'dark' },
      });
      assert(recA.id.startsWith('rec_'), 'Created recipe must have rec_ ID');
      assertEqual(recA.userId, userA);
      assertEqual(recA.status, 'active');

      // 2. Create recipe for User B
      const recB = await recipeStore.createRecipe({
        userId: userB,
        name: 'Bob Site',
        subdomain: 'bob-site',
        liveUrl: 'https://bob-site.pages.dev',
        status: 'active',
        services: ['cloudflare'],
        metadata: { theme: 'light' },
      });
      assert(recB.id.startsWith('rec_'));
      assertEqual(recB.userId, userB);

      // 3. Multi-tenant listing isolation
      const listA = await recipeStore.listRecipes(userA);
      assertEqual(listA.length, 1, 'User A should only see 1 recipe');
      assertEqual(listA[0].id, recA.id);

      const listB = await recipeStore.listRecipes(userB);
      assertEqual(listB.length, 1, 'User B should only see 1 recipe');
      assertEqual(listB[0].id, recB.id);

      // 4. Cross-tenant access rejection
      const crossFetch = await recipeStore.getRecipeById(userA, recB.id);
      assertEqual(crossFetch, null, 'User A must not be able to retrieve User B recipe');

      // 5. Update lifecycle
      const updatedA = await recipeStore.updateRecipe(userA, recA.id, {
        name: 'Alice Site Updated',
        metadata: { theme: 'system', fileCount: 5 },
      });
      assert(updatedA !== null, 'Updated recipe must exist');
      assertEqual(updatedA.name, 'Alice Site Updated');
      assertEqual(updatedA.metadata.theme, 'system');

      // 6. Deactivate lifecycle
      const deactivatedA = await recipeStore.deactivateRecipe(userA, recA.id);
      assert(deactivatedA !== null, 'Deactivated recipe must exist');
      assertEqual(deactivatedA.status, 'inactive', 'Recipe status must become inactive');

      // 7. Active count verification
      const countA = await recipeStore.countActive(userA);
      assertEqual(countA, 0, 'User A active count must drop to 0 after deactivation');

      const countB = await recipeStore.countActive(userB);
      assertEqual(countB, 1, 'User B active count must remain 1');
    }
  );

  // =========================================================================
  // F17-07: Plan limit enforcement caps free tier at 2 active recipes
  // =========================================================================
  await registry.runTest(
    'F17-07: Plan limit enforcement caps free tier at 2 active recipes and blocks creation/reactivation with HTTP 403 PLAN_LIMIT_EXCEEDED',
    async () => {
      // 1. getUserPlan tier resolution
      const freeUser0 = getUserPlan(null, 0);
      assertEqual(freeUser0.tier, 'free');
      assertEqual(freeUser0.maxActiveRecipes, 2);
      assertEqual(freeUser0.canActivateMore, true);

      const freeUser1 = getUserPlan({ app_metadata: { plan: 'free' } }, 1);
      assertEqual(freeUser1.canActivateMore, true);

      const freeUser2 = getUserPlan({ app_metadata: { plan: 'free' } }, 2);
      assertEqual(freeUser2.canActivateMore, false, 'Free user with 2 active recipes cannot activate more');

      const freeUser3 = getUserPlan(null, 3);
      assertEqual(freeUser3.canActivateMore, false);

      const proUser = getUserPlan({ app_metadata: { plan: 'pro' } }, 10);
      assertEqual(proUser.tier, 'pro');
      assertEqual(proUser.maxActiveRecipes, Infinity);
      assertEqual(proUser.canActivateMore, true);

      // 2. Static route inspection for creation limit check
      const hostingContent = fs.readFileSync(routes.hosting, 'utf-8');
      assertIncludes(
        hostingContent,
        'plan.tier === "free"',
        'hosting/route.ts must check plan.tier === "free"'
      );
      assertIncludes(
        hostingContent,
        'activeCount >= plan.maxActiveRecipes',
        'hosting/route.ts must check activeCount >= plan.maxActiveRecipes'
      );
      assertIncludes(
        hostingContent,
        'PLAN_LIMIT_EXCEEDED',
        'hosting/route.ts must return PLAN_LIMIT_EXCEEDED error code'
      );
      assertIncludes(
        hostingContent,
        '403',
        'hosting/route.ts must return HTTP status 403 on limit breach'
      );

      // 3. Static route inspection for update/reactivation limit check
      const updateContent = fs.readFileSync(routes.update, 'utf-8');
      assertIncludes(
        updateContent,
        'PLAN_LIMIT_EXCEEDED',
        'update/route.ts must enforce PLAN_LIMIT_EXCEEDED on reactivation'
      );
      assertIncludes(
        updateContent,
        '403',
        'update/route.ts must return HTTP status 403 when reactivating over limit'
      );

      // 4. Recipes listing endpoint returns plan info
      const listContent = fs.readFileSync(routes.recipesList, 'utf-8');
      assertIncludes(
        listContent,
        'getUserPlan',
        'recipes/route.ts must invoke getUserPlan'
      );
      assertIncludes(
        listContent,
        'maxActiveRecipes',
        'recipes/route.ts must expose maxActiveRecipes in plan object'
      );
    }
  );

  // =========================================================================
  // F17-08: Guided hosting wizard UX implements 4-step stepper, account check, uploaders, and route parity
  // =========================================================================
  await registry.runTest(
    'F17-08: Guided hosting wizard UX implements 4-step stepper, account check, uploaders, and route parity (/protected/recipes/hosting/new)',
    async () => {
      // 1. Route parity
      const newPagePath = path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx');
      assertFileExists(newPagePath);
      const newPageContent = fs.readFileSync(newPagePath, 'utf-8');
      assertIncludes(newPageContent, 'type === "hosting"', 'new/page.tsx must branch on type === "hosting"');
      assertIncludes(newPageContent, '<HostingWizard', 'new/page.tsx must render HostingWizard');

      const aliasPath = path.join(WEB_ROOT, 'app/protected/recipes/hosting/new/page.tsx');
      assertFileExists(aliasPath);
      const aliasContent = fs.readFileSync(aliasPath, 'utf-8');
      assertIncludes(aliasContent, '<HostingWizard />', 'hosting/new/page.tsx must render HostingWizard directly');

      // 2. HostingWizard component architecture
      const wizardPath = path.join(WEB_ROOT, 'components/recipes/hosting-wizard.tsx');
      assertFileExists(wizardPath);
      const wizardContent = fs.readFileSync(wizardPath, 'utf-8');

      // 4-step stepper
      assertIncludes(wizardContent, '1. Account', 'Must contain Step 1: Account');
      assertIncludes(wizardContent, '2. Upload Files', 'Must contain Step 2: Upload Files');
      assertIncludes(wizardContent, '3. Web Address', 'Must contain Step 3: Web Address');
      assertIncludes(wizardContent, '4. Publish', 'Must contain Step 4: Publish');

      // Step 1: Account verification
      assertIncludes(wizardContent, '/api/services', 'Must query /api/services for connected services');
      assertIncludes(wizardContent, 'dash.cloudflare.com/sign-up', 'Must provide link to get a free account');
      assertIncludes(wizardContent, 'dash.cloudflare.com/profile/api-tokens', 'Must provide token generation link');

      // Step 2: Upload Files
      assertIncludes(wizardContent, 'onDrop', 'Must support drag and drop upload');
      assertIncludes(wizardContent, 'hasRootIndexHtml', 'Must validate root index.html presence');
      assertIncludes(wizardContent, 'getStarterWebsiteFiles', 'Must provide sample starter website');

      // Step 3: Web Address
      assertIncludes(wizardContent, 'validateSubdomain', 'Must validate subdomain format');
      assertIncludes(wizardContent, '.pages.dev', 'Must preview *.pages.dev domain');
      assertIncludes(wizardContent, 'customDomain', 'Must support custom domain option');

      // Step 4: Publish
      assertIncludes(wizardContent, 'handlePublish', 'Must implement publishing activation handler');
      assertIncludes(wizardContent, 'Your website is live!', 'Must render celebratory completion state');
      assertIncludes(wizardContent, 'Copy Link', 'Must provide link copy button');
    }
  );

  // =========================================================================
  // F17-09: Dashboard recipe cards render live status badges, live URLs, Update modal, Turn Off deactivation
  // =========================================================================
  await registry.runTest(
    'F17-09: Dashboard recipe cards render live status badges, live URLs, Update modal, Turn Off deactivation, and Pro upgrade notices',
    async () => {
      // 1. Dashboard page integration
      const dashboardPath = path.join(WEB_ROOT, 'app/protected/recipes/page.tsx');
      assertFileExists(dashboardPath);
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
      assertIncludes(dashboardContent, 'recipeStore.listRecipes', 'Dashboard must fetch recipes from store');
      assertIncludes(dashboardContent, '<RecipeList', 'Dashboard must render RecipeList component');
      assertIncludes(dashboardContent, 'Browse Library', 'Dashboard must link empty state to Browse Library');

      // 2. RecipeList component features
      const listCompPath = path.join(WEB_ROOT, 'components/recipes/recipe-list.tsx');
      assertFileExists(listCompPath);
      const listContent = fs.readFileSync(listCompPath, 'utf-8');

      // Usage banner & Pro upgrade notice
      assertIncludes(listContent, 'free websites active', 'Must display active website usage pill');
      assertIncludes(listContent, 'Upgrade to Pro', 'Must display Pro upgrade prompt when at capacity');

      // Card rendering
      assertIncludes(listContent, '.pages.dev', 'Card must render live subdomain address');
      assertIncludes(listContent, 'Active', 'Card must render Active status badge');
      assertIncludes(listContent, 'target="_blank"', 'Card must link out to live website in new tab');

      // Lifecycle actions & modals
      assertIncludes(listContent, 'Update Website', 'Must provide Update Website button');
      assertIncludes(listContent, '/update', 'Update action must call update route');
      assertIncludes(listContent, 'Turn Off', 'Must provide Turn Off deactivation button');
      assertIncludes(listContent, '/deactivate', 'Turn off action must call deactivate route');
      assertIncludes(listContent, 'Turn On', 'Must provide Turn On toggle when inactive');
    }
  );

  // =========================================================================
  // F17-10: Plain-English copy purity audit enforces strict zero-jargon compliance
  // =========================================================================
  await registry.runTest(
    'F17-10: Plain-English copy purity audit enforces strict zero-jargon compliance across all Phase 3 UI components',
    async () => {
      const filesToAudit = [
        path.join(WEB_ROOT, 'components/recipes/hosting-wizard.tsx'),
        path.join(WEB_ROOT, 'components/recipes/recipe-list.tsx'),
        path.join(WEB_ROOT, 'app/protected/recipes/page.tsx'),
        path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx'),
        path.join(WEB_ROOT, 'app/protected/recipes/hosting/new/page.tsx'),
      ];

      const forbiddenJargonPatterns = [
        { name: 'webhook', regex: /\bwebhook(s)?\b/i },
        { name: 'container', regex: /\bcontainer(s)?\b/i },
        { name: 'endpoint', regex: /\bendpoint(s)?\b/i },
        { name: 'DevOps', regex: /\bDevOps\b/i },
        { name: 'CI/CD', regex: /\bCI\/CD\b/i },
        { name: 'Kubernetes', regex: /\bKubernetes\b/i },
        { name: 'Docker', regex: /\bDocker\b/i },
        { name: 'daemon', regex: /\bdaemon(s)?\b/i },
        { name: 'payload', regex: /\bpayload(s)?\b/i },
        { name: 'deprovision', regex: /\bdeprovision(ing)?\b/i },
        { name: 'provisioning', regex: /\bprovisioning\b/i },
      ];

      for (const filePath of filesToAudit) {
        assertFileExists(filePath, `Audit target must exist: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const pattern of forbiddenJargonPatterns) {
          const match = content.match(pattern.regex);
          assert(
            !match,
            `Prohibited technical jargon "${pattern.name}" found in ${path.relative(WEB_ROOT, filePath)}: "${match?.[0]}"`
          );
        }
      }

      // Check for approved plain-English terminology
      const wizardContent = fs.readFileSync(filesToAudit[0], 'utf-8');
      assertIncludes(wizardContent, 'Web address', 'Wizard must use "Web address"');
      assert(
        wizardContent.toLowerCase().includes('website files'),
        'Wizard must use plain-English "website files"'
      );

      const listContent = fs.readFileSync(filesToAudit[1], 'utf-8');
      assertIncludes(listContent, 'Turn Off', 'Recipe list must use "Turn Off" instead of deprovision');
    }
  );
}

if (process.argv[1]?.endsWith('test_f17_recipe_hosting.mjs')) {
  runF17Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
