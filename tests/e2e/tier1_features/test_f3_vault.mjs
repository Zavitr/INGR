/**
 * Tier 1: Feature F3 - Engine Admin Auth & Credential Vault
 * Authoritative source: ORIGINAL_REQUEST.md (R1), MASTER_PLAN.md (Part 3, Part 7 Phase 0), PROJECT.md (§ Interface Contracts)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  adminSignIn,
  createAppConnection,
  deleteAppConnection,
  listAppConnections,
} from '../helpers/api_client.mjs';
import { assert, assertEqual, assertHttpStatus, assertIncludes } from '../helpers/assertions.mjs';
import { CONFIG, WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F3 Engine Admin Auth & Vault', 'Tier 1', 'F3');

function getSupabaseUrl() {
  const envPath = path.join(WEB_ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/NEXT_PUBLIC_SUPABASE_URL=(https:\/\/[^\s]+)/);
    if (match) return match[1];
  }
  return 'https://fkudpldsmnbuepmvmydc.supabase.co';
}

export async function runF3Tests() {
  let authToken = null;
  let projectId = null;
  let testSupabaseConnId = null;
  let testCloudflareConnId = null;

  await registry.runTest('F3-01: Admin sign-in generates valid JWT and platform role ADMIN', async () => {
    const { status, data } = await adminSignIn();
    assertHttpStatus(status, 200, 'POST /api/v1/authentication/sign-in must return HTTP 200');
    assert(data !== null, 'Response must be valid JSON');
    assert(typeof data.token === 'string' && data.token.length > 20, 'Response must include non-empty JWT token');
    assertEqual(data.platformRole, 'ADMIN', 'User platformRole must be ADMIN');
    assertEqual(data.projectId, CONFIG.expectedProjectId, `Expected projectId ${CONFIG.expectedProjectId}`);
    authToken = data.token;
    projectId = data.projectId;
  });

  await registry.runTest('F3-02: Listing app connections retrieves existing vaulted credentials', async () => {
    assert(authToken !== null, 'Requires auth token from F3-01');
    const { status, data } = await listAppConnections(authToken, projectId);
    assertHttpStatus(status, 200, 'GET /api/v1/app-connections must return HTTP 200');
    assert(Array.isArray(data.data), 'app-connections data must be an array');
    const externalIds = data.data.map(c => c.externalId);
    assertIncludes(externalIds, 'supabase_connection', 'Must list pre-configured supabase_connection');
    assertIncludes(externalIds, 'cloudflare_connection', 'Must list pre-configured cloudflare_connection');
  });

  await registry.runTest('F3-03: Create vaulted Supabase connection (CUSTOM_AUTH)', async () => {
    assert(authToken !== null, 'Requires auth token from F3-01');
    const extId = `test_sb_${Date.now()}`;
    const payload = {
      projectId,
      externalId: extId,
      displayName: 'Test Supabase E2E',
      pieceName: '@activepieces/piece-supabase',
      type: 'CUSTOM_AUTH',
      value: {
        type: 'CUSTOM_AUTH',
        props: {
          url: getSupabaseUrl(),
          apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-test-key',
        },
      },
    };

    const { status, data } = await createAppConnection(authToken, payload);
    assert(status === 201 || status === 200, `Expected HTTP 200 or 201, got ${status}`);
    assert(data && data.id, 'Created connection must have an ID');
    assertEqual(data.externalId, extId);
    assertEqual(data.status, 'ACTIVE');
    testSupabaseConnId = data.id;
  });

  await registry.runTest('F3-04: Create vaulted Cloudflare connection (SECRET_TEXT)', async () => {
    assert(authToken !== null, 'Requires auth token from F3-01');
    const extId = `test_cf_${Date.now()}`;
    const payload = {
      projectId,
      externalId: extId,
      displayName: 'Test Cloudflare E2E',
      pieceName: '@activepieces/piece-http',
      type: 'SECRET_TEXT',
      value: {
        type: 'SECRET_TEXT',
        secret_text: 'cf-api-token-secret-e2e-value',
      },
    };

    const { status, data } = await createAppConnection(authToken, payload);
    assert(status === 201 || status === 200, `Expected HTTP 200 or 201, got ${status}`);
    assert(data && data.id, 'Created connection must have an ID');
    assertEqual(data.externalId, extId);
    assertEqual(data.status, 'ACTIVE');
    testCloudflareConnId = data.id;
  });

  await registry.runTest('F3-05: Clean up created test connections from vault', async () => {
    assert(authToken !== null, 'Requires auth token from F3-01');
    if (testSupabaseConnId) {
      const { status } = await deleteAppConnection(authToken, testSupabaseConnId);
      assert(status === 200 || status === 204, `Delete Supabase connection failed with status ${status}`);
    }
    if (testCloudflareConnId) {
      const { status } = await deleteAppConnection(authToken, testCloudflareConnId);
      assert(status === 200 || status === 204, `Delete Cloudflare connection failed with status ${status}`);
    }
  });
}

if (process.argv[1]?.endsWith('test_f3_vault.mjs')) {
  runF3Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
