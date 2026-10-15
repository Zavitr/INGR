/**
 * Tier 1: Feature F14 - Responsive Styling & Layout
 * Authoritative source: ORIGINAL_REQUEST.md (R2), MASTER_PLAN.md (Part 3 Tech Stack, Part 7 Phase 1), PROJECT.md (Feature F14)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F14 Responsive Styling & Layout', 'Tier 1', 'F14');

export async function runF14Tests() {
  const tailwindConfigPath = path.join(WEB_ROOT, 'tailwind.config.ts');
  const globalCssPath = path.join(WEB_ROOT, 'app/globals.css');
  const landingPagePath = path.join(WEB_ROOT, 'app/page.tsx');
  const servicesPagePath = path.join(WEB_ROOT, 'app/protected/services/page.tsx');
  const buttonUiPath = path.join(WEB_ROOT, 'components/ui/button.tsx');
  const inputUiPath = path.join(WEB_ROOT, 'components/ui/input.tsx');

  await registry.runTest('F14-01: Tailwind CSS is configured with theme tokens and utility classes', async () => {
    assert(fs.existsSync(tailwindConfigPath), 'tailwind.config.ts must exist');
    assert(fs.existsSync(globalCssPath), 'globals.css must exist');
    const cssContent = fs.readFileSync(globalCssPath, 'utf-8');
    assertIncludes(cssContent, '@tailwind base', 'globals.css must import Tailwind base');
    assertIncludes(cssContent, '@tailwind utilities', 'globals.css must import Tailwind utilities');
  });

  await registry.runTest('F14-02: Responsive grid layouts adapt between mobile and desktop viewports', async () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf-8');
    const servicesContent = fs.readFileSync(servicesPagePath, 'utf-8');
    assert(
      landingContent.includes('grid-cols-1') && landingContent.includes('md:grid-cols-'),
      'Landing page must use responsive grid columns'
    );
    assert(
      servicesContent.includes('grid-cols-1') && servicesContent.includes('md:grid-cols-'),
      'Services page must use responsive grid columns'
    );
  });

  await registry.runTest('F14-03: Navigation bars provide responsive layout rules', async () => {
    const layoutPath = path.join(WEB_ROOT, 'app/protected/layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    assert(
      content.includes('flex') && (content.includes('md:flex') || content.includes('justify-between')),
      'Protected layout navbar must provide responsive flex layout'
    );
  });

  await registry.runTest('F14-04: Button and input touch targets adhere to accessible sizing standards', async () => {
    assert(fs.existsSync(buttonUiPath), 'components/ui/button.tsx must exist');
    assert(fs.existsSync(inputUiPath), 'components/ui/input.tsx must exist');
    const btnContent = fs.readFileSync(buttonUiPath, 'utf-8');
    const inputContent = fs.readFileSync(inputUiPath, 'utf-8');

    assert(
      btnContent.includes('rounded-md') && (btnContent.includes('h-9') || btnContent.includes('h-10')),
      'Button component must define accessible height and border radius'
    );
    assert(
      inputContent.includes('rounded-md') && (inputContent.includes('h-9') || inputContent.includes('h-10')),
      'Input component must define accessible height and border radius'
    );
  });

  await registry.runTest('F14-05: ThemeSwitcher is wired into footer for dark/light appearance', async () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf-8');
    assertIncludes(landingContent, '<ThemeSwitcher', 'Landing page footer must include ThemeSwitcher');
  });
}

if (process.argv[1]?.endsWith('test_f14_styling.mjs')) {
  runF14Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
