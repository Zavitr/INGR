/**
 * Tier 1: Feature F7 - Route Integrity & Link Repair
 * Authoritative source: Survey Findings, PROJECT.md (Feature F7)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes, assertNotIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F7 Route Integrity & Link Repair', 'Tier 1', 'F7');

export async function runF7Tests() {
  const landingPagePath = path.join(WEB_ROOT, 'app/page.tsx');
  const protectedHomePath = path.join(WEB_ROOT, 'app/protected/page.tsx');
  const protectedRecipesPath = path.join(WEB_ROOT, 'app/protected/recipes/page.tsx');
  const protectedSettingsPath = path.join(WEB_ROOT, 'app/protected/settings/page.tsx');

  await registry.runTest('F7-01: Landing page Hero CTAs point to valid auth routes without /sign-in', async () => {
    assert(fs.existsSync(landingPagePath), 'web/app/page.tsx must exist');
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    assertNotIncludes(content, 'href="/sign-in"', 'Landing page must not link to non-existent /sign-in');
    assertIncludes(content, 'href="/auth/sign-up"', 'Hero primary CTA must link to /auth/sign-up');
  });

  await registry.runTest('F7-02: Recipe preview cards link to valid auth routes', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    const recipeSectionMatch = content.match(/id="recipes"[\s\S]*?<\/section>/);
    assert(recipeSectionMatch !== null, 'Recipes section must be present');
    assertNotIncludes(recipeSectionMatch[0], '/sign-in', 'Recipe cards must not link to /sign-in');
    assertIncludes(recipeSectionMatch[0], '/auth/sign-up', 'Recipe cards must link to /auth/sign-up');
  });

  await registry.runTest('F7-03: Pricing and Bottom CTA links point to /auth/sign-up', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    const pricingMatch = content.match(/id="pricing"[\s\S]*?<\/footer>/);
    assert(pricingMatch !== null, 'Pricing and bottom section must exist');
    assertNotIncludes(pricingMatch[0], '/sign-in', 'Pricing buttons must not link to /sign-in');
  });

  await registry.runTest('F7-04: Protected routes redirect unauthenticated users to /auth/login', async () => {
    const files = [protectedHomePath, protectedRecipesPath, protectedSettingsPath];
    for (const file of files) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        assertNotIncludes(content, 'redirect("/sign-in")', `${file} must not redirect to /sign-in`);
        assertIncludes(content, 'redirect("/auth/login")', `${file} must redirect unauthenticated users to /auth/login`);
      }
    }
  });

  await registry.runTest('F7-05: Section anchors #recipes and #pricing match section id elements', async () => {
    const content = fs.readFileSync(landingPagePath, 'utf-8');
    assertIncludes(content, 'id="recipes"', 'Landing page must contain element with id="recipes"');
    assertIncludes(content, 'id="pricing"', 'Landing page must contain element with id="pricing"');
    assertIncludes(content, 'href="#recipes"', 'Navbar must contain anchor link href="#recipes"');
    assertIncludes(content, 'href="#pricing"', 'Navbar must contain anchor link href="#pricing"');
  });
}

if (process.argv[1]?.endsWith('test_f7_routes.mjs')) {
  runF7Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
