/**
 * Tier 1: Feature F12 - Recipe Creation Route
 * Authoritative source: Survey Findings, PROJECT.md (Feature F12), MASTER_PLAN.md (Part 2 Principle 3)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F12 Recipe Creation Route', 'Tier 1', 'F12');

export async function runF12Tests() {
  const newRecipePath = path.join(WEB_ROOT, 'app/protected/recipes/new/page.tsx');
  const recipesHomePath = path.join(WEB_ROOT, 'app/protected/recipes/page.tsx');
  const dashboardHomePath = path.join(WEB_ROOT, 'app/protected/page.tsx');

  await registry.runTest('F12-01: Recipe creation route page file exists at /protected/recipes/new', async () => {
    assert(fs.existsSync(newRecipePath), 'web/app/protected/recipes/new/page.tsx must exist');
  });

  await registry.runTest('F12-02: Recipe creation page presents pre-built recipe templates', async () => {
    assert(fs.existsSync(newRecipePath), 'Route page must exist');
    const content = fs.readFileSync(newRecipePath, 'utf-8');
    assert(
      content.includes('Website Hosting') || content.includes('Hosting'),
      'Must offer Website Hosting template'
    );
    assert(
      content.includes('Uptime') || content.includes('Monitor'),
      'Must offer Uptime Monitor template'
    );
  });

  await registry.runTest('F12-03: Recipe creation implements guided wizard rather than blank canvas', async () => {
    assert(fs.existsSync(newRecipePath), 'Route page must exist');
    const content = fs.readFileSync(newRecipePath, 'utf-8');
    assert(
      content.includes('Step') || content.includes('wizard') || content.includes('Select') || content.includes('Choose'),
      'Page must guide user through steps'
    );
  });

  await registry.runTest('F12-04: Recipe creation page provides navigation back to recipes list', async () => {
    assert(fs.existsSync(newRecipePath), 'Route page must exist');
    const content = fs.readFileSync(newRecipePath, 'utf-8');
    assertIncludes(content, 'href="/protected/recipes"', 'Must link back to /protected/recipes');
  });

  await registry.runTest('F12-05: Dashboard and recipes empty states link to /protected/recipes/new', async () => {
    const dashContent = fs.readFileSync(dashboardHomePath, 'utf-8');
    const recipesContent = fs.readFileSync(recipesHomePath, 'utf-8');
    assertIncludes(dashContent, '/protected/recipes/new', 'Dashboard New Recipe CTA must target /protected/recipes/new');
    assertIncludes(recipesContent, '/protected/recipes/new', 'Recipes page New Recipe CTA must target /protected/recipes/new');
  });
}

if (process.argv[1]?.endsWith('test_f12_recipes.mjs')) {
  runF12Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
