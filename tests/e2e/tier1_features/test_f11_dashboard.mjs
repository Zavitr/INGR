/**
 * Tier 1: Feature F11 - Protected Dashboard Shell
 * Authoritative source: ORIGINAL_REQUEST.md (R2), MASTER_PLAN.md (Part 7 Phase 1), PROJECT.md (Feature F11)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F11 Protected Dashboard Shell', 'Tier 1', 'F11');

export async function runF11Tests() {
  const layoutPath = path.join(WEB_ROOT, 'app/protected/layout.tsx');
  const homePath = path.join(WEB_ROOT, 'app/protected/page.tsx');
  const recipesPath = path.join(WEB_ROOT, 'app/protected/recipes/page.tsx');
  const servicesPath = path.join(WEB_ROOT, 'app/protected/services/page.tsx');
  const serviceCardPath = path.join(WEB_ROOT, 'components/services/connect-service-card.tsx');
  const settingsPath = path.join(WEB_ROOT, 'app/protected/settings/page.tsx');

  await registry.runTest('F11-01: Protected layout renders top navbar with all 4 dashboard tabs', async () => {
    assert(fs.existsSync(layoutPath), 'web/app/protected/layout.tsx must exist');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    assertIncludes(content, 'href="/protected"', 'Navbar must link to /protected');
    assertIncludes(content, 'href="/protected/recipes"', 'Navbar must link to /protected/recipes');
    assertIncludes(content, 'href="/protected/services"', 'Navbar must link to /protected/services');
    assertIncludes(content, 'href="/protected/settings"', 'Navbar must link to /protected/settings');
  });

  await registry.runTest('F11-02: Dashboard home renders personalized welcome banner and New Recipe CTA', async () => {
    assert(fs.existsSync(homePath), 'web/app/protected/page.tsx must exist');
    const content = fs.readFileSync(homePath, 'utf-8');
    assertIncludes(content, 'Welcome back', 'Dashboard must render welcome greeting');
    assert(
      content.includes('New Recipe') || content.includes('Create Recipe'),
      'Dashboard must feature a New Recipe button'
    );
  });

  await registry.runTest('F11-03: Recipes section displays empty state card and suggestions', async () => {
    assert(fs.existsSync(recipesPath), 'web/app/protected/recipes/page.tsx must exist');
    const content = fs.readFileSync(recipesPath, 'utf-8');
    assert(
      content.includes('No active recipes') || content.includes('haven\'t turned on any recipes') || content.includes('haven&apos;t turned on any recipes'),
      'Recipes page must show empty state guidance'
    );
  });

  await registry.runTest('F11-04: Connected Services page renders Cline pattern service cards', async () => {
    assert(fs.existsSync(servicesPath), 'web/app/protected/services/page.tsx must exist');
    const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
    assertIncludes(servicesContent, 'supabase', 'Services page must include Supabase card');
    assertIncludes(servicesContent, 'cloudflare', 'Services page must include Cloudflare card');
    assertIncludes(servicesContent, 'openrouter', 'Services page must include OpenRouter card');
    assertIncludes(servicesContent, 'oracle', 'Services page must include Oracle Cloud card');

    const cardContent = fs.existsSync(serviceCardPath) ? fs.readFileSync(serviceCardPath, 'utf-8') : '';
    assert(
      servicesContent.includes('Get a free account') || cardContent.includes('Get a free account'),
      'Must include "Get a free account" Cline-pattern link'
    );
  });

  await registry.runTest('F11-05: Account settings displays plan limits, Pro upgrade, and vault info', async () => {
    assert(fs.existsSync(settingsPath), 'web/app/protected/settings/page.tsx must exist');
    const content = fs.readFileSync(settingsPath, 'utf-8');
    assertIncludes(content, 'Free Plan', 'Settings must show user current plan');
    assert(
      content.includes('$7/mo') || content.includes('Upgrade to Pro'),
      'Settings must offer Pro tier upgrade'
    );
    assertIncludes(content, 'AES-256', 'Settings must explain AES-256 credential encryption');
  });
}

if (process.argv[1]?.endsWith('test_f11_dashboard.mjs')) {
  runF11Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
