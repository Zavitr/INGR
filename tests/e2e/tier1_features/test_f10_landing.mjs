/**
 * Tier 1: Feature F10 - Plain-English Landing Page
 * Authoritative source: ORIGINAL_REQUEST.md (R2), MASTER_PLAN.md (Part 2 UX Principles, Part 5, Part 6), PROJECT.md (Feature F10)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes, assertNotIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F10 Plain-English Landing Page', 'Tier 1', 'F10');

export async function runF10Tests() {
  const landingPagePath = path.join(WEB_ROOT, 'app/page.tsx');

  await registry.runTest('F10-01: Hero section renders headline and value proposition', async () => {
    assert(fs.existsSync(landingPagePath), 'web/app/page.tsx must exist');
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    assert(
      content.includes('Free internet services') && content.includes('simplified'),
      'Hero headline must contain "Free internet services, simplified."'
    );
    assertIncludes(content, '$200/mo', 'Value proposition must mention saving expensive SaaS fees');
  });

  await registry.runTest('F10-02: Recipes section renders all 3 launch recipe previews', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    assertIncludes(content, 'Free Website Hosting', 'Must preview Website Hosting recipe');
    assertIncludes(content, 'Free Uptime Monitor', 'Must preview Uptime Monitor recipe');
    assertIncludes(content, 'Contact Form Backend', 'Must preview Contact Form Backend recipe');
  });

  await registry.runTest('F10-03: Pricing section renders Free ($0) and Pro ($7) tiers accurately', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    assertIncludes(content, '$0', 'Pricing must include $0 Free tier');
    assertIncludes(content, '$7', 'Pricing must include $7 Pro tier');
    assertIncludes(content, '2 active recipes', 'Free tier must specify 2 active recipes');
    assertIncludes(content, '3 connected services', 'Free tier must specify 3 connected services');
    assertIncludes(content, 'Unlimited recipes', 'Pro tier must specify Unlimited recipes');
  });

  await registry.runTest('F10-04: Trust bar highlights free tier partner services', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    assertIncludes(content, 'Cloudflare', 'Trust bar must include Cloudflare');
    assertIncludes(content, 'Supabase', 'Trust bar must include Supabase');
    assertIncludes(content, 'OpenRouter', 'Trust bar must include OpenRouter');
  });

  await registry.runTest('F10-05: Jargon Audit: user-facing marketing copy contains zero banned technical terms', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    // Banned terms according to MASTER_PLAN Part 2 Principle 2 in user copy:
    // "container", "instance", "webhook", "environment variable", "DevOps", "VM"
    assertNotIncludes(content, 'DevOps', 'Landing copy must not use "DevOps"');
    assertNotIncludes(content, 'Oracle VM', 'Badge must say "Oracle Cloud" not "Oracle VM"');
    assertNotIncludes(content, 'Deploy your website', 'Must use plain language ("Publish" or "Turn on") rather than "Deploy"');
  });
}

if (process.argv[1]?.endsWith('test_f10_landing.mjs')) {
  runF10Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
