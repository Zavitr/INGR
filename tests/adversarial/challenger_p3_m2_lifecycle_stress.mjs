#!/usr/bin/env node
/**
 * Empirical Adversarial Challenger Suite: Phase 3 Milestone 2
 * Focus: Dashboard Lifecycle Actions, Route Rendering, and Quota Enforcement
 *
 * Target Scope:
 * 1. Route rendering:
 *    - /protected/recipes/new?type=hosting
 *    - /protected/recipes/hosting/new
 *    - /protected/recipes
 * 2. Recipe listing, active count computation, Pro tier support without 2-website clamp
 * 3. Deactivate/update lifecycle triggers, IDOR isolation, concurrency
 * 4. "No Jargon, Ever" UI copy audit
 */

import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WEB_DIR = path.resolve(REPO_ROOT, 'web');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3333';

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

// Import sucrase and jiti for loading TypeScript and TSX modules
const sucrase = (await import(path.join(WEB_DIR, 'node_modules/sucrase/dist/index.js'))).default;
const createJiti = (await import(path.join(WEB_DIR, 'node_modules/jiti/lib/index.js'))).default;

const jiti = createJiti(path.join(WEB_DIR, 'test_runner.js'), {
  alias: { '@': WEB_DIR },
});

// Provide global React for classic JSX runtime
globalThis.React = jiti('react');

// Custom TSX and TS compiler hook using sucrase
const tsxHandler = (module, filename) => {
  let code = fs.readFileSync(filename, 'utf-8');
  code = code.replace(/@\//g, WEB_DIR + '/');
  const transformed = sucrase.transform(code, {
    transforms: ['typescript', 'jsx', 'imports'],
    jsxRuntime: 'classic',
  });
  return module._compile(transformed.code, filename);
};

jiti.extensions['.tsx'] = tsxHandler;
jiti.extensions['.ts'] = tsxHandler;

// Import application modules
const {
  getUserPlan,
  validateSubdomain,
  validateFileBundle,
} = jiti('./lib/recipes/types.ts');

const { RecipeStore } = jiti('./lib/recipes/store.ts');
const server = jiti('./lib/supabase/server.ts');
const apClient = jiti('./lib/activepieces/client.ts');

// API routes
const listRecipesRoute = jiti('./app/api/recipes/route.ts');
const hostingRoute = jiti('./app/api/recipes/hosting/route.ts');
const updateRoute = jiti('./app/api/recipes/hosting/[id]/update/route.ts');
const deactivateRoute = jiti('./app/api/recipes/hosting/[id]/deactivate/route.ts');

// Components and pages
const wizardModule = jiti('./components/recipes/hosting-wizard.tsx');
const recipeListModule = jiti('./components/recipes/recipe-list.tsx');
const newHostingPage = jiti('./app/protected/recipes/hosting/new/page.tsx').default;
const newRecipePage = jiti('./app/protected/recipes/new/page.tsx').default;
const recipesPage = jiti('./app/protected/recipes/page.tsx').default;

// Test framework accounting
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
// SUITE 1: Route Rendering Verification (Server Component & HTTP Probing)
// =========================================================================
async function suiteRouteRendering() {
  console.log('\n\x1b[1m\x1b[36m► Suite 1: Route Rendering & Navigation Verification\x1b[0m');

  const testUser = {
    id: `usr_render_${Date.now()}`,
    email: 'render_test@ingr.local',
    app_metadata: {},
    user_metadata: {},
  };

  // Mock authenticated user
  server.createClient = async () => ({
    auth: {
      getUser: async () => ({
        data: { user: testUser },
        error: null,
      }),
    },
  });

  // 1. Direct invocation of NewHostingRecipePage
  const hostingPageResult = await newHostingPage();
  check(
    'ROUTE-RENDER-01',
    'NewHostingRecipePage renders HostingWizard component directly',
    hostingPageResult?.type === wizardModule.HostingWizard,
    `Returned component: ${hostingPageResult?.type?.name || typeof hostingPageResult}`
  );

  // 2. NewRecipePage with type=hosting
  const newWithHostingParam = await newRecipePage({
    searchParams: Promise.resolve({ type: 'hosting' }),
  });
  check(
    'ROUTE-RENDER-02',
    'NewRecipePage(type=hosting) conditionally renders HostingWizard component',
    newWithHostingParam?.type === wizardModule.HostingWizard,
    `Returned component: ${newWithHostingParam?.type?.name || typeof newWithHostingParam}`
  );

  // 3. NewRecipePage without type (library catalog)
  const newWithoutParam = await newRecipePage({
    searchParams: Promise.resolve({}),
  });
  check(
    'ROUTE-RENDER-03',
    'NewRecipePage(no type) renders template catalog grid (div container)',
    newWithoutParam?.type === 'div',
    `Returned element: ${newWithoutParam?.type}`
  );

  // 4. NewRecipePage with type=uptime
  const newWithUptime = await newRecipePage({
    searchParams: Promise.resolve({ type: 'uptime' }),
  });
  check(
    'ROUTE-RENDER-04',
    'NewRecipePage(type=uptime) renders template catalog grid without redirecting to HostingWizard',
    newWithUptime?.type === 'div' && newWithUptime?.type !== wizardModule.HostingWizard,
    `Returned element: ${newWithUptime?.type}`
  );

  // 5. RecipesPage with 0 recipes
  const store = new RecipeStore();
  const recipesPageEmpty = await recipesPage();
  check(
    'ROUTE-RENDER-05',
    'RecipesPage with 0 recipes renders empty state container',
    recipesPageEmpty?.type === 'div',
    `Returned element: ${recipesPageEmpty?.type}`
  );

  // 6. RecipesPage with recipes
  await store.createRecipe({
    userId: testUser.id,
    name: 'Existing Website',
    subdomain: 'existing-site',
    status: 'active',
  });
  const recipesPageWithContent = await recipesPage();
  // Children[1] contains either RecipeList or empty state card
  const renderedChild = recipesPageWithContent?.props?.children?.find(
    (c) => c && c.type === recipeListModule.RecipeList
  );
  check(
    'ROUTE-RENDER-06',
    'RecipesPage with active recipe renders RecipeList component with props',
    !!renderedChild,
    `Could not locate RecipeList child in tree`
  );

  // 7. Unauthenticated redirects
  server.createClient = async () => ({
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new Error('Session expired'),
      }),
    },
  });

  let redirectCaught1 = false;
  let redirectTarget1 = '';
  try {
    await newHostingPage();
  } catch (err) {
    if (err.message === 'NEXT_REDIRECT') {
      redirectCaught1 = true;
      redirectTarget1 = err.digest || '';
    }
  }
  check(
    'ROUTE-AUTH-01',
    'NewHostingRecipePage redirects unauthenticated users to /auth/login',
    redirectCaught1 && redirectTarget1.includes('/auth/login'),
    `Redirected: ${redirectCaught1}, target digest: ${redirectTarget1}`
  );

  let redirectCaught2 = false;
  let redirectTarget2 = '';
  try {
    await newRecipePage({ searchParams: Promise.resolve({ type: 'hosting' }) });
  } catch (err) {
    if (err.message === 'NEXT_REDIRECT') {
      redirectCaught2 = true;
      redirectTarget2 = err.digest || '';
    }
  }
  check(
    'ROUTE-AUTH-02',
    'NewRecipePage redirects unauthenticated users to /auth/login',
    redirectCaught2 && redirectTarget2.includes('/auth/login'),
    `Redirected: ${redirectCaught2}, target digest: ${redirectTarget2}`
  );

  let redirectCaught3 = false;
  let redirectTarget3 = '';
  try {
    await recipesPage();
  } catch (err) {
    if (err.message === 'NEXT_REDIRECT') {
      redirectCaught3 = true;
      redirectTarget3 = err.digest || '';
    }
  }
  check(
    'ROUTE-AUTH-03',
    'RecipesPage redirects unauthenticated users to /auth/login',
    redirectCaught3 && redirectTarget3.includes('/auth/login'),
    `Redirected: ${redirectCaught3}, target digest: ${redirectTarget3}`
  );

  // 8. Live HTTP Probes against running Next.js instance on port 3333
  try {
    const res1 = await fetch(`${BASE_URL}/protected/recipes/new?type=hosting`, {
      redirect: 'manual',
    });
    check(
      'ROUTE-HTTP-01',
      'Live HTTP probe: GET /protected/recipes/new?type=hosting returns 307 to login',
      res1.status === 307 && res1.headers.get('location')?.includes('/auth/login'),
      `Status: ${res1.status}, location: ${res1.headers.get('location')}`
    );

    const res2 = await fetch(`${BASE_URL}/protected/recipes/hosting/new`, {
      redirect: 'manual',
    });
    check(
      'ROUTE-HTTP-02',
      'Live HTTP probe: GET /protected/recipes/hosting/new returns 307 to login',
      res2.status === 307 && res2.headers.get('location')?.includes('/auth/login'),
      `Status: ${res2.status}, location: ${res2.headers.get('location')}`
    );

    const res3 = await fetch(`${BASE_URL}/protected/recipes`, {
      redirect: 'manual',
    });
    check(
      'ROUTE-HTTP-03',
      'Live HTTP probe: GET /protected/recipes returns 307 to login',
      res3.status === 307 && res3.headers.get('location')?.includes('/auth/login'),
      `Status: ${res3.status}, location: ${res3.headers.get('location')}`
    );
  } catch (err) {
    check(
      'ROUTE-HTTP-FAIL',
      'Live HTTP probes on port 3333',
      false,
      `Network error: ${err.message}`
    );
  }
}

// =========================================================================
// SUITE 2: Recipe Listing & Active Count Computation Matrix
// =========================================================================
async function suiteListingAndCounts() {
  console.log('\n\x1b[1m\x1b[36m► Suite 2: Recipe Listing & Active Count Computation\x1b[0m');

  const store = new RecipeStore();
  const testUser = `usr_count_${Date.now()}`;

  // Initial count
  const count0 = await store.countActive(testUser);
  check('COUNT-01', 'Initial active count is strictly 0', count0 === 0, `Got: ${count0}`);

  // Create active recipe
  const rec1 = await store.createRecipe({
    userId: testUser,
    name: 'Active Site 1',
    subdomain: 'active-site-1',
    status: 'active',
  });
  const count1 = await store.countActive(testUser);
  check('COUNT-02', 'Active recipe increments count to 1', count1 === 1, `Got: ${count1}`);

  // Create deploying recipe
  const rec2 = await store.createRecipe({
    userId: testUser,
    name: 'Deploying Site 2',
    subdomain: 'deploying-site-2',
    status: 'deploying',
  });
  const count2 = await store.countActive(testUser);
  check('COUNT-03', 'Deploying recipe increments count to 2', count2 === 2, `Got: ${count2}`);

  // Create inactive recipe
  const rec3 = await store.createRecipe({
    userId: testUser,
    name: 'Inactive Site 3',
    subdomain: 'inactive-site-3',
    status: 'inactive',
  });
  const count3 = await store.countActive(testUser);
  check('COUNT-04', 'Inactive recipe does NOT increment active count', count3 === 2, `Got: ${count3}`);

  // Create error recipe
  const rec4 = await store.createRecipe({
    userId: testUser,
    name: 'Error Site 4',
    subdomain: 'error-site-4',
    status: 'error',
  });
  const count4 = await store.countActive(testUser);
  check('COUNT-05', 'Error status recipe does NOT increment active count', count4 === 2, `Got: ${count4}`);

  // Listing returns all 4 recipes
  const list = await store.listRecipes(testUser);
  check('LIST-TOTAL-01', 'listRecipes returns all 4 recipes regardless of status', list.length === 4, `Got: ${list.length}`);

  // Verify list order: descending by creation date
  const timestamps = list.map((r) => new Date(r.createdAt).getTime());
  const isSorted = timestamps.every((t, i) => i === 0 || t <= timestamps[i - 1]);
  check('LIST-SORT-01', 'listRecipes returns items in descending chronological order', isSorted);

  // Multi-tenant isolation test
  const userOther = `usr_other_${Date.now()}`;
  await store.createRecipe({
    userId: userOther,
    name: 'Other User Site',
    subdomain: 'other-site',
    status: 'active',
  });
  const listOther = await store.listRecipes(userOther);
  const countOther = await store.countActive(userOther);
  check(
    'LIST-ISOLATION-01',
    'User Other list contains only their 1 recipe',
    listOther.length === 1 && listOther[0].userId === userOther
  );
  check(
    'COUNT-ISOLATION-01',
    'User Other active count is strictly 1 and does not bleed into testUser',
    countOther === 1
  );

  // API Endpoint GET /api/recipes
  server.getAuthenticatedUser = async () => ({
    id: testUser,
    email: 'test@ingr.local',
    app_metadata: {},
    user_metadata: {},
  });

  const apiReq = new Request('http://localhost:3333/api/recipes');
  const apiRes = await listRecipesRoute.GET(apiReq);
  const apiData = await apiRes.json();

  check('API-LIST-STATUS-01', 'GET /api/recipes returns HTTP 200', apiRes.status === 200);
  check('API-LIST-COUNT-01', 'GET /api/recipes reports activeCount = 2', apiData.activeCount === 2);
  check('API-LIST-PLAN-01', 'GET /api/recipes reports tier = free with maxActiveRecipes = 2', apiData.plan?.tier === 'free' && apiData.plan?.maxActiveRecipes === 2);
  check('API-LIST-CAN-ACTIVATE', 'GET /api/recipes reports canActivateMore = false (at quota 2/2)', apiData.plan?.canActivateMore === false);

  // API Endpoint Unauthenticated
  server.getAuthenticatedUser = async () => null;
  const unauthRes = await listRecipesRoute.GET(apiReq);
  check('API-LIST-UNAUTH-01', 'GET /api/recipes returns HTTP 401 when unauthenticated', unauthRes.status === 401);
}

// =========================================================================
// SUITE 3: Pro Tier Support without 2-Website Clamp & Free Tier Limits
// =========================================================================
async function suiteProTierAndLimits() {
  console.log('\n\x1b[1m\x1b[36m► Suite 3: Pro Tier Unlimited Support & Quota Enforcement\x1b[0m');

  const proUser = {
    id: `usr_pro_${Date.now()}`,
    email: 'pro@ingr.local',
    app_metadata: { plan: 'pro' },
    user_metadata: {},
  };

  const freeUser = {
    id: `usr_free_${Date.now()}`,
    email: 'free@ingr.local',
    app_metadata: {},
    user_metadata: {},
  };

  // 1. getUserPlan contract
  const freePlan = getUserPlan(freeUser, 1);
  check('PLAN-FREE-01', 'Free user plan has maxActiveRecipes = 2 and tier = free', freePlan.tier === 'free' && freePlan.maxActiveRecipes === 2 && freePlan.canActivateMore === true);

  const freePlanMaxed = getUserPlan(freeUser, 2);
  check('PLAN-FREE-02', 'Free user plan at count 2 has canActivateMore = false', freePlanMaxed.canActivateMore === false);

  const proPlan = getUserPlan(proUser, 5);
  check('PLAN-PRO-01', 'Pro user plan has maxActiveRecipes = Infinity and tier = pro', proPlan.tier === 'pro' && proPlan.maxActiveRecipes === Infinity && proPlan.canActivateMore === true);

  // 2. Pro user creates 5 active websites via POST /api/recipes/hosting
  server.getAuthenticatedUser = async () => proUser;
  apClient.getCloudflareApiToken = async () => 'cf_mock_token_pro';

  const validHtmlFiles = [
    { path: 'index.html', content: '<h1>Pro INGR Website</h1>' },
    { path: 'styles.css', content: 'body { margin: 0; }' },
  ];

  let proCreateSuccessCount = 0;
  const createdProIds = [];

  for (let i = 1; i <= 5; i++) {
    const createReq = new Request('http://localhost:3333/api/recipes/hosting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: `pro-site-${i}-${Date.now().toString().slice(-4)}`,
        name: `Pro Site ${i}`,
        files: validHtmlFiles,
      }),
    });

    const createRes = await hostingRoute.POST(createReq);
    if (createRes.status === 201) {
      proCreateSuccessCount++;
      const data = await createRes.json();
      createdProIds.push(data.recipe.id);
    }
  }

  check(
    'PRO-UNLIMITED-CREATE-01',
    'Pro user can create 5 active websites without hitting 2-website clamp (5/5 HTTP 201)',
    proCreateSuccessCount === 5,
    `Created successfully: ${proCreateSuccessCount}/5`
  );

  const store = new RecipeStore();
  const proActiveCount = await store.countActive(proUser.id);
  check(
    'PRO-ACTIVE-COUNT-01',
    'Pro user activeCount correctly computes 5 active websites',
    proActiveCount === 5,
    `Got: ${proActiveCount}`
  );

  // 3. Pro user deactivates 1 website
  const deactTargetId = createdProIds[0];
  const deactReq = new Request(`http://localhost:3333/api/recipes/hosting/${deactTargetId}/deactivate`, {
    method: 'POST',
  });
  const deactRes = await deactivateRoute.POST(deactReq, { params: Promise.resolve({ id: deactTargetId }) });
  check('PRO-DEACT-01', 'Pro user deactivates a website (HTTP 200)', deactRes.status === 200);

  const proCountAfterDeact = await store.countActive(proUser.id);
  check('PRO-COUNT-AFTER-DEACT', 'Pro active count drops to 4', proCountAfterDeact === 4, `Got: ${proCountAfterDeact}`);

  // 4. CRITICAL CHECK: Pro user reactivates the website via update while already having 4 active websites
  // In buggy code with hardcoded activeCount >= 2, this would clamp status back to 'inactive'.
  const updateReq = new Request(`http://localhost:3333/api/recipes/hosting/${deactTargetId}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: [
        { path: 'index.html', content: '<h1>Reactivated Pro Website</h1>' },
      ],
    }),
  });

  const updateRes = await updateRoute.POST(updateReq, { params: Promise.resolve({ id: deactTargetId }) });
  const updateData = await updateRes.json();

  check('PRO-REACTIVATE-HTTP-200', 'Pro user update/reactivation returns HTTP 200', updateRes.status === 200);
  check(
    'PRO-REACTIVATE-UNCLAMPED',
    'Pro user reactivated website status is "active" (NOT clamped to inactive by 2-website limit)',
    updateData.recipe?.status === 'active',
    `Result status: ${updateData.recipe?.status}`
  );

  const proCountAfterReactivation = await store.countActive(proUser.id);
  check(
    'PRO-COUNT-AFTER-REACTIVATION',
    'Pro active count correctly restores to 5 active websites',
    proCountAfterReactivation === 5,
    `Got: ${proCountAfterReactivation}`
  );

  // 5. Free User Quota Clamping Enforcement
  server.getAuthenticatedUser = async () => freeUser;

  // Free User Site 1
  const freeReq1 = new Request('http://localhost:3333/api/recipes/hosting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subdomain: `free-site-1-${Date.now().toString().slice(-4)}`,
      name: 'Free Site 1',
      files: validHtmlFiles,
    }),
  });
  const freeRes1 = await hostingRoute.POST(freeReq1);
  check('FREE-CREATE-01', 'Free user creates 1st site (HTTP 201)', freeRes1.status === 201);

  // Free User Site 2
  const freeReq2 = new Request('http://localhost:3333/api/recipes/hosting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subdomain: `free-site-2-${Date.now().toString().slice(-4)}`,
      name: 'Free Site 2',
      files: validHtmlFiles,
    }),
  });
  const freeRes2 = await hostingRoute.POST(freeReq2);
  check('FREE-CREATE-02', 'Free user creates 2nd site (HTTP 201)', freeRes2.status === 201);

  // Free User Site 3 (Breach of quota)
  const freeReq3 = new Request('http://localhost:3333/api/recipes/hosting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subdomain: `free-site-3-${Date.now().toString().slice(-4)}`,
      name: 'Free Site 3',
      files: validHtmlFiles,
    }),
  });
  const freeRes3 = await hostingRoute.POST(freeReq3);
  const freeData3 = await freeRes3.json();
  check(
    'FREE-QUOTA-BLOCK-01',
    'Free user attempting 3rd website receives HTTP 403 Forbidden',
    freeRes3.status === 403 && freeData3.code === 'PLAN_LIMIT_EXCEEDED',
    `Status: ${freeRes3.status}, code: ${freeData3.code}`
  );

  // 6. Free user updating an ALREADY ACTIVE website (must NOT be blocked by quota)
  const freeData1 = await freeRes1.json();
  const freeActiveId = freeData1.recipe.id;

  const freeActiveUpdateReq = new Request(`http://localhost:3333/api/recipes/hosting/${freeActiveId}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: [
        { path: 'index.html', content: '<h1>Updated Live Free Website</h1>' },
      ],
    }),
  });

  const freeActiveUpdateRes = await updateRoute.POST(freeActiveUpdateReq, { params: Promise.resolve({ id: freeActiveId }) });
  check(
    'FREE-ACTIVE-UPDATE-01',
    'Free user updating an ALREADY ACTIVE website succeeds with HTTP 200 while activeCount == 2',
    freeActiveUpdateRes.status === 200,
    `Status: ${freeActiveUpdateRes.status}`
  );
}

// =========================================================================
// SUITE 4: Lifecycle Triggers: Deactivate and Update Mechanics
// =========================================================================
async function suiteLifecycleMechanics() {
  console.log('\n\x1b[1m\x1b[36m► Suite 4: Lifecycle Triggers, IDOR & Concurrency\x1b[0m');

  const store = new RecipeStore();
  const userA = {
    id: `usr_lifeA_${Date.now()}`,
    email: 'userA@ingr.local',
    app_metadata: {},
    user_metadata: {},
  };
  const userB = {
    id: `usr_lifeB_${Date.now()}`,
    email: 'userB@ingr.local',
    app_metadata: {},
    user_metadata: {},
  };

  // Create active recipe for user A
  const recA = await store.createRecipe({
    userId: userA.id,
    name: 'User A Site',
    subdomain: 'usera-site',
    status: 'active',
  });

  // IDOR Attack: User B tries to deactivate User A's recipe
  server.getAuthenticatedUser = async () => userB;
  const idorDeactReq = new Request(`http://localhost:3333/api/recipes/hosting/${recA.id}/deactivate`, {
    method: 'POST',
  });
  const idorDeactRes = await deactivateRoute.POST(idorDeactReq, { params: Promise.resolve({ id: recA.id }) });
  check(
    'LIFECYCLE-IDOR-DEACT-01',
    'User B attempting to deactivate User A recipe receives HTTP 404',
    idorDeactRes.status === 404,
    `Status: ${idorDeactRes.status}`
  );

  // IDOR Attack: User B tries to update User A's recipe
  const idorUpdateReq = new Request(`http://localhost:3333/api/recipes/hosting/${recA.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: [{ path: 'index.html', content: '<h1>Hacked</h1>' }],
    }),
  });
  const idorUpdateRes = await updateRoute.POST(idorUpdateReq, { params: Promise.resolve({ id: recA.id }) });
  check(
    'LIFECYCLE-IDOR-UPDATE-01',
    'User B attempting to update User A recipe receives HTTP 404',
    idorUpdateRes.status === 404,
    `Status: ${idorUpdateRes.status}`
  );

  // Legitimate deactivation by User A
  server.getAuthenticatedUser = async () => userA;
  const legitDeactReq = new Request(`http://localhost:3333/api/recipes/hosting/${recA.id}/deactivate`, {
    method: 'POST',
  });
  const legitDeactRes = await deactivateRoute.POST(legitDeactReq, { params: Promise.resolve({ id: recA.id }) });
  const legitDeactData = await legitDeactRes.json();

  check('LIFECYCLE-DEACT-STATUS', 'User A deactivates their own recipe (HTTP 200)', legitDeactRes.status === 200);
  check('LIFECYCLE-DEACT-RECIPE-STATUS', 'Returned recipe status is "inactive"', legitDeactData.recipe?.status === 'inactive');

  const countAfter = await store.countActive(userA.id);
  check('LIFECYCLE-DEACT-COUNT', 'Active count drops to 0 after deactivation', countAfter === 0, `Got: ${countAfter}`);

  // Idempotent deactivation call
  const deactAgainRes = await deactivateRoute.POST(legitDeactReq, { params: Promise.resolve({ id: recA.id }) });
  check('LIFECYCLE-DEACT-IDEMPOTENT', 'Repeated deactivation returns HTTP 200 and remains inactive', deactAgainRes.status === 200);

  // Update with missing index.html fails and leaves state unchanged
  apClient.getCloudflareApiToken = async () => 'cf_mock_token_a';
  const badUpdateReq = new Request(`http://localhost:3333/api/recipes/hosting/${recA.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: [{ path: 'about.html', content: '<h1>No root index</h1>' }],
    }),
  });
  const badUpdateRes = await updateRoute.POST(badUpdateReq, { params: Promise.resolve({ id: recA.id }) });
  check(
    'LIFECYCLE-UPDATE-BAD-FILES',
    'Update without root index.html returns HTTP 400',
    badUpdateRes.status === 400
  );

  const recStateAfterBad = await store.getRecipeById(userA.id, recA.id);
  check(
    'LIFECYCLE-UPDATE-UNCHANGED',
    'Recipe status remains "inactive" after failed update validation',
    recStateAfterBad?.status === 'inactive'
  );

  // Concurrency stress: 10 parallel deactivate calls
  const concurrentCalls = Array.from({ length: 10 }, () =>
    deactivateRoute.POST(legitDeactReq, { params: Promise.resolve({ id: recA.id }) })
  );
  const concurrentResults = await Promise.all(concurrentCalls);
  const all200 = concurrentResults.every((r) => r.status === 200);
  check('LIFECYCLE-CONCURRENCY-10', '10 concurrent deactivation calls complete with 100% HTTP 200 and zero crash', all200);
}

// =========================================================================
// SUITE 5: UI Contracts & "No Jargon, Ever" Copy Audit
// =========================================================================
async function suiteUiAndJargon() {
  console.log('\n\x1b[1m\x1b[36m► Suite 5: UI Contracts & Plain-English Jargon Audit\x1b[0m');

  const bannedTerms = [
    'DNS',
    'CNAME',
    'TLS',
    'SSL',
    'manifest',
    'endpoint',
    'REST',
    '403',
    'webhook',
    'container',
    'instance',
  ];

  // Recipe 1 target files built in M2
  const recipe1Files = [
    path.join(WEB_DIR, 'components/recipes/hosting-wizard.tsx'),
    path.join(WEB_DIR, 'components/recipes/recipe-list.tsx'),
    path.join(WEB_DIR, 'app/protected/recipes/page.tsx'),
    path.join(WEB_DIR, 'app/protected/recipes/hosting/new/page.tsx'),
  ];

  for (const filePath of recipe1Files) {
    const relativePath = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const term of bannedTerms) {
      const regex = new RegExp(`>([^<]*?\\b${term}\\b[^<]*?)<|"([^"]*?\\b${term}\\b[^"]*?)"`, 'gi');
      let match;
      let violationFound = false;

      while ((match = regex.exec(content)) !== null) {
        const snippet = match[0];
        if (
          !snippet.includes('/api/') &&
          !snippet.includes('import ') &&
          !snippet.includes('//')
        ) {
          violationFound = true;
          break;
        }
      }

      check(
        `JARGON-${path.basename(filePath)}-${term}`,
        `No banned term "${term}" in ${relativePath}`,
        !violationFound,
        `Found user-facing violation: ${term}`
      );
    }
  }

  // Check hosting template entry on /protected/recipes/new
  const newPagePath = path.join(WEB_DIR, 'app/protected/recipes/new/page.tsx');
  const newPageContent = fs.readFileSync(newPagePath, 'utf-8');
  // Verify hosting template copy is jargon-free
  const hostingTemplateSnippet = newPageContent.slice(
    newPageContent.indexOf('id: "hosting"'),
    newPageContent.indexOf('id: "uptime"')
  );
  for (const term of bannedTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    check(
      `JARGON-hosting-template-${term}`,
      `Hosting template on /protected/recipes/new contains no "${term}"`,
      !regex.test(hostingTemplateSnippet),
      `Found jargon in hosting template: ${term}`
    );
  }
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
async function main() {
  console.log('========================================================================');
  console.log('  CHALLENGER P3-M2 EMPIRICAL STRESS TEST HARNESS');
  console.log('  Dashboard Lifecycle Actions, Route Rendering, and Quota Clamping');
  console.log('========================================================================');

  const startTime = Date.now();

  try {
    await suiteRouteRendering();
    await suiteListingAndCounts();
    await suiteProTierAndLimits();
    await suiteLifecycleMechanics();
    await suiteUiAndJargon();
  } catch (fatal) {
    console.error('\n\x1b[31mFATAL TEST RUNNER ERROR:\x1b[0m', fatal);
    process.exit(1);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n========================================================================');
  console.log('                    CHALLENGER STRESS RESULTS SUMMARY                   ');
  console.log('========================================================================');
  console.log(`Total Tests Run:  ${totalTests}`);
  console.log(`Passed:           \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed:           \x1b[31m${failedTests}\x1b[0m`);
  console.log(`Duration:         ${duration}s`);
  console.log('========================================================================');

  if (failedTests > 0) {
    console.log('\nFailures breakdown:');
    for (const f of failures) {
      console.log(`  - [${f.testId}] ${f.name} (${f.details})`);
    }
    process.exit(1);
  } else {
    console.log('\n\x1b[32mALL EMPIRICAL CHALLENGES PASSED (100%)\x1b[0m');
    process.exit(0);
  }
}

main();
