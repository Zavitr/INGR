/**
 * Tier 1: Feature F6 - Frontend Build & Typecheck Resolution
 * Authoritative source: ORIGINAL_REQUEST.md (R2 Acceptance Criteria), PROJECT.md (Feature F6)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes, assertNotIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F6 Frontend Build & Typecheck', 'Tier 1', 'F6');

export async function runF6Tests() {
  await registry.runTest('F6-01: Root layout does not fetch Google Fonts over network during build', async () => {
    const layoutPath = path.join(WEB_ROOT, 'app/layout.tsx');
    assert(fs.existsSync(layoutPath), 'web/app/layout.tsx must exist');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    assertNotIncludes(content, 'next/font/google', 'Root layout must not import next/font/google to prevent build network failures');
  });

  await registry.runTest('F6-02: web/app/api/services/route.ts imports createCloudflareConnection', async () => {
    const routePath = path.join(WEB_ROOT, 'app/api/services/route.ts');
    assert(fs.existsSync(routePath), 'web/app/api/services/route.ts must exist');
    const content = fs.readFileSync(routePath, 'utf-8');
    assertIncludes(content, 'createCloudflareConnection', 'route.ts must import createCloudflareConnection to prevent TS2304');
  });

  await registry.runTest('F6-03: TypeScript compiler check passes with zero errors', async () => {
    const nodeBin = '/home/zavitr/.nvm/versions/node/v22.22.3/bin';
    const cmd = `export PATH=$PATH:${nodeBin} && cd "${WEB_ROOT}" && ./node_modules/.bin/tsc --noEmit`;
    const out = execSync(cmd, { encoding: 'utf-8' });
    assertEqual(out.trim(), '', 'TypeScript check must produce no errors');
  });

  await registry.runTest('F6-04: ESLint passes cleanly on app, components, and lib', async () => {
    const nodeBin = '/home/zavitr/.nvm/versions/node/v22.22.3/bin';
    const cmd = `export PATH=$PATH:${nodeBin} && cd "${WEB_ROOT}" && ./node_modules/.bin/eslint app components lib`;
    const out = execSync(cmd, { encoding: 'utf-8' });
    assertNotIncludes(out, 'error', 'ESLint must produce 0 errors');
  });

  await registry.runTest('F6-05: Next.js production build succeeds with exit code 0', async () => {
    const nodeBin = '/home/zavitr/.nvm/versions/node/v22.22.3/bin';
    const cmd = `export PATH=$PATH:${nodeBin} && cd "${WEB_ROOT}" && npm run build`;
    const out = execSync(cmd, { encoding: 'utf-8' });
    assertIncludes(out, 'Compiled successfully', 'Next.js build output must show successful compilation');
  });
}

if (process.argv[1]?.endsWith('test_f6_build.mjs')) {
  runF6Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
