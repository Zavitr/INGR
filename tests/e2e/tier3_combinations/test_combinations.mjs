/**
 * Tier 3: Cross-Feature Combinations Test Suite
 * Tests interactions between multiple system components:
 * - Engine Auth + Credential Vaulting + Retrieval
 * - Web API Proxy + Activepieces Client
 * - Landing CTA + Auth Routing
 * - Dashboard Layout + Sub-route Navigation
 * - Piece Catalog + Launch Recipe Requirements
 */

import { adminSignIn, createAppConnection, deleteAppConnection, fetchPieces, listAppConnections } from '../helpers/api_client.mjs';
import { assert, assertEqual, assertHttpStatus, assertIncludes } from '../helpers/assertions.mjs';
import { CONFIG, WEB_ROOT, registry } from '../helpers/test_context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import createJiti from '../../../web/node_modules/jiti/lib/index.js';

registry.setSuite('Tier 3 - Cross-Feature Combinations', 'Tier 3', 'COMBINATIONS');

export async function runTier3Tests() {
  await registry.runTest('C01: Engine Auth + Credential Vaulting + Retrieval Lifecycle', async () => {
    // 1. Authenticate admin
    const { status: authStatus, data: authData } = await adminSignIn();
    assertHttpStatus(authStatus, 200, 'Admin sign-in must succeed');
    const { token, projectId } = authData;

    // 2. Vault new credential
    const extId = `lifecycle_test_${Date.now()}`;
    const { status: createStatus, data: createData } = await createAppConnection(token, {
      projectId,
      externalId: extId,
      displayName: 'Lifecycle Test Credential',
      pieceName: '@activepieces/piece-http',
      type: 'SECRET_TEXT',
      value: {
        type: 'SECRET_TEXT',
        secret_text: 'sample-lifecycle-token',
      },
    });
    assert(createStatus === 200 || createStatus === 201, 'Creation must succeed');
    const connectionId = createData.id;

    // 3. Verify retrieved list includes newly vaulted credential
    const { status: listStatus, data: listData } = await listAppConnections(token, projectId);
    assertHttpStatus(listStatus, 200, 'List connections must succeed');
    const found = listData.data.find(c => c.id === connectionId);
    assert(found !== undefined, 'Created connection must appear in list');
    assertEqual(found.status, 'ACTIVE');

    // 4. Clean up
    await deleteAppConnection(token, connectionId);
  });

  await registry.runTest('C02: Web Internal API route contracts align with Activepieces client', async () => {
    const routePath = path.join(WEB_ROOT, 'app/api/services/route.ts');
    const clientPath = path.join(WEB_ROOT, 'lib/activepieces/client.ts');
    assert(fs.existsSync(routePath), 'web/app/api/services/route.ts must exist');
    assert(fs.existsSync(clientPath), 'web/lib/activepieces/client.ts must exist');

    const routeContent = fs.readFileSync(routePath, 'utf-8');
    const clientContent = fs.readFileSync(clientPath, 'utf-8');

    assertIncludes(routeContent, 'listAppConnections', 'route.ts must use listAppConnections');
    assertIncludes(clientContent, 'export async function listAppConnections', 'client.ts must export listAppConnections');
    assertIncludes(routeContent, 'createSupabaseConnection', 'route.ts must use createSupabaseConnection');
    assertIncludes(clientContent, 'export async function createSupabaseConnection', 'client.ts must export createSupabaseConnection');
  });

  await registry.runTest('C03: Service connection wizard interacts with /api/services', async () => {
    const connectPagePath = path.join(WEB_ROOT, 'app/protected/services/connect/page.tsx');
    assert(fs.existsSync(connectPagePath), 'web/app/protected/services/connect/page.tsx must exist');
    const content = fs.readFileSync(connectPagePath, 'utf-8');
    assertIncludes(content, '/api/services', 'Connect wizard must POST credentials to /api/services');
    assertIncludes(content, 'router.push("/protected/services")', 'Must redirect to services overview on success');
  });

  await registry.runTest('C04: Landing page CTA navigation preserves sign-up intent', async () => {
    const landingPath = path.join(WEB_ROOT, 'app/page.tsx');
    const content = fs.readFileSync(landingPath, 'utf-8');
    assertIncludes(content, 'href="/auth/sign-up"', 'Primary CTAs must guide new users to sign-up flow');
    assert(
      content.includes('href="/auth/login"') || content.includes('Sign in') || content.includes('AuthButton'),
      'Header must provide entry to existing user login'
    );
  });

  await registry.runTest('C05: Protected dashboard navigation links form a closed loop', async () => {
    const layoutPath = path.join(WEB_ROOT, 'app/protected/layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    const requiredRoutes = [
      '/protected',
      '/protected/recipes',
      '/protected/services',
      '/protected/settings',
    ];
    for (const r of requiredRoutes) {
      assertIncludes(content, `href="${r}"`, `Navbar must link to route ${r}`);
    }
  });

  await registry.runTest('C06: Engine connector catalog satisfies all 3 Launch Recipe requirements', async () => {
    const { data: auth } = await adminSignIn();
    const { status, data: pieces } = await fetchPieces(auth.token);
    assertHttpStatus(status, 200, 'Pieces endpoint must return HTTP 200');

    const pieceNames = pieces.map(p => p.name);
    // Recipe 1: Free Website Hosting -> needs HTTP / Webhook / Cloudflare piece
    assertIncludes(pieceNames, '@activepieces/piece-http', 'HTTP piece required for Cloudflare API interaction');
    // Recipe 2: Contact Form Backend -> needs Supabase & Resend pieces
    assertIncludes(pieceNames, '@activepieces/piece-supabase', 'Supabase piece required for backend storage');
    assertIncludes(pieceNames, '@activepieces/piece-resend', 'Resend piece required for email forwarding');
  });

  // =========================================================================
  // Phase 3 Milestone 3: Recipe 1 Free Website Hosting Combination Tests C07 - C08
  // =========================================================================
  const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
    alias: { '@': WEB_ROOT },
  });

  process.env.TEST_MODE = 'true';
  delete process.env.MOCK_CLOUDFLARE_TOKEN;

  const { recipeStore } = jiti('./lib/recipes/store.ts');
  const server = jiti('./lib/supabase/server.ts');
  const apClient = jiti('./lib/activepieces/client.ts');
  const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
  const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');
  const deactRoute = jiti('./app/api/recipes/hosting/[id]/deactivate/route.ts');
  const recipesRoute = jiti('./app/api/recipes/route.ts');

  await registry.runTest(
    'C07: Recipe lifecycle state transitions: Create (deploying -> active) -> Deactivate (inactive) -> Count updates -> Reactivation blocked when second recipe active -> Deactivate second -> Reactivate first',
    async () => {
      const userId = `usr_c07_lifecycle_${Date.now()}`;
      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;

      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        apClient.getCloudflareApiToken = async () => 'cf_hermetic_mock_token_c07';

        // 1. Deploy Recipe A
        const reqA = new Request('http://localhost:3000/api/recipes/hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'site-a',
            files: [{ path: 'index.html', content: '<h1>Site A</h1>' }],
          }),
        });
        const resA = await hostingRoute.POST(reqA);
        assertEqual(resA.status, 201, 'Recipe A deployment must return 201');
        const bodyA = await resA.json();
        const recipeA = bodyA.recipe;
        assertEqual(recipeA.status, 'active');
        assertEqual(await recipeStore.countActive(userId), 1, 'Active count must be 1 after Recipe A');

        // 2. Deploy Recipe B
        const reqB = new Request('http://localhost:3000/api/recipes/hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'site-b',
            files: [{ path: 'index.html', content: '<h1>Site B</h1>' }],
          }),
        });
        const resB = await hostingRoute.POST(reqB);
        assertEqual(resB.status, 201, 'Recipe B deployment must return 201');
        const bodyB = await resB.json();
        const recipeB = bodyB.recipe;
        assertEqual(recipeB.status, 'active');
        assertEqual(await recipeStore.countActive(userId), 2, 'Active count must be 2 after Recipe B');

        // 3. Deactivate Recipe A
        const reqDeactA = new Request(`http://localhost:3000/api/recipes/hosting/${recipeA.id}/deactivate`, {
          method: 'POST',
        });
        const resDeactA = await deactRoute.POST(reqDeactA, { params: { id: recipeA.id } });
        assertEqual(resDeactA.status, 200, 'Deactivating Recipe A must succeed');
        const bodyDeactA = await resDeactA.json();
        assertEqual(bodyDeactA.recipe.status, 'inactive');
        assertEqual(await recipeStore.countActive(userId), 1, 'Active count must decrement to 1');

        // 4. Deploy Recipe C
        const reqC = new Request('http://localhost:3000/api/recipes/hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: 'site-c',
            files: [{ path: 'index.html', content: '<h1>Site C</h1>' }],
          }),
        });
        const resC = await hostingRoute.POST(reqC);
        assertEqual(resC.status, 201, 'Recipe C deployment must return 201');
        const bodyC = await resC.json();
        const recipeC = bodyC.recipe;
        assertEqual(recipeC.status, 'active');
        assertEqual(await recipeStore.countActive(userId), 2, 'Active count must be back to 2 (B + C)');

        // 5. Attempt to Reactivate Recipe A (Blocked by quota)
        const reqReactivateA = new Request(`http://localhost:3000/api/recipes/hosting/${recipeA.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ path: 'index.html', content: '<h1>Reactivate Site A</h1>' }],
          }),
        });
        const resReactivateA = await updateRoute.POST(reqReactivateA, { params: { id: recipeA.id } });
        assertEqual(resReactivateA.status, 403, 'Reactivation must be blocked with HTTP 403');
        const bodyReactivateA = await resReactivateA.json();
        assertEqual(bodyReactivateA.code, 'PLAN_LIMIT_EXCEEDED');
        assertEqual(await recipeStore.countActive(userId), 2, 'Active count must remain 2');
        const checkA = await recipeStore.getRecipeById(userId, recipeA.id);
        assertEqual(checkA.status, 'inactive', 'Recipe A must remain inactive');

        // 6. Deactivate Recipe B
        const reqDeactB = new Request(`http://localhost:3000/api/recipes/hosting/${recipeB.id}/deactivate`, {
          method: 'POST',
        });
        const resDeactB = await deactRoute.POST(reqDeactB, { params: { id: recipeB.id } });
        assertEqual(resDeactB.status, 200);
        assertEqual(await recipeStore.countActive(userId), 1, 'Active count must decrement to 1 (only C active)');

        // 7. Reactivate Recipe A (Allowed now)
        const reqReactivateA2 = new Request(`http://localhost:3000/api/recipes/hosting/${recipeA.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ path: 'index.html', content: '<h1>Reactivated Site A</h1>' }],
          }),
        });
        const resReactivateA2 = await updateRoute.POST(reqReactivateA2, { params: { id: recipeA.id } });
        assertEqual(resReactivateA2.status, 200, 'Reactivating Recipe A must now succeed with HTTP 200');
        const bodyReactivateA2 = await resReactivateA2.json();
        assertEqual(bodyReactivateA2.recipe.status, 'active');
        assertEqual(await recipeStore.countActive(userId), 2, 'Active count must be back to 2 (A + C)');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  await registry.runTest(
    'C08: Multi-tenant recipe isolation: User A cannot list, update, or deactivate User B\'s recipes (GET /api/recipes only returns User A\'s; POST /api/recipes/hosting/[user_b_id]/update returns 404)',
    async () => {
      const userAlice = `usr_alice_c08_${Date.now()}`;
      const userBob = `usr_bob_c08_${Date.now()}`;

      // 1. Setup recipes in store
      const recAlice1 = await recipeStore.createRecipe({
        userId: userAlice,
        name: 'Alice 1',
        subdomain: 'alice-1',
        liveUrl: 'https://alice-1.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });
      const recAlice2 = await recipeStore.createRecipe({
        userId: userAlice,
        name: 'Alice 2',
        subdomain: 'alice-2',
        liveUrl: 'https://alice-2.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });
      const recBob1 = await recipeStore.createRecipe({
        userId: userBob,
        name: 'Bob 1',
        subdomain: 'bob-1',
        liveUrl: 'https://bob-1.pages.dev',
        status: 'active',
        services: ['cloudflare'],
      });

      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;

      try {
        apClient.getCloudflareApiToken = async () => 'cf_hermetic_token_c08';

        // 2. Listing Isolation for Alice
        server.getAuthenticatedUser = async () => ({
          id: userAlice,
          email: `${userAlice}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        const reqAliceList = new Request('http://localhost:3000/api/recipes');
        const resAliceList = await recipesRoute.GET(reqAliceList);
        assertEqual(resAliceList.status, 200);
        const dataAlice = await resAliceList.json();
        assertEqual(dataAlice.recipes.length, 2, 'Alice should see exactly 2 recipes');
        assertEqual(dataAlice.recipes.some(r => r.id === recBob1.id), false, 'Bob recipe must not leak to Alice');
        assertEqual(dataAlice.activeCount, 2);

        // 3. Listing Isolation for Bob
        server.getAuthenticatedUser = async () => ({
          id: userBob,
          email: `${userBob}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        const reqBobList = new Request('http://localhost:3000/api/recipes');
        const resBobList = await recipesRoute.GET(reqBobList);
        assertEqual(resBobList.status, 200);
        const dataBob = await resBobList.json();
        assertEqual(dataBob.recipes.length, 1, 'Bob should see exactly 1 recipe');
        assertEqual(dataBob.recipes[0].id, recBob1.id);
        assertEqual(dataBob.recipes.some(r => r.id === recAlice1.id), false, 'Alice recipe must not leak to Bob');
        assertEqual(dataBob.activeCount, 1);

        // 4. Cross-Tenant Update Rejection (Alice attempts to update Bob's recipe)
        server.getAuthenticatedUser = async () => ({
          id: userAlice,
          email: `${userAlice}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        const reqBadUpdate = new Request(`http://localhost:3000/api/recipes/hosting/${recBob1.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{ path: 'index.html', content: '<h1>Hacked by Alice</h1>' }],
          }),
        });
        const resBadUpdate = await updateRoute.POST(reqBadUpdate, { params: { id: recBob1.id } });
        assertEqual(resBadUpdate.status, 404, 'Attempt to update another user\'s recipe must return 404');
        const badUpdateBody = await resBadUpdate.json();
        assertEqual(badUpdateBody.error, 'Recipe not found');

        // Confirm Bob's recipe was unchanged
        const bobRecAfter = await recipeStore.getRecipeById(userBob, recBob1.id);
        assertEqual(bobRecAfter.status, 'active');

        // 5. Cross-Tenant Deactivation Rejection (Alice attempts to deactivate Bob's recipe)
        const reqBadDeact = new Request(`http://localhost:3000/api/recipes/hosting/${recBob1.id}/deactivate`, {
          method: 'POST',
        });
        const resBadDeact = await deactRoute.POST(reqBadDeact, { params: { id: recBob1.id } });
        assertEqual(resBadDeact.status, 404, 'Attempt to deactivate another user\'s recipe must return 404');
        const badDeactBody = await resBadDeact.json();
        assertEqual(badDeactBody.error, 'Recipe not found');

        // 6. Direct store scoping
        const directScoping = await recipeStore.getRecipeById(userAlice, recBob1.id);
        assertEqual(directScoping, null, 'Direct store getRecipeById across tenants must return null');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  // =========================================================================
  // Phase 4 Combinations: C09 - C10 (Cross-Recipe Multi-Tenant & Quota)
  // =========================================================================

  await registry.runTest(
    'C09: Multi-tenant isolation across Hosting and Uptime recipes',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const recipesRoute = jiti('./app/api/recipes/route.ts');
      const updateUptimeRoute = jiti('./app/api/recipes/uptime/[id]/update/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const { recipeStore } = jiti('./lib/recipes/store.ts');
      const origAuth = server.getAuthenticatedUser;

      const userAlice = `alice_c09_${Date.now()}`;
      const userBob = `bob_c09_${Date.now()}`;

      try {
        // Alice creates an uptime monitor
        const recAliceUptime = await recipeStore.createRecipe({
          userId: userAlice,
          type: 'uptime',
          name: 'Alice Uptime',
          status: 'active',
          subdomain: 'alice-uptime',
          metadata: { monitorsCount: 1, targets: [{ url: 'https://alice.com', name: 'Alice' }] },
        });

        // Bob creates a hosting website
        const recBobHosting = await recipeStore.createRecipe({
          userId: userBob,
          type: 'hosting',
          name: 'Bob Website',
          status: 'active',
          subdomain: 'bob-site',
        });

        // Bob queries his recipes list
        server.getAuthenticatedUser = async () => ({
          id: userBob,
          email: `${userBob}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        const reqBob = new Request('http://localhost:3000/api/recipes');
        const resBob = await recipesRoute.GET(reqBob);
        assertEqual(resBob.status, 200);
        const dataBob = await resBob.json();
        assertEqual(dataBob.recipes.length, 1);
        assertEqual(dataBob.recipes[0].id, recBobHosting.id);
        assertEqual(dataBob.recipes.some(r => r.id === recAliceUptime.id), false);

        // Bob attempts to modify Alice's uptime monitor
        const reqAttack = new Request(`http://localhost:3000/api/recipes/uptime/${recAliceUptime.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targets: [{ url: 'https://evil.com', name: 'Hacked' }],
          }),
        });
        const resAttack = await updateUptimeRoute.POST(reqAttack, { params: { id: recAliceUptime.id } });
        assertEqual(resAttack.status, 404, 'Bob cannot access or modify Alice uptime monitor');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );

  await registry.runTest(
    'C10: Global Plan Quota sharing between Hosting and Uptime recipes',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
      const uptimeRoute = jiti('./app/api/recipes/uptime/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const apClient = jiti('./lib/activepieces/client.ts');
      const { recipeStore } = jiti('./lib/recipes/store.ts');

      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;

      const userId = `quota_c10_${Date.now()}`;

      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        apClient.getCloudflareApiToken = async () => 'mock_cf_token_c10';

        // 1. Create hosting recipe (Quota: 1/2)
        const res1 = await hostingRoute.POST(
          new Request('http://localhost:3000/api/recipes/hosting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subdomain: 'c10-site-1',
              files: [{ path: 'index.html', content: '<h1>Hi</h1>' }],
            }),
          })
        );
        assertEqual(res1.status, 201);

        // 2. Create uptime recipe (Quota: 2/2)
        const res2 = await uptimeRoute.POST(
          new Request('http://localhost:3000/api/recipes/uptime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subdomain: 'c10-uptime-1',
              targets: [{ url: 'https://example.com', name: 'Example' }],
              notification: { type: 'email', target: 'alerts@example.com' },
            }),
          })
        );
        assertEqual(res2.status, 201);

        // 3. Attempt to create another hosting recipe (Quota exceeded: 3/2 -> 403)
        const res3 = await hostingRoute.POST(
          new Request('http://localhost:3000/api/recipes/hosting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subdomain: 'c10-site-2',
              files: [{ path: 'index.html', content: '<h1>Hi</h1>' }],
            }),
          })
        );
        assertEqual(res3.status, 403);
        const data3 = await res3.json();
        assertEqual(data3.code, 'PLAN_LIMIT_EXCEEDED');

        // 4. Attempt to create another uptime recipe (Quota exceeded: 3/2 -> 403)
        const res4 = await uptimeRoute.POST(
          new Request('http://localhost:3000/api/recipes/uptime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subdomain: 'c10-uptime-2',
              targets: [{ url: 'https://example.com', name: 'Example' }],
              notification: { type: 'email', target: 'alerts@example.com' },
            }),
          })
        );
        assertEqual(res4.status, 403);
        const data4 = await res4.json();
        assertEqual(data4.code, 'PLAN_LIMIT_EXCEEDED');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  // C11: Billing Upgrade Flow: Checkout session creation -> Webhook subscription activation -> Unlocks 3+ recipes
  await registry.runTest('C11: Upgrade Lifecycle: Checkout creation -> Webhook activation -> Pro unlocks 3+ recipes',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
      const webhookRoute = jiti('./app/api/billing/webhook/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const apClient = jiti('./lib/activepieces/client.ts');
      const { updateBillingAccount } = jiti('./lib/stripe/client.ts');
      const origAuth = server.getAuthenticatedUser;
      const origToken = apClient.getCloudflareApiToken;

      const userId = `usr_c11_upgrade_${Date.now()}`;

      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'free' },
        });
        apClient.getCloudflareApiToken = async () => 'mock_cf_token_c11';

        // 1. Initially Free tier: create 2 recipes
        const r1 = await hostingRoute.POST(
          new Request('http://localhost:3000/api/recipes/hosting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain: 'c11-site-1', files: [{ path: 'index.html', content: '<h1>1</h1>' }] }),
          })
        );
        assertEqual(r1.status, 201);

        const r2 = await hostingRoute.POST(
          new Request('http://localhost:3000/api/recipes/hosting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain: 'c11-site-2', files: [{ path: 'index.html', content: '<h1>2</h1>' }] }),
          })
        );
        assertEqual(r2.status, 201);

        // 2. 3rd recipe blocked on Free tier
        const r3Blocked = await hostingRoute.POST(
          new Request('http://localhost:3000/api/recipes/hosting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain: 'c11-site-3', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
          })
        );
        assertEqual(r3Blocked.status, 403);

        // 3. User upgrades: Webhook fires checkout.session.completed
        const webhookReq = new Request('http://localhost:3000/api/billing/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `evt_c11_${Date.now()}`,
            type: 'checkout.session.completed',
            data: {
              object: {
                metadata: { userId },
                customer: 'cus_mock_123',
                subscription: 'sub_mock_123',
              },
            },
          }),
        });
        const webhookRes = await webhookRoute.POST(webhookReq);
        assertEqual(webhookRes.status, 200);

        // 4. 3rd recipe now succeeds immediately under Pro plan!
        const r3Success = await hostingRoute.POST(
          new Request('http://localhost:3000/api/recipes/hosting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain: 'c11-site-3', files: [{ path: 'index.html', content: '<h1>3</h1>' }] }),
          })
        );
        assertEqual(r3Success.status, 201, 'Pro upgrade must immediately unlock creation of 3rd recipe');
      } finally {
        server.getAuthenticatedUser = origAuth;
        apClient.getCloudflareApiToken = origToken;
      }
    }
  );

  // C12: Customer Portal & In-Place Subscription Management
  await registry.runTest('C12: Portal session connects user to subscription management endpoint',
    async () => {
      const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
        alias: { '@': WEB_ROOT },
      });
      const portalRoute = jiti('./app/api/billing/portal/route.ts');
      const server = jiti('./lib/supabase/server.ts');
      const origAuth = server.getAuthenticatedUser;

      const userId = `usr_c12_portal_${Date.now()}`;

      try {
        server.getAuthenticatedUser = async () => ({
          id: userId,
          email: `${userId}@ingr.local`,
          app_metadata: { plan: 'pro' },
        });

        const req = new Request('http://localhost:3000/api/billing/portal', {
          method: 'POST',
        });
        const res = await portalRoute.POST(req);
        assertEqual(res.status, 200);
        const data = await res.json();
        assert(data.url && data.url.length > 0, 'Portal session must return destination URL');
      } finally {
        server.getAuthenticatedUser = origAuth;
      }
    }
  );
}

if (process.argv[1]?.endsWith('test_combinations.mjs')) {
  runTier3Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
