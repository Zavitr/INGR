/**
 * Tier 1: Feature F19 - Billing Integration, Plan Enforcement & Security Hardening
 * Authoritative sources:
 *   - MASTER_PLAN.md (Part 8: Phase 5: Billing & Limits)
 *   - SCOPE.md (Phase 5 Milestones)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import createJiti from '../../../web/node_modules/jiti/lib/index.js';
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

registry.setSuite('Tier 1 - F19 Billing & Security', 'Tier 1', 'F19');

export async function runF19Tests() {
  const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
    alias: { '@': WEB_ROOT },
  });

  process.env.TEST_MODE = 'true';

  const { getUserPlan } = jiti('./lib/recipes/types.ts');
  const { RecipeStore, recipeStore } = jiti('./lib/recipes/store.ts');
  const {
    getBillingAccount,
    updateBillingAccount,
    createCheckoutSession,
    createCustomerPortalSession,
    isEventProcessed,
    markEventProcessed,
  } = jiti('./lib/stripe/client.ts');

  const testUserId = `usr_billing_${crypto.randomBytes(4).toString('hex')}`;

  // F19-01: Plan tier resolution and privilege escalation prevention
  await registry.runTest('F19-01: Plan tier resolution rejects client-supplied user_metadata and defaults to Free',
    async () => {
      // User with malicious client-controlled user_metadata
      const maliciousUser = {
        id: testUserId,
        user_metadata: { plan: 'pro', role: 'admin' },
      };

      const plan = getUserPlan(maliciousUser, 0);
      assertEqual(plan.tier, 'free', 'Malicious user_metadata must not grant Pro tier');
      assertEqual(plan.maxActiveRecipes, 2);
      assertEqual(plan.maxConnectedServices, 3);
      assertEqual(plan.canActivateMore, true);
    }
  );

  // F19-02: Verified server billing account updates to Pro
  await registry.runTest('F19-02: Verified server billing account grants Pro with unlimited recipes and services',
    async () => {
      await updateBillingAccount(testUserId, {
        plan: 'pro',
        status: 'active',
      });

      const account = await getBillingAccount(testUserId);
      assertEqual(account.plan, 'pro');

      const plan = getUserPlan({ id: testUserId }, 5, account.plan);
      assertEqual(plan.tier, 'pro');
      assertEqual(plan.maxActiveRecipes, Infinity);
      assertEqual(plan.maxConnectedServices, Infinity);
      assertEqual(plan.canActivateMore, true);
    }
  );

  // F19-03: Dual-mode Stripe Checkout session generation
  await registry.runTest('F19-03: Checkout session generation provides deterministic checkout URL and session ID',
    async () => {
      const checkout = await createCheckoutSession(testUserId, 'billing_test@example.com');
      assert(checkout.url.length > 0, 'Checkout URL should not be empty');
      assertIncludes(checkout.url, 'session_id=');
      assertIncludes(checkout.sessionId, 'cs_test_');
    }
  );

  // F19-04: Customer Portal session generation
  await registry.runTest('F19-04: Customer Portal session generation provides management URL',
    async () => {
      const portal = await createCustomerPortalSession(testUserId);
      assert(portal.url.length > 0, 'Portal URL should not be empty');
      assertIncludes(portal.url, '/protected/settings');
    }
  );

  // F19-05: Webhook Idempotency deduplication
  await registry.runTest('F19-05: Stripe webhook event idempotency deduplicates replay attacks',
    async () => {
      const eventId = `evt_test_${crypto.randomBytes(6).toString('hex')}`;
      const firstCheck = await isEventProcessed(eventId);
      assertEqual(firstCheck, false, 'Event should not be processed yet');

      await markEventProcessed(eventId, 'checkout.session.completed', { id: eventId });
      const secondCheck = await isEventProcessed(eventId);
      assertEqual(secondCheck, true, 'Event should be recorded as processed');
    }
  );

  // F19-06: 14-day grace period for past_due subscriptions
  await registry.runTest('F19-06: Past-due subscription enters 14-day grace period with active privileges',
    async () => {
      const graceEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await updateBillingAccount(testUserId, {
        status: 'past_due',
        graceEndsAt: graceEnd,
      });

      const plan = getUserPlan({ id: testUserId }, 1, 'pro', graceEnd);
      assertEqual(plan.isGracePeriod, true, 'User should be marked in grace period');
      assertEqual(plan.tier, 'pro', 'Privileges remain active during grace period');
    }
  );

  // F19-07: Recipe preservation and pause policy upon cancellation (no deletion)
  await registry.runTest('F19-07: Cancellation reverts to Free and pauses excess recipes indefinitely without deletion',
    async () => {
      const cancelUserId = `usr_cancel_${crypto.randomBytes(4).toString('hex')}`;
      const store = new RecipeStore();

      // Create 3 recipes under Pro
      const r1 = await store.createRecipe({
        userId: cancelUserId,
        subdomain: `site-1-${Date.now()}`,
        name: 'Site 1',
        status: 'active',
      });
      const r2 = await store.createRecipe({
        userId: cancelUserId,
        subdomain: `site-2-${Date.now()}`,
        name: 'Site 2',
        status: 'active',
      });
      const r3 = await store.createRecipe({
        userId: cancelUserId,
        subdomain: `site-3-${Date.now()}`,
        name: 'Site 3',
        status: 'active',
      });

      let allRecipes = await store.listRecipes(cancelUserId);
      assertEqual(allRecipes.length, 3, 'User should have 3 recipes');

      // Emulate cancellation logic from webhook route
      await updateBillingAccount(cancelUserId, {
        plan: 'free',
        status: 'canceled',
        graceEndsAt: null,
      });

      const activeRecipes = (await store.listRecipes(cancelUserId)).filter(
        (r) => r.status === 'active' || r.status === 'deploying'
      );
      if (activeRecipes.length > 2) {
        const excess = activeRecipes.slice(2);
        for (const r of excess) {
          await store.updateRecipe(cancelUserId, r.id, { status: 'inactive' });
        }
      }

      // Check user recipes again: total still 3 (never deleted!), active count is 2
      allRecipes = await store.listRecipes(cancelUserId);
      assertEqual(allRecipes.length, 3, 'Zero data deletion: All recipes preserved');
      const activeCount = await store.countActive(cancelUserId);
      assertEqual(activeCount, 2, 'Excess recipe correctly paused to inactive');
    }
  );

  // F19-08: Public vs Private template toggle functionality (n8n-style)
  await registry.runTest('F19-08: Public template recipes are discoverable across users while private remain isolated',
    async () => {
      const userA = `usr_a_${crypto.randomBytes(4).toString('hex')}`;
      const userB = `usr_b_${crypto.randomBytes(4).toString('hex')}`;
      const store = new RecipeStore();

      // User A creates 1 private recipe and 1 public template
      const privRecipe = await store.createRecipe({
        userId: userA,
        subdomain: `priv-site-${Date.now()}`,
        name: 'Private Recipe',
        isPublic: false,
      });

      const pubRecipe = await store.createRecipe({
        userId: userA,
        subdomain: `pub-site-${Date.now()}`,
        name: 'Public Community Template',
        isPublic: true,
      });

      // User B lists recipes: only their own (0)
      const userBRecipes = await store.listRecipes(userB);
      assertEqual(userBRecipes.length, 0, 'User B private view isolated from User A');

      // Query public recipes: public template is present, private recipe is absent
      const publicRecipes = await store.listPublicRecipes();
      const hasPub = publicRecipes.some((r) => r.id === pubRecipe.id);
      const hasPriv = publicRecipes.some((r) => r.id === privRecipe.id);

      assertEqual(hasPub, true, 'Public template should be discoverable in community templates');
      assertEqual(hasPriv, false, 'Private recipe must never be listed in public templates');
    }
  );
}
