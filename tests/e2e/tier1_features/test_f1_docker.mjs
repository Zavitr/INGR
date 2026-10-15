/**
 * Tier 1: Feature F1 - Docker Orchestration & Service Health
 * Authoritative source: ORIGINAL_REQUEST.md (R1), MASTER_PLAN.md (Part 3, Part 7 Phase 0)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { ENGINE_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F1 Docker Orchestration', 'Tier 1', 'F1');

export async function runF1Tests() {
  await registry.runTest('F1-01: Activepieces container is running', async () => {
    const psOut = execSync('docker ps --filter "name=ingr_activepieces" --format "{{.Names}}\t{{.Status}}"', { encoding: 'utf-8' });
    assertIncludes(psOut, 'ingr_activepieces', 'Container ingr_activepieces must be present in running containers');
    assertIncludes(psOut, 'Up', 'ingr_activepieces status must be Up');
  });

  await registry.runTest('F1-02: PostgreSQL container is running and healthy', async () => {
    const psOut = execSync('docker ps --filter "name=ingr_postgres" --format "{{.Names}}\t{{.Status}}"', { encoding: 'utf-8' });
    assertIncludes(psOut, 'ingr_postgres', 'Container ingr_postgres must be running');
    assertIncludes(psOut, 'healthy', 'ingr_postgres status must be healthy via pg_isready');
  });

  await registry.runTest('F1-03: Redis container is running', async () => {
    const psOut = execSync('docker ps --filter "name=ingr_redis" --format "{{.Names}}\t{{.Status}}"', { encoding: 'utf-8' });
    assertIncludes(psOut, 'ingr_redis', 'Container ingr_redis must be running');
    assertIncludes(psOut, 'Up', 'ingr_redis status must be Up');
  });

  await registry.runTest('F1-04: Activepieces port 8080 binding is verified', async () => {
    const portOut = execSync('docker port ingr_activepieces 80', { encoding: 'utf-8' });
    assertIncludes(portOut, '8080', 'Container port 80 must map to host port 8080');
  });

  await registry.runTest('F1-05: Docker Compose defines all 3 services with persistence', async () => {
    const composePath = path.join(ENGINE_ROOT, 'docker-compose.yml');
    assert(fs.existsSync(composePath), 'docker-compose.yml must exist in engine/');
    const content = fs.readFileSync(composePath, 'utf-8');
    assertIncludes(content, 'activepieces:', 'Compose file must define activepieces service');
    assertIncludes(content, 'postgres:', 'Compose file must define postgres service');
    assertIncludes(content, 'redis:', 'Compose file must define redis service');
    assertIncludes(content, 'activepieces_data:', 'Compose file must declare activepieces_data volume');
    assertIncludes(content, 'postgres_data:', 'Compose file must declare postgres_data volume');
  });
}

if (process.argv[1]?.endsWith('test_f1_docker.mjs')) {
  runF1Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
