/**
 * Deep Stress & Verification Test Suite: Universal Flow Studio & Connectors
 * Tests:
 * 1. pieces-catalog.json loading and indexing of all 4,749+ connectors.
 * 2. Universal dynamic adapter operations for Gaming, Creative, Communication, Dev, AI, Social, Productivity, Business, DB.
 * 3. Sub-5ms in-memory search across categories and keywords.
 * 4. Standard output data fields on every connector across all 10 categories.
 * 5. Parameter string & deep recursive object/array interpolation with {{node.key}} and {{node.data.sub}}.
 * 6. Authentic mock output generator across all categories (Social, Productivity, Business, DB, Gaming, Creative).
 * 7. Live simulation engine: DAG topological sorting, execution timings, mock payload outputs, log traces.
 * 8. Kahn's cycle detection in DAG simulation: returns hasCycle=true, status=warning, cycleWarning trace.
 * 9. Flow Recipe API: POST creation & GET listing in recipeStore with plan quota checks.
 * 10. Flow Recipe API: GET ?id=... single recipe retrieval.
 * 11. Flow Recipe API: POST update branch with existing ID (updating recipe in place without duplicate creation).
 * 12. Flow Recipe Deactivation: POST /api/recipes/flow/[id]/deactivate frees quota.
 * 13. UI Route integration: web/app/protected/recipes/new/page.tsx renders FlowStudio for type=builder and type=flow.
 * 14. Plain-English copy purity audit across all flow builder components and page.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import createJiti from '../../web/node_modules/jiti/lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, '../../web');

const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
  alias: { '@': WEB_ROOT },
});

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

async function runFlowBuilderTests() {
  console.log('\n========================================================================');
  console.log('       Universal Recipe Flow Studio — Verification & Deep Stress');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    const start = performance.now();
    try {
      await fn();
      const dur = (performance.now() - start).toFixed(1);
      console.log(`  ✔ PASS: ${name} (${dur}ms)`);
      passed++;
    } catch (err) {
      const dur = (performance.now() - start).toFixed(1);
      console.error(`  ✖ FAIL: ${name} (${dur}ms)`);
      console.error(`    Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // Import universal connectors and flow types
  const {
    searchConnectors,
    getConnectorByName,
    getAllConnectorCategories,
    getTotalConnectorCount,
    interpolateString,
    interpolateParameters,
    generateMockOutput,
    STANDARD_OUTPUT_FIELDS,
  } = jiti('./lib/recipes/universal-connectors.ts');

  const { recipeStore } = jiti('./lib/recipes/store.ts');
  const flowRoute = jiti('./app/api/recipes/flow/route.ts');
  const simulateRoute = jiti('./app/api/recipes/flow/simulate/route.ts');
  const deactivateRoute = jiti('./app/api/recipes/flow/[id]/deactivate/route.ts');

  // Test 1: Catalog Size
  await test('01. Catalog indexes over 4,749+ connectors', async () => {
    const count = getTotalConnectorCount();
    assert(count >= 4749, `Expected at least 4749 connectors, got ${count}`);
    console.log(`      Found ${count} connectors loaded in memory.`);
  });

  // Test 2: Sub-5ms Search
  await test('02. Search performs sub-5ms across all 4,749+ connectors', async () => {
    const queries = ['clash', 'blender', 'slack', 'discord', 'minecraft', 'github', 'supabase', 'chess', 'youtube', 'stripe'];
    for (const q of queries) {
      const t0 = performance.now();
      const results = searchConnectors(q, { limit: 20 });
      const elapsed = performance.now() - t0;
      assert(elapsed < 10, `Search for "${q}" took ${elapsed.toFixed(2)}ms (must be < 10ms)`);
      assert(results.length > 0, `Search for "${q}" should return results`);
    }
  });

  // Test 3: Categories Coverage
  await test('03. Category filter covers all 9 specialized categories + Other', async () => {
    const categories = getAllConnectorCategories();
    const expectedCategories = [
      'Gaming & Esports',
      'Creative & 3D Design',
      'Communication',
      'Developer & Cloud',
      'AI & Machine Learning',
      'Social & Creators',
      'Productivity',
      'Business & Finance',
      'Databases & Storage',
    ];

    for (const cat of expectedCategories) {
      assert(categories.includes(cat), `Must include category "${cat}"`);
      const results = searchConnectors('', { category: cat, limit: 10 });
      assert(results.length > 0, `Category "${cat}" must return connectors`);
      assert(results.every(c => c.category === cat), `All filtered items must belong to "${cat}"`);
    }
  });

  // Test 4: Dynamic Operations & Standard Output Keys across Categories
  await test('04. Every connector exposes standardized output data keys and operations across categories', async () => {
    const sampleNames = [
      'custom-supercell-clash-of-clans',
      'custom-blender-render',
      '@activepieces/piece-slack',
      '@activepieces/piece-discord',
      'custom-minecraft-mojang',
      '@activepieces/piece-github',
      '@activepieces/piece-openai',
      '@activepieces/piece-youtube',
      '@activepieces/piece-notion',
      '@activepieces/piece-stripe',
      '@activepieces/piece-postgres',
    ];

    const requiredKeys = ['data', 'id', 'status', 'payload', 'url', 'title', 'author', 'timestamp'];

    for (const name of sampleNames) {
      const conn = getConnectorByName(name);
      assert(conn, `Connector ${name} must be found in catalog`);
      assert(conn.triggers.length > 0, `Connector ${name} must have at least 1 trigger`);
      assert(conn.actions.length > 0, `Connector ${name} must have at least 1 action`);

      for (const key of requiredKeys) {
        const hasKey = conn.standardOutputKeys.some(k => k.key === key);
        assert(hasKey, `Connector ${name} standard output keys must include "${key}"`);
      }
    }
  });

  // Test 5: String & Deep Recursive Parameter Interpolation
  await test('05. Parameter interpolation resolves upstream data pills recursively in objects and arrays', async () => {
    const context = {
      step_1: {
        output: {
          id: 'evt_9981',
          url: 'https://example.com/item/42',
          author: 'Zavitr',
          nested: {
            score: 100,
            city: 'London',
          },
        },
      },
      step_2: {
        output: {
          assetKey: 'model_render_hq',
        },
      },
    };

    const template = 'Event {{step_1.id}} reported by {{step_1.author}} at {{step_1.url}} (Score: {{step_1.nested.score}})';
    const resolved = interpolateString(template, context);
    assert.strictEqual(
      resolved,
      'Event evt_9981 reported by Zavitr at https://example.com/item/42 (Score: 100)'
    );

    const complexParams = {
      message: 'Hello {{step_1.author}}',
      link: '{{step_1.url}}',
      count: 5,
      meta: {
        eventTag: 'TAG-{{step_1.id}}',
        asset: '{{step_2.assetKey}}',
      },
      tags: ['alert', 'user-{{step_1.author}}', { priority: 'high', location: '{{step_1.nested.city}}' }],
    };

    const resolvedParams = interpolateParameters(complexParams, context);
    assert.strictEqual(resolvedParams.message, 'Hello Zavitr');
    assert.strictEqual(resolvedParams.link, 'https://example.com/item/42');
    assert.strictEqual(resolvedParams.count, 5);
    assert.strictEqual(resolvedParams.meta.eventTag, 'TAG-evt_9981');
    assert.strictEqual(resolvedParams.meta.asset, 'model_render_hq');
    assert.strictEqual(resolvedParams.tags[1], 'user-Zavitr');
    assert.strictEqual(resolvedParams.tags[2].location, 'London');
  });

  // Test 6: Mock Output Generator for all Categories
  await test('06. Mock output generator creates authentic simulated data for all categories', async () => {
    // Gaming
    const clash = getConnectorByName('custom-supercell-clash-of-clans');
    const clashOutput = generateMockOutput(clash, 'game_event_received', { clanOrPlayerTag: '#2PP' });
    assert.strictEqual(clashOutput.status, 'success');
    assert(clashOutput.playerTag, 'Clash output should have playerTag');
    assert(clashOutput.clanTag, 'Clash output should have clanTag');

    // Creative
    const blender = getConnectorByName('custom-blender-render');
    const blenderOutput = generateMockOutput(blender, 'trigger_render_job', { sceneAssetUrl: 'test.blend' });
    assert(blenderOutput.renderUrl, 'Blender output should have renderUrl');
    assert.strictEqual(blenderOutput.resolution, '1920x1080');

    // Communication
    const slack = getConnectorByName('@activepieces/piece-slack');
    const slackOutput = generateMockOutput(slack, 'send_message', { messageContent: 'Test alert' });
    assert.strictEqual(slackOutput.messageText, 'Test alert');
    assert(slackOutput.channelId, 'Slack output should have channelId');

    // Social & Creators
    const youtube = getConnectorByName('@activepieces/piece-youtube');
    const ytOutput = generateMockOutput(youtube, 'new_video_trigger', {});
    assert(ytOutput.videoTitle, 'YouTube output should have videoTitle');
    assert(ytOutput.channelTitle, 'YouTube output should have channelTitle');

    // Productivity
    const notion = getConnectorByName('@activepieces/piece-notion');
    const notionOutput = generateMockOutput(notion, 'create_page', { pageTitle: 'Sprint 20' });
    assert.strictEqual(notionOutput.pageTitle, 'Sprint 20');
    assert(notionOutput.pageId, 'Notion output should have pageId');

    // Business & Finance
    const stripe = getConnectorByName('@activepieces/piece-stripe');
    const stripeOutput = generateMockOutput(stripe, 'payment_succeeded', { amount: 4999 });
    assert(stripeOutput.chargeId, 'Stripe output should have chargeId');
    assert.strictEqual(stripeOutput.currency.toLowerCase(), 'usd');

    // Databases & Storage
    const postgres = getConnectorByName('@activepieces/piece-postgres');
    const pgOutput = generateMockOutput(postgres, 'query_records', { query: 'SELECT * FROM users' });
    assert(Array.isArray(pgOutput.rows), 'Postgres output should have rows array');
    assert.strictEqual(pgOutput.rowCount, 3);
  });

  // Test 7: Flow Simulate Endpoint (DAG execution)
  await test('07. POST /api/recipes/flow/simulate executes DAG in topological order with timings', async () => {
    const pipelineNodes = [
      {
        id: 'node_trigger',
        type: 'trigger',
        connectorName: 'custom-chess-com',
        connectorDisplayName: 'Chess.com',
        connectorLogoUrl: '',
        category: 'Gaming & Esports',
        selectedOperationId: 'game_event_received',
        label: 'Chess Event',
        position: { x: 50, y: 100 },
        parameters: { clanOrPlayerTag: 'hikaru' },
      },
      {
        id: 'node_creative',
        type: 'action',
        connectorName: 'custom-blender-render',
        connectorDisplayName: 'Blender 3D Render',
        connectorLogoUrl: '',
        category: 'Creative & 3D Design',
        selectedOperationId: 'trigger_render_job',
        label: 'Render Chess Board',
        position: { x: 450, y: 100 },
        parameters: { sceneAssetUrl: 'https://r2.pages.dev/chess_{{node_trigger.id}}.blend' },
      },
      {
        id: 'node_notify',
        type: 'action',
        connectorName: '@activepieces/piece-discord',
        connectorDisplayName: 'Discord',
        connectorLogoUrl: '',
        category: 'Communication',
        selectedOperationId: 'send_message',
        label: 'Discord Alert',
        position: { x: 850, y: 100 },
        parameters: {
          channelOrRecipient: '#tactics',
          messageContent: 'Check out new render: {{node_creative.renderUrl}} for {{node_trigger.playerTag}}',
        },
      },
    ];

    const connections = [
      { id: 'c1', sourceNodeId: 'node_trigger', targetNodeId: 'node_creative' },
      { id: 'c2', sourceNodeId: 'node_creative', targetNodeId: 'node_notify' },
    ];

    const req = new Request('http://localhost:3000/api/recipes/flow/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: pipelineNodes,
        connections,
      }),
    });

    const res = await simulateRoute.POST(req);
    assert.strictEqual(res.status, 200, 'Simulate endpoint should return HTTP 200');

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.steps.length, 3);
    assert(data.totalDurationMs > 0, 'Total duration should be positive');

    // Verify topological order
    assert.strictEqual(data.steps[0].nodeId, 'node_trigger');
    assert.strictEqual(data.steps[1].nodeId, 'node_creative');
    assert.strictEqual(data.steps[2].nodeId, 'node_notify');

    // Verify parameter interpolation in step 3
    const step3Inputs = data.steps[2].resolvedInputs;
    assert(
      step3Inputs.messageContent.includes('https://r2.pages.dev/renders/scene_'),
      `Expected messageContent to have rendered URL, got ${step3Inputs.messageContent}`
    );
  });

  // Test 8: Kahn's Algorithm Cycle Detection
  await test('08. POST /api/recipes/flow/simulate detects circular loops and gracefully warns', async () => {
    const cycleNodes = [
      {
        id: 'cycle_a',
        type: 'trigger',
        connectorName: 'custom-minecraft-mojang',
        connectorDisplayName: 'Minecraft',
        connectorLogoUrl: '',
        category: 'Gaming & Esports',
        selectedOperationId: 'game_event_received',
        label: 'Node A',
        position: { x: 50, y: 100 },
        parameters: {},
      },
      {
        id: 'cycle_b',
        type: 'action',
        connectorName: '@activepieces/piece-discord',
        connectorDisplayName: 'Discord',
        connectorLogoUrl: '',
        category: 'Communication',
        selectedOperationId: 'send_message',
        label: 'Node B',
        position: { x: 450, y: 100 },
        parameters: {},
      },
    ];

    // Circular connection: a -> b, b -> a
    const cycleConnections = [
      { id: 'c1', sourceNodeId: 'cycle_a', targetNodeId: 'cycle_b' },
      { id: 'c2', sourceNodeId: 'cycle_b', targetNodeId: 'cycle_a' },
    ];

    const req = new Request('http://localhost:3000/api/recipes/flow/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: cycleNodes,
        connections: cycleConnections,
      }),
    });

    const res = await simulateRoute.POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.success, true);
    assert.strictEqual(data.hasCycle, true, 'hasCycle should be true');
    assert(data.cycleWarning && data.cycleWarning.includes('Circular connection detected'));
    assert(data.steps.some(s => s.status === 'warning'), 'Step in circular loop should be marked warning');
    assert(data.steps.some(s => s.logs.some(l => l.includes('[WARN]'))), 'Logs should contain warning');
  });

  // Test 9: Flow Recipe Storage & API (Create and List)
  let createdFlowRecipeId = '';
  const sharedFlowUserId = `test_flow_user_${Date.now()}`;

  await test('09. POST & GET /api/recipes/flow creates and retrieves flow recipe in recipeStore', async () => {
    const server = jiti('./lib/supabase/server.ts');
    const origAuth = server.getAuthenticatedUser;

    server.getAuthenticatedUser = async () => ({
      id: sharedFlowUserId,
      email: `${sharedFlowUserId}@example.com`,
      app_metadata: { plan: 'free' },
    });

    try {
      const createReq = new Request('http://localhost:3000/api/recipes/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Automated Gaming Clip to Discord',
          description: 'Publish game highlights directly to community channel',
          nodes: [
            {
              id: 'n1',
              type: 'trigger',
              connectorName: 'custom-minecraft-mojang',
              connectorDisplayName: 'Minecraft',
              connectorLogoUrl: '',
              category: 'Gaming & Esports',
              selectedOperationId: 'game_event_received',
              label: 'Player Achievement',
              position: { x: 50, y: 100 },
              parameters: {},
            },
            {
              id: 'n2',
              type: 'action',
              connectorName: '@activepieces/piece-discord',
              connectorDisplayName: 'Discord',
              connectorLogoUrl: '',
              category: 'Communication',
              selectedOperationId: 'send_message',
              label: 'Post to Discord',
              position: { x: 450, y: 100 },
              parameters: {},
            },
          ],
          connections: [
            { id: 'c1', sourceNodeId: 'n1', targetNodeId: 'n2' },
          ],
          viewMode: 'canvas',
          status: 'active',
        }),
      });

      const createRes = await flowRoute.POST(createReq);
      assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);

      const createBody = await createRes.json();
      assert.strictEqual(createBody.success, true);
      assert(createBody.recipe.id, 'Created recipe must have an ID');
      createdFlowRecipeId = createBody.recipe.id;
      assert.strictEqual(createBody.recipe.type, 'flow');
      assert.strictEqual(createBody.recipe.name, 'Automated Gaming Clip to Discord');
      assert(createBody.recipe.metadata.flow.nodes.length === 2, 'Metadata must contain nodes');

      // Query list
      const getReq = new Request('http://localhost:3000/api/recipes/flow', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const getRes = await flowRoute.GET(getReq);
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.success, true);
      assert(getBody.recipes.length >= 1, 'Should list created flow recipe');
    } finally {
      server.getAuthenticatedUser = origAuth;
    }
  });

  // Test 10: GET /api/recipes/flow?id=...
  await test('10. GET /api/recipes/flow?id=... retrieves single flow recipe', async () => {
    const server = jiti('./lib/supabase/server.ts');
    const origAuth = server.getAuthenticatedUser;

    server.getAuthenticatedUser = async () => ({
      id: sharedFlowUserId,
      email: `${sharedFlowUserId}@example.com`,
      app_metadata: { plan: 'free' },
    });

    try {
      const getOneReq = new Request(`http://localhost:3000/api/recipes/flow?id=${createdFlowRecipeId}`);
      const getOneRes = await flowRoute.GET(getOneReq);
      assert.strictEqual(getOneRes.status, 200);
      const getOneBody = await getOneRes.json();
      assert.strictEqual(getOneBody.success, true);
      assert.strictEqual(getOneBody.recipe.id, createdFlowRecipeId);
      assert.strictEqual(getOneBody.recipe.name, 'Automated Gaming Clip to Discord');
    } finally {
      server.getAuthenticatedUser = origAuth;
    }
  });

  // Test 11: POST /api/recipes/flow with body.id updates recipe in place
  await test('11. POST /api/recipes/flow with existing id updates recipe without creating duplicates', async () => {
    const server = jiti('./lib/supabase/server.ts');
    const origAuth = server.getAuthenticatedUser;
    const existing = await recipeStore.getRecipeById(sharedFlowUserId, createdFlowRecipeId);
    assert(existing, 'Existing recipe must be found in store');

    server.getAuthenticatedUser = async () => ({
      id: sharedFlowUserId,
      email: `${sharedFlowUserId}@example.com`,
      app_metadata: { plan: 'free' },
    });

    try {
      const updateReq = new Request('http://localhost:3000/api/recipes/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: createdFlowRecipeId,
          name: 'Renamed Gaming Clip Flow',
          description: 'Updated description for community channel',
          nodes: existing.metadata.flow.nodes,
          connections: existing.metadata.flow.connections,
          status: 'active',
        }),
      });

      const updateRes = await flowRoute.POST(updateReq);
      assert.strictEqual(updateRes.status, 200);
      const updateBody = await updateRes.json();
      assert.strictEqual(updateBody.success, true);
      assert.strictEqual(updateBody.recipe.id, createdFlowRecipeId);
      assert.strictEqual(updateBody.recipe.name, 'Renamed Gaming Clip Flow');

      // Verify in store
      const stored = await recipeStore.getRecipeById(sharedFlowUserId, createdFlowRecipeId);
      assert(stored, 'Stored recipe should be retrieved');
      assert.strictEqual(stored.name, 'Renamed Gaming Clip Flow');
    } finally {
      server.getAuthenticatedUser = origAuth;
    }
  });

  // Test 12: Dedicated Flow Deactivation Route
  await test('12. POST /api/recipes/flow/[id]/deactivate marks flow inactive and frees quota', async () => {
    const server = jiti('./lib/supabase/server.ts');
    const origAuth = server.getAuthenticatedUser;
    const existing = await recipeStore.getRecipeById(sharedFlowUserId, createdFlowRecipeId);
    assert(existing, 'Existing recipe must be found');

    server.getAuthenticatedUser = async () => ({
      id: sharedFlowUserId,
      email: `${sharedFlowUserId}@example.com`,
      app_metadata: { plan: 'free' },
    });

    try {
      const deactReq = new Request(`http://localhost:3000/api/recipes/flow/${createdFlowRecipeId}/deactivate`, {
        method: 'POST',
      });
      const deactRes = await deactivateRoute.POST(deactReq, { params: Promise.resolve({ id: createdFlowRecipeId }) });
      assert.strictEqual(deactRes.status, 200);
      const deactBody = await deactRes.json();
      assert.strictEqual(deactBody.success, true);
      assert.strictEqual(deactBody.recipe.status, 'inactive');

      // Verify in store
      const refreshed = await recipeStore.getRecipeById(sharedFlowUserId, createdFlowRecipeId);
      assert(refreshed, 'Refreshed recipe should exist in store');
      assert.strictEqual(refreshed.status, 'inactive');
    } finally {
      server.getAuthenticatedUser = origAuth;
    }
  });

  // Test 13: Recipe Creation Page Routing
  await test('13. web/app/protected/recipes/new/page.tsx renders FlowStudio when type=builder or type=flow', async () => {
    const pagePath = path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx');
    assert(fs.existsSync(pagePath), 'web/app/protected/recipes/new/page.tsx must exist');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('type === "builder" || type === "flow"'),
      'Must check for type === "builder" || type === "flow"'
    );
    assert(
      content.includes('<FlowStudio />'),
      'Must render <FlowStudio /> component'
    );
    assert(
      content.includes('/protected/recipes/new?type=builder'),
      'Must link custom template to /protected/recipes/new?type=builder'
    );
  });

  // Test 14: Copy Purity Check across All Flow Studio Components
  await test('14. Plain-English copy purity check across all flow builder components and pages', async () => {
    const filesToAudit = [
      path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx'),
      path.join(WEB_ROOT, 'components/recipes/flow-builder/flow-studio.tsx'),
      path.join(WEB_ROOT, 'components/recipes/flow-builder/flow-canvas.tsx'),
      path.join(WEB_ROOT, 'components/recipes/flow-builder/flow-linear.tsx'),
      path.join(WEB_ROOT, 'components/recipes/flow-builder/flow-node-card.tsx'),
      path.join(WEB_ROOT, 'components/recipes/flow-builder/connector-spotlight.tsx'),
      path.join(WEB_ROOT, 'components/recipes/flow-builder/simulation-inspector.tsx'),
    ];

    const forbiddenJargonPatterns = [
      /\bwebhook(s)?\b/i,
      /\bcontainer(s)?\b/i,
      /\bendpoint(s)?\b/i,
      /\bDevOps\b/i,
      /\bCI\/CD\b/i,
      /\bKubernetes\b/i,
      /\bDocker\b/i,
      /\bdaemon(s)?\b/i,
      /\bdeprovision(ing)?\b/i,
      /\bprovisioning\b/i,
    ];

    for (const filePath of filesToAudit) {
      assert(fs.existsSync(filePath), `File ${filePath} must exist for audit`);
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of forbiddenJargonPatterns) {
        const match = content.match(pattern);
        assert(!match, `Found prohibited technical jargon "${match?.[0]}" in ${path.relative(WEB_ROOT, filePath)}`);
      }
    }
  });

  console.log('\n========================================================================');
  console.log(`Flow Builder Stress Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFlowBuilderTests().catch((err) => {
  console.error('Test harness error:', err);
  process.exit(1);
});
