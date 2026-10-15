/**
 * Tier 1: Feature F5 - Engine Configuration Hygiene
 * Authoritative source: Survey Findings, PROJECT.md (Feature F5)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { ENGINE_ROOT, WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F5 Engine Configuration Hygiene', 'Tier 1', 'F5');

export async function runF5Tests() {
  await registry.runTest('F5-01: engine/.env.example exists with complete template variables', async () => {
    const envExamplePath = path.join(ENGINE_ROOT, '.env.example');
    assert(fs.existsSync(envExamplePath), 'engine/.env.example must exist');
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    assertIncludes(content, 'AP_ENCRYPTION_KEY=', 'Must document AP_ENCRYPTION_KEY');
    assertIncludes(content, 'AP_JWT_SECRET=', 'Must document AP_JWT_SECRET');
    assertIncludes(content, 'AP_FRONTEND_URL=', 'Must document AP_FRONTEND_URL');
    assertIncludes(content, 'AP_POSTGRES_PASSWORD=', 'Must document AP_POSTGRES_PASSWORD');
    assertIncludes(content, 'AP_REDIS_HOST=', 'Must document AP_REDIS_HOST');
  });

  await registry.runTest('F5-02: docker-compose.yml pins Activepieces version to 0.82.0', async () => {
    const composePath = path.join(ENGINE_ROOT, 'docker-compose.yml');
    assert(fs.existsSync(composePath), 'docker-compose.yml must exist');
    const content = fs.readFileSync(composePath, 'utf-8');
    assertIncludes(content, 'activepieces/activepieces:0.82.0', 'Activepieces image must be pinned to :0.82.0');
  });

  await registry.runTest('F5-03: docker-compose.yml pins Postgres and Redis alpine images', async () => {
    const composePath = path.join(ENGINE_ROOT, 'docker-compose.yml');
    const content = fs.readFileSync(composePath, 'utf-8');
    assertIncludes(content, 'postgres:15-alpine', 'Postgres image must be pinned to 15-alpine');
    assertIncludes(content, 'redis:7-alpine', 'Redis image must be pinned to 7-alpine');
  });

  await registry.runTest('F5-04: web/.env.example includes Activepieces engine configurations', async () => {
    const webEnvExample = path.join(WEB_ROOT, '.env.example');
    assert(fs.existsSync(webEnvExample), 'web/.env.example must exist');
    const content = fs.readFileSync(webEnvExample, 'utf-8');
    assertIncludes(content, 'ACTIVEPIECES_API_URL=', 'Must document ACTIVEPIECES_API_URL');
    assertIncludes(content, 'ACTIVEPIECES_ADMIN_EMAIL=', 'Must document ACTIVEPIECES_ADMIN_EMAIL');
    assertIncludes(content, 'ACTIVEPIECES_ADMIN_PASSWORD=', 'Must document ACTIVEPIECES_ADMIN_PASSWORD');
  });

  await registry.runTest('F5-05: engine/.env AES-256 encryption key satisfies minimum length', async () => {
    const envPath = path.join(ENGINE_ROOT, '.env');
    assert(fs.existsSync(envPath), 'engine/.env must exist');
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/AP_ENCRYPTION_KEY=([^\s]+)/);
    assert(match !== null, 'engine/.env must contain AP_ENCRYPTION_KEY');
    const key = match[1];
    assert(key.length >= 32, `AP_ENCRYPTION_KEY must be >= 32 characters, got ${key.length}`);
  });
}

if (process.argv[1]?.endsWith('test_f5_hygiene.mjs')) {
  runF5Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
