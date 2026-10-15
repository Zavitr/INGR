/**
 * Tier 1: Feature F18 - Recipe 2: Free Uptime Monitor Flow & Lifecycle
 * Authoritative sources:
 *   - MASTER_PLAN.md (Part 6: Recipe 2: Free Uptime Monitor & Part 2: Core UX Principles)
 *   - SCOPE.md (Phase 4 Milestones)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import createJiti from '../../../web/node_modules/jiti/lib/index.js';
import {
  adminSignIn,
  createAppConnection,
  deleteAppConnection,
  listAppConnections,
} from '../helpers/api_client.mjs';
import {
  assert,
  assertEqual,
  assertNotEqual,
  assertHttpStatus,
  assertIncludes,
  assertNotIncludes,
  assertFileExists,
} from '../helpers/assertions.mjs';
import { CONFIG, WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F18 Recipe Uptime', 'Tier 1', 'F18');

export async function runF18Tests() {
  const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
    alias: { '@': WEB_ROOT },
  });

  process.env.TEST_MODE = 'true';

  const {
    validateMonitorUrl,
    validateNotificationChannel,
    validateUptimeTargets,
    validateSubdomain,
    getUserPlan,
  } = jiti('./lib/recipes/types.ts');

  const { RecipeStore, recipeStore } = jiti('./lib/recipes/store.ts');
  const { uptimeOrchestrator } = jiti('./lib/recipes/uptime-kuma.ts');

  // F18-01: Validates monitor URL scheme and format
  await registry.runTest('F18-01: validateMonitorUrl accepts http/https and rejects invalid urls',
    async () => {
      const valid1 = validateMonitorUrl('https://example.com');
      assertEqual(valid1.valid, true);

      const valid2 = validateMonitorUrl('http://my-site.org/health');
      assertEqual(valid2.valid, true);

      const invalid1 = validateMonitorUrl('ftp://example.com');
      assertEqual(invalid1.valid, false);
      assertIncludes(invalid1.error, 'http:// or https://');

      const invalid2 = validateMonitorUrl('not-a-url');
      assertEqual(invalid2.valid, false);
    }
  );

  // F18-02: Validates notification destinations (email, webhook, discord)
  await registry.runTest('F18-02: validateNotificationChannel validates email and webhook format',
    async () => {
      const emailOk = validateNotificationChannel('email', 'alerts@mycompany.com');
      assertEqual(emailOk.valid, true);

      const emailBad = validateNotificationChannel('email', 'not-an-email');
      assertEqual(emailBad.valid, false);
      assertIncludes(emailBad.error, 'valid email address');

      const hookOk = validateNotificationChannel('webhook', 'https://hooks.slack.com/services/123');
      assertEqual(hookOk.valid, true);

      const hookBad = validateNotificationChannel('webhook', 'http://insecure-hook.com');
      assertEqual(hookBad.valid, false);
      assertIncludes(hookBad.error, 'https://');
    }
  );

  // F18-03: Validates target array bounds (1 to 25)
  await registry.runTest('F18-03: validateUptimeTargets enforces target count limits',
    async () => {
      const empty = validateUptimeTargets([]);
      assertEqual(empty.valid, false);
      assertIncludes(empty.error, 'At least one website');

      const valid = validateUptimeTargets([
        { url: 'https://example.com', name: 'Homepage' },
        { url: 'https://api.example.com/health', name: 'API' },
      ]);
      assertEqual(valid.valid, true);

      const excessive = Array.from({ length: 26 }, (_, i) => ({
        url: `https://site${i}.com`,
        name: `Site ${i}`,
      }));
      const tooMany = validateUptimeTargets(excessive);
      assertEqual(tooMany.valid, false);
      assertIncludes(tooMany.error, 'Maximum 25');
    }
  );

  // F18-04: Orchestrator provisions monitor instance deterministically
  await registry.runTest('F18-04: uptimeOrchestrator provisions deterministic instance & metadata',
    async () => {
      const res = await uptimeOrchestrator.provision('usr_test_18_04', {
        name: 'Production Health',
        subdomain: 'status-corp',
        targets: [{ url: 'https://corp.example.com', name: 'Corp App' }],
        notification: { type: 'email', target: 'ops@corp.example.com' },
      });

      assertEqual(res.success, true);
      assert(res.instanceId.startsWith('kuma_'));
      assertEqual(res.statusPageUrl, 'https://status-corp.status.ingr.app');
      assertEqual(res.metadata.monitorsCount, 1);
      assertEqual(res.metadata.targets[0].url, 'https://corp.example.com');
    }
  );

  // F18-05: Orchestrator updates monitored targets and alerts
  await registry.runTest('F18-05: uptimeOrchestrator updates targets and notification channel',
    async () => {
      const initial = await uptimeOrchestrator.provision('usr_test_18_05', {
        name: 'Staging Monitor',
        subdomain: 'staging-status',
        targets: [{ url: 'https://stage.example.com', name: 'Stage' }],
        notification: { type: 'email', target: 'dev@stage.example.com' },
      });

      const updated = await uptimeOrchestrator.update(
        'usr_test_18_05',
        initial.metadata,
        {
          targets: [
            { url: 'https://stage.example.com', name: 'Stage' },
            { url: 'https://api-stage.example.com', name: 'Stage API' },
          ],
          notification: { type: 'webhook', target: 'https://discord.com/api/webhooks/999' },
        }
      );

      assertEqual(updated.monitorsCount, 2);
      assertEqual(updated.notification.type, 'webhook');
      assertEqual(updated.notification.target, 'https://discord.com/api/webhooks/999');
    }
  );

  // F18-06: Telemetry stats calculation
  await registry.runTest('F18-06: uptimeOrchestrator returns valid telemetry stats',
    async () => {
      const stats = await uptimeOrchestrator.getStats({
        targets: [{ url: 'https://example.com', name: 'App' }],
        uptimePercent: 99.98,
      });

      assertEqual(stats.uptimePercent, 99.98);
      assertEqual(stats.monitors.length, 1);
      assertEqual(stats.monitors[0].status, 'up');
      assert(stats.monitors[0].latencyMs > 0);
    }
  );

  // F18-07: RecipeStore persists uptime recipe records
  await registry.runTest('F18-07: recipeStore creates, retrieves, and lists uptime recipes',
    async () => {
      const store = new RecipeStore();
      const userId = `usr_test_${Date.now()}`;

      const rec = await store.createRecipe({
        userId,
        type: 'uptime',
        name: 'My Service Status',
        subdomain: 'my-service',
        liveUrl: 'https://my-service.status.ingr.app',
        services: ['oracle'],
        metadata: {
          uptimePercent: 100,
          monitorsCount: 1,
        },
      });

      assertEqual(rec.type, 'uptime');
      assertEqual(rec.status, 'deploying');

      const fetched = await store.getRecipeById(userId, rec.id);
      assertEqual(fetched?.name, 'My Service Status');
      assertEqual(fetched?.type, 'uptime');

      const all = await store.listRecipes(userId);
      assertEqual(all.length, 1);
      assertEqual(all[0].id, rec.id);
    }
  );

  // F18-08: Plan limit enforces combined count across hosting + uptime
  await registry.runTest('F18-08: plan limit enforces max 2 active recipes combined across hosting and uptime',
    async () => {
      const store = new RecipeStore();
      const userId = `usr_combined_${Date.now()}`;

      // 1st active recipe (hosting)
      await store.createRecipe({
        userId,
        type: 'hosting',
        name: 'Website 1',
        status: 'active',
        subdomain: 'site1',
      });

      // 2nd active recipe (uptime)
      await store.createRecipe({
        userId,
        type: 'uptime',
        name: 'Uptime 1',
        status: 'active',
        subdomain: 'status1',
      });

      const count = await store.countActive(userId);
      assertEqual(count, 2);

      const plan = getUserPlan({ app_metadata: { plan: 'free' } }, count);
      assertEqual(plan.tier, 'free');
      assertEqual(plan.canActivateMore, false);
    }
  );

  // F18-09: Deactivating uptime recipe frees up quota
  await registry.runTest('F18-09: deactivating uptime recipe sets status to inactive and frees quota',
    async () => {
      const store = new RecipeStore();
      const userId = `usr_deact_${Date.now()}`;

      const rec = await store.createRecipe({
        userId,
        type: 'uptime',
        name: 'Uptime to Pause',
        status: 'active',
        subdomain: 'status-pause',
      });

      const beforeCount = await store.countActive(userId);
      assertEqual(beforeCount, 1);

      const paused = await store.deactivateRecipe(userId, rec.id);
      assertEqual(paused?.status, 'inactive');

      const afterCount = await store.countActive(userId);
      assertEqual(afterCount, 0);
    }
  );

  // F18-10: Frontend components exist and have no jargon
  await registry.runTest('F18-10: uptime wizard and recipe pages exist and adhere to No Jargon policy',
    async () => {
      const wizardPath = path.resolve(WEB_ROOT, 'components/recipes/uptime-wizard.tsx');
      assertFileExists(wizardPath);
      const wizardContent = fs.readFileSync(wizardPath, 'utf8');

      // Verify plain English labels
      assertIncludes(wizardContent, 'Web Address');
      assertIncludes(wizardContent, 'Alert Destinations');
      assertIncludes(wizardContent, 'Step 1: Connect Oracle Cloud Always Free');

      // Ensure no raw developer jargon in UI
      assertNotIncludes(wizardContent, 'Kubernetes');
      assertNotIncludes(wizardContent, 'Prometheus');
      assertNotIncludes(wizardContent, 'gRPC');

      const parityPage = path.resolve(WEB_ROOT, 'app/protected/recipes/uptime/new/page.tsx');
      assertFileExists(parityPage);
    }
  );
}
