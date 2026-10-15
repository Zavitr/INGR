/**
 * Tier 1: Feature F2 - Headless Engine REST API
 * Authoritative source: ORIGINAL_REQUEST.md (R1), MASTER_PLAN.md (Part 3, Part 7 Phase 0)
 */

import { fetchFlags, fetchHealth, fetchPieces } from '../helpers/api_client.mjs';
import { assert, assertEqual, assertHttpStatus, assertIncludes } from '../helpers/assertions.mjs';
import { registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F2 Headless Engine REST API', 'Tier 1', 'F2');

export async function runF2Tests() {
  await registry.runTest('F2-01: Engine flags endpoint returns HTTP 200 and CE configuration', async () => {
    const { status, data } = await fetchFlags();
    assertHttpStatus(status, 200, 'GET /api/v1/flags must return HTTP 200');
    assert(data !== null, 'Response body must be valid JSON');
    assertEqual(data.EDITION, 'ce', 'Activepieces edition must be Community Edition ("ce")');
    assertEqual(data.USER_CREATED, true, 'Admin user must be created in engine');
    assertEqual(data.ENVIRONMENT, 'prod', 'Activepieces environment must be prod');
  });

  await registry.runTest('F2-02: Engine health endpoint returns HTTP 200 Healthy', async () => {
    const { status, data } = await fetchHealth();
    assertHttpStatus(status, 200, 'GET /api/v1/health must return HTTP 200');
    assert(data !== null, 'Response body must be valid JSON');
    assertEqual(data.status, 'Healthy', 'Health status must be "Healthy"');
  });

  await registry.runTest('F2-03: Connector catalog endpoint returns 700+ pieces', async () => {
    const { status, data } = await fetchPieces();
    assertHttpStatus(status, 200, 'GET /api/v1/pieces must return HTTP 200');
    assert(Array.isArray(data), 'Pieces response must be an array');
    assert(data.length >= 700, `Expected at least 700 pieces, got ${data.length}`);
  });

  await registry.runTest('F2-04: Pieces catalog includes Supabase and HTTP connectors', async () => {
    const { status, data } = await fetchPieces();
    assertHttpStatus(status, 200, 'GET /api/v1/pieces must return HTTP 200');
    const pieceNames = data.map(p => p.name);
    assertIncludes(pieceNames, '@activepieces/piece-supabase', 'Piece catalog must contain @activepieces/piece-supabase');
    assertIncludes(pieceNames, '@activepieces/piece-http', 'Piece catalog must contain @activepieces/piece-http');
  });

  await registry.runTest('F2-05: Headless operation matches configured public URL and webhook prefix', async () => {
    const { status, data } = await fetchFlags();
    assertHttpStatus(status, 200);
    assertIncludes(data.PUBLIC_URL, 'localhost:8080', 'PUBLIC_URL must point to port 8080');
    assertIncludes(data.WEBHOOK_URL_PREFIX, '/api/v1/webhooks', 'WEBHOOK_URL_PREFIX must use REST api prefix');
  });
}

if (process.argv[1]?.endsWith('test_f2_engine_api.mjs')) {
  runF2Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
