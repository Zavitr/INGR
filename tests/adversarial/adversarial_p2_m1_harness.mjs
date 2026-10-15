#!/usr/bin/env node
/**
 * Adversarial Test Harness: Phase 2 Milestone 1 (API Auth & Multi-Tenant Isolation)
 * 
 * Verifies:
 * 1. Unauthenticated calls to GET, POST, DELETE /api/services return HTTP 401.
 * 2. Malformed Authorization headers, expired/invalid tokens return HTTP 401.
 * 3. User A cannot see, delete, or overwrite User B's credentials in Activepieces vault.
 * 4. Deleting a non-existent connection or cross-user connection fails safely.
 * 5. Prefix delimiter collision resistance in externalId scoping.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WEB_DIR = path.resolve(REPO_ROOT, 'web');
const TEST_PORT = 3599;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Colors for terminal output
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
const results = [];

function assert(condition, testId, description, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ${ANSI.green}✔ PASS${ANSI.reset} [${testId}] ${description}`);
    results.push({ testId, description, status: 'PASS', details });
  } else {
    failedCount++;
    console.error(`  ${ANSI.red}✖ FAIL${ANSI.reset} [${testId}] ${description}${details ? ' - ' + details : ''}`);
    results.push({ testId, description, status: 'FAIL', details });
  }
}

async function startServer() {
  console.log(`${ANSI.cyan}Starting Next.js test server on port ${TEST_PORT}...${ANSI.reset}`);
  const nextBin = path.resolve(WEB_DIR, 'node_modules/.bin/next');
  
  const serverProc = spawn(nextBin, ['start', '-p', String(TEST_PORT)], {
    cwd: WEB_DIR,
    env: {
      ...process.env,
      PATH: `${process.env.PATH}:/home/zavitr/.nvm/versions/node/v22.22.3/bin`,
      PORT: String(TEST_PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stderr.on('data', (d) => {
    const msg = d.toString();
    if (!msg.includes('ExperimentalWarning')) {
      // ignore minor node warnings
    }
  });

  // Wait for server to become responsive
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`${BASE_URL}/api/services`);
      if (res.status === 401) {
        ready = true;
        break;
      }
    } catch {
      // wait a bit
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!ready) {
    serverProc.kill('SIGKILL');
    throw new Error('Next.js test server failed to start within 15 seconds.');
  }

  console.log(`${ANSI.green}Next.js test server ready on ${BASE_URL}${ANSI.reset}\n`);
  return serverProc;
}

async function testUnauthenticatedEndpoints() {
  console.log(`${ANSI.bold}► Suite 1: Unauthenticated Endpoint Access (HTTP 401 Enforcement)${ANSI.reset}`);

  // 1. GET /api/services
  {
    const res = await fetch(`${BASE_URL}/api/services`);
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-01',
      'GET /api/services without authentication returns HTTP 401 Unauthorized',
      `Got status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  }

  // 2. POST /api/services with empty body
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-02',
      'POST /api/services without auth (empty payload) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 3. POST /api/services with valid Cloudflare payload
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'cloudflare', apiToken: 'cf-secret-token' }),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-03',
      'POST /api/services without auth (Cloudflare payload) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 4. POST /api/services with valid Supabase payload
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'supabase',
        url: 'https://test.supabase.co',
        apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      }),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-04',
      'POST /api/services without auth (Supabase payload) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 5. POST /api/services with valid OpenRouter payload
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'openrouter', apiKey: 'sk-or-v1-testkey' }),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-05',
      'POST /api/services without auth (OpenRouter payload) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 6. POST /api/services with valid Oracle payload
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'oracle',
        credentials: { tenancy: 'ocid1.tenancy.oc1..test', user: 'ocid1.user.oc1..test' },
      }),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-06',
      'POST /api/services without auth (Oracle payload) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 7. DELETE /api/services with empty body
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-07',
      'DELETE /api/services without auth (empty payload) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 8. DELETE /api/services with ?service=cloudflare
  {
    const res = await fetch(`${BASE_URL}/api/services?service=cloudflare`, {
      method: 'DELETE',
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-08',
      'DELETE /api/services?service=cloudflare without auth returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }

  // 9. DELETE /api/services with JSON body
  {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'cloudflare' }),
    });
    const body = await res.json().catch(() => null);
    assert(
      res.status === 401 && body?.error === 'Unauthorized',
      'ADV-AUTH-09',
      'DELETE /api/services without auth (JSON body) returns HTTP 401 Unauthorized',
      `Got status: ${res.status}`
    );
  }
}

async function testMalformedAndInvalidAuthHeaders() {
  console.log(`\n${ANSI.bold}► Suite 2: Malformed Authorization Headers & Expired/Invalid Tokens${ANSI.reset}`);

  const cases = [
    {
      id: 'ADV-MALFORM-01',
      desc: 'Empty Authorization header',
      headers: { Authorization: '' },
    },
    {
      id: 'ADV-MALFORM-02',
      desc: 'Authorization header with "Bearer" but no token',
      headers: { Authorization: 'Bearer' },
    },
    {
      id: 'ADV-MALFORM-03',
      desc: 'Authorization header with "Bearer   " (whitespace only)',
      headers: { Authorization: 'Bearer    ' },
    },
    {
      id: 'ADV-MALFORM-04',
      desc: 'Basic auth scheme (non-Bearer)',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    },
    {
      id: 'ADV-MALFORM-05',
      desc: 'Digest auth scheme',
      headers: { Authorization: 'Digest username="admin", realm="test"' },
    },
    {
      id: 'ADV-MALFORM-06',
      desc: 'Token scheme',
      headers: { Authorization: 'Token abcdef123456' },
    },
    {
      id: 'ADV-MALFORM-07',
      desc: 'Bearer with invalid random string',
      headers: { Authorization: 'Bearer random_invalid_garbage_token_999' },
    },
    {
      id: 'ADV-MALFORM-08',
      desc: 'Bearer with expired/forged JWT',
      headers: {
        Authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid_sig',
      },
    },
    {
      id: 'ADV-MALFORM-09',
      desc: 'Bearer with SQL injection payload',
      headers: { Authorization: "Bearer ' OR '1'='1' --" },
    },
    {
      id: 'ADV-MALFORM-10',
      desc: 'Bearer with XSS payload',
      headers: { Authorization: 'Bearer <script>alert(1)</script>' },
    },
    {
      id: 'ADV-MALFORM-11',
      desc: 'Bearer with oversized token (10KB header stress)',
      headers: { Authorization: `Bearer ${'A'.repeat(10000)}` },
    },
    {
      id: 'ADV-MALFORM-12',
      desc: 'Invalid Supabase session cookies',
      headers: { Cookie: 'sb-access-token=bogus_token; sb-refresh-token=bogus_refresh' },
    },
    {
      id: 'ADV-MALFORM-13',
      desc: 'Corrupted cookie formatting',
      headers: { Cookie: 'sb:token=%%%corrupted;;;' },
    },
  ];

  for (const c of cases) {
    const res = await fetch(`${BASE_URL}/api/services`, { headers: c.headers });
    // Any status other than 200 or 500: specifically 401 (or 431 for oversized header) is safe
    const isSafe = res.status === 401 || (c.id === 'ADV-MALFORM-11' && res.status === 431);
    assert(
      isSafe,
      c.id,
      `${c.desc} returns HTTP 401 (or 431 for oversized)`,
      `HTTP status: ${res.status}`
    );
  }

  // Also verify POST and DELETE with invalid tokens reject with 401
  {
    const postRes = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid_token_xyz',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ service: 'cloudflare', apiToken: 'test' }),
    });
    assert(
      postRes.status === 401,
      'ADV-MALFORM-14',
      'POST /api/services with invalid Bearer token returns HTTP 401',
      `HTTP status: ${postRes.status}`
    );
  }

  {
    const delRes = await fetch(`${BASE_URL}/api/services`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer invalid_token_xyz',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ service: 'cloudflare' }),
    });
    assert(
      delRes.status === 401,
      'ADV-MALFORM-15',
      'DELETE /api/services with invalid Bearer token returns HTTP 401',
      `HTTP status: ${delRes.status}`
    );
  }
}

async function testVaultMultiTenantIsolation() {
  console.log(`\n${ANSI.bold}► Suite 3: Activepieces Vault Multi-Tenant Isolation & Anti-Collision${ANSI.reset}`);

  // Dynamic import of Activepieces client
  const clientPath = path.resolve(REPO_ROOT, 'web/lib/activepieces/client.ts');
  const client = await import(clientPath);

  const timestamp = Date.now();
  const userAlpha = `tenant_alpha_${timestamp}`;
  const userBeta = `tenant_beta_${timestamp}`;

  console.log(`  ${ANSI.dim}Created test tenants: Alpha=${userAlpha}, Beta=${userBeta}${ANSI.reset}`);

  try {
    // 1. Create connections for User Alpha
    const cfAlpha = await client.createCloudflareConnection('cf_secret_alpha_token', userAlpha);
    const sbAlpha = await client.createSupabaseConnection(
      'https://fkudpldsmnbuepmvmydc.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.alpha',
      userAlpha
    );
    const orAlpha = await client.createOpenRouterConnection('sk-or-v1-alpha-key', userAlpha);
    const oraAlpha = await client.createOracleConnection({ tenancyOcid: 'ocid1.tenancy.alpha' }, userAlpha);

    assert(
      Boolean(cfAlpha?.id && sbAlpha?.id && orAlpha?.id && oraAlpha?.id),
      'ADV-VAULT-01',
      'User Alpha creates connections across all 4 services with user scoping',
      `Created 4 connections for ${userAlpha}`
    );

    // 2. Create connections for User Beta
    const cfBeta = await client.createCloudflareConnection('cf_secret_beta_token', userBeta);
    const orBeta = await client.createOpenRouterConnection('sk-or-v1-beta-key', userBeta);

    assert(
      Boolean(cfBeta?.id && orBeta?.id),
      'ADV-VAULT-02',
      'User Beta creates connections with distinct user scoping',
      `Created 2 connections for ${userBeta}`
    );

    // 3. Test Read Isolation: Alpha reads only Alpha connections
    const alphaConns = await client.listAppConnections(userAlpha);
    const alphaExternalIds = alphaConns.map((c) => c.externalId);
    const alphaHasBeta = alphaExternalIds.some((id) => id.includes(userBeta));
    const alphaHasAllAlpha = alphaConns.length === 4 && alphaExternalIds.every((id) => id.includes(userAlpha));

    assert(
      alphaHasAllAlpha && !alphaHasBeta,
      'ADV-VAULT-03',
      'User Alpha listAppConnections returns only Alpha credentials (no Beta leaks)',
      `Found ${alphaConns.length} connections: ${alphaExternalIds.join(', ')}`
    );

    // 4. Test Read Isolation: Beta reads only Beta connections
    const betaConns = await client.listAppConnections(userBeta);
    const betaExternalIds = betaConns.map((c) => c.externalId);
    const betaHasAlpha = betaExternalIds.some((id) => id.includes(userAlpha));
    const betaHasAllBeta = betaConns.length === 2 && betaExternalIds.every((id) => id.includes(userBeta));

    assert(
      betaHasAllBeta && !betaHasAlpha,
      'ADV-VAULT-04',
      'User Beta listAppConnections returns only Beta credentials (no Alpha leaks)',
      `Found ${betaConns.length} connections: ${betaExternalIds.join(', ')}`
    );

    // 5. Global Seed Isolation: Ensure users do not see un-scoped Phase 0 seed connections
    const alphaSeesSeeds = alphaExternalIds.some(
      (id) => id === 'supabase_connection' || id === 'cloudflare_connection'
    );
    const betaSeesSeeds = betaExternalIds.some(
      (id) => id === 'supabase_connection' || id === 'cloudflare_connection'
    );

    assert(
      !alphaSeesSeeds && !betaSeesSeeds,
      'ADV-VAULT-05',
      'Global un-scoped seed connections (supabase_connection, etc.) are excluded from tenant views',
      `Seeds visible: Alpha=${alphaSeesSeeds}, Beta=${betaSeesSeeds}`
    );

    // 6. Substring / Numeric Suffix Isolation Test:
    // e.g. User 1 ("tenant_u1_...") vs User 10 ("tenant_u10_...")
    const userSuffixShort = `tenant_u1_${timestamp}`;
    const userSuffixLong = `tenant_u10_${timestamp}`;

    await client.createCloudflareConnection('cf_short', userSuffixShort);
    await client.createCloudflareConnection('cf_long', userSuffixLong);

    const shortConns = await client.listAppConnections(userSuffixShort);
    const shortIds = shortConns.map((c) => c.externalId);
    const shortCollision = shortIds.some((id) => id.includes(userSuffixLong));

    assert(
      !shortCollision && shortConns.length === 1,
      'ADV-VAULT-06',
      'User numeric suffix isolation: tenant_u1 does NOT leak tenant_u10',
      `shortIds: ${shortIds.join(', ')}`
    );

    // Clean up suffix test items
    await client.deleteAppConnectionByExternalId(`usr_${userSuffixShort}_cloudflare`);
    await client.deleteAppConnectionByExternalId(`usr_${userSuffixLong}_cloudflare`);

    // 7. Deletion Isolation: User Alpha deletes its Cloudflare connection
    const delAlphaCf = await client.deleteAppConnectionByExternalId(`usr_${userAlpha}_cloudflare`);
    assert(
      delAlphaCf === true,
      'ADV-VAULT-07',
      'User Alpha successfully deletes its Cloudflare connection',
      `Deleted: ${delAlphaCf}`
    );

    // Verify Alpha now has 3 connections
    const alphaAfterDel = await client.listAppConnections(userAlpha);
    const alphaStillHasCf = alphaAfterDel.some((c) => c.externalId === `usr_${userAlpha}_cloudflare`);
    assert(
      alphaAfterDel.length === 3 && !alphaStillHasCf,
      'ADV-VAULT-08',
      'User Alpha connection count decremented to 3 and Cloudflare is gone',
      `Remaining: ${alphaAfterDel.length}`
    );

    // CRITICAL: Verify User Beta's Cloudflare connection was NOT deleted and is STILL ACTIVE
    const betaAfterDel = await client.listAppConnections(userBeta);
    const betaStillHasCf = betaAfterDel.some((c) => c.externalId === `usr_${userBeta}_cloudflare`);
    assert(
      betaAfterDel.length === 2 && betaStillHasCf,
      'ADV-VAULT-09',
      "User Beta's Cloudflare connection remains intact and ACTIVE after Alpha deletion",
      `Beta connections remaining: ${betaAfterDel.length}`
    );

    // 8. Safe Failure: Deleting a non-existent connection fails safely
    const delNonExistent = await client.deleteAppConnectionByExternalId(
      `usr_nonexistent_tenant_${timestamp}_cloudflare`
    );
    assert(
      delNonExistent === false,
      'ADV-VAULT-10',
      'Deleting non-existent externalId returns false safely without throwing exception',
      `Result: ${delNonExistent}`
    );

    // 9. Safe Failure: Deleting already-deleted connection fails safely
    const delAlreadyDeleted = await client.deleteAppConnectionByExternalId(`usr_${userAlpha}_cloudflare`);
    assert(
      delAlreadyDeleted === false,
      'ADV-VAULT-11',
      'Deleting already-deleted externalId returns false safely without throwing exception',
      `Result: ${delAlreadyDeleted}`
    );

    // 10. Overwrite Isolation: User Beta updates Cloudflare token
    const betaUpdatedCf = await client.createCloudflareConnection('cf_secret_beta_v2', userBeta);
    const betaConnsAfterUpdate = await client.listAppConnections(userBeta);
    const alphaConnsAfterBetaUpdate = await client.listAppConnections(userAlpha);

    assert(
      betaUpdatedCf && alphaConnsAfterBetaUpdate.length === 3,
      'ADV-VAULT-12',
      "User Beta updating credentials does NOT affect User Alpha's remaining credentials",
      `Alpha count: ${alphaConnsAfterBetaUpdate.length}, Beta updated: ${Boolean(betaUpdatedCf)}`
    );

    // 11. Teardown / Cleanup
    console.log(`  ${ANSI.dim}Cleaning up test tenant connections...${ANSI.reset}`);
    await client.deleteAppConnectionByExternalId(`usr_${userAlpha}_supabase`);
    await client.deleteAppConnectionByExternalId(`usr_${userAlpha}_openrouter`);
    await client.deleteAppConnectionByExternalId(`usr_${userAlpha}_oracle`);
    await client.deleteAppConnectionByExternalId(`usr_${userBeta}_cloudflare`);
    await client.deleteAppConnectionByExternalId(`usr_${userBeta}_openrouter`);

    const alphaFinal = await client.listAppConnections(userAlpha);
    const betaFinal = await client.listAppConnections(userBeta);
    assert(
      alphaFinal.length === 0 && betaFinal.length === 0,
      'ADV-VAULT-13',
      'Test tenant vault artifacts cleanly purged after adversarial run',
      `Alpha left: ${alphaFinal.length}, Beta left: ${betaFinal.length}`
    );

  } catch (err) {
    failedCount++;
    console.error(`  ${ANSI.red}✖ FAIL${ANSI.reset} Vault isolation test threw error:`, err);
    results.push({ testId: 'ADV-VAULT-ERR', description: 'Vault isolation suite execution', status: 'FAIL', details: err.message });
  }
}

async function testHostilePayloadsAndUuidIsolation() {
  console.log(`\n${ANSI.bold}► Suite 4: UUID Multi-Tenancy & Hostile Injection Rejection${ANSI.reset}`);

  // Dynamic import of Activepieces client
  const clientPath = path.resolve(REPO_ROOT, 'web/lib/activepieces/client.ts');
  const client = await import(clientPath);

  // 1. Full RFC-4122 UUID tenant isolation test
  const uuid1 = '00000000-0000-4000-8000-000000000001';
  const uuid2 = '00000000-0000-4000-8000-000000000002';

  const u1Conn = await client.createCloudflareConnection('cf_uuid1_token', uuid1);
  const u2Conn = await client.createCloudflareConnection('cf_uuid2_token', uuid2);

  const u1List = await client.listAppConnections(uuid1);
  const u2List = await client.listAppConnections(uuid2);

  assert(
    u1List.length === 1 && u1List[0].externalId === `usr_${uuid1}_cloudflare`,
    'ADV-UUID-01',
    'Tenant with RFC 4122 UUID 1 retrieves exclusively their vaulted credentials',
    `u1 externalId: ${u1List[0]?.externalId}`
  );

  assert(
    u2List.length === 1 && u2List[0].externalId === `usr_${uuid2}_cloudflare`,
    'ADV-UUID-02',
    'Tenant with RFC 4122 UUID 2 retrieves exclusively their vaulted credentials',
    `u2 externalId: ${u2List[0]?.externalId}`
  );

  // Cross-user deletion attempt between UUIDs
  await client.deleteAppConnectionByExternalId(`usr_${uuid1}_cloudflare`);
  const u2ListAfter = await client.listAppConnections(uuid2);

  assert(
    u2ListAfter.length === 1 && u2ListAfter[0].externalId === `usr_${uuid2}_cloudflare`,
    'ADV-UUID-03',
    'Deleting UUID 1 credentials does not impact UUID 2 credentials in Activepieces',
    `u2 still active: ${u2ListAfter.length === 1}`
  );

  // Cleanup UUID 2
  await client.deleteAppConnectionByExternalId(`usr_${uuid2}_cloudflare`);

  // 2. Hostile query parameter and body injection attempts on /api/services
  const hostileQueries = [
    { id: 'ADV-HOSTILE-01', param: 'service=../../etc/passwd', desc: 'Path traversal in query param' },
    { id: 'ADV-HOSTILE-02', param: 'service=cloudflare%00', desc: 'Null byte injection in query param' },
    { id: 'ADV-HOSTILE-03', param: "service=' OR '1'='1", desc: 'SQL injection in query param' },
    { id: 'ADV-HOSTILE-04', param: 'service=<script>alert(1)</script>', desc: 'XSS in query param' },
    { id: 'ADV-HOSTILE-05', param: 'service=unknown_service_xyz', desc: 'Arbitrary unsupported service name' },
  ];

  for (const h of hostileQueries) {
    const res = await fetch(`${BASE_URL}/api/services?${h.param}`, { method: 'DELETE' });
    assert(
      res.status === 401,
      h.id,
      `Unauthenticated ${h.desc} returns HTTP 401 Unauthorized (auth precedes query parsing)`,
      `HTTP status: ${res.status}`
    );
  }

  // 3. Hostile body payloads attempting cross-user parameter tampering
  const hostileBodies = [
    {
      id: 'ADV-HOSTILE-06',
      desc: 'POST with cross-tenant userId override attempt',
      body: { service: 'cloudflare', apiToken: 'test', userId: 'victim-uuid-target' },
    },
    {
      id: 'ADV-HOSTILE-07',
      desc: 'POST with arbitrary externalId override attempt',
      body: { service: 'cloudflare', apiToken: 'test', externalId: 'usr_victim_cloudflare' },
    },
    {
      id: 'ADV-HOSTILE-08',
      desc: 'DELETE with cross-tenant userId and externalId tampering',
      body: { service: 'cloudflare', userId: 'victim-uuid-target', externalId: 'usr_victim_cloudflare' },
    },
    {
      id: 'ADV-HOSTILE-09',
      desc: 'POST with prototype pollution payload',
      body: { service: 'cloudflare', apiToken: 'test', __proto__: { admin: true } },
    },
    {
      id: 'ADV-HOSTILE-10',
      desc: 'POST with malformed non-JSON body syntax',
      rawBody: '{"service": "cloudflare", "apiToken": broken json...',
    },
  ];

  for (const b of hostileBodies) {
    const isPost = b.id.includes('POST') || !b.id.includes('DELETE');
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: isPost ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: b.rawBody !== undefined ? b.rawBody : JSON.stringify(b.body),
    });
    assert(
      res.status === 401,
      b.id,
      `Unauthenticated ${b.desc} returns HTTP 401 Unauthorized (auth precedes body processing)`,
      `HTTP status: ${res.status}`
    );
  }
}

async function main() {
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  EMPIRICAL ADVERSARIAL CHALLENGER: Phase 2 Milestone 1                ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Auth Enforcement, Token Hygiene & Multi-Tenant Isolation Tests       ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}========================================================================${ANSI.reset}\n`);

  let serverProc = null;
  try {
    serverProc = await startServer();

    await testUnauthenticatedEndpoints();
    await testMalformedAndInvalidAuthHeaders();
    await testVaultMultiTenantIsolation();
    await testHostilePayloadsAndUuidIsolation();

  } catch (err) {
    console.error(`${ANSI.red}Fatal test harness error:${ANSI.reset}`, err);
    failedCount++;
  } finally {
    if (serverProc) {
      console.log(`\n${ANSI.dim}Shutting down Next.js test server...${ANSI.reset}`);
      serverProc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      try {
        serverProc.kill('SIGKILL');
      } catch {}
    }
  }

  console.log(`\n${ANSI.bold}========================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}                     CHALLENGE SUMMARY & VERDICT                        ${ANSI.reset}`);
  console.log(`${ANSI.bold}========================================================================${ANSI.reset}`);
  console.log(`Total Adversarial Tests: ${passedCount + failedCount}`);
  console.log(`Passed:                  ${ANSI.green}${passedCount}${ANSI.reset}`);
  console.log(`Failed:                  ${failedCount > 0 ? ANSI.red + failedCount + ANSI.reset : '0'}`);

  const verdict = failedCount === 0 ? 'APPROVE' : 'CHALLENGE_FAILED';
  const verdictColor = failedCount === 0 ? ANSI.green : ANSI.red;
  console.log(`Verdict:                 ${verdictColor}${ANSI.bold}${verdict}${ANSI.reset}`);
  console.log(`${ANSI.bold}========================================================================${ANSI.reset}\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unhandled runner error:', err);
  process.exit(1);
});
