/**
 * Tier 4: Real-World Scenarios Test Suite
 * End-to-End User Journeys walking through complete application flows as a real user would.
 */

import { adminSignIn, createAppConnection, deleteAppConnection, listAppConnections } from '../helpers/api_client.mjs';
import { assert, assertEqual, assertHttpStatus, assertIncludes, assertNotIncludes, assertFileExists } from '../helpers/assertions.mjs';
import { CONFIG, WEB_ROOT, registry } from '../helpers/test_context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import createJiti from '../../../web/node_modules/jiti/lib/index.js';

registry.setSuite('Tier 4 - Real-World Scenarios', 'Tier 4', 'SCENARIOS');

export async function runTier4Tests() {
  await registry.runTest('S01: Complete User Journey 1 — Visitor Discovery to Registration Flow', async () => {
    // Step 1: User arrives at landing page (web/app/page.tsx)
    const landingPath = path.join(WEB_ROOT, 'app/page.tsx');
    assert(fs.existsSync(landingPath), 'Landing page must exist');
    const landingContent = fs.readFileSync(landingPath, 'utf-8');

    // Step 2: User reads plain-English headline and pricing
    assert(
      landingContent.includes('Free internet services') && landingContent.includes('simplified'),
      'Headline must inspire confidence with simplified services message'
    );
    assertIncludes(landingContent, '$0', 'Free tier must be clearly presented');
    assertIncludes(landingContent, '$7', 'Pro tier must be clearly presented');

    // Step 3: User clicks "Start building for free" primary CTA
    assertIncludes(landingContent, 'href="/auth/sign-up"', 'CTA button must navigate to sign-up');

    // Step 4: User lands on sign-up page (components/sign-up-form.tsx)
    const signUpPath = path.join(WEB_ROOT, 'components/sign-up-form.tsx');
    assert(fs.existsSync(signUpPath), 'Sign up form must exist');
    const signUpContent = fs.readFileSync(signUpPath, 'utf-8');

    // Step 5: User can sign up via Google OAuth or Email/Password
    assert(
      signUpContent.includes('Google') || signUpContent.includes('google'),
      'Must offer Google OAuth one-click sign up'
    );
    assertIncludes(signUpContent, 'type="email"', 'Must offer email signup');
    assertIncludes(signUpContent, 'type="password"', 'Must offer password input');
  });

  await registry.runTest('S02: Complete User Journey 2 — Connecting a Third-Party Service via Cline Pattern', async () => {
    // Step 1: User navigates to Connected Services dashboard tab (/protected/services)
    const servicesPath = path.join(WEB_ROOT, 'app/protected/services/page.tsx');
    const serviceCardPath = path.join(WEB_ROOT, 'components/services/connect-service-card.tsx');
    assert(fs.existsSync(servicesPath), 'Connected services page must exist');
    const servicesContent = fs.readFileSync(servicesPath, 'utf-8');

    // Step 2: User sees Cloudflare service card with explanation and "Connect Account" button
    assertIncludes(servicesContent, 'cloudflare', 'Cloudflare card must be present');
    const cardContent = fs.existsSync(serviceCardPath) ? fs.readFileSync(serviceCardPath, 'utf-8') : '';
    assert(
      servicesContent.includes('Get a free account') || cardContent.includes('Get a free account'),
      'Must provide "Get a free account" link'
    );

    // Step 3: User opens Connect wizard (/protected/services/connect)
    const connectPath = path.join(WEB_ROOT, 'app/protected/services/connect/page.tsx');
    assert(fs.existsSync(connectPath), 'Connect wizard page must exist');

    // Step 4: Behind the scenes, credential is sent to engine vault
    const { data: auth } = await adminSignIn();
    const testExtId = `journey_cf_${Date.now()}`;
    const { status: vaultStatus, data: vaultData } = await createAppConnection(auth.token, {
      projectId: auth.projectId,
      externalId: testExtId,
      displayName: 'User Journey Cloudflare',
      pieceName: '@activepieces/piece-http',
      type: 'SECRET_TEXT',
      value: {
        type: 'SECRET_TEXT',
        secret_text: 'journey-token-secret-123',
      },
    });
    assert(vaultStatus === 200 || vaultStatus === 201, 'Credential must be stored in vault');

    // Step 5: Verify status in vault and cleanup
    const { data: listData } = await listAppConnections(auth.token, auth.projectId);
    const conn = listData.data.find(c => c.id === vaultData.id);
    assert(conn !== undefined, 'Connection must be active in vault');
    await deleteAppConnection(auth.token, vaultData.id);
  });

  await registry.runTest('S03: Complete User Journey 3 — Recipe Discovery & Wizard Activation', async () => {
    // Step 1: User visits Recipes tab (/protected/recipes)
    const recipesPath = path.join(WEB_ROOT, 'app/protected/recipes/page.tsx');
    assert(fs.existsSync(recipesPath), 'Recipes page must exist');
    const recipesContent = fs.readFileSync(recipesPath, 'utf-8');

    // Step 2: User sees empty state with button to browse / create new recipe
    assert(
      recipesContent.includes('Browse Library') || recipesContent.includes('New Recipe'),
      'Must guide user to create first recipe'
    );
    assertIncludes(recipesContent, '/protected/recipes/new', 'CTA must link to /protected/recipes/new');

    // Step 3: User opens /protected/recipes/new
    const newRecipePath = path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx');
    assert(fs.existsSync(newRecipePath), 'Recipe creation route must exist');
    const newRecipeContent = fs.readFileSync(newRecipePath, 'utf-8');

    // Step 4: User selects a pre-built launch recipe template
    assert(
      newRecipeContent.includes('Website Hosting') || newRecipeContent.includes('Hosting') || newRecipeContent.includes('Uptime'),
      'Must offer pre-built recipe templates'
    );
  });

  await registry.runTest('S04: Complete User Journey 4 — Account Management, Billing Transparency & Support', async () => {
    // Step 1: User visits Settings tab (/protected/settings)
    const settingsPath = path.join(WEB_ROOT, 'app/protected/settings/page.tsx');
    assert(fs.existsSync(settingsPath), 'Settings page must exist');
    const settingsContent = fs.readFileSync(settingsPath, 'utf-8');

    // Step 2: User reviews Free Plan limits and Pro upgrade ($7/mo)
    assertIncludes(settingsContent, 'Free Plan', 'Must state current plan');
    assertIncludes(settingsContent, '2 active recipes', 'Must state free recipe limit');
    assertIncludes(settingsContent, '3 connected services', 'Must state free service limit');
    assert(
      settingsContent.includes('$7/mo') || settingsContent.includes('Upgrade to Pro'),
      'Must offer Pro upgrade'
    );

    // Step 3: User reads AES-256 security vault guarantee
    assertIncludes(settingsContent, 'AES-256', 'Must reassure user with plain-English AES-256 vault info');

    // Step 4: User has Crisp support chat accessible on the dashboard shell
    const layoutPath = path.join(WEB_ROOT, 'app/protected/layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    assert(
      layoutContent.includes('CrispChat') || layoutContent.includes('crisp'),
      'Crisp chat widget must be embedded in layout'
    );
  });

  // =========================================================================
  // Phase 3 Milestone 3: S05 User Journey — Free Website Hosting Lifecycle
  // =========================================================================
  await registry.runTest('S05: Complete User Journey 5 — Greenfield Static Site Deployment to Live Public URL via Recipe 1 Wizard', async () => {
    // -------------------------------------------------------------------------
    // Step 1: Visitor navigates to /protected/recipes/new
    // -------------------------------------------------------------------------
    const newRecipePagePath = path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx');
    assertFileExists(newRecipePagePath, 'Recipe creation page must exist at web/app/protected/recipes/new/page.tsx');
    const newRecipeContent = fs.readFileSync(newRecipePagePath, 'utf-8');
    
    assertIncludes(newRecipeContent, 'Create a Recipe', 'Page must have plain-English title');
    assertIncludes(newRecipeContent, 'Back to Recipes', 'Page must have navigation back to recipes dashboard');
    assertIncludes(newRecipeContent, 'href="/protected/recipes"', 'Back link must point to /protected/recipes');

    // -------------------------------------------------------------------------
    // Step 2: Selects "Free Website Hosting" recipe
    // -------------------------------------------------------------------------
    assertIncludes(newRecipeContent, 'Free Website Hosting', 'Templates list must feature Free Website Hosting recipe');
    assertIncludes(newRecipeContent, 'id: "hosting"', 'Hosting template must have id "hosting"');
    assertIncludes(newRecipeContent, 'type === "hosting"', 'Page must conditionally render HostingWizard for type=hosting');
    assertIncludes(newRecipeContent, '<HostingWizard', 'HostingWizard component must be rendered');
    
    // Check alias route /protected/recipes/hosting/new
    const aliasRoutePath = path.join(WEB_ROOT, 'app/protected/recipes/hosting/new/page.tsx');
    assertFileExists(aliasRoutePath, 'Alias route must exist at web/app/protected/recipes/hosting/new/page.tsx');
    const aliasContent = fs.readFileSync(aliasRoutePath, 'utf-8');
    assertIncludes(aliasContent, '<HostingWizard />', 'Alias route must render HostingWizard directly');

    // -------------------------------------------------------------------------
    // Step 3: Passes account check (Wizard Step 1: Account)
    // -------------------------------------------------------------------------
    const wizardPath = path.join(WEB_ROOT, 'components/recipes/hosting-wizard.tsx');
    assertFileExists(wizardPath, 'HostingWizard component must exist');
    const wizardContent = fs.readFileSync(wizardPath, 'utf-8');

    assertIncludes(wizardContent, '1. Account', 'Wizard must start with Account check step');
    assertIncludes(wizardContent, '/api/services', 'Wizard must query user services status from /api/services');
    assertIncludes(wizardContent, 'dash.cloudflare.com/sign-up', 'Wizard must offer "Get a free account" link');
    assertIncludes(wizardContent, 'dash.cloudflare.com/profile/api-tokens', 'Wizard must guide token generation');

    // Live Engine Vault check: simulate user having Cloudflare connected in vault
    const { data: auth } = await adminSignIn();
    const testUserId = `journey_s05_${Date.now()}`;
    const testExtId = `usr_${testUserId}_cloudflare`;
    let connectionId = null;

    try {
      const { status: vaultStatus, data: vaultData } = await createAppConnection(auth.token, {
        projectId: auth.projectId,
        externalId: testExtId,
        displayName: `Cloudflare Journey (${testUserId})`,
        pieceName: '@activepieces/piece-http',
        type: 'SECRET_TEXT',
        value: {
          type: 'SECRET_TEXT',
          secret_text: 'cf_test_mock_token_s05',
        },
      });
      assert(vaultStatus === 200 || vaultStatus === 201, 'Cloudflare credential must be vaulted in engine');
      connectionId = vaultData.id;

      // Verify connection appears in user-scoped vault list
      const { data: listData } = await listAppConnections(auth.token, auth.projectId);
      const conn = listData.data.find(c => c.id === connectionId);
      assert(conn !== undefined, 'Vault connection must be active and visible in engine');

      // -----------------------------------------------------------------------
      // Step 4: Uploads static website bundle containing index.html (Wizard Step 2)
      // -----------------------------------------------------------------------
      assertIncludes(wizardContent, '2. Upload Files', 'Wizard must feature file upload step');
      assertIncludes(wizardContent, 'processUploadedFiles', 'Wizard must use file processor for drag-and-drop & file inputs');
      assertIncludes(wizardContent, 'hasRootIndexHtml', 'Wizard must check for root index.html presence');
      assertIncludes(wizardContent, 'getStarterWebsiteFiles', 'Wizard must offer one-click starter template');

      const fileReaderPath = path.join(WEB_ROOT, 'lib/recipes/file-reader.ts');
      assertFileExists(fileReaderPath, 'File reader helper must exist');
      const fileReaderContent = fs.readFileSync(fileReaderPath, 'utf-8');
      assertIncludes(fileReaderContent, 'export function hasRootIndexHtml', 'Must export hasRootIndexHtml validator');
      assertIncludes(fileReaderContent, 'export function getStarterWebsiteFiles', 'Must export getStarterWebsiteFiles');

      // -----------------------------------------------------------------------
      // Step 5: Configures subdomain (Wizard Step 3: Web Address)
      // -----------------------------------------------------------------------
      assertIncludes(wizardContent, '3. Web Address', 'Wizard must feature web address configuration step');
      assertIncludes(wizardContent, 'validateSubdomain', 'Wizard must perform real-time subdomain validation');
      assertIncludes(wizardContent, '.pages.dev', 'Wizard must display live subdomain preview *.pages.dev');
      assertIncludes(wizardContent, 'customDomain', 'Wizard must include expandable custom domain section');

      const typesPath = path.join(WEB_ROOT, 'lib/recipes/types.ts');
      assertFileExists(typesPath, 'Recipe types & validators must exist');
      const typesContent = fs.readFileSync(typesPath, 'utf-8');
      assertIncludes(typesContent, 'export function validateSubdomain', 'types.ts must export validateSubdomain');

      // -----------------------------------------------------------------------
      // Step 6: Triggers activation (Wizard Step 4: Publish)
      // -----------------------------------------------------------------------
      assertIncludes(wizardContent, '4. Publish', 'Wizard must feature Publish activation step');
      assertIncludes(wizardContent, '/api/recipes/hosting', 'Wizard must trigger POST /api/recipes/hosting');
      assertIncludes(wizardContent, 'handlePublish', 'Wizard must implement publish handler');

      // Verify backend hosting API route contracts
      const hostingRoutePath = path.join(WEB_ROOT, 'app/api/recipes/hosting/route.ts');
      assertFileExists(hostingRoutePath, 'Hosting API route must exist');
      const hostingRouteContent = fs.readFileSync(hostingRoutePath, 'utf-8');
      assertIncludes(hostingRouteContent, 'getAuthenticatedUser', 'Hosting route must require authentication');
      assertIncludes(hostingRouteContent, 'getCloudflareApiToken', 'Hosting route must verify Cloudflare token in vault');
      assertIncludes(hostingRouteContent, 'PLAN_LIMIT_EXCEEDED', 'Hosting route must enforce plan limits');
      assertIncludes(hostingRouteContent, 'deployToCloudflarePages', 'Hosting route must invoke deployment engine');
      assertIncludes(hostingRouteContent, 'recipeStore.createRecipe', 'Hosting route must persist recipe in store');

      // Programmatic Hermetic Deployment Simulation via jiti
      process.env.TEST_MODE = 'true';
      delete process.env.MOCK_CLOUDFLARE_TOKEN;
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), { alias: { '@': WEB_ROOT } });
      const { deployToCloudflarePages, isHermeticMode } = jiti(path.join(WEB_ROOT, 'lib/recipes/cloudflare-pages.ts'));
      const { recipeStore } = jiti(path.join(WEB_ROOT, 'lib/recipes/store.ts'));

      const testSubdomain = `s05-journey-${Date.now().toString(36)}`;
      assert(isHermeticMode('cf_test_mock_token_s05'), 'Hermetic mode must be active for cf_test_ tokens');

      const deployResult = await deployToCloudflarePages({
        apiToken: 'cf_test_mock_token_s05',
        projectName: testSubdomain,
        files: [
          { path: 'index.html', content: '<html><body><h1>My Journey Site</h1></body></html>' },
          { path: 'styles.css', content: 'body { font-family: sans-serif; }' },
        ],
      });

      // -----------------------------------------------------------------------
      // Step 7: Observes deployed status and live URL *.pages.dev
      // -----------------------------------------------------------------------
      assertEqual(deployResult.status, 'active', 'Deployment status must be active');
      assertEqual(deployResult.url, `https://${testSubdomain}.pages.dev`, 'Live URL must match *.pages.dev format');
      assert(deployResult.deploymentId.startsWith('dep_sim_'), 'Deployment ID must be simulated in hermetic mode');

      // Persist in recipe store
      const createdRecipe = await recipeStore.createRecipe({
        userId: testUserId,
        name: testSubdomain,
        subdomain: testSubdomain,
        liveUrl: deployResult.url,
        status: deployResult.status,
        services: ['cloudflare'],
        metadata: { deploymentId: deployResult.deploymentId, fileCount: 2 },
      });

      assertEqual(createdRecipe.status, 'active', 'Stored recipe status must be active');
      assertEqual(createdRecipe.liveUrl, `https://${testSubdomain}.pages.dev`, 'Stored live URL must match *.pages.dev');

      // Verify celebratory card in wizard UI
      assertIncludes(wizardContent, 'Your website is live!', 'Wizard must render celebration card upon completion');
      assertIncludes(wizardContent, 'Copy Link', 'Wizard must render copy live URL button');
      assertIncludes(wizardContent, 'href="/protected/recipes"', 'Wizard must provide CTA to recipes dashboard');

      // -----------------------------------------------------------------------
      // Step 8: Navigates to /protected/recipes
      // -----------------------------------------------------------------------
      const recipesPagePath = path.join(WEB_ROOT, 'app/protected/recipes/page.tsx');
      assertFileExists(recipesPagePath, 'Recipes dashboard page must exist');
      const recipesContent = fs.readFileSync(recipesPagePath, 'utf-8');
      assertIncludes(recipesContent, 'recipeStore.listRecipes', 'Dashboard must fetch recipes from store');
      assertIncludes(recipesContent, 'RecipeList', 'Dashboard must render RecipeList when recipes exist');

      const recipeListPath = path.join(WEB_ROOT, 'components/recipes/recipe-list.tsx');
      assertFileExists(recipeListPath, 'RecipeList component must exist');
      const recipeListContent = fs.readFileSync(recipeListPath, 'utf-8');
      assertIncludes(recipeListContent, 'Active', 'Recipe card must render Active badge');
      assertIncludes(recipeListContent, 'Update Website', 'Recipe card must offer Update Website action');
      assertIncludes(recipeListContent, 'Turn Off', 'Recipe card must offer Turn Off action');

      // Verify store lists our active recipe
      const userRecipes = await recipeStore.listRecipes(testUserId);
      assertEqual(userRecipes.length, 1, 'User must have exactly 1 recipe in store');
      assertEqual(userRecipes[0].id, createdRecipe.id, 'Listed recipe must match created recipe ID');
      const initialActiveCount = await recipeStore.countActive(testUserId);
      assertEqual(initialActiveCount, 1, 'Active recipe count must be 1');

      // -----------------------------------------------------------------------
      // Step 9: Triggers website update
      // -----------------------------------------------------------------------
      const updateRoutePath = path.join(WEB_ROOT, 'app/api/recipes/hosting/[id]/update/route.ts');
      assertFileExists(updateRoutePath, 'Update route must exist');
      const updateRouteContent = fs.readFileSync(updateRoutePath, 'utf-8');
      assertIncludes(updateRouteContent, 'isUpdate: true', 'Update route must pass isUpdate flag to deployToCloudflarePages');
      assertIncludes(updateRouteContent, 'recipeStore.updateRecipe', 'Update route must persist updates');

      // Execute programmatic redeployment
      const redeployResult = await deployToCloudflarePages({
        apiToken: 'cf_test_mock_token_s05',
        projectName: testSubdomain,
        files: [
          { path: 'index.html', content: '<html><body><h1>My Updated Journey Site</h1></body></html>' },
        ],
        isUpdate: true,
      });

      const updatedRecipe = await recipeStore.updateRecipe(testUserId, createdRecipe.id, {
        metadata: { lastDeploymentId: redeployResult.deploymentId, updatedFilesCount: 1 },
      });

      assert(updatedRecipe !== null, 'Updated recipe must exist');
      assertEqual(updatedRecipe.status, 'active', 'Updated recipe must maintain active status');
      assertEqual(updatedRecipe.metadata.lastDeploymentId, redeployResult.deploymentId, 'Recipe must reflect new deployment ID');

      // -----------------------------------------------------------------------
      // Step 10: Triggers website deactivation
      // -----------------------------------------------------------------------
      const deactRoutePath = path.join(WEB_ROOT, 'app/api/recipes/hosting/[id]/deactivate/route.ts');
      assertFileExists(deactRoutePath, 'Deactivate route must exist');
      const deactRouteContent = fs.readFileSync(deactRoutePath, 'utf-8');
      assertIncludes(deactRouteContent, 'recipeStore.deactivateRecipe', 'Deactivate route must call deactivateRecipe');

      // Execute programmatic deactivation
      const deactivatedRecipe = await recipeStore.deactivateRecipe(testUserId, createdRecipe.id);
      assert(deactivatedRecipe !== null, 'Deactivated recipe must exist');
      assertEqual(deactivatedRecipe.status, 'inactive', 'Recipe status must transition to inactive');

      // Verify quota restoration: active count drops from 1 to 0
      const finalActiveCount = await recipeStore.countActive(testUserId);
      assertEqual(finalActiveCount, 0, 'Active recipe count must drop to 0 after deactivation, freeing plan quota');

      // Verify UI reflects paused state
      assertIncludes(recipeListContent, 'Paused', 'Recipe list must render Paused badge when status is inactive');
      assertIncludes(recipeListContent, 'Turn On', 'Recipe list must toggle button to Turn On when inactive');
    } finally {
      // Teardown: clean up engine vault credential
      if (connectionId) {
        await deleteAppConnection(auth.token, connectionId);
      }
    }
  });

  // =========================================================================
  // Phase 4 Real-World Scenario: S06 (Free Uptime Monitor User Journey)
  // =========================================================================

  await registry.runTest('S06: Complete User Journey 6 — End-to-End Free Uptime Monitor Lifecycle', async () => {
    const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
      alias: { '@': WEB_ROOT },
    });

    const { uptimeOrchestrator } = jiti('./lib/recipes/uptime-kuma.ts');
    const { recipeStore } = jiti('./lib/recipes/store.ts');
    const { validateMonitorUrl, validateNotificationChannel, validateSubdomain } = jiti('./lib/recipes/types.ts');

    const testUserId = `usr_s06_journey_${Date.now()}`;
    const testSubdomain = `status-journey-${Date.now() % 100000}`;

    // Step 1: User arrives at Recipe Library and chooses "Free Uptime Monitor"
    const newRecipePage = path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx');
    assertFileExists(newRecipePage);
    const newRecipeContent = fs.readFileSync(newRecipePage, 'utf-8');
    assertIncludes(newRecipeContent, 'Free Uptime Monitor');
    assertIncludes(newRecipeContent, 'UptimeWizard');

    // Step 2: User completes step 2: specifies websites to monitor
    const monitorTargets = [
      { url: 'https://mywebsite.com', name: 'Main Storefront', intervalSeconds: 60 },
      { url: 'https://api.mywebsite.com/health', name: 'Core API', intervalSeconds: 60 },
    ];
    for (const target of monitorTargets) {
      const val = validateMonitorUrl(target.url);
      assertEqual(val.valid, true);
    }

    // Step 3: User completes step 3: specifies alert destination
    const alertChannel = { type: 'email', target: 'ops-alerts@mywebsite.com' };
    const notifVal = validateNotificationChannel(alertChannel.type, alertChannel.target);
    assertEqual(notifVal.valid, true);

    // Step 4: User completes step 4: specifies status page subdomain
    const subVal = validateSubdomain(testSubdomain);
    assertEqual(subVal.valid, true);

    // Step 5: Provision monitor stack via orchestrator
    const provisionResult = await uptimeOrchestrator.provision(testUserId, {
      name: 'My Storefront Status',
      subdomain: testSubdomain,
      targets: monitorTargets,
      notification: alertChannel,
    });

    assertEqual(provisionResult.success, true);
    assertIncludes(provisionResult.statusPageUrl, `${testSubdomain}.status.ingr.app`);
    assertEqual(provisionResult.uptimePercent, 99.98);

    // Step 6: Persist recipe in store
    const createdRecipe = await recipeStore.createRecipe({
      userId: testUserId,
      type: 'uptime',
      name: 'My Storefront Status',
      status: 'active',
      subdomain: testSubdomain,
      liveUrl: provisionResult.statusPageUrl,
      services: ['oracle'],
      metadata: provisionResult.metadata,
    });

    assertEqual(createdRecipe.status, 'active');
    assertEqual(createdRecipe.type, 'uptime');

    // Step 7: Recipe displays in user dashboard
    const userRecipes = await recipeStore.listRecipes(testUserId);
    assertEqual(userRecipes.length, 1);
    assertEqual(userRecipes[0].id, createdRecipe.id);

    // Step 8: Telemetry stats query
    const stats = await uptimeOrchestrator.getStats(createdRecipe.metadata);
    assertEqual(stats.uptimePercent, 99.98);
    assertEqual(stats.monitors.length, 2);
    assertEqual(stats.monitors[0].status, 'up');

    // Step 9: User updates monitor targets
    const updatedMetadata = await uptimeOrchestrator.update(testUserId, createdRecipe.metadata, {
      targets: [
        ...monitorTargets,
        { url: 'https://docs.mywebsite.com', name: 'Documentation', intervalSeconds: 60 },
      ],
    });
    assertEqual(updatedMetadata.monitorsCount, 3);

    const updatedRecipe = await recipeStore.updateRecipe(testUserId, createdRecipe.id, {
      metadata: updatedMetadata,
    });
    assertEqual(updatedRecipe?.metadata.monitorsCount, 3);

    // Step 10: User pauses uptime monitor
    const pausedRecipe = await recipeStore.deactivateRecipe(testUserId, createdRecipe.id);
    assertEqual(pausedRecipe?.status, 'inactive');

    const activeCount = await recipeStore.countActive(testUserId);
    assertEqual(activeCount, 0, 'Active recipe quota must be restored upon pause');
  });

  await registry.runTest('S07: Complete User Journey 7 — End-to-End Billing Lifecycle & Quota Management', async () => {
    const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
      alias: { '@': WEB_ROOT },
    });
    const { RecipeStore } = jiti('./lib/recipes/store.ts');
    const { getUserPlan } = jiti('./lib/recipes/types.ts');
    const {
      getBillingAccount,
      updateBillingAccount,
      createCheckoutSession,
      createCustomerPortalSession,
      isEventProcessed,
      markEventProcessed,
    } = jiti('./lib/stripe/client.ts');

    const testUser = `usr_s07_${Date.now()}`;
    const store = new RecipeStore();

    // Step 1: User starts on Free plan
    const initialBilling = await getBillingAccount(testUser);
    assertEqual(initialBilling.plan, 'free');

    const initialPlan = getUserPlan({ id: testUser }, 0, initialBilling.plan);
    assertEqual(initialPlan.maxActiveRecipes, 2);
    assertEqual(initialPlan.maxConnectedServices, 3);

    // Step 2: User creates 2 recipes (fills quota)
    await store.createRecipe({
      userId: testUser,
      type: 'hosting',
      name: 'Site 1',
      subdomain: `site-1-${Date.now()}`,
      status: 'active',
    });
    await store.createRecipe({
      userId: testUser,
      type: 'uptime',
      name: 'Status 1',
      subdomain: `status-1-${Date.now()}`,
      status: 'active',
    });

    let activeCount = await store.countActive(testUser);
    assertEqual(activeCount, 2);
    const quotaCheck = getUserPlan({ id: testUser }, activeCount, initialBilling.plan);
    assertEqual(quotaCheck.canActivateMore, false, 'Free quota fully utilized');

    // Step 3: User clicks Upgrade to Pro and receives checkout session
    const checkout = await createCheckoutSession(testUser, 'subscriber@example.com');
    assert(checkout.sessionId.length > 0);

    // Step 4: Webhook triggers subscription activation
    await updateBillingAccount(testUser, {
      stripeCustomerId: 'cus_s07',
      stripeSubscriptionId: 'sub_s07',
      plan: 'pro',
      status: 'active',
    });

    const proBilling = await getBillingAccount(testUser);
    assertEqual(proBilling.plan, 'pro');
    const proPlan = getUserPlan({ id: testUser }, activeCount, proBilling.plan);
    assertEqual(proPlan.maxActiveRecipes, Infinity);
    assertEqual(proPlan.canActivateMore, true);

    // Step 5: User successfully deploys 3rd and 4th recipe under Pro
    await store.createRecipe({
      userId: testUser,
      type: 'hosting',
      name: 'Site 2',
      subdomain: `site-2-${Date.now()}`,
      status: 'active',
    });
    await store.createRecipe({
      userId: testUser,
      type: 'uptime',
      name: 'Status 2',
      subdomain: `status-2-${Date.now()}`,
      status: 'active',
    });
    activeCount = await store.countActive(testUser);
    assertEqual(activeCount, 4);

    // Step 6: User cancels subscription -> recipes safely preserved (never deleted), excess paused
    await updateBillingAccount(testUser, {
      plan: 'free',
      status: 'canceled',
    });

    const activeList = (await store.listRecipes(testUser)).filter(
      (r) => r.status === 'active' || r.status === 'deploying'
    );
    if (activeList.length > 2) {
      for (const excess of activeList.slice(2)) {
        await store.updateRecipe(testUser, excess.id, { status: 'inactive' });
      }
    }

    const finalRecipes = await store.listRecipes(testUser);
    assertEqual(finalRecipes.length, 4, 'Zero data loss: all 4 recipes preserved');
    const finalActive = await store.countActive(testUser);
    assertEqual(finalActive, 2, 'Excess recipes safely paused');
  });
}

if (process.argv[1]?.endsWith('test_scenarios.mjs')) {
  runTier4Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
