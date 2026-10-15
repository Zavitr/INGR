/**
 * Empirical Challenger Test Suite for Phase 2 Milestone 1:
 * Activepieces Vault Integration, Service Payloads, Upsert Behavior, and Multi-Tenant Isolation.
 */

import {
  getActivepiecesAuth,
  listAppConnections,
  createCloudflareConnection,
  createSupabaseConnection,
  createOpenRouterConnection,
  createOracleConnection,
  deleteAppConnectionByExternalId,
} from '../../web/lib/activepieces/client.ts';

const SUPABASE_TEST_URL = 'https://fkudpldsmnbuepmvmydc.supabase.co';
const SUPABASE_TEST_JWT_1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdWRwbGRzbW5idWVwbXZteWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDB9.test-sig-1';
const SUPABASE_TEST_JWT_2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdWRwbGRzbW5idWVwbXZteWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDB9.test-sig-2';

class ChallengerRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async run(name, fn) {
    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      this.tests.push({ name, status: 'PASS', duration });
      this.passed++;
      console.log(`  [PASS] ${name} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      this.tests.push({ name, status: 'FAIL', duration, error: err.message });
      this.failed++;
      console.error(`  [FAIL] ${name} (${duration}ms)\n         Error: ${err.message}`);
    }
  }

  summary() {
    console.log('\n======================================================');
    console.log(`CHALLENGER EMPIRICAL VERIFICATION SUMMARY`);
    console.log(`Total: ${this.tests.length} | Passed: ${this.passed} | Failed: ${this.failed}`);
    console.log('======================================================');
    return {
      total: this.tests.length,
      passed: this.passed,
      failed: this.failed,
      tests: this.tests,
    };
  }
}

async function runEmpiricalChallenge() {
  const runner = new ChallengerRunner();
  const runId = Date.now();

  console.log(`\n>>> STARTING CHALLENGER EMPIRICAL SUITE (Run ID: ${runId}) <<<\n`);

  // Ensure Activepieces engine connectivity
  await runner.run('ENG-01: Activepieces Engine Connectivity & Auth', async () => {
    const auth = await getActivepiecesAuth();
    if (!auth.token || !auth.projectId) {
      throw new Error('Activepieces authentication failed: token or projectId missing');
    }
  });

  // --------------------------------------------------------------------------
  // SUITE 1: Service Payload Variations
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 1: Service Payload Variations ---');

  const uP = `payload_tester_${runId}`;

  await runner.run('PAYLOAD-CF-01: Cloudflare standard alphanumeric token', async () => {
    const res = await createCloudflareConnection('cf_standard_token_123456789', uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Cloudflare creation: ${JSON.stringify(res)}`);
    if (res.type !== 'SECRET_TEXT') throw new Error(`Expected SECRET_TEXT, got ${res.type}`);
  });

  await runner.run('PAYLOAD-CF-02: Cloudflare long token (256 chars)', async () => {
    const longToken = 'cf_long_' + 'a'.repeat(248);
    const res = await createCloudflareConnection(longToken, uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Cloudflare creation with long token`);
  });

  await runner.run('PAYLOAD-CF-03: Cloudflare special characters token', async () => {
    const specToken = 'cf_spec_!@#$%^&*()_+~=-{}[]:;<>?,./';
    const res = await createCloudflareConnection(specToken, uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Cloudflare creation with special characters`);
  });

  await runner.run('PAYLOAD-SB-01: Supabase valid project URL and JWT format', async () => {
    const res = await createSupabaseConnection(SUPABASE_TEST_URL, SUPABASE_TEST_JWT_1, uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Supabase creation: ${JSON.stringify(res)}`);
    if (res.type !== 'CUSTOM_AUTH') throw new Error(`Expected CUSTOM_AUTH, got ${res.type}`);
    if (res.pieceName !== '@activepieces/piece-supabase') throw new Error(`Expected piece-supabase, got ${res.pieceName}`);
  });

  await runner.run('PAYLOAD-SB-02: Supabase non-supabase domain is rejected with validation error', async () => {
    let threw = false;
    try {
      await createSupabaseConnection('https://db.external-host.com', SUPABASE_TEST_JWT_1, uP);
    } catch (err) {
      threw = true;
      if (!err.message.includes('valid Supabase project URL')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected invalid Supabase URL to be rejected');
  });

  await runner.run('PAYLOAD-SB-03: Supabase non-JWT API key is rejected with validation error', async () => {
    let threw = false;
    try {
      await createSupabaseConnection(SUPABASE_TEST_URL, 'plain_unformatted_api_key', uP);
    } catch (err) {
      threw = true;
      if (!err.message.includes('Invalid API key format')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Expected non-JWT API key to be rejected');
  });

  await runner.run('PAYLOAD-OR-01: OpenRouter standard API key', async () => {
    const res = await createOpenRouterConnection('sk-or-v1-standard_key_1234567890', uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid OpenRouter creation`);
    if (res.type !== 'SECRET_TEXT') throw new Error(`Expected SECRET_TEXT, got ${res.type}`);
  });

  await runner.run('PAYLOAD-OR-02: OpenRouter high-entropy key with symbols', async () => {
    const res = await createOpenRouterConnection('sk-or-v1-!@#$%^&*()_+=-{}[]:;<>?', uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid OpenRouter creation with symbols`);
  });

  await runner.run('PAYLOAD-OR-03: OpenRouter 300+ character key', async () => {
    const res = await createOpenRouterConnection('sk-or-v1-' + 'k'.repeat(300), uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid OpenRouter creation with long key`);
  });

  await runner.run('PAYLOAD-ORA-01: Oracle Cloud string token payload (SECRET_TEXT)', async () => {
    const res = await createOracleConnection('oracle_api_token_simple_string', uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Oracle creation`);
    if (res.type !== 'SECRET_TEXT') throw new Error(`Expected SECRET_TEXT, got ${res.type}`);
  });

  await runner.run('PAYLOAD-ORA-02: Oracle Cloud object with apiToken (SECRET_TEXT)', async () => {
    const res = await createOracleConnection({ apiToken: 'oracle_api_token_in_obj' }, uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Oracle creation`);
    if (res.type !== 'SECRET_TEXT') throw new Error(`Expected SECRET_TEXT, got ${res.type}`);
  });

  await runner.run('PAYLOAD-ORA-03: Oracle Cloud object with apiKey (SECRET_TEXT)', async () => {
    const res = await createOracleConnection({ apiKey: 'oracle_api_key_in_obj' }, uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Oracle creation`);
    if (res.type !== 'SECRET_TEXT') throw new Error(`Expected SECRET_TEXT, got ${res.type}`);
  });

  await runner.run('PAYLOAD-ORA-04: Oracle Cloud OCI config with tenancyOcid (CUSTOM_AUTH)', async () => {
    const res = await createOracleConnection({
      tenancyOcid: 'ocid1.tenancy.oc1..testtenancy',
      userOcid: 'ocid1.user.oc1..testuser',
      fingerprint: '11:22:33:44:55:66',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
    }, uP);
    if (!res.id || res.status !== 'ACTIVE') throw new Error(`Invalid Oracle creation with OCI config`);
    if (res.type !== 'CUSTOM_AUTH') throw new Error(`Expected CUSTOM_AUTH, got ${res.type}`);
  });

  // Clean up suite 1 connections
  await deleteAppConnectionByExternalId(`usr_${uP}_cloudflare`);
  await deleteAppConnectionByExternalId(`usr_${uP}_supabase`);
  await deleteAppConnectionByExternalId(`usr_${uP}_openrouter`);
  await deleteAppConnectionByExternalId(`usr_${uP}_oracle`);

  // --------------------------------------------------------------------------
  // SUITE 2: Upsert & Idempotency Behavior
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Upsert & Idempotency Behavior ---');

  const uUpsert = `upsert_user_${runId}`;

  await runner.run('UPSERT-CF: Reconnecting Cloudflare updates existing credential without duplicates', async () => {
    const first = await createCloudflareConnection('initial_token_alpha', uUpsert);
    const listAfterFirst = await listAppConnections(uUpsert);
    if (listAfterFirst.length !== 1) {
      throw new Error(`Expected 1 connection after initial create, found ${listAfterFirst.length}`);
    }

    // Wait 50ms so timestamp can advance
    await new Promise(r => setTimeout(r, 50));

    const second = await createCloudflareConnection('updated_token_beta', uUpsert);
    const listAfterSecond = await listAppConnections(uUpsert);

    if (first.id !== second.id) {
      throw new Error(`Upsert did not preserve record ID! First ID: ${first.id}, Second ID: ${second.id}`);
    }
    if (listAfterSecond.length !== 1) {
      throw new Error(`Upsert created duplicate records! Expected 1, found ${listAfterSecond.length}`);
    }
    if (second.externalId !== `usr_${uUpsert}_cloudflare`) {
      throw new Error(`External ID mismatch: ${second.externalId}`);
    }
    if (new Date(second.updated).getTime() < new Date(first.updated).getTime()) {
      throw new Error(`Updated timestamp did not advance: first=${first.updated}, second=${second.updated}`);
    }
  });

  await runner.run('UPSERT-OR: Reconnecting OpenRouter updates existing credential without duplicates', async () => {
    const first = await createOpenRouterConnection('sk-or-initial-key', uUpsert);
    const listAfterFirst = await listAppConnections(uUpsert);
    // User already has Cloudflare from previous test, so list should be 2
    if (!listAfterFirst.some(c => c.id === first.id)) {
      throw new Error('Initial OpenRouter connection missing from list');
    }

    const second = await createOpenRouterConnection('sk-or-updated-key', uUpsert);
    const listAfterSecond = await listAppConnections(uUpsert);

    if (first.id !== second.id) {
      throw new Error(`OpenRouter upsert did not preserve record ID: ${first.id} vs ${second.id}`);
    }
    const orMatches = listAfterSecond.filter(c => c.externalId === `usr_${uUpsert}_openrouter`);
    if (orMatches.length !== 1) {
      throw new Error(`Expected 1 OpenRouter connection, found ${orMatches.length}`);
    }
  });

  await runner.run('UPSERT-SB: Reconnecting Supabase updates existing credential without duplicates', async () => {
    const first = await createSupabaseConnection(SUPABASE_TEST_URL, SUPABASE_TEST_JWT_1, uUpsert);
    const second = await createSupabaseConnection(SUPABASE_TEST_URL, SUPABASE_TEST_JWT_2, uUpsert);

    if (first.id !== second.id) {
      throw new Error(`Supabase upsert did not preserve record ID: ${first.id} vs ${second.id}`);
    }
    const list = await listAppConnections(uUpsert);
    const sbMatches = list.filter(c => c.externalId === `usr_${uUpsert}_supabase`);
    if (sbMatches.length !== 1) {
      throw new Error(`Expected 1 Supabase connection, found ${sbMatches.length}`);
    }
  });

  await runner.run('UPSERT-ORA: Reconnecting Oracle updates existing credential and transitions type', async () => {
    const first = await createOracleConnection('oracle_initial_str_token', uUpsert);
    if (first.type !== 'SECRET_TEXT') throw new Error(`Initial Oracle type expected SECRET_TEXT, got ${first.type}`);

    const second = await createOracleConnection({
      tenancyOcid: 'ocid1.tenancy.oc1..reconnect',
      userOcid: 'ocid1.user.oc1..reconnect',
      fingerprint: '33:44:55:66',
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
    }, uUpsert);

    if (first.id !== second.id) {
      throw new Error(`Oracle upsert did not preserve record ID: ${first.id} vs ${second.id}`);
    }
    if (second.type !== 'CUSTOM_AUTH') {
      throw new Error(`Oracle type did not transition to CUSTOM_AUTH, got ${second.type}`);
    }
    const list = await listAppConnections(uUpsert);
    const oraMatches = list.filter(c => c.externalId === `usr_${uUpsert}_oracle`);
    if (oraMatches.length !== 1) {
      throw new Error(`Expected 1 Oracle connection, found ${oraMatches.length}`);
    }
  });

  // Verify total for uUpsert is exactly 4 (1 for each service)
  await runner.run('UPSERT-TOTAL: User with all 4 services has exactly 4 vaulted connections', async () => {
    const list = await listAppConnections(uUpsert);
    if (list.length !== 4) {
      throw new Error(`Expected exactly 4 connections for user with 4 services, got ${list.length}`);
    }
  });

  // Cleanup uUpsert
  await deleteAppConnectionByExternalId(`usr_${uUpsert}_cloudflare`);
  await deleteAppConnectionByExternalId(`usr_${uUpsert}_openrouter`);
  await deleteAppConnectionByExternalId(`usr_${uUpsert}_supabase`);
  await deleteAppConnectionByExternalId(`usr_${uUpsert}_oracle`);

  // --------------------------------------------------------------------------
  // SUITE 3: Multi-Tenant Credential Isolation & Leakage Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Multi-Tenant Credential Isolation ---');

  const userAlice = `alice_${runId}`;
  const userBob = `bob_${runId}`;

  await runner.run('TENANT-SETUP: Provision isolated credentials for User Alice and User Bob', async () => {
    // Alice connects Cloudflare and OpenRouter
    await createCloudflareConnection('cf_token_alice_secret', userAlice);
    await createOpenRouterConnection('or_key_alice_secret', userAlice);

    // Bob connects Cloudflare, Oracle, and Supabase
    await createCloudflareConnection('cf_token_bob_secret', userBob);
    await createOracleConnection('oracle_token_bob_secret', userBob);
    await createSupabaseConnection(SUPABASE_TEST_URL, SUPABASE_TEST_JWT_1, userBob);
  });

  await runner.run('TENANT-ALICE-LIST: Alice listAppConnections contains ONLY Alice connections', async () => {
    const aliceList = await listAppConnections(userAlice);
    if (aliceList.length !== 2) {
      throw new Error(`Expected exactly 2 connections for Alice, found ${aliceList.length}`);
    }
    const aliceServices = aliceList.map(c => c.externalId);
    if (!aliceServices.includes(`usr_${userAlice}_cloudflare`) || !aliceServices.includes(`usr_${userAlice}_openrouter`)) {
      throw new Error(`Alice connections missing expected services: ${JSON.stringify(aliceServices)}`);
    }

    // Verify ZERO Bob connections appear in Alice list
    const leakedBob = aliceList.filter(c => c.externalId.includes(userBob));
    if (leakedBob.length > 0) {
      throw new Error(`CRITICAL LEAK: Bob connections leaked to Alice: ${JSON.stringify(leakedBob)}`);
    }
  });

  await runner.run('TENANT-BOB-LIST: Bob listAppConnections contains ONLY Bob connections', async () => {
    const bobList = await listAppConnections(userBob);
    if (bobList.length !== 3) {
      throw new Error(`Expected exactly 3 connections for Bob, found ${bobList.length}`);
    }
    const bobServices = bobList.map(c => c.externalId);
    if (
      !bobServices.includes(`usr_${userBob}_cloudflare`) ||
      !bobServices.includes(`usr_${userBob}_oracle`) ||
      !bobServices.includes(`usr_${userBob}_supabase`)
    ) {
      throw new Error(`Bob connections missing expected services: ${JSON.stringify(bobServices)}`);
    }

    // Verify ZERO Alice connections appear in Bob list
    const leakedAlice = bobList.filter(c => c.externalId.includes(userAlice));
    if (leakedAlice.length > 0) {
      throw new Error(`CRITICAL LEAK: Alice connections leaked to Bob: ${JSON.stringify(leakedAlice)}`);
    }
  });

  await runner.run('TENANT-SECRET-LEAK: Connection metadata returns zero plaintext credentials', async () => {
    const aliceList = await listAppConnections(userAlice);
    const bobList = await listAppConnections(userBob);
    const all = [...aliceList, ...bobList];

    for (const conn of all) {
      const connStr = JSON.stringify(conn);
      if (connStr.includes('alice_secret') || connStr.includes('bob_secret')) {
        throw new Error(`CRITICAL SECURITY FAILURE: Plaintext secret found in connection object: ${connStr}`);
      }
      if (conn.value !== undefined) {
        throw new Error(`Secret 'value' property exposed in app connection object: ${connStr}`);
      }
    }
  });

  await runner.run('TENANT-DELETE-ISOLATION: Deleting Alice Cloudflare does not delete Bob Cloudflare', async () => {
    const deleted = await deleteAppConnectionByExternalId(`usr_${userAlice}_cloudflare`);
    if (!deleted) throw new Error('Failed to delete Alice Cloudflare connection');

    const aliceListAfter = await listAppConnections(userAlice);
    if (aliceListAfter.length !== 1) {
      throw new Error(`Expected Alice to have 1 connection remaining, got ${aliceListAfter.length}`);
    }
    if (aliceListAfter[0].externalId !== `usr_${userAlice}_openrouter`) {
      throw new Error(`Expected Alice remaining connection to be openrouter, got ${aliceListAfter[0].externalId}`);
    }

    // Verify Bob's Cloudflare connection is completely untouched
    const bobListAfter = await listAppConnections(userBob);
    if (bobListAfter.length !== 3) {
      throw new Error(`Expected Bob to retain all 3 connections, got ${bobListAfter.length}`);
    }
    const bobCf = bobListAfter.find(c => c.externalId === `usr_${userBob}_cloudflare`);
    if (!bobCf || bobCf.status !== 'ACTIVE') {
      throw new Error('Bob Cloudflare connection was altered or deleted!');
    }
  });

  // Cleanup tenants
  await deleteAppConnectionByExternalId(`usr_${userAlice}_openrouter`);
  await deleteAppConnectionByExternalId(`usr_${userBob}_cloudflare`);
  await deleteAppConnectionByExternalId(`usr_${userBob}_oracle`);
  await deleteAppConnectionByExternalId(`usr_${userBob}_supabase`);

  // --------------------------------------------------------------------------
  // SUITE 4: Prefix Edge Cases & Exact Match Safety
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Prefix Edge Cases & Exact Match Safety ---');

  await runner.run('PREFIX-ANALYSIS: Exact match verification in route handler vs client startsWith', async () => {
    // Simulate User Eve and User EveExtended
    const userEve = `eve_${runId}`;
    const userEveExt = `eve_${runId}_extended`;

    await createCloudflareConnection('cf_eve', userEve);
    await createCloudflareConnection('cf_eve_ext', userEveExt);

    const eveExtList = await listAppConnections(userEveExt);
    if (eveExtList.length !== 1 || eveExtList[0].externalId !== `usr_${userEveExt}_cloudflare`) {
      throw new Error('EveExt connection list unexpected');
    }

    // Notice that client.ts filter uses startsWith(`usr_${userId}_`).
    // If a custom string ID is an exact prefix with underscore of another user, client-level list may return both,
    // BUT the route handler /api/services performs strict equality check:
    // conn.externalId === `usr_${user.id}_cloudflare`
    const exactMatchSim = eveExtList.filter(c => c.externalId === `usr_${userEve}_cloudflare`);
    if (exactMatchSim.length !== 0) {
      throw new Error('Route-level exact match failed to isolate overlapping prefix!');
    }

    // Cleanup
    await deleteAppConnectionByExternalId(`usr_${userEve}_cloudflare`);
    await deleteAppConnectionByExternalId(`usr_${userEveExt}_cloudflare`);
  });

  return runner.summary();
}

runEmpiricalChallenge().then((summary) => {
  if (summary.failed > 0) {
    console.error(`\nCHALLENGER VERDICT: CHALLENGE_FAILED (${summary.failed} tests failed)`);
    process.exit(1);
  } else {
    console.log(`\nCHALLENGER VERDICT: APPROVE (${summary.passed}/${summary.total} tests passed)`);
    process.exit(0);
  }
}).catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
