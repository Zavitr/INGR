/**
 * Tier 1: Feature F13 - Crisp Chat Widget Integration
 * Authoritative source: ORIGINAL_REQUEST.md (R2), MASTER_PLAN.md (Part 3, Part 7 Phase 1), PROJECT.md (Feature F13)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F13 Crisp Chat Widget', 'Tier 1', 'F13');

export async function runF13Tests() {
  const crispComponentPath = path.join(WEB_ROOT, 'components/crisp-chat.tsx');
  const layoutPath = path.join(WEB_ROOT, 'app/protected/layout.tsx');

  await registry.runTest('F13-01: Crisp chat client component file exists', async () => {
    assert(fs.existsSync(crispComponentPath), 'web/components/crisp-chat.tsx must exist');
    const content = fs.readFileSync(crispComponentPath, 'utf-8');
    assertIncludes(content, '"use client"', 'Crisp component must be a client component ("use client")');
  });

  await registry.runTest('F13-02: Crisp chat component is mounted in protected layout', async () => {
    assert(fs.existsSync(layoutPath), 'web/app/protected/layout.tsx must exist');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    assert(
      content.includes('CrispChat') || content.includes('crisp-chat') || content.includes('Crisp'),
      'Protected layout must import and render CrispChat component'
    );
  });

  await registry.runTest('F13-03: Component reads NEXT_PUBLIC_CRISP_WEBSITE_ID environment variable', async () => {
    assert(fs.existsSync(crispComponentPath), 'Crisp component must exist');
    const content = fs.readFileSync(crispComponentPath, 'utf-8');
    assertIncludes(content, 'NEXT_PUBLIC_CRISP_WEBSITE_ID', 'Component must read NEXT_PUBLIC_CRISP_WEBSITE_ID');
  });

  await registry.runTest('F13-04: Graceful fallback when website ID is undefined or empty', async () => {
    assert(fs.existsSync(crispComponentPath), 'Crisp component must exist');
    const content = fs.readFileSync(crispComponentPath, 'utf-8');
    assert(
      content.includes('if (!websiteId') || content.includes('if (!crispWebsiteId') || content.includes('return null') || content.includes('if (!id)'),
      'Component must exit early without error if website ID is not configured'
    );
  });

  await registry.runTest('F13-05: Dynamic script injection wires Crisp chat client SDK', async () => {
    assert(fs.existsSync(crispComponentPath), 'Crisp component must exist');
    const content = fs.readFileSync(crispComponentPath, 'utf-8');
    assert(
      content.includes('$crisp') || content.includes('client.crisp.chat'),
      'Component must configure $crisp global window object or load script from client.crisp.chat'
    );
  });
}

if (process.argv[1]?.endsWith('test_f13_crisp.mjs')) {
  runF13Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
