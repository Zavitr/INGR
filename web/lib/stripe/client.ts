import Stripe from "stripe";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Dual-mode Stripe Client:
// In hermetic test mode or when STRIPE_SECRET_KEY is absent in local dev,
// provides deterministic in-memory mock billing sessions and portals.
// In production or with STRIPE_SECRET_KEY, connects to live Stripe API.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || "price_pro_monthly_7usd";

export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
    })
  : null;

export interface BillingAccount {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "unpaid" | "trialing";
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory billing account store for test mode & dev fallback
declare global {
  var __ingrBillingAccounts: Map<string, BillingAccount> | undefined;
  var __ingrProcessedStripeEvents: Set<string> | undefined;
}

if (!globalThis.__ingrBillingAccounts) {
  globalThis.__ingrBillingAccounts = new Map<string, BillingAccount>();
}
if (!globalThis.__ingrProcessedStripeEvents) {
  globalThis.__ingrProcessedStripeEvents = new Set<string>();
}

const mockBillingStore = globalThis.__ingrBillingAccounts;
const mockEventStore = globalThis.__ingrProcessedStripeEvents;

export function isMockBilling(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return !STRIPE_SECRET_KEY || process.env.TEST_MODE === "true" || process.env.NODE_ENV === "test";
}

/**
 * Retrieve verified billing account from Supabase or mock store.
 */
export async function getBillingAccount(userId: string): Promise<BillingAccount> {
  // Single-tenant open-source instance owner is always on unlimited pro plan
  if (!userId || userId === "00000000-0000-0000-0000-000000000001") {
    return {
      id: "instance-owner-billing",
      userId: "00000000-0000-0000-0000-000000000001",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      plan: "pro",
      status: "active",
      currentPeriodEnd: null,
      graceEndsAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  if (!isMockBilling()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("billing_accounts")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          userId: data.user_id,
          stripeCustomerId: data.stripe_customer_id,
          stripeSubscriptionId: data.stripe_subscription_id,
          plan: data.plan || "free",
          status: data.status || "active",
          currentPeriodEnd: data.current_period_end,
          graceEndsAt: data.grace_ends_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      console.warn("Failed to query billing_accounts from Supabase, checking mock store:", err);
    }
  }

  // Fallback to in-memory store
  const existing = mockBillingStore.get(userId);
  if (existing) return existing;

  const initial: BillingAccount = {
    id: `ba_${userId.substring(0, 8)}`,
    userId,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    plan: "free",
    status: "active",
    currentPeriodEnd: null,
    graceEndsAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockBillingStore.set(userId, initial);
  return initial;
}

/**
 * Update billing account in Supabase or mock store.
 */
export async function updateBillingAccount(
  userId: string,
  updates: Partial<BillingAccount>
): Promise<BillingAccount> {
  const current = await getBillingAccount(userId);
  const updated: BillingAccount = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (!isMockBilling()) {
    try {
      const supabase = createAdminClient();
      await supabase.from("billing_accounts").upsert({
        user_id: userId,
        stripe_customer_id: updated.stripeCustomerId,
        stripe_subscription_id: updated.stripeSubscriptionId,
        plan: updated.plan,
        status: updated.status,
        current_period_end: updated.currentPeriodEnd,
        grace_ends_at: updated.graceEndsAt,
        updated_at: updated.updatedAt,
      });
    } catch (err) {
      console.warn("Failed to persist billing_account to Supabase:", err);
    }
  }

  mockBillingStore.set(userId, updated);
  return updated;
}

/**
 * Create a Stripe Checkout Session for $7/mo Pro subscription.
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  successUrl = `${NEXT_PUBLIC_SITE_URL}/protected/settings?session_id={CHECKOUT_SESSION_ID}&upgraded=true`,
  cancelUrl = `${NEXT_PUBLIC_SITE_URL}/protected/settings?canceled=true`
): Promise<{ url: string; sessionId: string }> {
  if (isMockBilling() || !stripe) {
    const mockSessionId = `cs_test_${Date.now()}_${userId.substring(0, 6)}`;
    const mockUrl = `${NEXT_PUBLIC_SITE_URL}/protected/settings?session_id=${mockSessionId}&upgraded=true`;
    return { url: mockUrl, sessionId: mockSessionId };
  }

  const account = await getBillingAccount(userId);
  let customerId = account.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
    await updateBillingAccount(userId, { stripeCustomerId: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: STRIPE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url || successUrl, sessionId: session.id };
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 */
export async function createCustomerPortalSession(
  userId: string,
  returnUrl = `${NEXT_PUBLIC_SITE_URL}/protected/settings`
): Promise<{ url: string }> {
  const account = await getBillingAccount(userId);

  if (isMockBilling() || !stripe) {
    return { url: `${returnUrl}?portal=active` };
  }

  if (!account.stripeCustomerId) {
    throw new Error("No billing account found for this user. Please subscribe first.");
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: portalSession.url };
}

/**
 * Verify Webhook Event signature.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string | null
): Stripe.Event {
  if (!STRIPE_WEBHOOK_SECRET) {
    if (isMockBilling()) {
      const parsed = JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8"));
      if (!parsed || typeof parsed !== "object" || !parsed.type) {
        throw new Error("Invalid webhook payload structure");
      }
      if (!parsed.id) {
        parsed.id = `evt_mock_${Date.now()}`;
      }
      return parsed;
    }
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  if (!signature) {
    throw new Error("Missing stripe-signature header.");
  }

  if (!stripe) {
    throw new Error("Stripe client is not initialized.");
  }

  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Check if a webhook event was already processed (Idempotency).
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  if (mockEventStore.has(eventId)) {
    return true;
  }

  if (!isMockBilling()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("stripe_events")
        .select("id")
        .eq("id", eventId)
        .single();
      if (data) return true;
    } catch {
      // Fallback
    }
  }

  return false;
}

/**
 * Mark a webhook event as processed.
 */
export async function markEventProcessed(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  mockEventStore.add(eventId);

  if (!isMockBilling()) {
    try {
      const supabase = createAdminClient();
      await supabase.from("stripe_events").insert({
        id: eventId,
        event_type: eventType,
        payload,
      });
    } catch (err) {
      console.warn("Failed to persist stripe_event:", err);
    }
  }
}
